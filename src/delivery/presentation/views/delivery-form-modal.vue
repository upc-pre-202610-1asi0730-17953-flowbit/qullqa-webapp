<script setup>
import { reactive, computed } from 'vue';
import { useI18n }            from 'vue-i18n';
import useDeliveryStore       from '../../application/delivery.store.js';
import useIamStore            from '../../../iam/application/iam.store.js';
import useProductStore        from '../../../product/application/product.store.js';

const emit = defineEmits([
  /** Emitted when the modal should close without saving. */
  'close',
  /** Emitted after a delivery has been successfully registered. */
  'created'
]);

const { t }         = useI18n();
const deliveryStore = useDeliveryStore();
const iamStore      = useIamStore();
const productStore  = useProductStore();

const availableProducts = computed(() =>
    productStore.products.filter(product => product.isActive)
);

// ─── Form state ──────────────────────────────────────────────────────────────

/**
 * Reactive form data for the new delivery registration.
 * All text fields default to empty; weight is numeric + unit.
 */
const formData = reactive({
  supplierName:     '',
  orderId:          '',
  origin:           '',
  destination:      '',
  driverName:       '',
  driverPhone:      '',
  vehicle:          '',
  licensePlate:     '',
  estimatedArrival: '',
  totalWeightValue: '',
  totalWeightUnit:  'kg'
});

/**
 * Structured product lines for the shipment: { productId, quantity }.
 * Optional — a shipment can be registered without a product breakdown.
 * @type {import('vue').Ref<Array<{ productId: string, quantity: number }>>}
 */
const productLines = reactive([{ productId: '', quantity: 1 }]);

/**
 * Adds a new empty product line.
 */
function addProductLine() {
  productLines.push({ productId: '', quantity: 1 });
}

/**
 * Removes a product line at the given index (keeps at least one).
 * @param {number} lineIndex
 */
function removeProductLine(lineIndex) {
  if (productLines.length <= 1) return;
  productLines.splice(lineIndex, 1);
}

/**
 * Tracks whether a save attempt has been made (to show validation errors).
 */
const submitted = reactive({ value: false });

/**
 * Whether the current user is loading (saving to API).
 */
const saving = reactive({ value: false });

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validation error messages keyed by field name.
 * Returns an empty string when a field is valid.
 * @type {import('vue').ComputedRef<Record<string, string>>}
 */
const validationErrors = computed(() => {
  const errorMap = {};

  errorMap.supplierName = formData.supplierName.trim().length < 2
      ? t('tracking.error-supplier-name')
      : '';

  errorMap.origin = formData.origin.trim().length < 5
      ? t('tracking.error-origin')
      : '';

  errorMap.destination = formData.destination.trim().length < 5
      ? t('tracking.error-destination')
      : '';

  errorMap.driverName = formData.driverName.trim().length < 2
      ? t('tracking.error-driver-name')
      : '';

  errorMap.driverPhone = !/^\d{3}[-\s]?\d{3}[-\s]?\d{3,4}$/.test(formData.driverPhone.trim())
      ? t('tracking.error-driver-phone')
      : '';

  errorMap.estimatedArrival = formData.estimatedArrival.trim() === ''
      ? t('tracking.error-estimated-arrival')
      : '';

  return errorMap;
});

/**
 * Whether the form is currently valid and ready to submit.
 * @type {import('vue').ComputedRef<boolean>}
 */
const isFormValid = computed(() =>
    Object.values(validationErrors.value).every(errorMessage => errorMessage === '')
);

// ─── Form field definitions ───────────────────────────────────────────────────

/**
 * Definition array for rendering form inputs dynamically.
 * span: true means the field spans the full width of the 2-column grid.
 * @type {Array<{ key: string, labelKey: string, placeholderKey: string, type?: string, span?: boolean, required?: boolean }>}
 */
