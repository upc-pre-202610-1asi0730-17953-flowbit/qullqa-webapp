<script setup>
import { computed, onMounted, toRefs } from 'vue';
import { useRouter }                   from 'vue-router';
import { useI18n }                     from 'vue-i18n';
import useDashboardStore               from '../../application/dashboard.store.js';
import useIamStore                     from '../../../iam/application/iam.store.js';

const { t }          = useI18n();
const router         = useRouter();
const dashboardStore = useDashboardStore();
const iamStore       = useIamStore();

const { metrics, metricsLoaded, alerts, alertsLoaded, salesByDay, topProducts, errors } = toRefs(dashboardStore);
const { fetchDashboardMetrics, fetchAlerts, fetchSalesByDay, fetchTopProducts } = dashboardStore;

/**
 * Loads all dashboard data for the currently authenticated business on mount.
 */
onMounted(() => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (businessId) {
    if (!metricsLoaded.value)  fetchDashboardMetrics(businessId);
    if (!alertsLoaded.value)   fetchAlerts(businessId);
    if (!salesByDay.value.length)  fetchSalesByDay(businessId);
    if (!topProducts.value.length) fetchTopProducts(businessId);
  }
});

/**
 * Navigates to the report generation view.
 */
function navigateToReports() {
  router.push({ name: 'dashboard-report-filters' });
}

/**
 * Navigates to the movements view (placeholder until that bounded context is ready).
 */
function navigateToMovements() {
  router.push({ name: 'home' });
}

/**
 * Navigates to the alerts view (placeholder until that bounded context is ready).
 */
function navigateToAlerts() {
  router.push({ name: 'alerts' });
}

/**
 * Navigates to the new product view (placeholder until products bounded context is ready).
 */
function navigateToNewProduct() {
  router.push({ name: 'product-new' });
}

/**
 * Returns the icon color for an alert based on its severity.
 * Business rule: HIGH → red (#EF4444), any other → orange (#F97316).
 *
 * @param {string} severity - Alert severity from the API (HIGH, MEDIUM, LOW).
 * @returns {string} Hex color string.
 */
function resolveAlertIconColor(severity) {
  return severity === 'HIGH' ? '#EF4444' : '#F97316';
}

/**
 * Returns the badge background color for an alert based on its severity.
 * Business rule: HIGH → red tint, any other → orange tint.
 *
 * @param {string} severity - Alert severity from the API.
 * @returns {string} Hex color string for the badge background.
 */
function resolveAlertBadgeBackground(severity) {
  return severity === 'HIGH' ? '#FEE2E2' : '#FFEDD5';
}

/**
 * Returns the badge text color for an alert based on its severity.
 *
 * @param {string} severity - Alert severity from the API.
 * @returns {string} Hex color string for the badge text.
 */
function resolveAlertBadgeTextColor(severity) {
  return severity === 'HIGH' ? '#EF4444' : '#F97316';
}

/**
 * Returns the translated severity label key for an alert.
 *
 * @param {string} severity - Alert severity from the API.
 * @returns {string} i18n key.
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
 * Formats a monetary amount as a PEN currency string.
 *
 * @param {number} amount - Numeric amount in PEN.
 * @returns {string} Formatted string, e.g. "S/ 1,234.50".
 */
