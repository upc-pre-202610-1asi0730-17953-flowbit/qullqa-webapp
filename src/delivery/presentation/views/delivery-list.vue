<script setup>
import { computed, onMounted, ref, toRefs } from 'vue';
import { useI18n }                           from 'vue-i18n';
import useDeliveryStore                      from '../../application/delivery.store.js';
import useIamStore                           from '../../../iam/application/iam.store.js';
import useProductStore                       from '../../../product/application/product.store.js';
import { DeliveryStatus }                    from '../../domain/model/delivery.entity.js';
import DeliveryDetailModal                   from './delivery-detail-modal.vue';
import DeliveryFormModal                     from './delivery-form-modal.vue';

const { t }           = useI18n();
const deliveryStore   = useDeliveryStore();
const iamStore        = useIamStore();
const productStore    = useProductStore();

const {
  deliveries,
  deliveriesLoaded,
  inTransitDeliveries,
  inTransitCount,
  atDestinationCount,
  completedCount,
  totalCount
} = toRefs(deliveryStore);

const { fetchDeliveries, loadDeliveryWaypoints } = deliveryStore;

// ─── Local state ────────────────────────────────────────────────────────────

/**
 * Controls the visibility of the register delivery modal.
 * @type {import('vue').Ref<boolean>}
 */
const showRegisterModal = ref(false);

/**
 * The delivery currently open in the detail panel modal.
 * Null when no detail panel is visible.
 * @type {import('vue').Ref<import('../../domain/model/delivery.entity.js').Delivery|null>}
 */
const selectedDelivery = ref(null);

/**
 * Current search query string applied to the delivery list.
 * @type {import('vue').Ref<string>}
 */
const searchQuery = ref('');

/**
 * Status filter currently active. 'ALL' means no status filter.
 * @type {import('vue').Ref<string>}
 */
const activeStatusFilter = ref('ALL');

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (!deliveriesLoaded.value) fetchDeliveries(businessId);
  if (!productStore.productsLoaded) productStore.fetchProducts(businessId);
});

// ─── Filtering ───────────────────────────────────────────────────────────────

/**
 * Deliveries filtered by the active status pill and search query.
 * Search matches tracking number, supplier name, or driver name (case-insensitive).
 * @type {import('vue').ComputedRef<import('../../domain/model/delivery.entity.js').Delivery[]>}
 */
const filteredDeliveries = computed(() => {
  const queryLower = searchQuery.value.toLowerCase().trim();
  return deliveries.value.filter(deliveryItem => {
    const matchesStatus = activeStatusFilter.value === 'ALL'
        || deliveryItem.status === activeStatusFilter.value;
    const matchesSearch = !queryLower
        || deliveryItem.trackingNumber.toLowerCase().includes(queryLower)
        || deliveryItem.supplierName.toLowerCase().includes(queryLower)
        || deliveryItem.driverName.toLowerCase().includes(queryLower);
    return matchesStatus && matchesSearch;
  });
});

// ─── Status config ────────────────────────────────────────────────────────────

/**
 * Configuration map for delivery status UI (label key, color, background, border).
 * @type {Record<string, { labelKey: string, color: string, bg: string, border: string }>}
 */