const formFields = [
  {
    key:            'supplierName',
    labelKey:       'tracking.field-supplier',
    placeholderKey: 'tracking.placeholder-supplier',
    required:       true
  },
  {
    key:            'orderId',
    labelKey:       'tracking.field-order-ref',
    placeholderKey: 'tracking.placeholder-order-ref'
  },
  {
    key:            'origin',
    labelKey:       'tracking.field-origin',
    placeholderKey: 'tracking.placeholder-origin',
    span:           true,
    required:       true
  },
  {
    key:            'destination',
    labelKey:       'tracking.field-destination',
    placeholderKey: 'tracking.placeholder-destination',
    span:           true,
    required:       true
  },
  {
    key:            'driverName',
    labelKey:       'tracking.field-driver-name',
    placeholderKey: 'tracking.placeholder-driver-name',
    required:       true
  },
  {
    key:            'driverPhone',
    labelKey:       'tracking.field-driver-phone',
    placeholderKey: 'tracking.placeholder-driver-phone',
    required:       true
  },
  {
    key:            'vehicle',
    labelKey:       'tracking.field-vehicle',
    placeholderKey: 'tracking.placeholder-vehicle'
  },
  {
    key:            'licensePlate',
    labelKey:       'tracking.field-license-plate',
    placeholderKey: 'tracking.placeholder-license-plate'
  },
  {
    key:            'estimatedArrival',
    labelKey:       'tracking.field-estimated',
    placeholderKey: 'tracking.placeholder-estimated',
    required:       true
  }
];

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Handles form submission. Validates fields, then calls the store's
 * createDelivery action. Emits 'created' on success.
 */
async function handleSubmit() {
  submitted.value = true;
  if (!isFormValid.value || saving.value) return;

  saving.value = true;
  const businessId = iamStore.currentUser?.businessId ?? null;

  const productList = productLines
      .filter(line => line.productId && line.quantity > 0)
      .map(line => ({ productId: parseInt(line.productId), quantity: parseInt(line.quantity) }));

  const result = await deliveryStore.createDelivery({
    orderId:          formData.orderId.trim(),
    supplierName:     formData.supplierName.trim(),
    origin:           formData.origin.trim(),
    destination:      formData.destination.trim(),
    driverName:       formData.driverName.trim(),
    driverPhone:      formData.driverPhone.trim(),
    vehicle:          formData.vehicle.trim(),
    licensePlate:     formData.licensePlate.trim(),
    estimatedArrival: formData.estimatedArrival.trim(),
    products:         productList,
    totalWeightValue: parseFloat(formData.totalWeightValue) || 0,
    totalWeightUnit:  formData.totalWeightUnit,
    businessId:       businessId
  });

  saving.value = false;

  if (result.success) {
    emit('created');
  }
}
</script>

