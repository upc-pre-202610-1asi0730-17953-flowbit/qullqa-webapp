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

/** Whether this form is in edit mode. */
const isEdit = computed(() => !!route.params.id);

/**
 * Reactive form state matching exactly the fields in the prototype:
 * nombre, categoría, código, precio, stockActual, stockMínimo, fechaVencimiento, descripción.
 */
const form = ref({
  name:            '',
  category:        '',
  code:            '',
  basePrice:       '',
  currentStock:    '',
  minimumStock:    '',
  expirationDate:  '',
  description:     ''
});

/** Per-field validation error messages. */
const fieldErrors = ref({
  name:         '',
  category:     '',
  basePrice:    '',
  currentStock: '',
  minimumStock: ''
});

/** Triggers the success banner and redirect. */
const submitSuccess = ref(false);

/** Category options for the dropdown. */
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

/**
 * Validates all required fields.
 * Business rules:
 * - name: non-empty.
 * - category: must be selected.
 * - basePrice: number > 0.
 * - currentStock: integer >= 0.
 * - minimumStock: integer >= 0.
 *
 * @returns {boolean}
 */
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

/**
 * Saves the product entity.
 * On creation also registers the initial stock via registerStockIntake.
 */
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

    // Register initial stock after product creation
    const initialStock = parseInt(form.value.currentStock);
    if (initialStock > 0) {
      // Delayed to allow the product to be created first
      setTimeout(() => {
        const newProduct = productStore.products[productStore.products.length - 1];
        if (newProduct) {
          productStore.registerStockIntake({
            productId:   newProduct.id,
            businessId:  businessId,
            quantity:    initialStock
          });
        }
      }, 500);
    }
  }

  submitSuccess.value = true;
  setTimeout(() => router.push({ name: 'products' }), 1500);
}

/** Navigates back to the product list without saving. */
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
        <h1 class="m-0" style="color: #0B3558; font-size: 2rem; font-weight: 700;">
          {{ isEdit ? t('product-form.edit-title') : t('product-form.new-title') }}
        </h1>
        <p class="m-0 mt-1" style="color: #64748B;">
          {{ isEdit ? t('product-form.edit-subtitle') : t('product-form.new-subtitle') }}
        </p>
      </div>
    </div>

    <!-- Success banner -->
    <div v-if="submitSuccess" class="p-3 border-round-lg" style="background-color: #DCFCE7; border: 1px solid #22C55E;">
      <p class="m-0" style="color: #22C55E;">
        {{ isEdit ? t('product-form.success-update') : t('product-form.success-create') }}
      </p>
    </div>

    <!-- Form card -->
    <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
      <div class="grid m-0" style="gap: 1.25rem;">

        <!-- Nombre -->
        <div class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.9rem;">
            {{ t('product-form.name') }}
          </label>
          <input
              v-model="form.name"
              :placeholder="t('product-form.name-placeholder')"
              style="width: 100%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 0.95rem; outline: none; color: #1E293B; box-sizing: border-box;"
          />
          <p v-if="fieldErrors.name" class="m-0 mt-1" style="color: #EF4444; font-size: 0.8rem;">{{ fieldErrors.name }}</p>
        </div>

        <!-- Categoría -->
        <div class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.9rem;">
            {{ t('product-form.category') }}
          </label>
          <pv-select
              v-model="form.category"
              :options="categoryOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('product-form.category-placeholder')"
              class="w-full"
          />
          <p v-if="fieldErrors.category" class="m-0 mt-1" style="color: #EF4444; font-size: 0.8rem;">{{ fieldErrors.category }}</p>
        </div>

        <!-- Código -->
        <div class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.9rem;">
            {{ t('product-form.code') }}
          </label>
          <input
              v-model="form.code"
              :placeholder="t('product-form.code-placeholder')"
              style="width: 100%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 0.95rem; outline: none; color: #1E293B; box-sizing: border-box;"
          />
        </div>

        <!-- Precio -->
        <div class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.9rem;">
            {{ t('product-form.price') }}
          </label>
          <input
              v-model="form.basePrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              style="width: 100%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 0.95rem; outline: none; color: #1E293B; box-sizing: border-box;"
          />
          <p v-if="fieldErrors.basePrice" class="m-0 mt-1" style="color: #EF4444; font-size: 0.8rem;">{{ fieldErrors.basePrice }}</p>
        </div>

        <!-- Stock actual (only on create) -->
        <div v-if="!isEdit" class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.9rem;">
            {{ t('product-form.current-stock') }}
          </label>
          <input
              v-model="form.currentStock"
              type="number"
              min="0"
              placeholder="0"
              style="width: 100%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 0.95rem; outline: none; color: #1E293B; box-sizing: border-box;"
          />
          <p v-if="fieldErrors.currentStock" class="m-0 mt-1" style="color: #EF4444; font-size: 0.8rem;">{{ fieldErrors.currentStock }}</p>
        </div>

        <!-- Stock mínimo (only on create) -->
        <div v-if="!isEdit" class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.9rem;">
            {{ t('product-form.minimum-stock') }}
          </label>
          <input
              v-model="form.minimumStock"
              type="number"
              min="0"
              placeholder="0"
              style="width: 100%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 0.95rem; outline: none; color: #1E293B; box-sizing: border-box;"
          />
          <p v-if="fieldErrors.minimumStock" class="m-0 mt-1" style="color: #EF4444; font-size: 0.8rem;">{{ fieldErrors.minimumStock }}</p>
        </div>

        <!-- Fecha de vencimiento (full width) -->
        <div class="col-12 md:col-12 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.9rem;">
            {{ t('product-form.expiration') }}
          </label>
          <input
              v-model="form.expirationDate"
              type="date"
              style="width: 100%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 0.95rem; outline: none; color: #1E293B; box-sizing: border-box;"
          />
        </div>

        <!-- Descripción (full width) -->
        <div class="col-12 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.9rem;">
            {{ t('product-form.description') }}
          </label>
          <textarea
              v-model="form.description"
              :placeholder="t('product-form.description-placeholder')"
              rows="4"
              style="width: 100%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 0.95rem; outline: none; color: #1E293B; resize: vertical; font-family: inherit; box-sizing: border-box;"
          />
        </div>

      </div>

      <!-- Actions -->
      <div class="flex gap-3 justify-content-end mt-5 pt-4" style="border-top: 1px solid #E2E8F0;">
        <button
            class="px-4 py-2 border-round-lg cursor-pointer"
            style="background: none; border: 1px solid #E2E8F0; color: #64748B; font-size: 0.95rem;"
            @click="navigateBack"
        >
          {{ t('product-form.cancel') }}
        </button>
        <button
            class="flex align-items-center gap-2 px-4 py-2 border-round-lg cursor-pointer border-none"
            style="background-color: #0B3558; color: #FAFAF7; font-size: 0.95rem; font-weight: 500;"
            @click="saveProduct"
        >
          <i class="pi pi-save"/>
          {{ t('product-form.save') }}
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
</style>