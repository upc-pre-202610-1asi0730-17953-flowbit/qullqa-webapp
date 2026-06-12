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

const {
  metrics, metricsLoaded,
  alerts,  alertsLoaded,
  salesByDay, topProducts,
  errors
} = toRefs(dashboardStore);

const {
  fetchDashboardMetrics,
  fetchAlerts,
  fetchSalesByDay,
  fetchTopProducts,
  refreshMetrics
} = dashboardStore;

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (businessId) {
    if (!metricsLoaded.value)        fetchDashboardMetrics(businessId);
    if (!alertsLoaded.value)         fetchAlerts(businessId);
    if (!salesByDay.value.length)    fetchSalesByDay(businessId);
    if (!topProducts.value.length)   fetchTopProducts(businessId);
  }
});

// ─── Navigation ────────────────────────────────────────────────────────────

function navigateToReports()    { router.push({ name: 'dashboard-report-filters' }); }
function navigateToAlerts()     { router.push({ name: 'alerts' }); }
function navigateToNewProduct() { router.push({ name: 'products' }); }
function navigateToTracking()   { router.push({ name: 'deliveries' }); }
function navigateToSales()      { router.push({ name: 'pos-screen' }); }
function navigateToSuppliers()  { router.push({ name: 'suppliers' }); }

// ─── Computed ──────────────────────────────────────────────────────────────

/**
 * Only ACTIVE alerts appear in the recent-alerts panel.
 * @type {import('vue').ComputedRef<Array>}
 */
const activeAlerts = computed(() =>
    alerts.value.filter(alert => alert.status === 'ACTIVE')
);

/**
 * Count of active EXPIRATION alerts (used in the "Por Vencer" KPI).
 * @type {import('vue').ComputedRef<number>}
 */
const expiringCount = computed(() =>
    alertsLoaded.value
        ? alerts.value.filter(alert => alert.type === 'EXPIRATION' && alert.status === 'ACTIVE').length
        : null
);

// ─── KPI card definitions ──────────────────────────────────────────────────

/**
 * The six KPI cards rendered in the top grid.
 * Each card reads from the loaded metrics / alerts state.
 * @type {import('vue').ComputedRef<Array>}
 */
const kpiCards = computed(() => [
  {
    labelKey:   'dashboard.total-products',
    value:      metricsLoaded.value && metrics.value ? metrics.value.totalProducts : null,
    icon:       'pi pi-box',
    iconColor:  '#0E7490',
    iconBg:     '#E0F2FE',
    valueColor: '#0B3558'
  },
  {
    labelKey:   'dashboard.low-stock',
    value:      metricsLoaded.value && metrics.value ? metrics.value.lowStockProducts : null,
    icon:       'pi pi-exclamation-triangle',
    iconColor:  '#F97316',
    iconBg:     '#FFEDD5',
    valueColor: '#F97316'
  },
  {
    labelKey:   'dashboard.expiring-soon',
    value:      expiringCount.value,
    icon:       'pi pi-calendar-times',
    iconColor:  '#EF4444',
    iconBg:     '#FEE2E2',
    valueColor: '#EF4444'
  },
  {
    labelKey:    'dashboard.inventory-value',
    value:       metricsLoaded.value && metrics.value ? formatCurrency(metrics.value.inventoryValue) : null,
    icon:        'pi pi-warehouse',
    iconColor:   '#22C55E',
    iconBg:      '#DCFCE7',
    valueColor:  '#22C55E'
  },
  {
    labelKey:   'dashboard.total-sales',
    value:      metricsLoaded.value && metrics.value ? formatCurrency(metrics.value.totalSales) : null,
    icon:       'pi pi-shopping-cart',
    iconColor:  '#6366F1',
    iconBg:     '#EEF2FF',
    valueColor: '#4338CA'
  },
  {
    labelKey:   'dashboard.stock-health',
    value:      metricsLoaded.value && metrics.value ? (metrics.value.stockHealthPercentage + '%') : null,
    icon:       'pi pi-heart',
    iconColor:  '#0E7490',
    iconBg:     '#CFFAFE',
    valueColor: '#0B3558'
  }
]);

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * @param {string} isoString
 * @returns {string}
 */
function formatDateTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

