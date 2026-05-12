<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter }                from 'vue-router';
import { useI18n }                  from 'vue-i18n';
import useProductStore              from '../../application/product.store.js';
import useIamStore                  from '../../../iam/application/iam.store.js';

const { t }        = useI18n();
const router       = useRouter();
const productStore = useProductStore();
const iamStore     = useIamStore();

const { errors } = productStore;

/** Whether the form submitted successfully. */
const submitSuccess = ref(false);

/** Selected intake reason. */
const intakeReason = ref('');

/** Selected supplier id. */
const selectedSupplierId = ref('');

/** Validation errors. */
const formErrors = ref({ reason: '' });

/**
 * The list of product intake lines.
 * Each line has a unique entryId, a productId, quantity, warehouseId and expirationDate.
 * @type {import('vue').Ref<Array<{entryId: string, productId: string, quantity: number, warehouseId: string, expirationDate: string}>>}
 */
const intakeLines = ref([
  { entryId: '1', productId: '', quantity: 0, warehouseId: '', expirationDate: '' }
]);

/** Warehouse options loaded from the store. */
const warehouseOptions = ref([]);

/** Supplier options loaded from the store. */
const supplierOptions = ref([]);

/** Product options derived from the store. */
const productOptions = computed(() =>
    productStore.products.map(product => ({ label: product.name, value: String(product.id) }))
);

const intakeReasonOptions = [
  { label: t('batch-intake.reason-purchase'),   value: 'PURCHASE'   },
  { label: t('batch-intake.reason-return'),     value: 'RETURN'     },
  { label: t('batch-intake.reason-transfer'),   value: 'TRANSFER'   },
  { label: t('batch-intake.reason-adjustment'), value: 'ADJUSTMENT' }
];

onMounted(async () => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (businessId) {
    if (!productStore.productsLoaded) productStore.fetchProducts(businessId);
    productStore.fetchInventory(businessId);

    const warehouses = await productStore.fetchWarehousesForBusiness(businessId);
    warehouseOptions.value = warehouses.map(warehouse => ({
      label: warehouse.name,
      value: String(warehouse.id)
    }));

    const suppliers = await productStore.fetchSuppliersForBusiness(businessId);
    supplierOptions.value = suppliers.map(supplier => ({
      label: supplier.name,
      value: String(supplier.id)
    }));
  }
});

/**
 * Adds a new empty intake line to the list.
 */
function addLine() {
  intakeLines.value.push({
    entryId:        String(Date.now()),
    productId:      '',
    quantity:       0,
    warehouseId:    '',
    expirationDate: ''
  });
}

/**
 * Removes a line by its entryId.
 * Business rule: at least one line must remain.
 * @param {string} entryId
 */
function removeLine(entryId) {
  if (intakeLines.value.length === 1) return;
  intakeLines.value = intakeLines.value.filter(line => line.entryId !== entryId);
}

/**
 * Validates the form.
 * Business rules:
 * - intakeReason must be selected.
 * - At least one line must have productId and quantity > 0.
 * - Each line with a productId must have quantity > 0.
 *
 * @returns {boolean}
 */
function validateForm() {
  formErrors.value = { reason: '' };
  let isValid = true;

  if (!intakeReason.value) {
    formErrors.value.reason = t('batch-intake.error-reason');
    isValid = false;
  }

  const validLines = intakeLines.value.filter(line => line.productId && line.quantity > 0);
  if (validLines.length === 0) {
    isValid = false;
  }

  intakeLines.value.forEach((line, index) => {
    if (line.productId && line.quantity <= 0) {
      isValid = false;
    }
  });

  return isValid;
}

/**
 * Submits all valid intake lines via the store's registerStockIntake.
 * Business rule: only lines with a productId and quantity > 0 are processed.
 */
function submitBatchIntake() {
  if (!validateForm()) return;

  const businessId = iamStore.currentUser?.businessId ?? null;

  intakeLines.value
      .filter(line => line.productId && line.quantity > 0)
      .forEach(line => {
        productStore.registerStockIntake({
          productId:   parseInt(line.productId),
          businessId:  businessId,
          quantity:    line.quantity,
          warehouseId: line.warehouseId ? parseInt(line.warehouseId) : null
        });
      });

  submitSuccess.value = true;
  setTimeout(() => router.push({ name: 'product-stock-intake-history' }), 2000);
}