function formatCurrency(amount) {
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Only the ACTIVE alerts are shown in the dashboard recent-alerts panel.
 * Business rule: resolved or sent alerts do not appear in the summary.
 *
 * @type {import('vue').ComputedRef<Array>}
 */
const activeAlerts = computed(() =>
    alerts.value.filter(alert => alert.status === 'ACTIVE')
);
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">

    <!-- Page title -->
    <div>
      <h1 class="m-0" style="color: #0B3558;">{{ t('dashboard.title') }}</h1>
      <p class="m-0 mt-1" style="color: #64748B;">{{ t('dashboard.subtitle') }}</p>
    </div>

    <!-- 4 KPI Cards -->
    <div class="grid">
      <!-- Total Productos -->
      <div class="col-12 md:col-6 lg:col-3">
        <pv-card class="shadow-1 h-full">
          <template #content>
            <div class="flex align-items-center justify-content-between">
              <div>
                <p class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.total-products') }}</p>
                <h2 class="m-0 mt-2" style="color: #0B3558;">
                  {{ metricsLoaded && metrics ? metrics.totalProducts : '—' }}
                </h2>
              </div>
              <div class="p-3 border-round-lg" style="background-color: #E0F2FE;">
                <i class="pi pi-box" style="font-size: 1.5rem; color: #0E7490;"/>
              </div>
            </div>
          </template>
        </pv-card>
      </div>

      <!-- Stock Bajo -->
      <div class="col-12 md:col-6 lg:col-3">
        <pv-card class="shadow-1 h-full">
          <template #content>
            <div class="flex align-items-center justify-content-between">
              <div>
                <p class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.low-stock') }}</p>
                <h2 class="m-0 mt-2" style="color: #F97316;">
                  {{ metricsLoaded && metrics ? metrics.lowStockProducts : '—' }}
                </h2>
              </div>
              <div class="p-3 border-round-lg" style="background-color: #FFEDD5;">
                <i class="pi pi-exclamation-triangle" style="font-size: 1.5rem; color: #F97316;"/>
              </div>
            </div>
          </template>
        </pv-card>
      </div>

      <!-- Por Vencer (expiring batches count from alerts) -->
      <div class="col-12 md:col-6 lg:col-3">
        <pv-card class="shadow-1 h-full">
          <template #content>
            <div class="flex align-items-center justify-content-between">
              <div>
                <p class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.expiring-soon') }}</p>
                <h2 class="m-0 mt-2" style="color: #EF4444;">
                  {{ alertsLoaded ? alerts.filter(alert => alert.type === 'EXPIRATION' && alert.status === 'ACTIVE').length : '—' }}
                </h2>
              </div>
              <div class="p-3 border-round-lg" style="background-color: #FEE2E2;">
                <i class="pi pi-calendar" style="font-size: 1.5rem; color: #EF4444;"/>
              </div>
            </div>
          </template>
        </pv-card>
      </div>

      <!-- Valor Inventario -->
      <div class="col-12 md:col-6 lg:col-3">
        <pv-card class="shadow-1 h-full">
          <template #content>
            <div class="flex align-items-center justify-content-between">
              <div>
                <p class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.inventory-value') }}</p>
                <h2 class="m-0 mt-2" style="color: #22C55E;">
                  {{ metricsLoaded && metrics ? formatCurrency(metrics.inventoryValue) : '—' }}
                </h2>
              </div>
              <div class="p-3 border-round-lg" style="background-color: #DCFCE7;">
                <i class="pi pi-chart-line" style="font-size: 1.5rem; color: #22C55E;"/>
              </div>
            </div>
          </template>
        </pv-card>
      </div>
    </div>

    <!-- Bar chart (2/3) + Alertas Recientes (1/3) -->
    <div class="grid">

      <!-- Movimientos de la semana — bar chart -->
      <div class="col-12 lg:col-8">
        <pv-card class="shadow-1 h-full">
          <template #content>
            <h3 class="m-0 mb-4" style="color: #0B3558;">{{ t('dashboard.weekly-movements') }}</h3>

            <!-- Bar chart built with plain SVG + PrimeFlex — no extra charting library needed -->
            <div v-if="salesByDay.length" style="width: 100%; overflow-x: auto;">
              <div style="display: flex; align-items: flex-end; gap: 12px; height: 220px; padding: 0 8px;">
                <div
                    v-for="dayEntry in salesByDay"
                    :key="dayEntry.dayLabel"
                    style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;"
                >
                                    <span style="font-size: 0.75rem; color: #64748B;">
                                        {{ dayEntry.totalAmount > 0 ? formatCurrency(dayEntry.totalAmount) : '' }}
                                    </span>
                  <div
                      :style="{
                                            width: '100%',
                                            backgroundColor: '#0E7490',
                                            borderRadius: '4px 4px 0 0',
                                            height: dayEntry.barHeightPercent + '%',
                                            minHeight: '4px',
                                            transition: 'height 0.4s ease'
                                        }"
                  />
                  <span style="font-size: 0.8rem; color: #64748B;">{{ dayEntry.dayLabel }}</span>
                </div>
              </div>
              <!-- X axis line -->
              <div style="height: 1px; background-color: #E2E8F0; margin: 0 8px;"/>
            </div>

            <div v-else class="flex justify-content-center align-items-center" style="height: 220px;">
              <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; color: #0E7490;"/>
            </div>
          </template>
        </pv-card>
      </div>

      <!-- Alertas Recientes -->
      <div class="col-12 lg:col-4">
        <pv-card class="shadow-1 h-full">
          <template #content>
            <div class="flex align-items-center justify-content-between mb-4">
              <h3 class="m-0" style="color: #0B3558;">{{ t('dashboard.recent-alerts') }}</h3>
              <pv-button
                  :label="t('dashboard.see-all')"
                  text
                  size="small"
                  style="color: #0E7490;"
                  @click="navigateToAlerts"
              />
            </div>

            <div v-if="activeAlerts.length" style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div
                  v-for="alert in activeAlerts.slice(0, 3)"
                  :key="alert.id"
                  class="p-3 border-round-lg"
                  style="border: 1px solid #E2E8F0;"
              >
                <div class="flex align-items-start gap-2">
                  <i
                      class="pi pi-exclamation-circle mt-1"
                      style="font-size: 1rem;"
                      :style="{ color: resolveAlertIconColor(alert.severity) }"
                  />
                  <div style="flex: 1; overflow: hidden;">
                    <p class="m-0 text-sm" style="color: #1E293B; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      {{ alert.productName ?? t('dashboard.unknown-product') }}
                    </p>
                    <p class="m-0 mt-1" style="font-size: 0.75rem; color: #64748B;">
                      {{ alert.message }}
                    </p>
                  </div>
                  <span
                      class="border-round px-2 py-1"
                      style="font-size: 0.7rem; font-weight: 600; white-space: nowrap;"
                      :style="{
                                            backgroundColor: resolveAlertBadgeBackground(alert.severity),
                                            color: resolveAlertBadgeTextColor(alert.severity)
                                        }"
                  >
                                        {{ t(resolveAlertSeverityLabelKey(alert.severity)) }}
                                    </span>
                </div>
              </div>
            </div>

            <p v-else class="m-0 text-sm" style="color: #64748B;">{{ t('dashboard.no-alerts') }}</p>
          </template>
        </pv-card>
      </div>
    </div>

    <!-- Productos más vendidos + Acciones rápidas -->
    <div class="grid">

      <!-- Productos más vendidos -->
      <div class="col-12 md:col-6">
        <pv-card class="shadow-1 h-full">
          <template #content>
            <h3 class="m-0 mb-4" style="color: #0B3558;">{{ t('dashboard.top-products') }}</h3>

            <div v-if="topProducts.length" style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div
                  v-for="productEntry in topProducts"
                  :key="productEntry.productId"
                  class="flex align-items-center justify-content-between"
              >
                <div>
                  <p class="m-0" style="color: #1E293B;">{{ productEntry.productName }}</p>
                  <p class="m-0 mt-1 text-sm" style="color: #64748B;">
                    {{ productEntry.totalQuantity }} {{ t('dashboard.units') }}
                  </p>
                </div>
                <span
                    class="border-round px-2 py-1"
                    style="font-size: 0.75rem; font-weight: 600; background-color: #DCFCE7; color: #22C55E;"
                >
                                    {{ formatCurrency(productEntry.totalRevenue) }}
                                </span>
              </div>
            </div>

            <div v-else class="flex justify-content-center align-items-center" style="min-height: 80px;">
              <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; color: #0E7490;"/>
            </div>
          </template>
        </pv-card>
      </div>

      <!-- Acciones rápidas -->
      <div class="col-12 md:col-6">
        <pv-card class="shadow-1 h-full">
          <template #content>
            <h3 class="m-0 mb-4" style="color: #0B3558;">{{ t('dashboard.quick-actions') }}</h3>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <pv-button
                  :label="t('dashboard.action-new-product')"
                  icon="pi pi-box"
                  severity="secondary"
                  outlined
                  class="w-full justify-content-start"
                  @click="navigateToNewProduct"
              />
              <pv-button
                  :label="t('dashboard.action-new-movement')"
                  icon="pi pi-chart-line"
                  severity="secondary"
                  outlined
                  class="w-full justify-content-start"
                  @click="navigateToMovements"
              />
              <pv-button
                  :label="t('dashboard.action-view-reports')"
                  icon="pi pi-chart-bar"
                  severity="secondary"
                  outlined
                  class="w-full justify-content-start"
                  @click="navigateToReports"
              />
            </div>
          </template>
        </pv-card>
      </div>
    </div>

    <!-- Errors -->
    <div v-if="errors.length">
      <p style="color: #EF4444;">{{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}</p>
    </div>

  </div>
</template>

<style scoped>
</style>