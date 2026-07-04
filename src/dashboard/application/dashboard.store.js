/**
 * Application service store for the Dashboard & Analytics bounded context.
 * Coordinates metrics, sales and report use cases. Alerts are sourced
 * directly from the Alerts bounded context's own store (see alerts.store.js's
 * evaluateLiveAlerts), not duplicated here, so the Panel's recent-alerts
 * widget can never drift out of sync with the Alertas screen.
 *
 * @module useDashboardStore
 */
import { defineStore }  from 'pinia';
import { computed, ref } from 'vue';
import { DashboardApi }     from '../infrastructure/dashboard.api.js';
import { MetricsAssembler } from '../infrastructure/metrics-snapshot.assembler.js';
import { Report, ReportType } from '../domain/model/report.entity.js';
import { ReportFilters }      from '../domain/model/report-filters.entity.js';

const dashboardApi = new DashboardApi();

/**
 * Reactive store that exposes Dashboard & Analytics commands and queries.
 * @returns {Object} Store state and actions.
 */
const useDashboardStore = defineStore('dashboard', () => {

    /** @type {import('vue').Ref<import('../domain/model/metrics-snapshot.entity.js').MetricsSnapshot|null>} */
    const metrics = ref(null);

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
    const metricsLoaded = ref(false);

    /** @type {import('vue').Ref<boolean>} */
    const reportsLoaded = ref(false);

    /** @type {import('vue').Ref<Error[]>} */
    const errors = ref([]);

    /** @type {import('vue').ComputedRef<number>} */
    const reportsCount = computed(() => reports.value.length);

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
     * Fetches and stores the metrics snapshot for a business.
     * @param {number|string} businessId
     */
    function fetchDashboardMetrics(businessId) {
        dashboardApi.getDashboardMetrics(businessId)
            .then(response => {
                const snapshots = MetricsAssembler.toEntitiesFromResponse(response);
                metrics.value       = snapshots.length > 0 ? snapshots[0] : null;
                metricsLoaded.value = true;
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Simulates a metrics refresh by updating the generatedAt timestamp via PUT.
     * Business rule: only operates when a snapshot is already loaded.
     */
    function refreshMetrics() {
        if (!metrics.value) return;
        dashboardApi.updateMetrics({ ...metrics.value, generatedAt: new Date().toISOString() })
            .then(response => {
                metrics.value = MetricsAssembler.toEntityFromResource(response.data);
            })
            .catch(error => errors.value.push(error));
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
     * Exports the latest report as a CSV download using the current metrics snapshot.
     * Business rule: aborts with an error when metrics or the report are not loaded.
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
        if (!metrics.value) {
            errors.value.push(new Error('Cannot export report: no metrics snapshot is loaded.'));
            return;
        }
        const snapshot = metrics.value;
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
        metrics,
        salesByDay,
        reports,
        metricsLoaded,
        reportsLoaded,
        errors,
        reportsCount,
        getReportById,
        filterReportsByType,
        fetchDashboardMetrics,
        refreshMetrics,
        fetchSalesByDay,
        generateReport,
        exportReport
    };
});

export default useDashboardStore;