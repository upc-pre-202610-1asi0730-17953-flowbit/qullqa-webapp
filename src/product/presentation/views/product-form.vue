<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter }      from 'vue-router';
import { useI18n }                  from 'vue-i18n';
import useProductStore              from '../../application/product.store.js';
import useIamStore                  from '../../../iam/application/iam.store.js';
import { Product, ProductCategory, ProductStatus } from '../../domain/model/product.entity.js';

const { t }        = useI18n();
const route        = useRoute();
const router       = useRouter();
const productStore = useProductStore();
const iamStore     = useIamStore();

const isEdit = computed(() => !!route.params.id);

const form = ref({
  name:           '',
  category:       '',
  code:           '',
  basePrice:      '',
  currentStock:   '',
  minimumStock:   '',
  expirationDate: '',
  description:    ''
});

const fieldErrors = ref({
  name:         '',
  category:     '',
  basePrice:    '',
  currentStock: '',
  minimumStock: ''
});

const submitSuccess = ref(false);

const categoryOptions = Object.values(ProductCategory).map(value => ({
  label: t(`products.category-${value}`),
  value
}));

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (businessId && !productStore.productsLoaded) {
    productStore.fetchProducts(businessId);
  }

  if (isEdit.value) {
    const existingProduct = productStore.getProductById(route.params.id);
    if (existingProduct) {
      form.value.name        = existingProduct.name;
      form.value.category    = existingProduct.category;
      form.value.description = existingProduct.description;
      form.value.basePrice   = String(existingProduct.basePrice);
    } else {
      router.push({ name: 'products' });
    }
  }
});

function validateForm() {
  fieldErrors.value = { name: '', category: '', basePrice: '', currentStock: '', minimumStock: '' };
  let isValid = true;

  if (!form.value.name.trim()) {
    fieldErrors.value.name = t('product-form.error-name');
    isValid = false;
  }
  if (!form.value.category) {
    fieldErrors.value.category = t('product-form.error-category');
    isValid = false;
  }
  if (!form.value.basePrice || parseFloat(form.value.basePrice) <= 0) {
    fieldErrors.value.basePrice = t('product-form.error-price');
    isValid = false;
  }
  if (!isEdit.value) {
    if (form.value.currentStock === '' || parseInt(form.value.currentStock) < 0) {
      fieldErrors.value.currentStock = t('product-form.error-stock');
      isValid = false;
    }
    if (form.value.minimumStock === '' || parseInt(form.value.minimumStock) < 0) {
      fieldErrors.value.minimumStock = t('product-form.error-min-stock');
      isValid = false;
    }
  }
  return isValid;
}

function saveProduct() {
  if (!validateForm()) return;

  const businessId = iamStore.currentUser?.businessId ?? null;

  const productEntity = new Product({
    id:          isEdit.value ? parseInt(route.params.id) : null,
    businessId:  businessId,
    name:        form.value.name.trim(),
    category:    form.value.category,
    description: form.value.description.trim(),
    basePrice:   parseFloat(form.value.basePrice),
    status:      ProductStatus.ACTIVE
  });

  if (isEdit.value) {
    productStore.updateProduct(productEntity);
  } else {
    productStore.addProduct(productEntity);

    const initialStock = parseInt(form.value.currentStock);
    if (initialStock > 0) {
      setTimeout(() => {
        const newProduct = productStore.products[productStore.products.length - 1];
        if (newProduct) {
          productStore.registerStockIntake({
            productId:  newProduct.id,
            businessId: businessId,
            quantity:   initialStock
          });
        }
      }, 500);
    }
  }

  submitSuccess.value = true;
  setTimeout(() => router.push({ name: 'products' }), 1500);
}

function navigateBack() {
  router.push({ name: 'products' });
}
</script>