/** @param {string} severity @returns {string} */
function alertIconColor(severity)   { return severity === 'HIGH' ? '#EF4444' : '#F97316'; }
/** @param {string} severity @returns {string} */
function alertBadgeBg(severity)     { return severity === 'HIGH' ? '#FEE2E2' : '#FFEDD5'; }
/** @param {string} severity @returns {string} */
function alertBadgeColor(severity)  { return severity === 'HIGH' ? '#EF4444' : '#F97316'; }
/** @param {string} severity @returns {string} */
function alertSeverityKey(severity) {
  return { HIGH: 'dashboard.severity-high', MEDIUM: 'dashboard.severity-medium', LOW: 'dashboard.severity-low' }[severity]
      ?? 'dashboard.severity-low';
}

/** Chart gridline Y positions (percentage of chart height, top = 0). */
const gridLines = [0, 25, 50, 75];

/**
 * Current date formatted in Spanish long format (e.g. "Viernes, 12 de junio de 2026").
 * Capitalized because toLocaleDateString returns lowercase weekday in es-PE.
 * @type {import('vue').ComputedRef<string>}
 */
const currentDateLabel = computed(() => {
  const formatted = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
});

/**
 * i18n key for the time-of-day greeting.
 * 0–11 → morning, 12–19 → afternoon, 20–23 → evening.
 * @type {import('vue').ComputedRef<string>}
 */
const greetingKey = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'dashboard.greeting-morning';
  if (hour < 20) return 'dashboard.greeting-afternoon';
  return 'dashboard.greeting-evening';
});

/**
 * First word of the authenticated user's full name, used in the greeting headline.
 * @type {import('vue').ComputedRef<string>}
 */
const currentUserFirstName = computed(() => {
  const full = iamStore.currentUser?.fullName ?? '';
  return full.split(' ')[0];
});

/**
 * Top 3 products sorted descending by stock quantity for the "Mayor stock" panel.
 * stockPercent is relative to the highest-quantity item (max badge = +12%).
 * @type {import('vue').ComputedRef<Array>}
 */
const topStockProducts = computed(() => {
  if (!topProducts.value.length) return [];
  const sorted = [...topProducts.value].sort((a, b) => b.totalQuantity - a.totalQuantity);
  const maxQty = sorted[0].totalQuantity;
  return sorted.slice(0, 3).map(product => ({
    ...product,
    stockPercent: maxQty > 0 ? Math.max(1, Math.round((product.totalQuantity / maxQty) * 12)) : 0
  }));
});

/**
 * The 6 quick-action cards shown in the 2×3 grid.
 * Each card declares its i18n keys, icon, colors, and navigation handler.
 * @type {import('vue').ComputedRef<Array>}
 */
const quickActions = computed(() => [
  {
    labelKey: 'dashboard.action-new-product',
    subKey:   'dashboard.action-new-product-sub',
    icon:     'pi pi-plus',
    iconBg:   '#E0F2FE',
    iconColor:'#0E7490',
    handler:  navigateToNewProduct
  },
  {
    labelKey: 'dashboard.action-new-sale',
    subKey:   'dashboard.action-new-sale-sub',
    icon:     'pi pi-shopping-cart',
    iconBg:   '#EDE9FE',
    iconColor:'#7C3AED',
    handler:  navigateToSales
  },
  {
    labelKey: 'dashboard.action-purchase-order',
    subKey:   'dashboard.action-purchase-order-sub',
    icon:     'pi pi-clipboard',
    iconBg:   '#FEF3C7',
    iconColor:'#D97706',
    handler:  navigateToSuppliers
  },
  {
    labelKey: 'dashboard.go-to-alerts',
    subKey:   'dashboard.action-alerts-sub',
    icon:     'pi pi-bell',
    iconBg:   '#FEE2E2',
    iconColor:'#EF4444',
    handler:  navigateToAlerts
  },
  {
    labelKey: 'dashboard.action-tracking',
    subKey:   'dashboard.action-tracking-sub',
    icon:     'pi pi-map-marker',
    iconBg:   '#DCFCE7',
    iconColor:'#22C55E',
    handler:  navigateToTracking
  },
  {
    labelKey: 'dashboard.action-inventory',
    subKey:   'dashboard.action-inventory-sub',
    icon:     'pi pi-database',
    iconBg:   '#DBEAFE',
    iconColor:'#2563EB',
    handler:  navigateToNewProduct
  }
]);
</script>