<template>
  <!-- Overlay backdrop -->
  <div
      class="fixed inset-0 flex align-items-end sm:align-items-center justify-content-center"
      style="z-index: 50; background-color: rgba(0,0,0,0.5);"
      @click.self="emit('close')"
  >
    <!-- Modal panel -->
    <div
        class="w-full bg-white"
        style="
        max-width: 540px;
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
        <h2 class="m-0" style="font-size: 1.05rem; font-weight: 700; color: #0B3558;">
          {{ t('tracking.form-title') }}
        </h2>
        <button
            class="flex align-items-center justify-content-center border-none border-round-lg cursor-pointer"
            style="width: 32px; height: 32px; background: none; color: #94A3B8;"
            @click="emit('close')"
        >
          <i class="pi pi-times" style="font-size: 1rem;"/>
        </button>
      </div>

      <!-- Form body -->
      <div class="px-5 py-4">
        <div class="mb-4" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">

          <div
              v-for="field in formFields"
              :key="field.key"
              :style="field.span ? 'grid-column: 1 / -1;' : ''"
          >
            <label
                class="block mb-1"
                style="font-size: 0.75rem; font-weight: 600; color: #64748B;"
            >
              {{ t(field.labelKey) }}<span v-if="field.required" style="color: #EF4444;"> *</span>
            </label>

            <input
                v-model="formData[field.key]"
                type="text"
                :placeholder="t(field.placeholderKey)"
                class="w-full border-round-lg"
                style="padding: 0.5rem 0.75rem; font-size: 0.88rem; color: #1E293B; outline: none; transition: border-color 0.15s;"
                :style="{
                border: submitted.value && validationErrors[field.key]
                  ? '1.5px solid #EF4444'
                  : '1px solid #E2E8F0'
              }"
                @focus="(event) => { event.target.style.borderColor = '#0E7490'; }"
                @blur="(event) => {
                event.target.style.borderColor = submitted.value && validationErrors[field.key]
                  ? '#EF4444'
                  : '#E2E8F0';
              }"
            />

            <!-- Validation error message -->
            <p
                v-if="submitted.value && validationErrors[field.key]"
                class="m-0 mt-1"
                style="font-size: 0.7rem; color: #EF4444;"
            >
              {{ validationErrors[field.key] }}
            </p>
          </div>

        </div>

        <!-- Total weight: numeric value + unit -->
        <div class="mb-4">
          <label class="block mb-1" style="font-size: 0.75rem; font-weight: 600; color: #64748B;">
            {{ t('tracking.field-weight') }}
          </label>
          <div class="flex gap-2">
            <input
                v-model="formData.totalWeightValue"
                type="number"
                min="0"
                step="0.1"
                :placeholder="t('tracking.placeholder-weight-value')"
                class="border-round-lg"
                style="flex: 1; padding: 0.5rem 0.75rem; font-size: 0.88rem; color: #1E293B; outline: none; border: 1px solid #E2E8F0;"
            />
            <select
                v-model="formData.totalWeightUnit"
                class="border-round-lg"
                style="padding: 0.5rem 0.75rem; font-size: 0.88rem; color: #1E293B; outline: none; border: 1px solid #E2E8F0; background: #fff;"
            >
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </div>
        </div>

        <!-- Products in shipment: structured lines -->
        <div class="mb-4">
          <div class="flex align-items-center justify-content-between mb-2">
            <label style="font-size: 0.75rem; font-weight: 600; color: #64748B;">
              {{ t('tracking.field-products') }}
            </label>
            <button
                type="button"
                class="border-none cursor-pointer border-round-lg px-2 py-1"
                style="background-color: #E0F2FE; color: #0E7490; font-size: 0.72rem; font-weight: 600;"
                @click="addProductLine"
            >
              + {{ t('tracking.btn-add-product-line') }}
            </button>
          </div>

          <div
              v-for="(line, lineIndex) in productLines"
              :key="lineIndex"
              class="flex align-items-center gap-2 mb-2"
          >
            <select
                v-model="line.productId"
                class="border-round-lg"
                style="flex: 1; min-width: 0; padding: 0.45rem 0.6rem; font-size: 0.85rem; color: #1E293B; outline: none; border: 1px solid #E2E8F0; background: #fff;"
            >
              <option value="">{{ t('tracking.placeholder-product-select') }}</option>
              <option v-for="product in availableProducts" :key="product.id" :value="String(product.id)">
                {{ product.name }}
              </option>
            </select>
            <input
                v-model.number="line.quantity"
                type="number"
                min="1"
                :placeholder="t('tracking.placeholder-product-qty')"
                class="border-round-lg"
                style="width: 5.5rem; padding: 0.45rem 0.6rem; font-size: 0.85rem; color: #1E293B; outline: none; border: 1px solid #E2E8F0; text-align: center;"
            />
            <button
                type="button"
                class="flex align-items-center justify-content-center border-none cursor-pointer border-round-lg"
                style="width: 2rem; height: 2rem; flex-shrink: 0; background-color: #FEE2E2; color: #EF4444;"
                :disabled="productLines.length === 1"
                @click="removeProductLine(lineIndex)"
            >
              <i class="pi pi-times" style="font-size: 0.8rem;"/>
            </button>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-2">
          <button
              class="flex-1 py-2 border-round-xl border-none cursor-pointer"
              style="border: 1px solid #E2E8F0; color: #64748B; font-size: 0.88rem; font-weight: 600; background: #fff;"
              @click="emit('close')"
          >
            {{ t('tracking.btn-cancel') }}
          </button>
          <button
              class="flex-1 py-2 border-round-xl border-none cursor-pointer"
              style="font-size: 0.88rem; font-weight: 600; color: #fff; transition: background-color 0.15s;"
              :style="{
              backgroundColor: isFormValid ? '#0B3558' : '#CBD5E1',
              cursor:          isFormValid && !saving.value ? 'pointer' : 'not-allowed'
            }"
              :disabled="!isFormValid || saving.value"
              @click="handleSubmit"
          >
            <i v-if="saving.value" class="pi pi-spin pi-spinner mr-2" style="font-size: 0.85rem;"/>
            {{ saving.value ? t('tracking.form-saving') : t('tracking.form-submit') }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* Round bottom corners on wider screens */
@media (min-width: 640px) {
  div[style*="border-radius: 1.25rem"] {
    border-radius: 1.25rem !important;
  }
}
</style>