const statusConfig = {
  [DeliveryStatus.REGISTERED]:     { labelKey: 'tracking.status-registered',     color: '#0891B2', bg: '#CFFAFE', border: '#A5F3FC' },
  [DeliveryStatus.IN_TRANSIT]:     { labelKey: 'tracking.status-in-transit',     color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  [DeliveryStatus.AT_DESTINATION]: { labelKey: 'tracking.status-at-destination', color: '#7C3AED', bg: '#EDE9FE', border: '#C4B5FD' },
  [DeliveryStatus.COMPLETED]:      { labelKey: 'tracking.status-completed',       color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' },
  [DeliveryStatus.CANCELLED]:      { labelKey: 'tracking.status-cancelled',       color: '#EF4444', bg: '#FEE2E2', border: '#FECACA' }
};

/**
 * Icon classes for each status (PrimeIcons).
 * @type {Record<string, string>}
 */
const statusIconClass = {
  [DeliveryStatus.REGISTERED]:     'pi pi-box',
  [DeliveryStatus.IN_TRANSIT]:     'pi pi-truck',
  [DeliveryStatus.AT_DESTINATION]: 'pi pi-map-marker',
  [DeliveryStatus.COMPLETED]:      'pi pi-check-circle',
  [DeliveryStatus.CANCELLED]:      'pi pi-times-circle'
};

/**
 * Status filter pill definitions shown in the filter bar.
 * @type {Array<{ key: string, labelKey: string }>}
 */
const statusFilterPills = [
  { key: 'ALL',                           labelKey: 'tracking.filter-all'            },
  { key: DeliveryStatus.IN_TRANSIT,       labelKey: 'tracking.status-in-transit'     },
  { key: DeliveryStatus.AT_DESTINATION,   labelKey: 'tracking.status-at-destination' },
  { key: DeliveryStatus.REGISTERED,       labelKey: 'tracking.status-registered'     },
  { key: DeliveryStatus.COMPLETED,        labelKey: 'tracking.status-completed'       },
  { key: DeliveryStatus.CANCELLED,        labelKey: 'tracking.status-cancelled'       }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the pill/badge style object for a given delivery status.
 * @param {string} status - DeliveryStatus value.
 * @returns {Object} Vue style binding object.
 */
function getStatusBadgeStyle(status) {
  const config = statusConfig[status];
  if (!config) return {};
  return {
    backgroundColor: config.bg,
    color:           config.color,
    border:          `1px solid ${config.border}`
  };
}

/**
 * Returns the style for an active status filter pill.
 * @param {string} key - Filter key or 'ALL'.
 * @returns {Object} Vue style binding object.
 */
function getPillStyle(key) {
  const isActive = activeStatusFilter.value === key;
  if (!isActive) return { backgroundColor: '#F1F5F9', color: '#64748B' };
  if (key === 'ALL') return { backgroundColor: '#0B3558', color: '#fff' };
  const config = statusConfig[key];
  return {
    backgroundColor: config.bg,
    color:           config.color,
    border:          `1.5px solid ${config.border}`
  };
}

/**
 * Formats an ISO date string into a readable locale date-time.
 * @param {string|null} isoString - ISO 8601 date string.
 * @returns {string} Formatted string or '—' when null/empty.
 */
function formatDateTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('es-PE', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Opens the delivery detail panel for the selected delivery.
 * Loads waypoints on demand if not already cached.
 * @param {import('../../domain/model/delivery.entity.js').Delivery} delivery - Delivery to inspect.
 */
async function openDeliveryDetail(delivery) {
  selectedDelivery.value = delivery;
  await loadDeliveryWaypoints(delivery.id);
  // Re-assign to trigger reactivity after waypoints injection
  selectedDelivery.value = deliveryStore.getDeliveryById(delivery.id) ?? delivery;
}

/**
 * Closes the delivery detail panel.
 */
function closeDeliveryDetail() {
  selectedDelivery.value = null;
}

/**
 * Handles a delivery update event emitted by the detail modal.
 * Refreshes the selected delivery reference from the store.
 */
function handleDeliveryUpdated() {
  if (selectedDelivery.value) {
    selectedDelivery.value = deliveryStore.getDeliveryById(selectedDelivery.value.id)
        ?? selectedDelivery.value;
  }
}

/**
 * Handles a delivery being marked completed or updated to AT_DESTINATION.
 * Closes the detail modal after completion.
 */
function handleDeliveryCompleted() {
  selectedDelivery.value = null;
}

/**
 * Handles a new delivery registered from the form modal.
 * Closes the form modal after successful registration.
 */
function handleDeliveryCreated() {
  showRegisterModal.value = false;
}
</script>

<template>
  <div class="flex flex-column" style="gap: 0; min-height: 0;">

    <!-- ── Page header ──────────────────────────────────────────────────── -->
    <div class="flex align-items-center justify-content-between mb-4">
      <div>
        <h1 class="m-0" style="font-size: 1.35rem; font-weight: 700; color: #0B3558; line-height: 1.2;">
          {{ t('tracking.title') }}
        </h1>
        <p class="m-0 mt-1" style="color: #64748B; font-size: 0.82rem;">
          {{ t('tracking.subtitle') }}
        </p>
      </div>
      <button
          class="flex align-items-center gap-2 px-4 py-2 border-none border-round-lg cursor-pointer"
          style="background-color: #0B3558; color: #fff; font-size: 0.85rem; font-weight: 600; flex-shrink: 0;"
          @click="showRegisterModal = true"
      >
        <i class="pi pi-plus" style="font-size: 0.85rem;"/>
        <span class="hidden sm:inline">{{ t('tracking.btn-register') }}</span>
      </button>
    </div>

    <!-- ── Stats bar ────────────────────────────────────────────────────── -->
    <div class="grid mb-4" style="grid-template-columns: repeat(4, 1fr); gap: 0.75rem;">

      <div class="border-round-xl px-4 py-3" style="background-color: #FEF3C7;">
        <p class="m-0" style="font-size: 0.68rem; color: #D97706; font-weight: 600; text-transform: uppercase;">
          {{ t('tracking.stat-in-transit') }}
        </p>
        <p class="m-0 mt-1" style="font-size: 1.4rem; font-weight: 800; color: #D97706;">
          {{ inTransitCount }}
        </p>
      </div>

      <div class="border-round-xl px-4 py-3" style="background-color: #EDE9FE;">
        <p class="m-0" style="font-size: 0.68rem; color: #7C3AED; font-weight: 600; text-transform: uppercase;">
          {{ t('tracking.stat-at-destination') }}
        </p>
        <p class="m-0 mt-1" style="font-size: 1.4rem; font-weight: 800; color: #7C3AED;">
          {{ atDestinationCount }}
        </p>
      </div>

      <div class="border-round-xl px-4 py-3" style="background-color: #DCFCE7;">
        <p class="m-0" style="font-size: 0.68rem; color: #16A34A; font-weight: 600; text-transform: uppercase;">
          {{ t('tracking.stat-completed') }}
        </p>
        <p class="m-0 mt-1" style="font-size: 1.4rem; font-weight: 800; color: #16A34A;">
          {{ completedCount }}
        </p>
      </div>

      <div class="border-round-xl px-4 py-3" style="background-color: #E0F2FE;">
        <p class="m-0" style="font-size: 0.68rem; color: #0B3558; font-weight: 600; text-transform: uppercase;">
          {{ t('tracking.stat-total') }}
        </p>
        <p class="m-0 mt-1" style="font-size: 1.4rem; font-weight: 800; color: #0B3558;">
          {{ totalCount }}
        </p>
      </div>

    </div>

    <!-- ── Live / in-transit section ────────────────────────────────────── -->
    <div v-if="inTransitDeliveries.length > 0" class="mb-4">
      <div class="flex align-items-center gap-2 mb-3">
        <div class="relative" style="width: 8px; height: 8px;">
          <span
              class="absolute border-circle"
              style="width: 8px; height: 8px; background-color: #0E7490; opacity: 0.5; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"
          />
          <span
              class="border-circle"
              style="width: 8px; height: 8px; background-color: #0E7490; display: block;"
          />
        </div>
        <p class="m-0" style="font-size: 0.85rem; font-weight: 700; color: #0B3558;">
          {{ inTransitCount }} {{ t('tracking.live-label') }}
        </p>
      </div>

      <!-- Live delivery cards grid -->
      <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.75rem;">
        <button
            v-for="liveDelivery in inTransitDeliveries"
            :key="liveDelivery.id"
            class="text-left border-round-xl p-4 border-none cursor-pointer"
            style="background-color: #0B3558; border: 1px solid rgba(14,116,144,0.4); transition: border-color 0.15s;"
            @click="openDeliveryDetail(liveDelivery)"
            @mouseenter="(event) => { event.currentTarget.style.borderColor = '#0E7490'; }"
            @mouseleave="(event) => { event.currentTarget.style.borderColor = 'rgba(14,116,144,0.4)'; }"
        >
          <!-- Live card header -->
          <div class="flex align-items-start justify-content-between mb-3">
            <div>
              <div class="flex align-items-center gap-2">
                <span style="font-size: 0.9rem; font-weight: 700; color: #fff;">
                  {{ liveDelivery.trackingNumber }}
                </span>
                <span
                    class="flex align-items-center gap-1 px-2 py-1 border-round-full"
                    style="background-color: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3);"
                >
                  <span class="live-dot border-circle" style="width: 6px; height: 6px; background-color: #38BDF8; display: inline-block;"/>
                  <span style="font-size: 0.62rem; color: #38BDF8; font-weight: 700;">EN VIVO</span>
                </span>
              </div>
              <p class="m-0 mt-1" style="font-size: 0.72rem; color: #7FA8BF;">
                {{ liveDelivery.supplierName }}
              </p>
            </div>
            <i class="pi pi-wifi" style="color: #38BDF8; font-size: 1rem; flex-shrink: 0;"/>
          </div>

          <!-- Current location -->
          <p class="m-0 mb-3" style="font-size: 0.78rem; color: #93B5C9;">
            📍 {{ liveDelivery.currentLabel || '—' }}
          </p>

          <!-- Progress bar -->
          <div class="border-round-full mb-1" style="height: 6px; background-color: rgba(255,255,255,0.1);">
            <div
                class="border-round-full"
                style="height: 6px; background-color: #0E7490; transition: width 0.5s;"
                :style="{ width: liveDelivery.routeProgress + '%' }"
            />
          </div>
          <div class="flex justify-content-between mb-3">
            <span style="font-size: 0.62rem; color: #7FA8BF;">{{ t('tracking.origin') }}</span>
            <span style="font-size: 0.62rem; color: #38BDF8; font-weight: 600;">
              {{ liveDelivery.routeProgress }}% {{ t('tracking.progress-label') }}
            </span>
            <span style="font-size: 0.62rem; color: #7FA8BF;">{{ t('tracking.destination') }}</span>
          </div>

          <!-- Driver + vehicle footer -->
          <div
              class="flex align-items-center gap-2 pt-2"
              style="border-top: 1px solid rgba(255,255,255,0.08);"
          >
            <i class="pi pi-truck" style="color: #7FA8BF; font-size: 0.8rem; flex-shrink: 0;"/>
            <span style="font-size: 0.72rem; color: #7FA8BF;">
              {{ liveDelivery.driverName }} · {{ liveDelivery.vehicle }}
            </span>
            <i class="pi pi-chevron-right ml-auto" style="color: #0E7490; font-size: 0.75rem; flex-shrink: 0;"/>
          </div>
        </button>
      </div>
    </div>

    <!-- ── All deliveries section ────────────────────────────────────────── -->
    <div>
      <p class="m-0 mb-3" style="font-size: 0.85rem; font-weight: 700; color: #0B3558;">
        {{ t('tracking.history-title') }}
      </p>

      <!-- Filters row -->
      <div class="flex flex-column sm:flex-row gap-2 mb-4">

        <!-- Search input -->
        <div class="relative flex-1">
          <i
              class="pi pi-search absolute"
              style="left: 12px; top: 50%; transform: translateY(-50%); color: #94A3B8; font-size: 0.85rem;"
          />
          <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('tracking.search-placeholder')"
              class="w-full border-round-lg"
              style="padding: 0.55rem 0.75rem 0.55rem 2.25rem; border: 1px solid #E2E8F0; font-size: 0.85rem; color: #1E293B; outline: none; background-color: #fff;"
              @focus="(event) => { event.target.style.borderColor = '#0E7490'; }"
              @blur="(event) => { event.target.style.borderColor = '#E2E8F0'; }"
          />
        </div>

        <!-- Status filter pills -->
        <div class="flex gap-1 overflow-x-auto" style="flex-wrap: nowrap; padding-bottom: 2px;">
          <button
              v-for="pill in statusFilterPills"
              :key="pill.key"
              class="border-none border-round-lg cursor-pointer px-3 py-2"
              style="font-size: 0.72rem; font-weight: 600; white-space: nowrap; flex-shrink: 0; transition: all 0.15s;"
              :style="getPillStyle(pill.key)"
              @click="activeStatusFilter = pill.key"
          >
            {{ t(pill.labelKey) }}
          </button>
        </div>

      </div>

      <!-- ── Desktop table ─────────────────────────────────────────────── -->
      <div class="hidden md:block bg-white border-round-xl overflow-hidden mb-4" style="border: 1px solid #E2E8F0;">
        <table class="w-full" style="border-collapse: collapse;">
          <thead>
          <tr style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
            <th
                v-for="columnHeader in [
                  t('tracking.col-id'),
                  t('tracking.col-supplier'),
                  t('tracking.col-driver'),
                  t('tracking.col-registered'),
                  t('tracking.col-estimated'),
                  t('tracking.col-status'),
                  ''
                ]"
                :key="columnHeader"
                class="text-left px-4 py-3"
                style="font-size: 0.72rem; font-weight: 600; color: #94A3B8;"
            >
              {{ columnHeader }}
            </th>
          </tr>
          </thead>
          <tbody>
          <tr
              v-for="deliveryItem in filteredDeliveries"
              :key="deliveryItem.id"
              style="border-bottom: 1px solid #F1F5F9; transition: background-color 0.1s;"
              @mouseenter="(event) => { event.currentTarget.style.backgroundColor = '#F8FAFC'; }"
              @mouseleave="(event) => { event.currentTarget.style.backgroundColor = 'transparent'; }"
          >
            <!-- Tracking number + order ref -->
            <td class="px-4 py-3">
              <div class="flex align-items-center gap-2">
                  <span style="font-size: 0.82rem; font-weight: 700; color: #0B3558;">
                    {{ deliveryItem.trackingNumber }}
                  </span>
                <span
                    v-if="deliveryItem.isLive"
                    class="border-circle live-pulse"
                    style="width: 6px; height: 6px; background-color: #0E7490; display: inline-block;"
                />
              </div>
              <span style="font-size: 0.68rem; color: #94A3B8;">
                  {{ deliveryItem.orderId || '—' }}
                </span>
            </td>

            <!-- Supplier -->
            <td class="px-4 py-3" style="font-size: 0.78rem; color: #1E293B;">
              {{ deliveryItem.supplierName }}
            </td>

            <!-- Driver + vehicle -->
            <td class="px-4 py-3">
              <p class="m-0" style="font-size: 0.78rem; color: #1E293B;">{{ deliveryItem.driverName }}</p>
              <p class="m-0" style="font-size: 0.68rem; color: #94A3B8;">{{ deliveryItem.vehicle }}</p>
            </td>

            <!-- Registered at -->
            <td class="px-4 py-3" style="font-size: 0.72rem; color: #64748B;">
              {{ formatDateTime(deliveryItem.registeredAt) }}
            </td>

            <!-- Estimated or completed -->
            <td class="px-4 py-3" style="font-size: 0.72rem; color: #64748B;">
              {{ deliveryItem.completedAt
                ? formatDateTime(deliveryItem.completedAt)
                : formatDateTime(deliveryItem.estimatedArrival) }}
            </td>

            <!-- Status badge -->
            <td class="px-4 py-3">
                <span
                    class="flex align-items-center gap-1 border-round-md px-2 py-1 inline-flex"
                    style="font-size: 0.7rem; font-weight: 600;"
                    :style="getStatusBadgeStyle(deliveryItem.status)"
                >
                  <i :class="statusIconClass[deliveryItem.status]" style="font-size: 0.7rem;"/>
                  {{ t(statusConfig[deliveryItem.status]?.labelKey ?? '') }}
                </span>
            </td>

            <!-- Actions -->
            <td class="px-4 py-3">
              <button
                  class="flex align-items-center gap-1 border-none border-round-lg px-3 py-1 cursor-pointer"
                  style="background-color: #E0F2FE; color: #0E7490; font-size: 0.72rem; font-weight: 600; transition: background-color 0.15s;"
                  @click="openDeliveryDetail(deliveryItem)"
                  @mouseenter="(event) => { event.currentTarget.style.backgroundColor = '#BAE6FD'; }"
                  @mouseleave="(event) => { event.currentTarget.style.backgroundColor = '#E0F2FE'; }"
              >
                <i class="pi pi-eye" style="font-size: 0.72rem;"/>
                {{ t('tracking.btn-detail') }}
              </button>
            </td>
          </tr>
          </tbody>
        </table>

        <!-- Empty state -->
        <div
            v-if="filteredDeliveries.length === 0"
            class="flex flex-column align-items-center justify-content-center py-6"
            style="gap: 0.5rem;"
        >
          <i class="pi pi-map-marker" style="font-size: 2rem; color: #CBD5E1;"/>
          <p class="m-0" style="color: #94A3B8; font-size: 0.88rem;">
            {{ t('tracking.no-results') }}
          </p>
        </div>
      </div>

      <!-- ── Mobile cards ───────────────────────────────────────────────── -->
      <div class="md:hidden flex flex-column gap-3 mb-4">
        <button
            v-for="deliveryItem in filteredDeliveries"
            :key="deliveryItem.id"
            class="w-full text-left bg-white border-round-xl p-4 border-none cursor-pointer"
            style="border: 1px solid #E2E8F0; transition: border-color 0.15s;"
            @click="openDeliveryDetail(deliveryItem)"
            @mouseenter="(event) => { event.currentTarget.style.borderColor = '#BAE6FD'; }"
            @mouseleave="(event) => { event.currentTarget.style.borderColor = '#E2E8F0'; }"
        >
          <div class="flex align-items-start justify-content-between mb-2">
            <div>
              <div class="flex align-items-center gap-2">
                <span style="font-size: 0.9rem; font-weight: 700; color: #0B3558;">
                  {{ deliveryItem.trackingNumber }}
                </span>
                <span
                    v-if="deliveryItem.isLive"
                    class="border-circle live-pulse"
                    style="width: 6px; height: 6px; background-color: #0E7490; display: inline-block;"
                />
              </div>
              <p class="m-0" style="font-size: 0.72rem; color: #94A3B8;">
                {{ deliveryItem.supplierName }}
              </p>
            </div>
            <span
                class="flex align-items-center gap-1 border-round-md px-2 py-1"
                style="font-size: 0.68rem; font-weight: 600;"
                :style="getStatusBadgeStyle(deliveryItem.status)"
            >
              <i :class="statusIconClass[deliveryItem.status]" style="font-size: 0.65rem;"/>
              {{ t(statusConfig[deliveryItem.status]?.labelKey ?? '') }}
            </span>
          </div>

          <div class="grid mb-2" style="grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <div class="border-round-lg p-2" style="background-color: #F8FAFC;">
              <p class="m-0" style="font-size: 0.6rem; color: #94A3B8;">{{ t('tracking.col-driver') }}</p>
              <p class="m-0" style="font-size: 0.78rem; font-weight: 600; color: #1E293B;">
                {{ deliveryItem.driverName }}
              </p>
            </div>
            <div class="border-round-lg p-2" style="background-color: #F8FAFC;">
              <p class="m-0" style="font-size: 0.6rem; color: #94A3B8;">{{ t('tracking.col-vehicle') }}</p>
              <p class="m-0" style="font-size: 0.78rem; font-weight: 600; color: #1E293B;">
                {{ deliveryItem.vehicle }}
              </p>
            </div>
          </div>

          <div class="flex align-items-center gap-1">
            <i class="pi pi-map-marker" style="color: #0E7490; font-size: 0.75rem; flex-shrink: 0;"/>
            <span style="font-size: 0.72rem; color: #64748B;">{{ deliveryItem.currentLabel || '—' }}</span>
            <i class="pi pi-chevron-right ml-auto" style="color: #0E7490; font-size: 0.72rem; flex-shrink: 0;"/>
          </div>
        </button>

        <!-- Mobile empty state -->
        <div
            v-if="filteredDeliveries.length === 0"
            class="flex flex-column align-items-center justify-content-center py-6"
            style="gap: 0.5rem;"
        >
          <i class="pi pi-map-marker" style="font-size: 2rem; color: #CBD5E1;"/>
          <p class="m-0" style="color: #94A3B8; font-size: 0.88rem;">
            {{ t('tracking.no-results') }}
          </p>
        </div>
      </div>
    </div>

    <!-- ── Modals ─────────────────────────────────────────────────────────── -->
    <delivery-detail-modal
        v-if="selectedDelivery"
        :delivery="selectedDelivery"
        @close="closeDeliveryDetail"
        @updated="handleDeliveryUpdated"
        @completed="handleDeliveryCompleted"
    />

    <delivery-form-modal
        v-if="showRegisterModal"
        @close="showRegisterModal = false"
        @created="handleDeliveryCreated"
    />

  </div>
</template>

<style scoped>
/* Live pulse animation for in-transit dots */
@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

.live-pulse {
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

/* Responsive stats grid */
@media (max-width: 640px) {
  .grid[style*="repeat(4, 1fr)"] {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
</style>