<template>
  <div class="dashboard-wrapper">

    <!-- ── Page header ─────────────────────────────────────────────────────── -->
    <div class="flex align-items-start justify-content-between gap-3 mb-4">
      <div>
        <p class="m-0 mb-1 header-date">{{ currentDateLabel }}</p>
        <h1 class="m-0 header-greeting">
          {{ t(greetingKey) }}, {{ currentUserFirstName }}
        </h1>
      </div>
      <div class="flex align-items-center gap-2">
        <button
            class="refresh-btn"
            :title="t('dashboard.refresh')"
            @click="refreshMetrics"
        >
          <i class="pi pi-refresh"/>
        </button>
        <button class="alert-icon-btn" @click="navigateToAlerts">
          <i class="pi pi-bell"/>
          <span v-if="activeAlerts.length > 0" class="alert-icon-btn__badge">
            {{ activeAlerts.length > 9 ? '9+' : activeAlerts.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- ── 6 KPI Cards ─────────────────────────────────────────────────────── -->
    <div class="grid mb-2">
      <div
          v-for="card in kpiCards"
          :key="card.labelKey"
          class="col-12 md:col-6 lg:col-4"
      >
        <div class="kpi-card">
          <div class="kpi-card__body">
            <p class="kpi-card__label">{{ t(card.labelKey) }}</p>
            <p v-if="card.value !== null" class="kpi-card__value" :style="{ color: card.valueColor }">
              {{ card.value }}
            </p>
            <div v-else class="kpi-card__skeleton"/>
          </div>
          <div class="kpi-card__icon" :style="{ backgroundColor: card.iconBg }">
            <i :class="card.icon" :style="{ color: card.iconColor }"/>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Bar chart + Alertas recientes ──────────────────────────────────── -->
    <div class="grid">

      <!-- Movimientos semanales -->
      <div class="col-12 lg:col-8">
        <div class="panel h-full">
          <h3 class="panel__title">{{ t('dashboard.weekly-movements') }}</h3>

          <div v-if="salesByDay.length" class="chart-container">
            <!-- Gridlines -->
            <div class="chart-grid">
              <div
                  v-for="line in gridLines"
                  :key="line"
                  class="chart-grid__line"
                  :style="{ top: line + '%' }"
              >
                <span class="chart-grid__label">
                  {{ line === 0 ? '' : (100 - line) + '%' }}
                </span>
              </div>
            </div>

            <!-- Bars -->
            <div class="chart-bars">
              <div
                  v-for="dayEntry in salesByDay"
                  :key="dayEntry.dayLabel"
                  class="chart-bar-col"
              >
                <span class="chart-bar-col__amount">
                  {{ dayEntry.totalAmount > 0 ? formatCurrency(dayEntry.totalAmount) : '' }}
                </span>
                <div
                    class="chart-bar-col__bar"
                    :style="{ height: dayEntry.barHeightPercent + '%' }"
                />
                <span class="chart-bar-col__label">{{ dayEntry.dayLabel }}</span>
              </div>
            </div>
            <div class="chart-axis"/>
          </div>

          <div v-else class="panel__loading">
            <i class="pi pi-spin pi-spinner"/>
          </div>
        </div>
      </div>

      <!-- Alertas recientes -->
      <div class="col-12 lg:col-4">
        <div class="panel h-full">
          <div class="flex align-items-center justify-content-between mb-3">
            <h3 class="panel__title m-0">{{ t('dashboard.recent-alerts') }}</h3>
            <button class="link-btn" @click="navigateToAlerts">
              {{ t('dashboard.see-all') }}
              <i class="pi pi-arrow-right" style="font-size: 0.7rem;"/>
            </button>
          </div>

          <div v-if="!alertsLoaded" class="panel__loading">
            <i class="pi pi-spin pi-spinner"/>
          </div>

          <div v-else-if="activeAlerts.length" class="flex flex-column gap-2">
            <div
                v-for="alert in activeAlerts.slice(0, 3)"
                :key="alert.id"
                class="alert-card"
            >
              <i
                  class="pi pi-exclamation-circle alert-card__icon"
                  :style="{ color: alertIconColor(alert.severity) }"
              />
              <div class="alert-card__body">
                <p class="alert-card__product">
                  {{ alert.productName ?? t('dashboard.unknown-product') }}
                </p>
                <p class="alert-card__message">{{ alert.message }}</p>
              </div>
              <span
                  class="alert-card__badge"
                  :style="{
                    backgroundColor: alertBadgeBg(alert.severity),
                    color:           alertBadgeColor(alert.severity)
                  }"
              >
                {{ t(alertSeverityKey(alert.severity)) }}
              </span>
            </div>
          </div>

          <p v-else class="m-0" style="font-size: 0.88rem; color: #64748B;">
            {{ t('dashboard.no-alerts') }}
          </p>
        </div>
      </div>
    </div>

    <!-- ── Acciones rápidas + Mayor stock ────────────────────────────────── -->
    <div class="grid mt-0">

      <!-- Acciones rápidas — 2×3 grid of icon cards -->
      <div class="col-12 lg:col-8">
        <div class="panel h-full">
          <h3 class="panel__title">{{ t('dashboard.quick-actions') }}</h3>
          <div class="action-grid">
            <button
                v-for="action in quickActions"
                :key="action.labelKey"
                class="action-card"
                @click="action.handler"
            >
              <div class="action-card__circle" :style="{ backgroundColor: action.iconBg }">
                <i :class="action.icon" :style="{ color: action.iconColor }"/>
              </div>
              <p class="action-card__label">{{ t(action.labelKey) }}</p>
              <p class="action-card__sub">{{ t(action.subKey) }}</p>
            </button>
          </div>
        </div>
      </div>

      <!-- Mayor stock -->
      <div class="col-12 lg:col-4">
        <div class="panel h-full">
          <div class="flex align-items-center justify-content-between mb-3">
            <h3 class="panel__title m-0">{{ t('dashboard.top-stock') }}</h3>
            <button class="link-btn" @click="navigateToNewProduct">
              {{ t('dashboard.see-all') }}
              <i class="pi pi-arrow-right" style="font-size: 0.7rem;"/>
            </button>
          </div>

          <div v-if="topStockProducts.length" class="flex flex-column gap-3">
            <div
                v-for="stockItem in topStockProducts"
                :key="stockItem.productId"
                class="stock-row"
            >
              <div class="stock-row__info">
                <p class="stock-row__name">{{ stockItem.productName }}</p>
                <p class="stock-row__qty">
                  {{ stockItem.totalQuantity }} {{ t('dashboard.units') }}
                </p>
              </div>
              <span class="stock-row__badge">+{{ stockItem.stockPercent }}%</span>
            </div>
          </div>

          <div v-else class="panel__loading">
            <i class="pi pi-spin pi-spinner"/>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Errors ──────────────────────────────────────────────────────────── -->
    <div v-if="errors.length" class="error-banner mt-3">
      <i class="pi pi-exclamation-triangle"/>
      {{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}
    </div>

  </div>
</template>

<style scoped>
.dashboard-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Header date + greeting ─────────────────────────────────────────── */
.header-date {
  color: #94A3B8;
  font-size: 0.82rem;
}
.header-greeting {
  color: #0B3558;
  font-size: 1.65rem;
  font-weight: 700;
  line-height: 1.2;
}

/* ── Refresh button (icon-only) ─────────────────────────────────────── */
.refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid #E2E8F0;
  border-radius: 50%;
  background: #fff;
  color: #64748B;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  flex-shrink: 0;
}
.refresh-btn:hover {
  background-color: #F1F5F9;
  color: #0B3558;
}

/* ── Alert icon button ──────────────────────────────────────────────── */
.alert-icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid #E2E8F0;
  border-radius: 50%;
  background: #fff;
  color: #64748B;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  flex-shrink: 0;
}
.alert-icon-btn:hover {
  background-color: #FFF7ED;
  color: #F97316;
  border-color: #FED7AA;
}
.alert-icon-btn__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #EF4444;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* ── KPI cards ──────────────────────────────────────────────────────── */
.kpi-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem;
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 0.875rem;
  transition: box-shadow 0.2s, transform 0.2s;
}
.kpi-card:hover {
  box-shadow: 0 4px 16px rgba(11, 53, 88, 0.09);
  transform: translateY(-2px);
}
.kpi-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.kpi-card__label {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.kpi-card__value {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.1;
}
.kpi-card__skeleton {
  width: 80px;
  height: 28px;
  border-radius: 6px;
  background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
.kpi-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 0.75rem;
  flex-shrink: 0;
}
.kpi-card__icon i {
  font-size: 1.4rem;
}

/* ── Panels ─────────────────────────────────────────────────────────── */
.panel {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 0.875rem;
  padding: 1.25rem;
}
.panel__title {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0B3558;
}
.panel__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  color: #0E7490;
  font-size: 1.4rem;
}

