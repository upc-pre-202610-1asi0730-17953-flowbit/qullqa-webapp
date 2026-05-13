<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter }                from 'vue-router';
import { useI18n }                  from 'vue-i18n';
import useIamStore                  from '../../../iam/application/iam.store.js';

const { t }      = useI18n();
const router     = useRouter();
const iamStore   = useIamStore();

/**
 * IDs of currently expanded intake rows.
 * @type {import('vue').Ref<number[]>}
 */
const expandedIds = ref([]);

/** Filter value for intake reason. */
const filterReason = ref('todos');

/**
 * Intake records loaded from the purchases endpoint.
 * Each record is enriched with its purchase details client-side.
 * @type {import('vue').Ref<Array>}
 */
const intakeRecords = ref([]);

/** Whether the intake list has been loaded. */
const intakeLoaded = ref(false);

const filterOptions = [
  { label: t('stock-intake.filter-all'),        value: 'todos'         },
  { label: t('stock-intake.filter-purchase'),   value: 'PURCHASE'      },
  { label: t('stock-intake.filter-return'),     value: 'RETURN'        },
  { label: t('stock-intake.filter-transfer'),   value: 'TRANSFER'      },
  { label: t('stock-intake.filter-adjustment'), value: 'ADJUSTMENT'    }
];

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (businessId) {
    loadIntakeRecords(businessId);
  }
});

/**
 * Loads purchase records for the business and maps them to intake record objects.
 * Uses the purchases + purchaseDetails endpoints via direct fetch to avoid
 * coupling the product store to purchase domain logic.
 *
 * @param {number|string} businessId
 */
function loadIntakeRecords(businessId) {
  const baseUrl = import.meta.env.VITE_QULLQA_API_BASE_URL.trim();
  Promise.all([
    fetch(`${baseUrl}/purchases?businessId=${businessId}`).then(response => response.json()),
    fetch(`${baseUrl}/purchaseDetails`).then(response => response.json()),
    fetch(`${baseUrl}/products?businessId=${businessId}`).then(response => response.json()),
    fetch(`${baseUrl}/suppliers?businessId=${businessId}`).then(response => response.json())
  ])
      .then(([purchases, purchaseDetails, products, suppliers]) => {
        intakeRecords.value = purchases.map(purchase => {
          const details      = purchaseDetails.filter(detail => detail.purchaseId === purchase.id);
          const supplierData = suppliers.find(supplier => supplier.id === purchase.supplierId);
          const productLines = details.map(detail => {
            const productData = products.find(product => product.id === detail.productId);
            return {
              productName: productData ? productData.name : `Producto #${detail.productId}`,
              quantity:    detail.quantity
            };
          });
          return {
            id:            purchase.id,
            date:          purchase.date,
            reason:        purchase.status,
            supplierName:  supplierData ? supplierData.name : null,
            description:   purchase.description,
            productLines,
            totalUnits:    productLines.reduce((sum, line) => sum + line.quantity, 0)
          };
        });
        intakeLoaded.value = true;
      })
      .catch(error => console.error('Error loading intake records:', error));
}

/**
 * Intake records filtered by the selected reason.
 * @type {import('vue').ComputedRef<Array>}
 */
const filteredRecords = computed(() => {
  if (filterReason.value === 'todos') return intakeRecords.value;
  return intakeRecords.value.filter(record => record.reason === filterReason.value);
});

/**
 * Total units across all loaded intake records.
 * @type {import('vue').ComputedRef<number>}
 */
const totalUnitsIngested = computed(() =>
    intakeRecords.value.reduce((sum, record) => sum + record.totalUnits, 0)
);

/**
 * The most recent intake date formatted for display.
 * @type {import('vue').ComputedRef<string>}
 */
const lastIntakeDate = computed(() => {
  if (!intakeRecords.value.length) return '—';
  const sortedRecords = [...intakeRecords.value].sort(
      (firstRecord, secondRecord) => new Date(secondRecord.date) - new Date(firstRecord.date)
  );
  return new Date(sortedRecords[0].date).toLocaleDateString('es-PE');
});

/**
 * Toggles the expanded state for an intake row.
 * @param {number} intakeId
 */
function toggleExpand(intakeId) {
  if (expandedIds.value.includes(intakeId)) {
    expandedIds.value = expandedIds.value.filter(existingId => existingId !== intakeId);
  } else {
    expandedIds.value.push(intakeId);
  }
}

/**
 * Returns true when the given intake row is expanded.
 * @param {number} intakeId
 * @returns {boolean}
 */
function isExpanded(intakeId) {
  return expandedIds.value.includes(intakeId);
}