<template>
  <div class="page-wrapper">

    <!-- ── Header ─────────────────────────────────────────────────── -->
    <div class="flex align-items-center gap-3">
      <button
          class="flex align-items-center justify-content-center border-round-lg border-none cursor-pointer flex-shrink-0 btn-back"
          @click="navigateBack"
      >
        <i class="pi pi-arrow-left" style="font-size: 1rem;"/>
      </button>
      <div class="flex align-items-center gap-3">
        <div class="flex align-items-center justify-content-center border-round-xl flex-shrink-0 form-icon-wrap">
          <i :class="isEdit ? 'pi pi-pencil' : 'pi pi-plus'" style="color: #0E7490; font-size: 1rem;"/>
        </div>
        <div>
          <h1 class="m-0 page-title">
            {{ isEdit ? t('product-form.edit-title') : t('product-form.new-title') }}
          </h1>
          <p class="m-0 mt-1 page-subtitle">
            {{ isEdit ? t('product-form.edit-subtitle') : t('product-form.new-subtitle') }}
          </p>
        </div>
      </div>
    </div>

    <!-- ── Success banner ─────────────────────────────────────────── -->
    <div v-if="submitSuccess" class="flex align-items-center gap-3 p-4 border-round-xl success-banner">
      <div class="flex align-items-center justify-content-center border-round-lg flex-shrink-0 success-icon-wrap">
        <i class="pi pi-check-circle" style="color: #16A34A; font-size: 1rem;"/>
      </div>
      <p class="success-text">
        {{ isEdit ? t('product-form.success-update') : t('product-form.success-create') }}
      </p>
    </div>

    <!-- ── Form card ──────────────────────────────────────────────── -->
    <div class="border-round-xl overflow-hidden card">

      <!-- Section header -->
      <div class="px-5 py-4 flex align-items-center gap-2 section-header">
        <i class="pi pi-info-circle" style="color: #0E7490; font-size: 0.88rem;"/>
        <p class="section-header-text">Información del producto</p>
      </div>

      <div class="p-5">
        <div class="form-grid">

          <!-- Nombre -->
          <div class="form-field-full">
            <label class="form-label">
              <i class="pi pi-tag" style="font-size: 0.72rem;"/>
              {{ t('product-form.name') }}
              <span class="required">*</span>
            </label>
            <input
                v-model="form.name"
                :placeholder="t('product-form.name-placeholder')"
                :class="['form-input', { 'form-input-error': fieldErrors.name }]"
            />
            <p v-if="fieldErrors.name" class="form-error-msg">
              <i class="pi pi-exclamation-circle" style="font-size: 0.72rem;"/>
              {{ fieldErrors.name }}
            </p>
          </div>

          <!-- Categoría -->
          <div>
            <label class="form-label">
              <i class="pi pi-th-large" style="font-size: 0.72rem;"/>
              {{ t('product-form.category') }}
              <span class="required">*</span>
            </label>
            <pv-select
                v-model="form.category"
                :options="categoryOptions"
                option-label="label"
                option-value="value"
                :placeholder="t('product-form.category-placeholder')"
                class="w-full"
                :class="{ 'p-invalid': fieldErrors.category }"
            />
            <p v-if="fieldErrors.category" class="form-error-msg">
              <i class="pi pi-exclamation-circle" style="font-size: 0.72rem;"/>
              {{ fieldErrors.category }}
            </p>
          </div>

          <!-- Código -->
          <div>
            <label class="form-label">
              <i class="pi pi-hashtag" style="font-size: 0.72rem;"/>
              {{ t('product-form.code') }}
            </label>
            <input
                v-model="form.code"
                :placeholder="t('product-form.code-placeholder')"
                class="form-input"
            />
          </div>

          <!-- Precio -->
          <div>
            <label class="form-label">
              <i class="pi pi-dollar" style="font-size: 0.72rem;"/>
              {{ t('product-form.price') }}
              <span class="required">*</span>
            </label>
            <div class="relative">
              <span class="absolute price-prefix">S/</span>
              <input
                  v-model="form.basePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  :class="['form-input', 'form-input-price', { 'form-input-error': fieldErrors.basePrice }]"
              />
            </div>
            <p v-if="fieldErrors.basePrice" class="form-error-msg">
              <i class="pi pi-exclamation-circle" style="font-size: 0.72rem;"/>
              {{ fieldErrors.basePrice }}
            </p>
          </div>

          <!-- Stock actual (solo en creación) -->
          <div v-if="!isEdit">
            <label class="form-label">
              <i class="pi pi-box" style="font-size: 0.72rem;"/>
              {{ t('product-form.current-stock') }}
              <span class="required">*</span>
            </label>
            <input
                v-model="form.currentStock"
                type="number"
                min="0"
                placeholder="0"
                :class="['form-input', { 'form-input-error': fieldErrors.currentStock }]"
            />
            <p v-if="fieldErrors.currentStock" class="form-error-msg">
              <i class="pi pi-exclamation-circle" style="font-size: 0.72rem;"/>
              {{ fieldErrors.currentStock }}
            </p>
          </div>

          <!-- Stock mínimo (solo en creación) -->
          <div v-if="!isEdit">
            <label class="form-label">
              <i class="pi pi-exclamation-triangle" style="font-size: 0.72rem;"/>
              {{ t('product-form.minimum-stock') }}
              <span class="required">*</span>
            </label>
            <input
                v-model="form.minimumStock"
                type="number"
                min="0"
                placeholder="0"
                :class="['form-input', { 'form-input-error': fieldErrors.minimumStock }]"
            />
            <p v-if="fieldErrors.minimumStock" class="form-error-msg">
              <i class="pi pi-exclamation-circle" style="font-size: 0.72rem;"/>
              {{ fieldErrors.minimumStock }}
            </p>
          </div>

          <!-- Fecha de vencimiento -->
          <div class="form-field-full">
            <label class="form-label">
              <i class="pi pi-calendar" style="font-size: 0.72rem;"/>
              {{ t('product-form.expiration') }}
            </label>
            <input
                v-model="form.expirationDate"
                type="date"
                class="form-input"
            />
          </div>

          <!-- Descripción -->
          <div class="form-field-full">
            <label class="form-label">
              <i class="pi pi-align-left" style="font-size: 0.72rem;"/>
              {{ t('product-form.description') }}
            </label>
            <textarea
                v-model="form.description"
                :placeholder="t('product-form.description-placeholder')"
                rows="3"
                class="form-input form-textarea"
            />
          </div>

        </div>
      </div>

      <!-- ── Actions footer ─────────────────────────────────────── -->
      <div class="flex flex-column sm:flex-row gap-3 px-5 py-4 footer-actions">
        <button
            class="flex-1 sm:flex-none flex align-items-center justify-content-center gap-2 px-5 py-2 border-round-xl cursor-pointer btn-cancel"
            @click="navigateBack"
        >
          <i class="pi pi-times" style="font-size: 0.82rem;"/>
          {{ t('product-form.cancel') }}
        </button>
        <button
            class="flex-1 flex align-items-center justify-content-center gap-2 px-5 py-2 border-round-xl cursor-pointer border-none btn-save"
            @click="saveProduct"
        >
          <i class="pi pi-save" style="font-size: 0.85rem;"/>
          {{ t('product-form.save') }}
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Back button */
.btn-back {
  width: 38px;
  height: 38px;
  background-color: #F1F5F9;
  color: #0B3558;
  transition: all 0.15s;
}
.btn-back:hover {
  background-color: #E2E8F0;
  transform: translateX(-2px);
}

