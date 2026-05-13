<script setup>
import { computed, onMounted, ref, toRefs } from 'vue';
import { useRouter }   from 'vue-router';
import { useConfirm }  from 'primevue';
import { useI18n }     from 'vue-i18n';
import useProductStore from '../../application/product.store.js';
import useIamStore     from '../../../iam/application/iam.store.js';

const { t }        = useI18n();
const router       = useRouter();
const confirm      = useConfirm();
const productStore = useProductStore();
const iamStore     = useIamStore();

const { products, productsLoaded, errors, stockStatusCounts, productsCount } = toRefs(productStore);
const { fetchProducts, fetchInventory, deleteProduct } = productStore;

/** Live search query. */
const searchQuery = ref('');

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (businessId) {
    if (!productsLoaded.value) fetchProducts(businessId);
    fetchInventory(businessId);
  }
});

/**
 * Products filtered by the search query (case-insensitive match on name).
 * @type {import('vue').ComputedRef<Array>}
 */
const filteredProducts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return products.value;
  return products.value.filter(product => product.name.toLowerCase().includes(query));
});

/**
 * Returns the stock status for a product by joining with the in-memory inventory.
 * Products with no inventory record are treated as CRITICAL.
 * @param {number} productId
 * @returns {'NORMAL'|'LOW'|'CRITICAL'}
 */
function resolveStockStatus(productId) {
  const inventoryItem = productStore.getInventoryByProduct(productId);
  if (!inventoryItem) return 'CRITICAL';
  return inventoryItem.stockStatus;
}

/**
 * Returns the current stock for a product. Returns 0 when no record exists.
 * @param {number} productId
 * @returns {number}
 */
function resolveCurrentStock(productId) {
  const inventoryItem = productStore.getInventoryByProduct(productId);
  return inventoryItem ? inventoryItem.currentStock : 0;
}

/**
 * Returns the minimum stock for a product. Returns 0 when no record exists.
 * @param {number} productId
 * @returns {number}
 */
function resolveMinimumStock(productId) {
  const inventoryItem = productStore.getInventoryByProduct(productId);
  return inventoryItem ? inventoryItem.minimumStock : 0;
}

/**
 * Returns badge colors and translated label for a given stock status.
 * @param {'NORMAL'|'LOW'|'CRITICAL'} status
 * @returns {{ background: string, color: string, label: string }}
 */
function resolveStatusStyle(status) {
  const styleMap = {
    NORMAL:   { background: '#DCFCE7', color: '#22C55E', label: t('products.status-normal')   },
    LOW:      { background: '#FFEDD5', color: '#F97316', label: t('products.status-low')      },
    CRITICAL: { background: '#FEE2E2', color: '#EF4444', label: t('products.status-critical') }
  };
  return styleMap[status] ?? styleMap.CRITICAL;
}

/**
 * Returns the translated category label for a product category enum value.
 * @param {string} category
 * @returns {string}
 */
function resolveCategoryLabel(category) {
  return t(`products.category-${category}`) || category;
}

/**
 * Formats a monetary amount as PEN currency string.
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return `S/ ${Number(amount).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Navigates to the product creation form. */
function navigateToNew() {
  router.push({ name: 'product-new' });
}

/**
 * Navigates to the product detail view.
 * @param {number} id
 */
function navigateToDetail(id) {
  router.push({ name: 'product-detail', params: { id } });
}

/**
 * Navigates to the product edit form.
 * @param {number} id
 */
function navigateToEdit(id) {
  router.push({ name: 'product-edit', params: { id } });
}

/**
 * Opens a PrimeVue confirmation dialog before deleting.
 * The store enforces the business rule blocking deletion with stock > 0.
 * @param {import('../../domain/model/product.entity.js').Product} product
 */
