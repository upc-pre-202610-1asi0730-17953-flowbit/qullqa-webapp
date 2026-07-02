<script setup>
import { computed } from 'vue';
import { useI18n }  from 'vue-i18n';
import useDeliveryStore from '../../application/delivery.store.js';
import useProductStore  from '../../../product/application/product.store.js';
import { DeliveryStatus } from '../../domain/model/delivery.entity.js';

const props = defineProps({
  /**
   * The Delivery entity to display in the detail panel.
   * @type {import('../../domain/model/delivery.entity.js').Delivery}
   */
  delivery: {
    type:     Object,
    required: true
  }
});

const emit = defineEmits([
  /** Emitted when the modal should close. */
  'close',
  /** Emitted after a location simulation or status change (not completion). */
  'updated',
  /** Emitted when the delivery is marked as COMPLETED. */
  'completed'
]);

const { t }         = useI18n();
const deliveryStore = useDeliveryStore();
const productStore  = useProductStore();

/**
 * Resolves a productId to its display name, falling back to the raw id.
 * @param {number} productId
 * @returns {string}
 */
function getProductName(productId) {
  const product = productStore.products.find(productItem => productItem.id === productId);
  return product ? product.name : `#${productId}`;
}

// ─── Status config ─────────────────────────────────────────────────────────

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
 * Returns the badge style object for the current delivery status.
 * @type {import('vue').ComputedRef<Object>}
 */
const statusBadgeStyle = computed(() => {
  const config = statusConfig[props.delivery.status];
  if (!config) return {};
  return {
    backgroundColor: config.bg,
    color:           config.color,
    border:          `1px solid ${config.border}`
  };
});

/**
 * Whether the delivery can be transitioned from REGISTERED to IN_TRANSIT.
 * @type {import('vue').ComputedRef<boolean>}
 */
const canStartTransit = computed(() => props.delivery.canStartTransit);

/**
 * Whether the update-location (IoT simulation) action is available.
 * @type {import('vue').ComputedRef<boolean>}
 */
const canUpdateLocation = computed(() => props.delivery.canUpdateLocation);

/**
 * Whether the complete delivery action is available.
 * @type {import('vue').ComputedRef<boolean>}
 */
const canComplete = computed(() => props.delivery.canComplete);

// ─── Waypoint helpers ───────────────────────────────────────────────────────

/**
 * Returns true when the given waypoint is the currently active one
 * (the last reached waypoint while status is IN_TRANSIT).
 * @param {import('../../domain/model/waypoint.entity.js').Waypoint} waypointItem
 * @param {number} waypointIndex
 * @returns {boolean}
 */
function isCurrentWaypoint(waypointItem, waypointIndex) {
  const reachedCount = props.delivery.reachedWaypointsCount;
  return waypointItem.reached
      && waypointIndex === reachedCount - 1
      && props.delivery.isInTransit;
}

/**
 * Formats an ISO date string into a readable locale date-time.
 * @param {string|null} isoString
 * @returns {string}
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

// ─── Actions ────────────────────────────────────────────────────────────────

/**
 * Transitions the delivery from REGISTERED to IN_TRANSIT.
 */
async function handleStartTransit() {
  if (!canStartTransit.value) return;
  await deliveryStore.startTransit(props.delivery);
  emit('updated');
}

/**
 * Triggers a simulated IoT location update for the delivery,
 * advancing to the next waypoint.
 */
async function handleSimulateUpdate() {
  if (!canUpdateLocation.value) return;
  await deliveryStore.simulateLocationUpdate(props.delivery);
  emit('updated');
}

/**
 * Marks the delivery as COMPLETED and emits the completed event.
 */
async function handleComplete() {
  if (!canComplete.value) return;
  await deliveryStore.completeDelivery(props.delivery);
  emit('completed');
}
</script>