/** Navigates back to the product list. */
function navigateBack() {
  router.push({ name: 'products' });
}
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">

    <!-- Header -->
    <div class="flex align-items-center gap-3">
      <button
          class="flex align-items-center justify-content-center border-round-lg border-none cursor-pointer"
          style="width: 36px; height: 36px; background: none;"
          @click="navigateBack"
          @mouseenter="$event.currentTarget.style.backgroundColor = '#F1F5F9'"
          @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
      >
        <i class="pi pi-arrow-left" style="color: #0B3558; font-size: 1.1rem;"/>
      </button>
      <div>
        <h1 class="m-0" style="color: #0B3558; font-size: 2rem; font-weight: 700;">{{ t('batch-intake.title') }}</h1>
        <p class="m-0 mt-1" style="color: #64748B;">{{ t('batch-intake.subtitle') }}</p>
      </div>
    </div>

    <!-- Success banner -->
    <div v-if="submitSuccess" class="p-3 border-round-lg" style="background-color: #DCFCE7; border: 1px solid #22C55E;">
      <p class="m-0" style="color: #22C55E;">{{ t('batch-intake.success') }}</p>
    </div>

    <!-- General Information -->
    <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
      <h3 class="m-0 mb-4" style="color: #0B3558;">{{ t('batch-intake.section-general') }}</h3>
      <div class="grid m-0" style="gap: 1rem;">
        <div class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.9rem; font-weight: 500;">
            {{ t('batch-intake.reason') }}
          </label>
          <pv-select
              v-model="intakeReason"
              :options="intakeReasonOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('batch-intake.reason-placeholder')"
              class="w-full"
          />
          <p v-if="formErrors.reason" class="m-0 mt-1" style="color: #EF4444; font-size: 0.8rem;">{{ formErrors.reason }}</p>
        </div>
        <div class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.9rem; font-weight: 500;">
            {{ t('batch-intake.supplier') }}
          </label>
          <pv-select
              v-model="selectedSupplierId"
              :options="supplierOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('batch-intake.supplier-placeholder')"
              class="w-full"
          />
        </div>
      </div>
    </div>

    <!-- Products to intake -->
    <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
      <div class="flex align-items-center justify-content-between mb-4">
        <h3 class="m-0" style="color: #0B3558;">
          {{ t('batch-intake.section-products', { count: intakeLines.length }) }}
        </h3>
        <button
            class="flex align-items-center gap-2 px-3 py-2 border-round-lg cursor-pointer"
            style="background: none; border: 1px solid #E2E8F0; color: #0B3558; font-size: 0.875rem;"
            @click="addLine"
            @mouseenter="$event.currentTarget.style.backgroundColor = '#F8FAFC'"
            @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
        >
          <i class="pi pi-plus" style="font-size: 0.85rem;"/>
          {{ t('batch-intake.add-product') }}
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div
            v-for="(line, index) in intakeLines"
            :key="line.entryId"
            class="p-4 border-round-lg"
            style="border: 1px solid #E2E8F0;"
        >
          <div class="flex align-items-center justify-content-between mb-3">
            <p class="m-0 text-sm" style="color: #64748B; font-weight: 500;">
              {{ t('batch-intake.product-number', { number: index + 1 }) }}
            </p>
            <button
                v-if="intakeLines.length > 1"
                class="flex align-items-center justify-content-center border-round border-none cursor-pointer"
                style="width: 28px; height: 28px; background: none;"
                @click="removeLine(line.entryId)"
                @mouseenter="$event.currentTarget.style.backgroundColor = '#FEE2E2'"
                @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
            >
              <i class="pi pi-trash" style="color: #EF4444; font-size: 0.85rem;"/>
            </button>
          </div>

          <div class="grid m-0" style="gap: 0.75rem;">
            <!-- Product selector (2 cols) -->
            <div class="col-12 md:col-6 p-0">
              <label class="block mb-2 text-sm" style="color: #1E293B; font-weight: 500;">
                {{ t('batch-intake.product-label') }}
              </label>
              <pv-select
                  v-model="line.productId"
                  :options="productOptions"
                  option-label="label"
                  option-value="value"
                  :placeholder="t('batch-intake.product-placeholder')"
                  class="w-full"
              />
            </div>

            <!-- Quantity -->
            <div class="col-12 md:col-3 p-0">
              <label class="block mb-2 text-sm" style="color: #1E293B; font-weight: 500;">
                {{ t('batch-intake.quantity-label') }}
              </label>
              <input
                  v-model.number="line.quantity"
                  type="number"
                  min="1"
                  placeholder="0"
                  style="width: 100%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 0.9rem; outline: none; color: #1E293B; box-sizing: border-box;"
              />
            </div>

            <!-- Warehouse -->
            <div class="col-12 md:col-3 p-0">
              <label class="block mb-2 text-sm" style="color: #1E293B; font-weight: 500;">
                {{ t('batch-intake.warehouse-label') }}
              </label>
              <pv-select
                  v-model="line.warehouseId"
                  :options="warehouseOptions"
                  option-label="label"
                  option-value="value"
                  :placeholder="t('batch-intake.warehouse-placeholder')"
                  class="w-full"
              />
            </div>

            <!-- Expiration date (2 cols) -->
            <div class="col-12 md:col-6 p-0">
              <label class="block mb-2 text-sm" style="color: #1E293B; font-weight: 500;">
                {{ t('batch-intake.expiration-label') }}
              </label>
              <input
                  v-model="line.expirationDate"
                  type="date"
                  style="width: 100%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 0.9rem; outline: none; color: #1E293B; box-sizing: border-box;"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Info banner -->
    <div class="flex align-items-start gap-3 p-4 border-round-xl" style="background-color: #E0F2FE;">
      <i class="pi pi-box" style="font-size: 1.3rem; color: #0E7490; flex-shrink: 0; margin-top: 2px;"/>
      <div>
        <p class="m-0 font-semibold" style="color: #0B3558;">{{ t('batch-intake.info-title') }}</p>
        <p class="m-0 mt-1 text-sm" style="color: #64748B;">{{ t('batch-intake.info-body') }}</p>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex gap-3 justify-content-end">
      <button
          class="px-4 py-2 border-round-lg cursor-pointer"
          style="background: none; border: 1px solid #E2E8F0; color: #64748B; font-size: 0.95rem;"
          @click="navigateBack"
      >
        {{ t('batch-intake.cancel') }}
      </button>
      <button
          class="flex align-items-center gap-2 px-4 py-2 border-round-lg cursor-pointer border-none"
          style="background-color: #0B3558; color: #FAFAF7; font-size: 0.95rem; font-weight: 500;"
          @click="submitBatchIntake"
      >
        <i class="pi pi-save"/>
        {{ t('batch-intake.save') }}
      </button>
    </div>

    <p v-if="errors.length" style="color: #EF4444; font-size: 0.875rem;">
      {{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}
    </p>

  </div>
</template>

<style scoped>
</style>