/* ── Link button ────────────────────────────────────────────────────── */
.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: none;
  background: none;
  color: #0E7490;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.link-btn:hover { color: #0B3558; }

/* ── Bar chart ──────────────────────────────────────────────────────── */
.chart-container {
  position: relative;
  padding-bottom: 0.5rem;
}
.chart-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.chart-grid__line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed #E2E8F0;
}
.chart-grid__label {
  position: absolute;
  left: 0;
  top: -12px;
  font-size: 0.65rem;
  color: #CBD5E1;
}
.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 200px;
  padding: 1rem 2rem 0;
  position: relative;
}
.chart-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.chart-bar-col__amount {
  font-size: 0.65rem;
  color: #64748B;
  text-align: center;
  min-height: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.chart-bar-col__bar {
  width: 100%;
  background: linear-gradient(180deg, #0E7490 0%, #155E75 100%);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: height 0.5s ease;
}
.chart-bar-col__label {
  font-size: 0.75rem;
  color: #94A3B8;
  font-weight: 500;
}
.chart-axis {
  height: 1px;
  background: #E2E8F0;
  margin: 0 2rem;
}

/* ── Alert cards ────────────────────────────────────────────────────── */
.alert-card {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid #F1F5F9;
  border-radius: 0.625rem;
  background: #FAFAFA;
}
.alert-card__icon {
  font-size: 1rem;
  margin-top: 2px;
  flex-shrink: 0;
}
.alert-card__body {
  flex: 1;
  overflow: hidden;
}
.alert-card__product {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: #1E293B;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.alert-card__message {
  margin: 0.2rem 0 0;
  font-size: 0.73rem;
  color: #64748B;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.alert-card__badge {
  flex-shrink: 0;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

/* ── Quick-action card grid ─────────────────────────────────────────── */
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  padding: 1rem 0.75rem;
  border: 1px solid #E2E8F0;
  border-radius: 0.875rem;
  background: #fff;
  cursor: pointer;
  transition: box-shadow 0.18s, transform 0.15s, border-color 0.15s;
}
.action-card:hover {
  box-shadow: 0 4px 14px rgba(11, 53, 88, 0.09);
  transform: translateY(-2px);
  border-color: #CBD5E1;
}
.action-card:active { transform: translateY(0); }
.action-card__circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
}
.action-card__circle i { font-size: 1.2rem; }
.action-card__label {
  margin: 0;
  font-size: 0.83rem;
  font-weight: 700;
  color: #1E293B;
}
.action-card__sub {
  margin: 0;
  font-size: 0.72rem;
  color: #94A3B8;
  line-height: 1.3;
}

/* ── Mayor stock rows ───────────────────────────────────────────────── */
.stock-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #F1F5F9;
}
.stock-row:last-child { border-bottom: none; }
.stock-row__info { overflow: hidden; }
.stock-row__name {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: #1E293B;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stock-row__qty {
  margin: 0.15rem 0 0;
  font-size: 0.75rem;
  color: #64748B;
}
.stock-row__badge {
  flex-shrink: 0;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.73rem;
  font-weight: 700;
  background: #DCFCE7;
  color: #16A34A;
  white-space: nowrap;
}

/* ── Error banner ───────────────────────────────────────────────────── */
.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.625rem;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  color: #DC2626;
  font-size: 0.85rem;
}

/* ── Shimmer animation ──────────────────────────────────────────────── */
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
