<script setup>
import { computed, onMounted, toRefs } from 'vue';
import { useRouter }                   from 'vue-router';
import { useI18n }                     from 'vue-i18n';
import useDashboardStore               from '../../application/dashboard.store.js';
import { ReportType }                  from '../../domain/model/report.entity.js';
import { toDateLocale }                from '../../../shared/presentation/date-locale.js';

const { t, locale }  = useI18n();
const router         = useRouter();
const dashboardStore = useDashboardStore();

/**
 * Translated label for a report type, reusing the same reports.type-* keys
 * already defined for the report-filters type dropdown.
 * @param {string} type - A ReportType value.
 * @returns {string}
 */
function reportTypeLabel(type) {
  const keys = {
    [ReportType.INVENTORY]:     'reports.type-inventory',
    [ReportType.SALES]:         'reports.type-sales',
    [ReportType.LOW_STOCK]:     'reports.type-low-stock',
    [ReportType.REPLENISHMENT]: 'reports.type-replenishment'
  };
  return t(keys[type] ?? type);
}

const { reports, reportsLoaded, errors } = toRefs(dashboardStore);
const { exportReport, computeMetricsForFilters } = dashboardStore;

/**
 * The most recently generated report (last element of the reports array).
 * The store appends new reports to the end of the list.
 *
 * @type {import('vue').ComputedRef<import('../../domain/model/report.entity.js').Report|null>}
 */
const latestReport = computed(() => {
  if (!reports.value.length) return null;
  return reports.value[reports.value.length - 1];
});

/**
 * Metrics scoped to the report's own date range — NOT the Panel's all-time
 * liveMetrics, which would silently ignore the filters the user just chose.
 * @type {import('vue').ComputedRef<Object|null>}
 */
const metrics = computed(() =>
    latestReport.value ? computeMetricsForFilters(latestReport.value.filters) : null
);

/**
 * Redirects to the filters view when there are no reports to display.
 */
onMounted(() => {
  if (!reportsLoaded.value || !reports.value.length) {
    router.push({ name: 'dashboard-report-filters' });
  }
});

/**
 * Triggers the CSV export for the latest report via the store, passing
 * already-translated row labels so the exported file matches the active
 * UI locale instead of a hardcoded English fallback.
 */
function handleExportReport() {
  if (!latestReport.value) return;
  exportReport(latestReport.value.id, {
    header:           `${t('reports.col-metric')},${t('reports.col-value')}`,
    totalProducts:    t('reports.metrics-total-products'),
    lowStockProducts: t('reports.metrics-low-stock'),
    inventoryValue:   t('reports.metrics-inventory-value'),
    totalSales:       t('reports.metrics-total-sales'),
    salesCount:       t('reports.metrics-sales-count'),
    averageSaleValue: t('reports.metrics-average-sale'),
    stockHealth:      t('reports.metrics-stock-health'),
    generatedAt:      t('reports.generated-at')
  });
}

/**
 * Navigates back to the report filters view to generate a new report.
 */
function navigateBack() {
  router.push({ name: 'dashboard-report-filters' });
}

/**
 * Navigates to the main dashboard.
 */
function navigateToDashboard() {
  router.push({ name: 'dashboard' });
}

/**
 * Formats a monetary amount as a PEN currency string.
 *
 * @param {number} amount - Monetary amount in PEN.
 * @returns {string} Formatted currency string.
 */
function formatCurrency(amount) {
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formats an ISO 8601 date string into a readable locale date string.
 *
 * @param {string} isoDate - ISO 8601 date string.
 * @returns {string} Formatted date string.
 */
function formatDate(isoDate) {
  if (!isoDate) return '-';
  return new Date(isoDate).toLocaleDateString(toDateLocale(locale.value));
}
</script>

<template>
  <div class="p-4">
    <!-- Header -->
    <div class="flex align-items-center gap-3 mb-4 flex-wrap">
      <pv-button icon="pi pi-arrow-left" text rounded @click="navigateBack"/>
      <div class="flex-1">
        <h1 class="m-0" style="color: #0B3558;">{{ t('reports.result-title') }}</h1>
      </div>
      <pv-button
          v-if="latestReport"
          :label="t('reports.export')"
          icon="pi pi-download"
          @click="handleExportReport"
      />
      <pv-button
          :label="t('dashboard.title')"
          icon="pi pi-home"
          severity="secondary"
          outlined
          @click="navigateToDashboard"
      />
    </div>

    <!-- No report available -->
    <div v-if="!latestReport" class="flex justify-content-center align-items-center" style="min-height: 200px;">
      <p style="color: #64748B;">{{ t('reports.no-reports') }}</p>
    </div>

    <div v-else>
      <!-- Report metadata -->
      <pv-card class="mb-4 shadow-1">
        <template #content>
          <div class="grid">
            <div class="col-12 md:col-4">
              <p class="m-0 text-sm" style="color: #64748B;">{{ t('reports.type') }}</p>
              <p class="m-0 mt-1 font-semibold" style="color: #0B3558;">{{ reportTypeLabel(latestReport.type) }}</p>
            </div>
            <div class="col-12 md:col-4">
              <p class="m-0 text-sm" style="color: #64748B;">{{ t('reports.filters') }}</p>
              <p class="m-0 mt-1" style="color: #0B3558;">
                {{ formatDate(latestReport.filters.startDate) }} – {{ formatDate(latestReport.filters.endDate) }}
              </p>
              <p v-if="latestReport.filters.category" class="m-0 text-sm" style="color: #64748B;">
                {{ latestReport.filters.category }}
              </p>
            </div>
            <div class="col-12 md:col-4">
              <p class="m-0 text-sm" style="color: #64748B;">{{ t('reports.generated-at') }}</p>
              <p class="m-0 mt-1" style="color: #0B3558;">{{ formatDate(latestReport.generatedAt) }}</p>
            </div>
          </div>
        </template>
      </pv-card>

      <!-- Metrics table (data from the loaded snapshot) -->
      <pv-card v-if="metrics" class="shadow-1">
        <template #header>
          <div class="p-3 pb-0">
            <h3 class="m-0" style="color: #0B3558;">{{ t('reports.list-title') }}</h3>
          </div>
        </template>
        <template #content>
          <pv-data-table
              :value="[
                            { metric: t('reports.metrics-total-products'),  value: metrics.totalProducts },
                            { metric: t('reports.metrics-low-stock'),       value: metrics.lowStockProducts },
                            { metric: t('reports.metrics-inventory-value'), value: formatCurrency(metrics.inventoryValue) },
                            { metric: t('reports.metrics-total-sales'),     value: formatCurrency(metrics.totalSales) },
                            { metric: t('reports.metrics-sales-count'),     value: metrics.salesCount },
                            { metric: t('reports.metrics-average-sale'),    value: formatCurrency(metrics.averageSaleValue) },
                            { metric: t('reports.metrics-stock-health'),    value: metrics.stockHealthPercentage + '%' }
                        ]"
              striped-rows
              table-style="min-width: 30rem"
          >
            <pv-column field="metric" :header="t('reports.col-metric')" />
            <pv-column field="value"  :header="t('reports.col-value')"  />
          </pv-data-table>
        </template>
      </pv-card>
    </div>

    <!-- Errors -->
    <div v-if="errors.length" class="mt-3">
      <p style="color: #EF4444;">{{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}</p>
    </div>
  </div>
</template>

<style scoped>
</style>