/**
 * Formats an ISO date string to a locale date string.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('es-PE');
}

/** Navigates to the batch intake form. */
function navigateToBatchIntake() {
  router.push({ name: 'product-batch-intake' });
}
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">

    <!-- ── Header ───────────────────────────────────────────────────── -->
    <div class="flex align-items-center justify-content-between flex-wrap gap-3">
      <div>
        <h1 class="m-0" style="color: #0B3558; font-size: 2rem; font-weight: 700;">
          {{ t('stock-intake.title') }}
        </h1>
        <p class="m-0 mt-1" style="color: #64748B;">{{ t('stock-intake.subtitle') }}</p>
      </div>
      <button
          class="flex align-items-center gap-2 px-4 py-2 border-round-lg cursor-pointer border-none"
          style="background-color: #0B3558; color: #FAFAF7; font-size: 0.95rem; font-weight: 500;"
          @click="navigateToBatchIntake"
      >
        <i class="pi pi-box"/>
        {{ t('stock-intake.new-intake') }}
      </button>
    </div>

    <!-- ── 3 Summary cards ────────────────────────────────────────────── -->
    <div class="grid m-0" style="gap: 1rem;">
      <div class="col-12 md:col-4 p-0">
        <div class="flex align-items-center justify-content-between p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
          <div>
            <p class="m-0 text-sm" style="color: #64748B;">{{ t('stock-intake.summary-total') }}</p>
            <p class="m-0 mt-2" style="color: #22C55E; font-size: 1.75rem; font-weight: 700;">{{ intakeRecords.length }}</p>
          </div>
          <div class="flex align-items-center justify-content-center border-round-lg" style="width: 48px; height: 48px; background-color: #DCFCE7;">
            <i class="pi pi-box" style="color: #22C55E; font-size: 1.3rem;"/>
          </div>
        </div>
      </div>
      <div class="col-12 md:col-4 p-0">
        <div class="flex align-items-center justify-content-between p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
          <div>
            <p class="m-0 text-sm" style="color: #64748B;">{{ t('stock-intake.summary-units') }}</p>
            <p class="m-0 mt-2" style="color: #0E7490; font-size: 1.75rem; font-weight: 700;">{{ totalUnitsIngested }}</p>
            <p class="m-0 mt-1 text-xs" style="color: #64748B;">{{ t('stock-intake.summary-units-sub') }}</p>
          </div>
          <div class="flex align-items-center justify-content-center border-round-lg" style="width: 48px; height: 48px; background-color: #E0F2FE;">
            <i class="pi pi-calendar" style="color: #0E7490; font-size: 1.3rem;"/>
          </div>
        </div>
      </div>
      <div class="col-12 md:col-4 p-0">
        <div class="flex align-items-center justify-content-between p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
          <div>
            <p class="m-0 text-sm" style="color: #64748B;">{{ t('stock-intake.summary-last') }}</p>
            <p class="m-0 mt-2" style="color: #0B3558; font-size: 1rem; font-weight: 600;">{{ lastIntakeDate }}</p>
          </div>
          <div class="flex align-items-center justify-content-center border-round-lg" style="width: 48px; height: 48px; background-color: #DCFCE7;">
            <i class="pi pi-user" style="color: #22C55E; font-size: 1.3rem;"/>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Filter + Collapsible list ─────────────────────────────────── -->
    <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">

      <!-- Filter row -->
      <div class="flex align-items-center justify-content-between mb-5">
        <h3 class="m-0" style="color: #0B3558;">{{ t('stock-intake.filter-label') }}</h3>
        <pv-select
            v-model="filterReason"
            :options="filterOptions"
            option-label="label"
            option-value="value"
            style="min-width: 200px;"
        />
      </div>

      <!-- Loading -->
      <div v-if="!intakeLoaded" class="flex justify-content-center py-6">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; color: #0E7490;"/>
      </div>

      <!-- Records -->
      <div v-else style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div
            v-for="record in filteredRecords"
            :key="record.id"
            class="border-round-lg"
            style="border: 1px solid #E2E8F0; overflow: hidden;"
        >
          <!-- Row header (clickable) -->
          <div
              class="p-4 cursor-pointer"
              style="transition: background-color 0.15s;"
              @click="toggleExpand(record.id)"
              @mouseenter="$event.currentTarget.style.backgroundColor = '#FAFAF7'"
              @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
          >
            <div class="flex align-items-start gap-3">
              <div
                  class="flex align-items-center justify-content-center border-round-lg flex-shrink-0"
                  style="width: 44px; height: 44px; background-color: #DCFCE7;"
              >
                <i class="pi pi-box" style="color: #22C55E; font-size: 1.1rem;"/>
              </div>
              <div style="flex: 1; min-width: 0;">
                <div class="flex flex-wrap align-items-center gap-2 mb-2">
                                    <span style="color: #1E293B; font-weight: 500; font-size: 0.95rem;">
                                        {{ formatDate(record.date) }}
                                    </span>
                  <span
                      class="border-round px-2 py-1"
                      style="font-size: 0.72rem; font-weight: 600; background-color: #E0F2FE; color: #0E7490;"
                  >
                                        {{ record.description }}
                                    </span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <p v-if="record.supplierName" class="m-0 text-sm" style="color: #64748B;">
                    {{ t('stock-intake.supplier-label', { name: record.supplierName }) }}
                  </p>
                  <p class="m-0 text-sm" style="color: #64748B;">
                    {{ t('stock-intake.products-summary', { count: record.productLines.length, total: record.totalUnits }) }}
                  </p>
                </div>
              </div>
              <i
                  class="flex-shrink-0"
                  :class="isExpanded(record.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                  style="color: #64748B; font-size: 1rem; margin-top: 4px;"
              />
            </div>
          </div>

          <!-- Expanded detail -->
          <div v-if="isExpanded(record.id)" class="px-4 pb-4" style="border-top: 1px solid #E2E8F0;">
            <p class="mt-3 mb-2 text-sm" style="color: #64748B;">{{ t('stock-intake.detail-title') }}</p>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <div
                  v-for="(line, index) in record.productLines"
                  :key="index"
                  class="flex align-items-center justify-content-between p-3 border-round"
                  style="background-color: #FAFAF7;"
              >
                <span style="color: #1E293B; font-size: 0.9rem;">{{ line.productName }}</span>
                <span
                    class="border-round px-2 py-1"
                    style="font-size: 0.78rem; font-weight: 700; background-color: #DCFCE7; color: #22C55E;"
                >
                                    +{{ line.quantity }}
                                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
</style>