/**
 * Application service store for the Dashboard & Analytics bounded context.
 * Coordinates sales and report use cases. KPIs are computed live from the
 * Product and Sales bounded contexts' own stores (see liveMetrics below)
 * instead of a static pre-seeded snapshot — that snapshot never changed as
 * real products/inventory/sales did, so every KPI reading it (total
 * products, inventory value, total sales, stock health) was stale by
 * construction. Alerts are likewise sourced directly from the Alerts
 * bounded context's own store (see alerts.store.js's fetchAlerts), which the
 * real backend now persists and evaluates entirely server-side.
 *
 * @module useDashboardStore
 */
import { defineStore }  from 'pinia';
import { computed, ref } from 'vue';
import { DashboardApi }     from '../infrastructure/dashboard.api.js';
import { Report, ReportType } from '../domain/model/report.entity.js';
import { ReportFilters }      from '../domain/model/report-filters.entity.js';
import useProductStore, { parseLocalDate } from '../../product/application/product.store.js';
import useSalesStore          from '../../sales/application/sales.store.js';

const dashboardApi = new DashboardApi();

/**
 * Current-state product/inventory figures — never date-scoped, since this
 * mock has no historical inventory snapshots to report "as of" a past date;
 * these always reflect right-now, regardless of any report date range.
 * @returns {{totalProducts: number, lowStockProducts: number, inventoryValue: number, stockHealthPercentage: number}}
 */
function currentStockMetrics() {
    const productStore = useProductStore();

    const totalProducts    = productStore.products.length;
    const lowStockProducts = productStore.inventory.filter(item => item.isLowStock).length;
    const inventoryValue   = productStore.inventory.reduce((sum, item) => {
        const product = productStore.getProductById(item.productId);
        return sum + item.currentStock * (product?.basePrice ?? 0);
    }, 0);

    return {
        totalProducts,
        lowStockProducts,
        inventoryValue: Math.round(inventoryValue * 100) / 100,
        stockHealthPercentage: totalProducts === 0
            ? 100
            : Math.round(((totalProducts - lowStockProducts) / totalProducts) * 100)
    };
}

/**
 * Sales-derived figures for PAID sales whose date falls within
 * [startDate, endDate] (inclusive, local dates) — or all-time when either
 * bound is omitted, which is what the Panel's own KPI cards want.
 * @param {string} [startDate] - 'yyyy-mm-dd', inclusive.
 * @param {string} [endDate]   - 'yyyy-mm-dd', inclusive.
 * @returns {{totalSales: number, salesCount: number, averageSaleValue: number}}
 */
function salesMetricsInRange(startDate, endDate) {
    const salesStore = useSalesStore();

    const rangeStart = startDate ? parseLocalDate(startDate) : null;
    const rangeEnd   = endDate   ? parseLocalDate(endDate)   : null;
    if (rangeEnd) rangeEnd.setHours(23, 59, 59, 999); // inclusive through end of that day

    const scopedSales = salesStore.sales.filter(sale => {
        if (sale.status !== 'PAID') return false;
        const saleDate = new Date(sale.date);
        if (rangeStart && saleDate < rangeStart) return false;
        if (rangeEnd && saleDate > rangeEnd) return false;
        return true;
    });

    const totalSales = Math.round(scopedSales.reduce((sum, sale) => sum + sale.subtotal, 0) * 100) / 100;
    const salesCount = scopedSales.length;

    return {
        totalSales,
        salesCount,
        averageSaleValue: salesCount === 0 ? 0 : Math.round((totalSales / salesCount) * 100) / 100
    };
}

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
     * Live, all-time business metrics for the Panel's own KPI cards — same
     * shape the old static /metrics snapshot had, so kpiCards didn't need to
     * change how it's consumed, only where it comes from.
     * Reports need figures scoped to a specific date range instead — see
     * computeMetricsForFilters below, which this intentionally does NOT feed
     * (the Panel's "Ventas totales" is meant to be cumulative, matching
     * POS's own "Total acumulado").
     * @type {import('vue').ComputedRef<Object>}
     */
    const liveMetrics = computed(() => ({
        ...currentStockMetrics(),
        ...salesMetricsInRange(),
        generatedAt: new Date().toISOString()
    }));

    /**
     * Business metrics scoped to a report's own filters — unlike liveMetrics,
     * totalSales/salesCount/averageSaleValue here only include PAID sales
     * whose date falls within filters.startDate–endDate (inclusive). This is
     * what report-result.vue and exportReport must use instead of liveMetrics,
     * otherwise a report for "last week" would silently show all-time sales
     * totals — exactly what generated wrong CSV exports before this fix.
     * @param {import('../domain/model/report-filters.entity.js').ReportFilters} filters
     * @returns {Object}
     */
    function computeMetricsForFilters(filters) {
        return {
            ...currentStockMetrics(),
            ...salesMetricsInRange(filters?.startDate, filters?.endDate),
            generatedAt: new Date().toISOString()
        };
    }

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
     * Exports a report as a CSV download, using metrics scoped to that
     * report's own date range (see computeMetricsForFilters) — NOT the
     * Panel's all-time liveMetrics, which would ignore the filters entirely.
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
        const snapshot = computeMetricsForFilters(report.filters);
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
        computeMetricsForFilters,
        exportReport
    };
});

export default useDashboardStore;