/**
 * Application service store for the Dashboard & Analytics bounded context.
 * Coordinates sales and report use cases. KPIs are computed live from the
 * Product and Sales bounded contexts' own stores (see liveMetrics below)
 * instead of a static pre-seeded snapshot — that snapshot never changed as
 * real products/inventory/sales did, so every KPI reading it (total
 * products, inventory value, total sales, stock health) was stale by
 * construction. Alerts are likewise sourced directly from the Alerts
 * bounded context's own store (see alerts.store.js's evaluateLiveAlerts).
 *
 * @module useDashboardStore
 */
import { defineStore }  from 'pinia';
import { computed, ref } from 'vue';
import { DashboardApi }     from '../infrastructure/dashboard.api.js';
import { Report, ReportType } from '../domain/model/report.entity.js';
import { ReportFilters }      from '../domain/model/report-filters.entity.js';
import useProductStore        from '../../product/application/product.store.js';
import useSalesStore          from '../../sales/application/sales.store.js';

const dashboardApi = new DashboardApi();

/**
 * Reactive store that exposes Dashboard & Analytics commands and queries.
 * @returns {Object} Store state and actions.
 */
const useDashboardStore = defineStore('dashboard', () => {

    /**
     * Aggregated sales per weekday for the last 7 days.
     * Each entry: { dayIndex, totalAmount, barHeightPercent }. dayIndex is
     * 0=Monday..6=Sunday; the presentation layer translates it to a label
     * via i18n so the domain/application layer stays locale-agnostic.
     * @type {import('vue').Ref<Array>}
     */
    const salesByDay = ref([]);

    /** @type {import('vue').Ref<Array>} */
    const reports = ref([]);

    /** @type {import('vue').Ref<boolean>} */
    const reportsLoaded = ref(false);

    /** @type {import('vue').Ref<Error[]>} */
    const errors = ref([]);

    /** @type {import('vue').ComputedRef<number>} */
    const reportsCount = computed(() => reports.value.length);

    /**
     * Live business metrics, computed on demand from the Product and Sales
     * bounded contexts' own (already-loaded) state — same shape the old
     * static /metrics snapshot had, so kpiCards and exportReport didn't need
     * to change how they consume it, only where it comes from.
     *
     * Business rules (mirrors MetricsSnapshot's former getters):
     * - lowStockProducts counts InventoryItem.isLowStock (>0 and <= minimum),
     *   matching Inventario's own "Stock bajo" definition exactly.
     * - inventoryValue = Σ currentStock × basePrice across all products.
     * - totalSales/salesCount come straight from sales.store.js's own
     *   totalRevenue/paidSalesCount, so this always agrees with what POS shows.
     * - stockHealthPercentage: proportion of products NOT low-stock (100% when
     *   there are no products at all — vacuously healthy).
     * @type {import('vue').ComputedRef<Object>}
     */
    const liveMetrics = computed(() => {
        const productStore = useProductStore();
        const salesStore   = useSalesStore();

        const totalProducts    = productStore.products.length;
        const lowStockProducts = productStore.inventory.filter(item => item.isLowStock).length;
        const inventoryValue   = productStore.inventory.reduce((sum, item) => {
            const product = productStore.getProductById(item.productId);
            return sum + item.currentStock * (product?.basePrice ?? 0);
        }, 0);
        const totalSales = salesStore.totalRevenue;
        const salesCount = salesStore.paidSalesCount;

        return {
            totalProducts,
            lowStockProducts,
            inventoryValue: Math.round(inventoryValue * 100) / 100,
            totalSales,
            salesCount,
            averageSaleValue: salesCount === 0 ? 0 : Math.round((totalSales / salesCount) * 100) / 100,
            stockHealthPercentage: totalProducts === 0
                ? 100
                : Math.round(((totalProducts - lowStockProducts) / totalProducts) * 100),
            generatedAt: new Date().toISOString()
        };
    });

    // ─── Queries ──────────────────────────────────────────────────────────────

    /**
     * Finds a report entity by its identifier.
     * @param {number|string} id
     * @returns {Report|undefined}
     */
    function getReportById(id) {
        return reports.value.find(report => report.id === parseInt(id));
    }

    /**
     * Filters the in-memory report list by type.
     * Returns all reports when type is null or undefined.
     * @param {string|null} type
     * @returns {Report[]}
     */
    function filterReportsByType(type) {
        if (!type) return reports.value;
        return reports.value.filter(report => report.type === type);
    }

    // ─── Commands ─────────────────────────────────────────────────────────────

    /**
     * Re-fetches the real product, inventory and sales data liveMetrics is
     * computed from, so the "refresh" button picks up anything that changed
     * on the server since this session last loaded it (e.g. edited directly
     * in the mock, or from another tab) instead of just touching a timestamp.
     * @param {number|string} businessId
     */
    function refreshMetrics(businessId) {
        const productStore = useProductStore();
        const salesStore   = useSalesStore();
        productStore.fetchProducts(businessId);
        productStore.fetchInventory(businessId);
        salesStore.fetchSales(businessId);
    }

    /**
     * Fetches sales and sale details for a business, then computes salesByDay
     * — PAID sales aggregated by weekday for the last 7 calendar days.
     *
     * Business rules:
     * - Only sales with status === 'PAID' contribute to revenue totals.
     * - Revenue per sale detail = quantity × unitPrice × (1 - discount), discount
     *   being a decimal fraction (0–1), matching SaleDetail.lineTotal.
     * - barHeightPercent is scaled so the day with maximum revenue = 100%.
     * - Days with no PAID sales render with totalAmount = 0 and barHeightPercent = 0.
     *
     * @param {number|string} businessId
     */
    function fetchSalesByDay(businessId) {
        dashboardApi.getSales(businessId)
            .then(salesResponse => {
                const allSales = salesResponse.data instanceof Array ? salesResponse.data : [];

                // Filter to PAID sales belonging to this business
                const paidSales = allSales.filter(sale => sale.status === 'PAID');

                // Fetch line items one sale at a time (scoped by saleId) so no
                // other business's sale-detail rows are ever requested.
                const detailPromises = paidSales.map(sale =>
                    dashboardApi.getSaleDetailsBySale(sale.id)
                        .then(response => response.data instanceof Array ? response.data : [])
                );

                return Promise.all(detailPromises).then(detailArrays => ({
                    paidSales,
                    allDetails: detailArrays.flat()
                }));
            })
            .then(({ paidSales, allDetails }) => {
                // ── salesByDay computation ──────────────────────────────────
                // Build a map of the last 7 calendar days: key = 'YYYY-MM-DD', value = { dayIndex, totalAmount }
                const today = new Date();
                const dayMap = new Map();

                for (let offset = 6; offset >= 0; offset--) {
                    const date = new Date(today);
                    date.setDate(today.getDate() - offset);
                    const dateKey = date.toISOString().slice(0, 10);

                    // getDay() returns 0=Sunday...6=Saturday; remap to 0=Monday
                    const jsDay        = date.getDay();
                    const mondayIndex  = (jsDay + 6) % 7;

                    dayMap.set(dateKey, { dayIndex: mondayIndex, totalAmount: 0 });
                }

                // Accumulate PAID sale totals per day
                paidSales.forEach(sale => {
                    const saleDateKey = sale.date.slice(0, 10);
                    if (!dayMap.has(saleDateKey)) return;

                    const saleLineDetails = allDetails.filter(detail => detail.saleId === sale.id);
                    const saleTotal = saleLineDetails.reduce((accumulator, detail) => {
                        const lineRevenue = detail.quantity * detail.unitPrice * (1 - (detail.discount ?? 0));
                        return accumulator + lineRevenue;
                    }, 0);

                    const existing = dayMap.get(saleDateKey);
                    dayMap.set(saleDateKey, {
                        ...existing,
                        totalAmount: Math.round((existing.totalAmount + saleTotal) * 100) / 100
                    });
                });

                const dayEntries = Array.from(dayMap.values());

                // Scale bars proportionally to the maximum day
                const maxAmount = Math.max(...dayEntries.map(entry => entry.totalAmount));
                salesByDay.value = dayEntries.map(entry => ({
                    ...entry,
                    barHeightPercent: maxAmount > 0
                        ? Math.round((entry.totalAmount / maxAmount) * 100)
                        : 0
                }));
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Generates a new Report entity locally and appends it to the in-memory list.
     * Business rule: rejected when ReportFilters has an invalid date range.
     * @param {Object} resource
     */
    function generateReport(resource) {
        const filters = new ReportFilters(resource.filters ?? {});
        if (!filters.isDateRangeValid()) {
            errors.value.push(new Error('Invalid date range: startDate must not be after endDate.'));
            return;
        }
        reports.value.push(new Report({
            id:          reports.value.length + 1,
            businessId:  resource.businessId,
            type:        resource.type,
            filters:     filters,
            generatedAt: new Date().toISOString()
        }));
        reportsLoaded.value = true;
    }

    /**
     * Exports the latest report as a CSV download using the current live metrics.
     * Business rule: aborts with an error when the report itself isn't loaded.
     *
     * Row labels are supplied by the caller (already translated) so this
     * application-layer function stays locale-agnostic — same DDD principle
     * already applied when Report.typeLabel was moved out of the domain entity.
     *
     * @param {number|string} reportId
     * @param {Object} [labels] - Translated CSV row labels; English fallback
     *   is used for any key the caller omits.
     */
    function exportReport(reportId, labels = {}) {
        const report = getReportById(reportId);
        if (!report) {
            errors.value.push(new Error(`Report with id ${reportId} not found.`));
            return;
        }
        const snapshot = liveMetrics.value;
        const L = {
            header:            'Metric,Value',
            totalProducts:     'Total Products',
            lowStockProducts:  'Low Stock Products',
            inventoryValue:    'Inventory Value (PEN)',
            totalSales:        'Total Sales (PEN)',
            salesCount:        'Sales Count',
            averageSaleValue:  'Average Sale Value (PEN)',
            stockHealth:       'Stock Health (%)',
            generatedAt:       'Generated At',
            ...labels
        };
        const csvRows = [
            L.header,
            `${L.totalProducts},${snapshot.totalProducts}`,
            `${L.lowStockProducts},${snapshot.lowStockProducts}`,
            `${L.inventoryValue},${snapshot.inventoryValue}`,
            `${L.totalSales},${snapshot.totalSales}`,
            `${L.salesCount},${snapshot.salesCount}`,
            `${L.averageSaleValue},${snapshot.averageSaleValue}`,
            `${L.stockHealth},${snapshot.stockHealthPercentage}`,
            `${L.generatedAt},${snapshot.generatedAt}`
        ];
        const blob         = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const downloadUrl  = URL.createObjectURL(blob);
        const anchorElement = document.createElement('a');
        anchorElement.href     = downloadUrl;
        anchorElement.download = `report-${report.type.toLowerCase()}-${report.id}.csv`;
        anchorElement.click();
        URL.revokeObjectURL(downloadUrl);
    }

    return {
        liveMetrics,
        salesByDay,
        reports,
        reportsLoaded,
        errors,
        reportsCount,
        getReportById,
        filterReportsByType,
        refreshMetrics,
        fetchSalesByDay,
        generateReport,
        exportReport
    };
});

export default useDashboardStore;