/* Header icon wrapper */
.form-icon-wrap {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #E0F2FE, #DBEAFE);
}

.page-title {
  color: #0B3558;
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1.2;
}

.page-subtitle {
  color: #64748B;
  font-size: 0.8rem;
}

/* Success banner */
.success-banner {
  background-color: #F0FDF4;
  border: 1.5px solid #86EFAC;
}

.success-icon-wrap {
  width: 36px;
  height: 36px;
  background-color: #DCFCE7;
}

.success-text {
  color: #15803D;
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0;
}

/* Card container */
.card {
  background-color: #ffffff;
  border: 1px solid #E2E8F0;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
}

/* Section header bar */
.section-header {
  border-bottom: 1px solid #E2E8F0;
  background-color: #F8FAFC;
}

.section-header-text {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0B3558;
  margin: 0;
}

/* Required asterisk */
.required {
  color: #DC2626;
}

/* Form layout: 1-col mobile → 2-col desktop */
.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}
@media (min-width: 640px) {
  .form-grid { grid-template-columns: repeat(2, 1fr); }
}

.form-field-full {
  grid-column: 1 / -1;
}

/* Label */
.form-label {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #374151;
  letter-spacing: 0.02em;
}

/* Input base */
.form-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  background-color: #F8FAFC;
  border: 1.5px solid #E2E8F0;
  color: #0B3558;
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
  transition: all 0.18s;
  font-family: inherit;
}
.form-input:focus {
  border-color: #0E7490;
  box-shadow: 0 0 0 3px rgba(14, 116, 144, 0.12);
  background-color: #fff;
}
.form-input-error {
  border-color: #FCA5A5 !important;
  background-color: #FFF5F5;
}
.form-input-error:focus {
  border-color: #EF4444 !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12) !important;
}

/* Price input left padding for S/ prefix */
.form-input-price {
  padding-left: 32px;
}

/* Currency prefix (S/) inside price field */
.price-prefix {
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748B;
  font-size: 0.85rem;
  font-weight: 600;
  pointer-events: none;
}

/* Textarea extras */
.form-textarea {
  resize: vertical;
  font-family: inherit;
  min-height: 80px;
}

/* Error message */
.form-error-msg {
  margin: 4px 0 0 0;
  font-size: 0.77rem;
  color: #DC2626;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Footer actions bar */
.footer-actions {
  border-top: 1px solid #E2E8F0;
  background-color: #F8FAFC;
}

/* Cancel button */
.btn-cancel {
  border: 1.5px solid #E2E8F0;
  color: #64748B;
  font-size: 0.9rem;
  font-weight: 500;
  background: #fff;
  transition: all 0.15s;
  order: 2;
}
.btn-cancel:hover {
  background-color: #F8FAFC;
}

/* Save button */
.btn-save {
  background: linear-gradient(135deg, #0E7490, #0B3558);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  box-shadow: 0 2px 10px rgba(14, 116, 144, 0.3);
  transition: all 0.18s;
  order: 1;
}
.btn-save:hover {
  box-shadow: 0 4px 16px rgba(14, 116, 144, 0.45);
  transform: translateY(-1px);
}

@media (min-width: 640px) {
  .btn-cancel { order: 2; }
  .btn-save   { order: 1; }
}
</style>