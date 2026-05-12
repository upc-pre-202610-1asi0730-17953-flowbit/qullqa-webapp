<script setup>
import { onMounted, toRefs } from 'vue';
import { useRouter }         from 'vue-router';
import { useI18n }           from 'vue-i18n';
import useDashboardStore     from '../../application/dashboard.store.js';
import useIamStore           from '../../../iam/application/iam.store.js';

const { t }          = useI18n();
const router         = useRouter();
const dashboardStore = useDashboardStore();
const iamStore       = useIamStore();

const { metrics, metricsLoaded, errors } = toRefs(dashboardStore);
const { fetchDashboardMetrics, refreshMetrics } = dashboardStore;

/**
 * Loads the metrics snapshot for the currently authenticated business on mount.
 * Falls back gracefully when no business is linked to the current user.
 */
onMounted(() => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (businessId && !metricsLoaded.value) {
    fetchDashboardMetrics(businessId);
  }
});

/**
 * Triggers a metrics refresh via the store and re-fetches updated data.
 */
function handleRefreshMetrics() {
  refreshMetrics();
}

/**
 * Navigates the user to the reports generation view.
 */
function navigateToReports() {
  router.push({ name: 'dashboard-report-filters' });
}

/**
 * Navigates the user to the alerts view (placeholder — alerts bounded context).
 */
function navigateToAlerts() {
  router.push({ name: 'home' });
}

/**
 * Returns the PrimeVue severity tag for a given alert severity string.
 *
 * Business rule:
 * - HIGH   → danger
 * - MEDIUM → warn
 * - LOW    → info
 *
 * @param {string} severity - Alert severity value from the API.
 * @returns {string} PrimeVue Tag severity string.
 */
function resolveAlertSeverityTag(severity) {
  const severityMap = {
    HIGH:   'danger',
    MEDIUM: 'warn',
    LOW:    'info'
  };
  return severityMap[severity] ?? 'info';
}

/**
 * Returns the i18n key for the human-readable severity label.
 *
 * @param {string} severity - Alert severity value from the API.
 * @returns {string} i18n translation key.
 */
function resolveAlertSeverityLabelKey(severity) {
  const labelKeyMap = {
    HIGH:   'dashboard.severity-high',
    MEDIUM: 'dashboard.severity-medium',
    LOW:    'dashboard.severity-low'
  };
  return labelKeyMap[severity] ?? 'dashboard.severity-low';
}

/**
 * Formats a monetary value as a PEN currency string.
 *
 * @param {number} amount - Numeric amount in PEN.
 * @returns {string} Formatted string, e.g. "S/ 1,234.50".
 */
