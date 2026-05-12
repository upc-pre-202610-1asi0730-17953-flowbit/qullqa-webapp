/**
 * Application service store for the Dashboard & Analytics bounded context.
 * Coordinates metrics and report use cases and keeps UI-facing state.
 *
 * Business rules enforced here:
 * - Only one MetricsSnapshot per business is kept in memory at a time.
 * - A report can only be generated when its ReportFilters has a valid date range.
 * - filterReportsByType returns all reports when type is null or undefined.
 * - exportReport builds a comma-separated text file from the current metrics snapshot
 *   and triggers a browser download; no server call is required.
 * - refreshMetrics recomputes and persists a new snapshot based on the current
 *   metrics state (simulated via PUT to the mock API).
 *
 * @module useDashboardStore
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { DashboardApi }       from '../infrastructure/dashboard.api.js';
import { MetricsAssembler }   from '../infrastructure/metrics-snapshot.assembler.js';
import { ReportAssembler }    from '../infrastructure/report.assembler.js';
import { MetricsSnapshot }    from '../domain/model/metrics-snapshot.entity.js';
import { Report, ReportType } from '../domain/model/report.entity.js';
import { ReportFilters }      from '../domain/model/report-filters.entity.js';

const dashboardApi = new DashboardApi();

/**
 * Reactive store that exposes Dashboard & Analytics commands and queries.
 *
 * @returns {Object} Store state and actions.
 */
const useDashboardStore = defineStore('dashboard', () => {

    /**
     * The current metrics snapshot for the authenticated business.
     * @type {import('vue').Ref<MetricsSnapshot|null>}
     */
    const metrics = ref(null);

    /**
     * List of generated reports for the authenticated business.
     * @type {import('vue').Ref<Report[]>}
     */
    const reports = ref([]);

    /**
     * Whether the metrics snapshot has been loaded from the API.
     * @type {import('vue').Ref<boolean>}
     */
    const metricsLoaded = ref(false);

    /**
     * Whether the reports list has been loaded from the API.
     * @type {import('vue').Ref<boolean>}
     */
    const reportsLoaded = ref(false);

    /**
     * Errors encountered during API or validation operations.
     * @type {import('vue').Ref<Error[]>}
     */
    const errors = ref([]);

    /**
     * Number of generated reports currently in memory.
     * @type {import('vue').ComputedRef<number>}
     */
    const reportsCount = computed(() => reports.value.length);

    // Queries

    /**
     * Finds a report entity by its numeric identifier.
     *
     * @param {number|string} id - Report identifier.
     * @returns {Report|undefined} Matching report, or undefined if not found.
     */
    function getReportById(id) {
        const numericId = parseInt(id);
        return reports.value.find(report => report.id === numericId);
    }

    /**
     * Returns all reports matching the given ReportType.
     * When type is null or undefined, returns the full list.
     *
     * @param {string|null} type - A ReportType value or null for all.
     * @returns {Report[]} Filtered (or full) report list.
     */
    function filterReportsByType(type) {
        if (!type) return reports.value;
        return reports.value.filter(report => report.type === type);
    }

    // Commands

    /**
     * Fetches the metrics snapshot for a given business from the API
     * and stores the first result (json-server returns an array).
     *
     * @param {number|string} businessId - The identifier of the authenticated business.
     * @returns {void}
     */
    function fetchDashboardMetrics(businessId) {
        dashboardApi.getDashboardMetrics(businessId)
            .then(response => {
                const snapshots = MetricsAssembler.toEntitiesFromResponse(response);
                metrics.value       = snapshots.length > 0 ? snapshots[0] : null;
                metricsLoaded.value = true;
            })
            .catch(error => {
                errors.value.push(error);
            });
    }

    /**
     * Simulates a metrics refresh by incrementing the generatedAt timestamp
     * and persisting the updated snapshot via PUT.
     * Business rule: refreshMetrics only operates when a snapshot is already loaded.
     *
     * @returns {void}
     */
    function refreshMetrics() {
        if (!metrics.value) return;

        const updatedResource = {
            ...metrics.value,
            generatedAt: new Date().toISOString()
        };

        dashboardApi.updateMetrics(updatedResource)
            .then(response => {
                metrics.value = MetricsAssembler.toEntityFromResource(response.data);
            })
            .catch(error => {
                errors.value.push(error);
            });
    }

    /**
     * Generates a new Report entity locally and adds it to the in-memory list.
     * Business rule: generation is rejected when the provided ReportFilters
     * does not have a valid date range.
     *
     * @param {Object} resource - Report resource payload including type and filters.
     * @returns {void}
     */
    function generateReport(resource) {
        const filters = new ReportFilters(resource.filters ?? {});

        if (!filters.isDateRangeValid()) {
            errors.value.push(new Error('Invalid date range: startDate must not be after endDate.'));
            return;
        }

        const newReport = new Report({
            id:          reports.value.length + 1,
            businessId:  resource.businessId,
            type:        resource.type,
            filters:     filters,
            generatedAt: new Date().toISOString()
        });

        reports.value.push(newReport);
        reportsLoaded.value = true;
    }

    /**
     * Exports a report as a CSV file and triggers a browser download.
     * Business rule: export uses the current metrics snapshot as the data source.
     * When no metrics are available, an error is added and no download occurs.
     *
     * @param {number|string} reportId - Identifier of the report to export.
     * @returns {void}
     */
    function exportReport(reportId) {
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

        const csvHeader = 'Metric,Value';
        const csvRows = [
            `Total Products,${snapshot.totalProducts}`,
            `Low Stock Products,${snapshot.lowStockProducts}`,
            `Inventory Value (PEN),${snapshot.inventoryValue}`,
            `Total Sales (PEN),${snapshot.totalSales}`,
            `Sales Count,${snapshot.salesCount}`,
            `Average Sale Value (PEN),${snapshot.averageSaleValue}`,
            `Stock Health (%),${snapshot.stockHealthPercentage}`,
            `Generated At,${snapshot.generatedAt}`
        ];

        const csvContent   = [csvHeader, ...csvRows].join('\n');
        const blob         = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const downloadUrl  = URL.createObjectURL(blob);
        const anchorElement = document.createElement('a');
        anchorElement.href     = downloadUrl;
        anchorElement.download = `report-${report.type.toLowerCase()}-${report.id}.csv`;
        anchorElement.click();
        URL.revokeObjectURL(downloadUrl);
    }

    return {
        metrics,
        reports,
        metricsLoaded,
        reportsLoaded,
        errors,
        reportsCount,
        getReportById,
        filterReportsByType,
        fetchDashboardMetrics,
        refreshMetrics,
        generateReport,
        exportReport
    };
});

export default useDashboardStore;