<template>
  <!-- Overlay backdrop -->
  <div
      class="fixed inset-0 flex align-items-end sm:align-items-center justify-content-center"
      style="z-index: 50; background-color: rgba(0,0,0,0.6);"
      @click.self="emit('close')"
  >
    <!-- Panel -->
    <div
        class="w-full bg-white"
        style="
        max-width: 520px;
        border-radius: 1.25rem 1.25rem 0 0;
        max-height: 92dvh;
        overflow-y: auto;
        border: 1px solid #E2E8F0;
      "
    >
      <!-- Sticky header -->
      <div
          class="flex align-items-center justify-content-between px-5 pt-5 pb-3 sticky top-0 bg-white"
          style="border-bottom: 1px solid #F1F5F9;"
      >
        <div class="flex align-items-center gap-2">
          <p class="m-0" style="font-size: 1rem; font-weight: 700; color: #0B3558;">
            {{ delivery.trackingNumber }}
          </p>
          <span
              class="flex align-items-center gap-1 border-round-md px-2 py-1"
              style="font-size: 0.7rem; font-weight: 600;"
              :style="statusBadgeStyle"
          >
            {{ t(statusConfig[delivery.status]?.labelKey ?? '') }}
          </span>
        </div>
        <button
            class="flex align-items-center justify-content-center border-none border-round-lg cursor-pointer"
            style="width: 32px; height: 32px; background: none; color: #94A3B8;"
            @click="emit('close')"
        >
          <i class="pi pi-times" style="font-size: 1rem;"/>
        </button>
      </div>

      <div class="px-5 py-4 flex flex-column gap-4">

        <!-- ── Route visualizer ─────────────────────────────────────────── -->
        <div
            class="border-round-xl p-4"
            style="background-color: #0B3558; position: relative; overflow: hidden;"
        >
          <!-- Decorative background rings -->
          <div
              v-for="ringIndex in 5"
              :key="ringIndex"
              class="absolute border-circle border-1"
              style="border-color: rgba(255,255,255,0.04); transform: translate(-50%,-50%); top: 50%; left: 50%;"
              :style="{
              width:  (ringIndex * 80) + 'px',
              height: (ringIndex * 80) + 'px'
            }"
          />

          <!-- Visualizer header -->
          <div class="relative flex align-items-center justify-content-between mb-4">
            <div>
              <p class="m-0" style="color: #7FA8BF; font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                {{ t('tracking.route-live') }}
              </p>
              <p class="m-0 mt-1" style="color: #fff; font-size: 0.9rem; font-weight: 700;">
                {{ delivery.trackingNumber }}
              </p>
            </div>
            <div
                v-if="delivery.isLive"
                class="flex align-items-center gap-2 px-3 py-1 border-round-full"
                style="background-color: rgba(14,116,144,0.3); border: 1px solid rgba(14,116,144,0.5);"
            >
              <span
                  class="relative border-circle"
                  style="width: 8px; height: 8px; display: inline-block;"
              >
                <span
                    class="absolute border-circle"
                    style="width: 8px; height: 8px; background-color: #0E7490; opacity: 0.6; animation: ping-ring 1.5s infinite;"
                />
                <span
                    class="border-circle"
                    style="width: 8px; height: 8px; background-color: #38BDF8; display: block;"
                />
              </span>
              <span style="color: #38BDF8; font-size: 0.65rem; font-weight: 700;">EN VIVO</span>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="relative mb-4">
            <div class="border-round-full" style="height: 6px; background-color: rgba(255,255,255,0.1);">
              <div
                  class="border-round-full"
                  style="height: 6px; background-color: #0E7490; transition: width 0.7s;"
                  :style="{ width: delivery.routeProgress + '%' }"
              />
            </div>
            <div class="flex justify-content-between mt-1">
              <span style="font-size: 0.62rem; color: #7FA8BF;">{{ t('tracking.origin') }}</span>
              <span style="font-size: 0.62rem; color: #7FA8BF;">{{ delivery.routeProgress }}% {{ t('tracking.progress-label') }}</span>
              <span style="font-size: 0.62rem; color: #7FA8BF;">{{ t('tracking.destination') }}</span>
            </div>
          </div>

          <!-- Waypoints stepper -->
          <div class="flex flex-column relative">
            <div
                v-for="(waypointItem, waypointIndex) in delivery.waypoints"
                :key="waypointItem.id ?? waypointIndex"
                class="flex gap-3"
            >
              <!-- Dot and connector line -->
              <div class="flex flex-column align-items-center">
                <div
                    class="flex align-items-center justify-content-center border-circle flex-shrink-0"
                    style="width: 28px; height: 28px; z-index: 1; transition: all 0.3s;"
                    :style="{
                    backgroundColor: waypointItem.reached
                      ? (isCurrentWaypoint(waypointItem, waypointIndex) ? '#0E7490' : 'rgba(14,116,144,0.25)')
                      : 'rgba(255,255,255,0.06)',
                    border: `2px solid ${waypointItem.reached
                      ? (isCurrentWaypoint(waypointItem, waypointIndex) ? '#38BDF8' : '#0E7490')
                      : 'rgba(255,255,255,0.15)'}`
                  }"
                >
                  <!-- Origin flag icon -->
                  <i
                      v-if="waypointItem.isOrigin && waypointItem.reached"
                      class="pi pi-flag-fill"
                      :style="{ color: isCurrentWaypoint(waypointItem, waypointIndex) ? '#fff' : '#0E7490', fontSize: '0.6rem' }"
                  />
                  <!-- Last waypoint pin -->
                  <i
                      v-else-if="waypointIndex === delivery.waypoints.length - 1"
                      class="pi pi-map-marker"
                      :style="{ color: waypointItem.reached ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }"
                  />
                  <!-- Reached but not current -->
                  <i
                      v-else-if="waypointItem.reached && !isCurrentWaypoint(waypointItem, waypointIndex)"
                      class="pi pi-check"
                      style="color: #0E7490; font-size: 0.6rem;"
                  />
                  <!-- Currently active waypoint pulsing indicator -->
                  <template v-else-if="isCurrentWaypoint(waypointItem, waypointIndex)">
                    <span
                        class="absolute border-circle"
                        style="width: 28px; height: 28px; background-color: #0E7490; opacity: 0.3; animation: ping-ring 1.5s infinite;"
                    />
                    <i class="pi pi-compass" style="color: #fff; font-size: 0.65rem; z-index: 1;"/>
                  </template>
                  <!-- Not yet reached -->
                  <span
                      v-else
                      class="border-circle"
                      style="width: 8px; height: 8px; background-color: rgba(255,255,255,0.2); display: block;"
                  />
                </div>
                <!-- Vertical connector line -->
                <div
                    v-if="waypointIndex < delivery.waypoints.length - 1"
                    style="width: 2px; flex: 1; min-height: 24px; margin: 2px 0; transition: background-color 0.3s;"
                    :style="{
                    backgroundColor: waypointItem.reached
                      ? 'rgba(14,116,144,0.5)'
                      : 'rgba(255,255,255,0.08)'
                  }"
                />
              </div>

              <!-- Waypoint info -->
              <div class="pb-4 flex-1 min-w-0">
                <p
                    class="m-0"
                    style="font-size: 0.82rem; line-height: 1.3; transition: color 0.3s;"
                    :style="{
                    color:      waypointItem.reached ? '#fff' : 'rgba(255,255,255,0.35)',
                    fontWeight: isCurrentWaypoint(waypointItem, waypointIndex) ? 700 : 500
                  }"
                >
                  {{ waypointItem.label }}
                </p>
                <p
                    class="m-0"
                    style="font-size: 0.68rem;"
                    :style="{ color: waypointItem.reached ? '#7FA8BF' : 'rgba(255,255,255,0.2)' }"
                >
                  {{ waypointItem.district }}
                  <span v-if="waypointItem.timestamp">
                    · {{ formatDateTime(waypointItem.timestamp) }}
                  </span>
                </p>
                <!-- Coordinates for the current waypoint -->
                <span
                    v-if="isCurrentWaypoint(waypointItem, waypointIndex)"
                    style="font-family: monospace; font-size: 0.68rem; color: #64748B;"
                >
                  {{ waypointItem.latitude.toFixed(4) }}, {{ waypointItem.longitude.toFixed(4) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Current GPS position footer (in transit only) -->
          <div
              v-if="delivery.isInTransit"
              class="flex align-items-center gap-2 mt-1 pt-3"
              style="border-top: 1px solid rgba(255,255,255,0.08);"
          >
            <i class="pi pi-compass" style="color: #38BDF8; font-size: 0.8rem; flex-shrink: 0;"/>
            <div>
              <p class="m-0" style="font-size: 0.65rem; color: #7FA8BF;">{{ t('tracking.current-position') }}</p>
              <span style="font-family: monospace; font-size: 0.7rem; color: #94A3B8;">
                {{ delivery.currentLatitude.toFixed(4) }}, {{ delivery.currentLongitude.toFixed(4) }}
              </span>
            </div>
          </div>
        </div>

        <!-- ── Driver + vehicle grid ─────────────────────────────────────── -->
        <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div class="border-round-xl p-3" style="background-color: #F8FAFC; border: 1px solid #E2E8F0;">
            <div class="flex align-items-center gap-2 mb-1">
              <i class="pi pi-user" style="color: #0E7490; font-size: 0.78rem;"/>
              <p class="m-0" style="font-size: 0.65rem; color: #94A3B8;">{{ t('tracking.field-driver') }}</p>
            </div>
            <p class="m-0" style="font-size: 0.85rem; font-weight: 600; color: #1E293B;">
              {{ delivery.driverName || '—' }}
            </p>
            <div class="flex align-items-center gap-1 mt-1">
              <i class="pi pi-phone" style="color: #94A3B8; font-size: 0.65rem;"/>
              <p class="m-0" style="font-size: 0.72rem; color: #64748B;">
                {{ delivery.driverPhone || '—' }}
              </p>
            </div>
          </div>
          <div class="border-round-xl p-3" style="background-color: #F8FAFC; border: 1px solid #E2E8F0;">
            <div class="flex align-items-center gap-2 mb-1">
              <i class="pi pi-truck" style="color: #0E7490; font-size: 0.78rem;"/>
              <p class="m-0" style="font-size: 0.65rem; color: #94A3B8;">{{ t('tracking.field-vehicle') }}</p>
            </div>
            <p class="m-0" style="font-size: 0.85rem; font-weight: 600; color: #1E293B;">
              {{ delivery.vehicle || '—' }}
            </p>
            <p class="m-0 mt-1" style="font-size: 0.72rem; color: #64748B;">
              {{ delivery.licensePlate || '—' }}
            </p>
          </div>
        </div>

        <!-- ── Info grid ─────────────────────────────────────────────────── -->
        <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div
              v-for="infoField in [
              { label: t('tracking.field-supplier'),  value: delivery.supplierName      },
              { label: t('tracking.field-order-ref'), value: delivery.orderId || '—'   },
              { label: t('tracking.field-registered'), value: formatDateTime(delivery.registeredAt) },
              { label: t('tracking.field-estimated'),  value: formatDateTime(delivery.estimatedArrival) },
              ...(delivery.completedAt ? [{ label: t('tracking.field-completed'), value: formatDateTime(delivery.completedAt) }] : []),
              { label: t('tracking.field-weight'),    value: delivery.totalWeightValue ? `${delivery.totalWeightValue} ${delivery.totalWeightUnit}` : '—' }
            ]"
              :key="infoField.label"
              class="border-round-xl p-3"
              style="background-color: #F8FAFC; border: 1px solid #E2E8F0;"
          >
            <p class="m-0" style="font-size: 0.65rem; color: #94A3B8; margin-bottom: 2px;">
              {{ infoField.label }}
            </p>
            <p class="m-0" style="font-size: 0.82rem; font-weight: 600; color: #1E293B;">
              {{ infoField.value }}
            </p>
          </div>
        </div>

        <!-- ── Products in shipment ─────────────────────────────────────── -->
        <div
            v-if="delivery.products && delivery.products.length > 0"
            class="border-round-xl p-4"
            style="background-color: #F8FAFC; border: 1px solid #E2E8F0;"
        >
          <p class="m-0 mb-3" style="font-size: 0.75rem; font-weight: 600; color: #64748B;">
            {{ t('tracking.field-products') }}
          </p>
          <div class="flex flex-column gap-2">
            <div
                v-for="(productLine, productIndex) in delivery.products"
                :key="productIndex"
                class="flex align-items-center gap-2"
            >
              <i class="pi pi-box" style="color: #0E7490; font-size: 0.75rem; flex-shrink: 0;"/>
              <span style="font-size: 0.82rem; color: #1E293B;">
                {{ getProductName(productLine.productId) }} ×{{ productLine.quantity }}
              </span>
            </div>
          </div>
        </div>

        <!-- ── Origin → Destination ─────────────────────────────────────── -->
        <div
            class="border-round-xl p-4 flex flex-column gap-3"
            style="background-color: #F0FDFA; border: 1px solid #99F6E4;"
        >
          <div class="flex align-items-start gap-2">
            <i class="pi pi-flag-fill mt-1 flex-shrink-0" style="color: #0E7490; font-size: 0.8rem;"/>
            <div>
              <p class="m-0" style="font-size: 0.62rem; color: #0E7490; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                {{ t('tracking.label-origin') }}
              </p>
              <p class="m-0 mt-1" style="font-size: 0.82rem; color: #1E293B;">
                {{ delivery.origin || '—' }}
              </p>
            </div>
          </div>
          <div class="flex align-items-start gap-2">
            <i class="pi pi-map-marker mt-1 flex-shrink-0" style="color: #0B3558; font-size: 0.8rem;"/>
            <div>
              <p class="m-0" style="font-size: 0.62rem; color: #0B3558; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                {{ t('tracking.label-destination') }}
              </p>
              <p class="m-0 mt-1" style="font-size: 0.82rem; color: #1E293B;">
                {{ delivery.destination || '—' }}
              </p>
            </div>
          </div>
        </div>

        <!-- ── Action buttons ────────────────────────────────────────────── -->
        <div v-if="canStartTransit || canUpdateLocation || canComplete" class="flex flex-column gap-2">

          <!-- Start transit button (REGISTERED → IN_TRANSIT) -->
          <button
              v-if="canStartTransit"
              class="w-full flex align-items-center justify-content-center gap-2 py-2 border-none border-round-xl cursor-pointer"
              style="background-color: #DBEAFE; color: #1D4ED8; font-size: 0.88rem; font-weight: 600; transition: background-color 0.15s;"
              @click="handleStartTransit"
              @mouseenter="(event) => { event.currentTarget.style.backgroundColor = '#BFDBFE'; }"
              @mouseleave="(event) => { event.currentTarget.style.backgroundColor = '#DBEAFE'; }"
          >
            <i class="pi pi-play-circle" style="font-size: 0.88rem;"/>
            {{ t('tracking.btn-start-transit') }}
          </button>

          <!-- Simulate IoT update button -->
          <button
              v-if="canUpdateLocation"
              class="w-full flex align-items-center justify-content-center gap-2 py-2 border-none border-round-xl cursor-pointer"
              style="background-color: #FEF3C7; color: #D97706; font-size: 0.88rem; font-weight: 600; transition: background-color 0.15s;"
              @click="handleSimulateUpdate"
              @mouseenter="(event) => { event.currentTarget.style.backgroundColor = '#FDE68A'; }"
              @mouseleave="(event) => { event.currentTarget.style.backgroundColor = '#FEF3C7'; }"
          >
            <i class="pi pi-sync" style="font-size: 0.88rem;"/>
            {{ t('tracking.btn-simulate-update') }}
          </button>

          <!-- Complete delivery button -->
          <button
              v-if="canComplete"
              class="w-full flex align-items-center justify-content-center gap-2 py-2 border-none border-round-xl cursor-pointer"
              style="background-color: #DCFCE7; color: #16A34A; font-size: 0.88rem; font-weight: 600; transition: background-color 0.15s;"
              @click="handleComplete"
              @mouseenter="(event) => { event.currentTarget.style.backgroundColor = '#BBF7D0'; }"
              @mouseleave="(event) => { event.currentTarget.style.backgroundColor = '#DCFCE7'; }"
          >
            <i class="pi pi-check-circle" style="font-size: 0.88rem;"/>
            {{ t('tracking.btn-mark-completed') }}
          </button>

        </div>

        <!-- Close button -->
        <button
            class="w-full py-2 border-none border-round-xl cursor-pointer"
            style="background-color: #0B3558; color: #fff; font-size: 0.88rem; font-weight: 600;"
            @click="emit('close')"
        >
          {{ t('tracking.btn-close') }}
        </button>

      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes ping-ring {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

/* Rounded bottom corners on larger screens */
@media (min-width: 640px) {
  div[style*="border-radius: 1.25rem"] {
    border-radius: 1.25rem !important;
  }
}
</style>