function formatCurrency(amount) {
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formats an ISO 8601 date string into a readable locale string.
 *
 * @param {string} isoDate - ISO 8601 date string.
 * @returns {string} Formatted date and time string.
 */
function formatDate(isoDate) {
  if (!isoDate) return '-';
  return new Date(isoDate).toLocaleString('es-PE');
}
</script>

<template>
  <div class="p-4">
    <!-- Header -->
    <div class="flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
      <div>
        <h1 class="m-0" style="color: #0B3558;">{{ t('dashboard.title') }}</h1>
        <p class="m-0 mt-1" style="color: #64748B;">{{ t('dashboard.subtitle') }}</p>
      </div>
      <div class="flex gap-2">
        <pv-button
            :label="t('dashboard.refresh')"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            :disabled="!metricsLoaded"
            @click="handleRefreshMetrics"
        />
        <pv-button
            :label="t('dashboard.go-to-reports')"
            icon="pi pi-chart-bar"
            @click="navigateToReports"
        />
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="!metricsLoaded" class="flex justify-content-center align-items-center" style="min-height: 200px;">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem; color: #0E7490;"/>
      <span class="ml-3" style="color: #64748B;">{{ t('dashboard.loading') }}</span>
    </div>

    <!-- Metrics loaded -->
    <div v-else-if="metrics">

      <!-- KPI Cards -->
      <div class="grid mb-4">
        <!-- Total Products -->
        <div class="col-12 md:col-6 lg:col-3">
          <pv-card class="h-full shadow-1">
            <template #content>
              <div class="flex align-items-center justify-content-between">
                <div>
                  <p class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.total-products') }}</p>
                  <h2 class="m-0 mt-2" style="color: #0B3558;">{{ metrics.totalProducts }}</h2>
                </div>
                <div class="p-3 border-round-lg" style="background-color: #E0F2FE;">
                  <i class="pi pi-box" style="font-size: 1.5rem; color: #0E7490;"/>
                </div>
              </div>
            </template>
          </pv-card>
        </div>

        <!-- Low Stock -->
        <div class="col-12 md:col-6 lg:col-3">
          <pv-card class="h-full shadow-1">
            <template #content>
              <div class="flex align-items-center justify-content-between">
                <div>
                  <p class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.low-stock') }}</p>
                  <h2 class="m-0 mt-2" style="color: #F97316;">{{ metrics.lowStockProducts }}</h2>
                </div>
                <div class="p-3 border-round-lg" style="background-color: #FFEDD5;">
                  <i class="pi pi-exclamation-triangle" style="font-size: 1.5rem; color: #F97316;"/>
                </div>
              </div>
            </template>
          </pv-card>
        </div>

        <!-- Inventory Value -->
        <div class="col-12 md:col-6 lg:col-3">
          <pv-card class="h-full shadow-1">
            <template #content>
              <div class="flex align-items-center justify-content-between">
                <div>
                  <p class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.inventory-value') }}</p>
                  <h2 class="m-0 mt-2" style="color: #22C55E;">{{ formatCurrency(metrics.inventoryValue) }}</h2>
                </div>
                <div class="p-3 border-round-lg" style="background-color: #DCFCE7;">
                  <i class="pi pi-chart-line" style="font-size: 1.5rem; color: #22C55E;"/>
                </div>
              </div>
            </template>
          </pv-card>
        </div>

        <!-- Total Sales -->
        <div class="col-12 md:col-6 lg:col-3">
          <pv-card class="h-full shadow-1">
            <template #content>
              <div class="flex align-items-center justify-content-between">
                <div>
                  <p class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.total-sales') }}</p>
                  <h2 class="m-0 mt-2" style="color: #0B3558;">{{ formatCurrency(metrics.totalSales) }}</h2>
                  <p class="m-0 mt-1 text-sm" style="color: #64748B;">
                    {{ metrics.salesCount }} {{ t('dashboard.sales-count') }}
                  </p>
                </div>
                <div class="p-3 border-round-lg" style="background-color: #E0F2FE;">
                  <i class="pi pi-dollar" style="font-size: 1.5rem; color: #0E7490;"/>
                </div>
              </div>
            </template>
          </pv-card>
        </div>
      </div>

      <!-- Secondary metrics row -->
      <div class="grid mb-4">
        <!-- Average Sale Value -->
        <div class="col-12 md:col-6 lg:col-4">
          <pv-card class="h-full shadow-1">
            <template #content>
              <div class="flex align-items-center justify-content-between">
                <div>
                  <p class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.average-sale') }}</p>
                  <h3 class="m-0 mt-2" style="color: #0B3558;">{{ formatCurrency(metrics.averageSaleValue) }}</h3>
                </div>
                <div class="p-3 border-round-lg" style="background-color: #FEF3C7;">
                  <i class="pi pi-calculator" style="font-size: 1.5rem; color: #FACC15;"/>
                </div>
              </div>
            </template>
          </pv-card>
        </div>

        <!-- Stock Health -->
        <div class="col-12 md:col-6 lg:col-4">
          <pv-card class="h-full shadow-1">
            <template #content>
              <p class="m-0 text-sm mb-2" style="color: #64748B;">{{ t('dashboard.stock-health') }}</p>
              <div class="flex align-items-center gap-3">
                <div style="flex: 1; height: 12px; background-color: #F1F5F9; border-radius: 6px; overflow: hidden;">
                  <div
                      :style="{
                                            width: metrics.stockHealthPercentage + '%',
                                            height: '100%',
                                            backgroundColor: metrics.stockHealthPercentage >= 80 ? '#22C55E' : metrics.stockHealthPercentage >= 50 ? '#F97316' : '#EF4444',
                                            borderRadius: '6px',
                                            transition: 'width 0.5s ease'
                                        }"
                  />
                </div>
                <span style="color: #0B3558; font-weight: 600; min-width: 3rem;">{{ metrics.stockHealthPercentage }}%</span>
              </div>
            </template>
          </pv-card>
        </div>

        <!-- Generated At -->
        <div class="col-12 md:col-12 lg:col-4">
          <pv-card class="h-full shadow-1">
            <template #content>
              <div class="flex align-items-center justify-content-between">
                <div>
                  <p class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.generated-at') }}</p>
                  <p class="m-0 mt-2" style="color: #0B3558; font-weight: 500;">{{ formatDate(metrics.generatedAt) }}</p>
                </div>
                <i class="pi pi-clock" style="font-size: 1.5rem; color: #64748B;"/>
              </div>
            </template>
          </pv-card>
        </div>
      </div>

      <!-- Quick actions and navigation -->
      <div class="grid">
        <div class="col-12 md:col-6">
          <pv-card class="shadow-1">
            <template #header>
              <div class="p-3 pb-0">
                <h3 class="m-0" style="color: #0B3558;">{{ t('dashboard.go-to-reports') }}</h3>
              </div>
            </template>
            <template #content>
              <p style="color: #64748B;">{{ t('reports.subtitle') }}</p>
              <pv-button
                  :label="t('dashboard.go-to-reports')"
                  icon="pi pi-chart-bar"
                  class="w-full"
                  @click="navigateToReports"
              />
            </template>
          </pv-card>
        </div>
        <div class="col-12 md:col-6">
          <pv-card class="shadow-1">
            <template #header>
              <div class="p-3 pb-0">
                <h3 class="m-0" style="color: #0B3558;">{{ t('dashboard.go-to-alerts') }}</h3>
              </div>
            </template>
            <template #content>
              <p style="color: #64748B;">{{ t('dashboard.recent-alerts') }}</p>
              <pv-button
                  :label="t('dashboard.go-to-alerts')"
                  icon="pi pi-bell"
                  severity="secondary"
                  class="w-full"
                  @click="navigateToAlerts"
              />
            </template>
          </pv-card>
        </div>
      </div>
    </div>

    <!-- Errors -->
    <div v-if="errors.length" class="mt-3">
      <p style="color: #EF4444;">{{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}</p>
    </div>
  </div>
</template>

<style scoped>
</style>