function confirmDelete(product) {
  confirm.require({
    message: t('products.confirm-delete', { name: product.name }),
    header:  t('products.delete-header'),
    icon:    'pi pi-exclamation-triangle',
    accept:  () => deleteProduct(product.id)
  });
}
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">

    <!-- ── Header ───────────────────────────────────────────────────── -->
    <div class="flex align-items-center justify-content-between flex-wrap gap-3">
      <div>
        <h1 class="m-0" style="color: #0B3558; font-size: 2rem; font-weight: 700;">
          {{ t('products.title') }}
        </h1>
        <p class="m-0 mt-1" style="color: #64748B;">{{ t('products.subtitle') }}</p>
      </div>
      <button
          class="flex align-items-center gap-2 px-4 py-2 border-round-lg cursor-pointer border-none"
          style="background-color: #0B3558; color: #FAFAF7; font-size: 0.95rem; font-weight: 500;"
          @click="navigateToNew"
      >
        <i class="pi pi-plus"/>
        {{ t('products.new-product') }}
      </button>
    </div>

    <!-- ── Search + Table ────────────────────────────────────────────── -->
    <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">

      <!-- Search input -->
      <div class="flex align-items-center gap-2 mb-5">
        <i class="pi pi-search" style="color: #64748B; font-size: 1.1rem;"/>
        <input
            v-model="searchQuery"
            :placeholder="t('products.search-placeholder')"
            style="flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 9px 12px; font-size: 0.95rem; outline: none; color: #1E293B;"
        />
      </div>

      <!-- Loading -->
      <div v-if="!productsLoaded" class="flex justify-content-center py-8">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; color: #0E7490;"/>
      </div>

      <!-- Empty state -->
      <div
          v-else-if="filteredProducts.length === 0"
          class="flex flex-column align-items-center py-8"
          style="text-align: center;"
      >
        <i class="pi pi-box" style="font-size: 3rem; color: #E2E8F0;"/>
        <p class="mt-3 m-0" style="color: #64748B;">{{ t('products.no-results') }}</p>
      </div>

      <!-- Table -->
      <div v-else style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <th class="py-2 px-3 text-left" style="color: #64748B; font-size: 0.82rem; font-weight: 500; white-space: nowrap;">{{ t('products.col-product') }}</th>
            <th class="py-2 px-3 text-left" style="color: #64748B; font-size: 0.82rem; font-weight: 500; white-space: nowrap;">{{ t('products.col-category') }}</th>
            <th class="py-2 px-3 text-left" style="color: #64748B; font-size: 0.82rem; font-weight: 500; white-space: nowrap;">{{ t('products.col-stock') }}</th>
            <th class="py-2 px-3 text-left" style="color: #64748B; font-size: 0.82rem; font-weight: 500; white-space: nowrap;">{{ t('products.col-min-stock') }}</th>
            <th class="py-2 px-3 text-left" style="color: #64748B; font-size: 0.82rem; font-weight: 500; white-space: nowrap;">{{ t('products.col-price') }}</th>
            <th class="py-2 px-3 text-left" style="color: #64748B; font-size: 0.82rem; font-weight: 500; white-space: nowrap;">{{ t('products.col-status') }}</th>
            <th class="py-2 px-3 text-right" style="color: #64748B; font-size: 0.82rem; font-weight: 500; white-space: nowrap;">{{ t('products.col-actions') }}</th>
          </tr>
          </thead>
          <tbody>
          <tr
              v-for="product in filteredProducts"
              :key="product.id"
              style="border-bottom: 1px solid #F1F5F9; transition: background-color 0.15s;"
              @mouseenter="$event.currentTarget.style.backgroundColor = '#FAFAF7'"
              @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
          >
            <td class="py-3 px-3" style="color: #1E293B; font-weight: 500;">{{ product.name }}</td>
            <td class="py-3 px-3" style="color: #64748B;">{{ resolveCategoryLabel(product.category) }}</td>
            <td class="py-3 px-3" style="color: #1E293B;">{{ resolveCurrentStock(product.id) }}</td>
            <td class="py-3 px-3" style="color: #64748B;">{{ resolveMinimumStock(product.id) }}</td>
            <td class="py-3 px-3" style="color: #1E293B;">{{ formatCurrency(product.basePrice) }}</td>
            <td class="py-3 px-3">
                                <span
                                    class="border-round px-2 py-1"
                                    style="font-size: 0.75rem; font-weight: 600;"
                                    :style="{
                                        backgroundColor: resolveStatusStyle(resolveStockStatus(product.id)).background,
                                        color:           resolveStatusStyle(resolveStockStatus(product.id)).color
                                    }"
                                >
                                    {{ resolveStatusStyle(resolveStockStatus(product.id)).label }}
                                </span>
            </td>
            <td class="py-3 px-3">
              <div class="flex align-items-center justify-content-end gap-1">
                <button
                    class="flex align-items-center justify-content-center border-round-lg border-none cursor-pointer"
                    style="width: 32px; height: 32px; background: none;"
                    @click="navigateToDetail(product.id)"
                    @mouseenter="$event.currentTarget.style.backgroundColor = '#F1F5F9'"
                    @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
                >
                  <i class="pi pi-eye" style="color: #64748B; font-size: 0.9rem;"/>
                </button>
                <button
                    class="flex align-items-center justify-content-center border-round-lg border-none cursor-pointer"
                    style="width: 32px; height: 32px; background: none;"
                    @click="navigateToEdit(product.id)"
                    @mouseenter="$event.currentTarget.style.backgroundColor = '#F1F5F9'"
                    @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
                >
                  <i class="pi pi-pencil" style="color: #64748B; font-size: 0.9rem;"/>
                </button>
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Summary cards ─────────────────────────────────────────────── -->
    <div class="grid m-0" style="gap: 1rem;">
      <div class="col-12 md:col-4 p-0">
        <div class="flex align-items-center justify-content-between p-4 border-round-xl shadow-1" style="background-color: #ffffff;">
          <div>
            <p class="m-0 text-sm" style="color: #64748B;">{{ t('products.summary-total') }}</p>
            <p class="m-0 mt-1" style="color: #0B3558; font-size: 1.75rem; font-weight: 700;">{{ productsCount }}</p>
          </div>
          <div class="flex align-items-center justify-content-center border-round" style="width: 40px; height: 40px; background-color: #E0F2FE;">
            <i class="pi pi-box" style="color: #0E7490; font-size: 1.1rem;"/>
          </div>
        </div>
      </div>
      <div class="col-12 md:col-4 p-0">
        <div class="flex align-items-center justify-content-between p-4 border-round-xl shadow-1" style="background-color: #ffffff;">
          <div>
            <p class="m-0 text-sm" style="color: #64748B;">{{ t('products.summary-low') }}</p>
            <p class="m-0 mt-1" style="color: #F97316; font-size: 1.75rem; font-weight: 700;">{{ stockStatusCounts.low }}</p>
          </div>
          <div class="flex align-items-center justify-content-center border-round" style="width: 40px; height: 40px; background-color: #FFEDD5;">
            <i class="pi pi-box" style="color: #F97316; font-size: 1.1rem;"/>
          </div>
        </div>
      </div>
      <div class="col-12 md:col-4 p-0">
        <div class="flex align-items-center justify-content-between p-4 border-round-xl shadow-1" style="background-color: #ffffff;">
          <div>
            <p class="m-0 text-sm" style="color: #64748B;">{{ t('products.summary-critical') }}</p>
            <p class="m-0 mt-1" style="color: #EF4444; font-size: 1.75rem; font-weight: 700;">{{ stockStatusCounts.critical }}</p>
          </div>
          <div class="flex align-items-center justify-content-center border-round" style="width: 40px; height: 40px; background-color: #FEE2E2;">
            <i class="pi pi-box" style="color: #EF4444; font-size: 1.1rem;"/>
          </div>
        </div>
      </div>
    </div>

    <!-- Errors -->
    <p v-if="errors.length" style="color: #EF4444; font-size: 0.875rem;">
      {{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}
    </p>

  </div>
</template>

<style scoped>
</style>