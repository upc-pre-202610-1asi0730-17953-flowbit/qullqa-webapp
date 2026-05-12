<script setup>
import { computed, onMounted, toRefs } from 'vue';
import { useRoute, useRouter }         from 'vue-router';
import { useI18n }                     from 'vue-i18n';
import useProductStore                 from '../../application/product.store.js';
import useIamStore                     from '../../../iam/application/iam.store.js';
import { MovementType }                from '../../domain/model/stock-movement.entity.js';

const { t }        = useI18n();
const route        = useRoute();
const router       = useRouter();
const productStore = useProductStore();
const iamStore     = useIamStore();

const { stockMovements, errors } = toRefs(productStore);
const { fetchStockMovements, fetchProducts, fetchInventory } = productStore;

/**
 * The product entity resolved from the store by the route :id param.
 * @type {import('vue').ComputedRef<import('../../domain/model/product.entity.js').Product|undefined>}
 */
const product = computed(() => productStore.getProductById(route.params.id));

/**
 * The inventory item for this product.
 * @type {import('vue').ComputedRef<import('../../domain/model/inventory-item.entity.js').InventoryItem|undefined>}
 */
const inventoryItem = computed(() => productStore.getInventoryByProduct(route.params.id));

/**
 * The first batch linked to this product, used to display the expiration date.
 * @type {import('vue').ComputedRef<import('../../domain/model/stock-movement.entity.js').StockMovement|undefined>}
 */
const firstBatch = computed(() => stockMovements.value[0] ?? null);

/**
 * Days remaining until the first batch expires.
 * Business rule: computed as Math.ceil((expirationDate - today) / msPerDay).
 * Returns null when no batch is available. Negative values mean expired.
 * @type {import('vue').ComputedRef<number|null>}
 */
const daysUntilExpiration = computed(() => {
  if (!firstBatch.value) return null;
  const expirationDate = new Date(firstBatch.value.registeredAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
});

/**
 * Badge style for the stock status.
 * @type {import('vue').ComputedRef<{background: string, color: string, label: string}>}
 */
const stockStatusStyle = computed(() => {
  if (!inventoryItem.value) return { background: '#FEE2E2', color: '#EF4444', label: t('products.status-critical') };
  const styleMap = {
    NORMAL:   { background: '#DCFCE7', color: '#22C55E', label: t('product-detail.stock-normal') },
    LOW:      { background: '#FFEDD5', color: '#F97316', label: t('products.status-low')         },
    CRITICAL: { background: '#FEE2E2', color: '#EF4444', label: t('products.status-critical')    }
  };
  return styleMap[inventoryItem.value.stockStatus] ?? styleMap.CRITICAL;
});

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (businessId) {
    if (!productStore.productsLoaded) fetchProducts(businessId);
    fetchInventory(businessId);
  }
  if (route.params.id) fetchStockMovements(route.params.id);
});

/**
 * Returns the translated label for a stock movement row.
 * @param {import('../../domain/model/stock-movement.entity.js').StockMovement} movement
 * @returns {string}
 */
function resolveMovementLabel(movement) {
  const labelKeyMap = {
    [MovementType.INTAKE]:     'product-detail.movement-intake',
    [MovementType.SALE]:       'product-detail.movement-sale',
    [MovementType.ADJUSTMENT]: 'product-detail.movement-adjustment'
  };
  return t(labelKeyMap[movement.type] ?? 'product-detail.movement-intake', { qty: movement.quantity });
}

/**
 * Returns icon, background, and icon color for a movement row.
 * INTAKE/ADJUSTMENT → green TrendingUp icon. SALE → red TrendingDown icon.
 * @param {import('../../domain/model/stock-movement.entity.js').StockMovement} movement
 * @returns {{ background: string, iconColor: string, icon: string }}
 */
function resolveMovementStyle(movement) {
  if (movement.isIntake) return { background: '#DCFCE7', iconColor: '#22C55E', icon: 'pi pi-arrow-up' };
  return { background: '#FEE2E2', iconColor: '#EF4444', icon: 'pi pi-arrow-down' };
}

/**
 * Returns badge background and color for the signed quantity label.
 * @param {import('../../domain/model/stock-movement.entity.js').StockMovement} movement
 * @returns {{ background: string, color: string }}
 */
function resolveMovementBadgeStyle(movement) {
  if (movement.isIntake) return { background: '#DCFCE7', color: '#22C55E' };
  return { background: '#FEE2E2', color: '#EF4444' };
}

/**
 * Returns the translated category label.
 * @param {string} category
 * @returns {string}
 */
function resolveCategoryLabel(category) {
  return t(`products.category-${category}`) || category;
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

/**
 * Formats a monetary amount as a PEN currency string.
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return `S/ ${Number(amount).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Navigates back to the product list. */
function navigateBack() {
  router.push({ name: 'products' });
}

/** Navigates to the product edit form. */
function navigateToEdit() {
  router.push({ name: 'product-edit', params: { id: route.params.id } });
}

/** Navigates to the batch intake form. */
function navigateToBatchIntake() {
  router.push({ name: 'product-batch-intake' });
}
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">

    <div v-if="!product && productStore.productsLoaded" class="flex justify-content-center py-8">
      <p style="color: #64748B;">{{ t('products.no-results') }}</p>
    </div>

    <template v-if="product">

      <!-- ── Header ──────────────────────────────────────────────── -->
      <div class="flex align-items-center justify-content-between flex-wrap gap-3">
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
            <h1 class="m-0" style="color: #0B3558; font-size: 2rem; font-weight: 700;">{{ product.name }}</h1>
            <p class="m-0 mt-1" style="color: #64748B; font-size: 0.875rem;">
              {{ t('product-detail.field-code') }}: {{ product.id }}
            </p>
          </div>
        </div>
        <button
            class="flex align-items-center gap-2 px-4 py-2 border-round-lg cursor-pointer border-none"
            style="background-color: #0B3558; color: #FAFAF7; font-size: 0.95rem; font-weight: 500;"
            @click="navigateToEdit"
        >
          <i class="pi pi-pencil"/>
          {{ t('product-detail.edit') }}
        </button>
      </div>

      <!-- ── 3 KPI Cards ─────────────────────────────────────────── -->
      <div class="grid m-0" style="gap: 1rem;">

        <!-- Stock Actual -->
        <div class="col-12 md:col-4 p-0">
          <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
            <div class="flex align-items-center justify-content-between mb-3">
              <h3 class="m-0" style="color: #0B3558; font-size: 1rem; font-weight: 600;">{{ t('product-detail.current-stock') }}</h3>
              <i class="pi pi-box" style="color: #0E7490; font-size: 1.1rem;"/>
            </div>
            <p class="m-0" style="color: #0B3558; font-size: 2.5rem; font-weight: 700; line-height: 1;">
              {{ inventoryItem ? inventoryItem.currentStock : '—' }}
            </p>
            <p class="m-0 mt-2 text-sm" style="color: #64748B;">
              {{ t('product-detail.minimum-label', { min: inventoryItem ? inventoryItem.minimumStock : '—' }) }}
            </p>
            <span
                class="border-round mt-3 inline-block px-2 py-1"
                style="font-size: 0.75rem; font-weight: 600;"
                :style="{ backgroundColor: stockStatusStyle.background, color: stockStatusStyle.color }"
            >
                            {{ stockStatusStyle.label }}
                        </span>
          </div>
        </div>

        <!-- Precio -->
        <div class="col-12 md:col-4 p-0">
          <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
            <div class="flex align-items-center justify-content-between mb-3">
              <h3 class="m-0" style="color: #0B3558; font-size: 1rem; font-weight: 600;">{{ t('product-detail.price-card') }}</h3>
            </div>
            <p class="m-0" style="color: #0B3558; font-size: 2rem; font-weight: 700; line-height: 1.2;">
              {{ formatCurrency(product.basePrice) }}
            </p>
            <p class="m-0 mt-2 text-sm" style="color: #64748B;">{{ t('product-detail.per-unit') }}</p>
          </div>
        </div>

        <!-- Vencimiento -->
        <div class="col-12 md:col-4 p-0">
          <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
            <div class="flex align-items-center justify-content-between mb-3">
              <h3 class="m-0" style="color: #0B3558; font-size: 1rem; font-weight: 600;">{{ t('product-detail.expiration-card') }}</h3>
              <i class="pi pi-calendar" style="color: #0E7490; font-size: 1.1rem;"/>
            </div>
            <p class="m-0" style="color: #0B3558; font-size: 1rem; font-weight: 600;">
              {{ firstBatch ? formatDate(firstBatch.registeredAt) : '—' }}
            </p>
            <p
                v-if="daysUntilExpiration !== null"
                class="m-0 mt-2 text-sm"
                :style="{ color: daysUntilExpiration <= 0 ? '#EF4444' : daysUntilExpiration <= 30 ? '#F97316' : '#64748B' }"
            >
              {{ daysUntilExpiration <= 0 ? t('product-detail.expired') : t('product-detail.days-remaining', { days: daysUntilExpiration }) }}
            </p>
          </div>
        </div>
      </div>

      <!-- ── Información del Producto ────────────────────────────── -->
      <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
        <h3 class="m-0 mb-4" style="color: #0B3558;">{{ t('product-detail.info-title') }}</h3>
        <div class="grid m-0">
          <div class="col-12 md:col-6 p-0 mb-4">
            <p class="m-0 text-sm mb-1" style="color: #64748B;">{{ t('product-detail.field-name') }}</p>
            <p class="m-0" style="color: #1E293B;">{{ product.name }}</p>
          </div>
          <div class="col-12 md:col-6 p-0 mb-4">
            <p class="m-0 text-sm mb-1" style="color: #64748B;">{{ t('product-detail.field-category') }}</p>
            <p class="m-0" style="color: #1E293B;">{{ resolveCategoryLabel(product.category) }}</p>
          </div>
          <div class="col-12 md:col-6 p-0 mb-4">
            <p class="m-0 text-sm mb-1" style="color: #64748B;">{{ t('product-detail.field-code') }}</p>
            <p class="m-0" style="color: #1E293B;">{{ product.id }}</p>
          </div>
          <div class="col-12 md:col-6 p-0 mb-4">
            <p class="m-0 text-sm mb-1" style="color: #64748B;">{{ t('product-detail.field-description') }}</p>
            <p class="m-0" style="color: #1E293B;">{{ product.description || '—' }}</p>
          </div>
        </div>
      </div>

      <!-- ── Movimientos Recientes ───────────────────────────────── -->
      <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
        <div class="flex align-items-center justify-content-between mb-4">
          <h3 class="m-0" style="color: #0B3558;">{{ t('product-detail.movements-title') }}</h3>
          <button
              style="background: none; border: none; cursor: pointer; color: #0E7490; font-size: 0.875rem; padding: 0;"
              @click="navigateToBatchIntake"
          >
            {{ t('product-detail.movements-see-all') }}
          </button>
        </div>

        <div v-if="stockMovements.length" style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div
              v-for="movement in stockMovements.slice(0, 3)"
              :key="movement.id"
              class="flex align-items-center justify-content-between p-4 border-round-lg"
              style="border: 1px solid #E2E8F0;"
          >
            <div class="flex align-items-center gap-3">
              <div
                  class="flex align-items-center justify-content-center border-round"
                  style="width: 36px; height: 36px; flex-shrink: 0;"
                  :style="{ backgroundColor: resolveMovementStyle(movement).background }"
              >
                <i
                    :class="resolveMovementStyle(movement).icon"
                    :style="{ color: resolveMovementStyle(movement).iconColor, fontSize: '0.9rem' }"
                />
              </div>
              <div>
                <p class="m-0" style="color: #1E293B; font-size: 0.9rem;">
                  {{ resolveMovementLabel(movement) }}
                </p>
                <p class="m-0 mt-1 text-sm" style="color: #64748B;">
                  {{ formatDate(movement.registeredAt) }}
                </p>
              </div>
            </div>
            <span
                class="border-round px-2 py-1"
                style="font-size: 0.8rem; font-weight: 700;"
                :style="resolveMovementBadgeStyle(movement)"
            >
                            {{ movement.signedQuantity > 0 ? '+' : '' }}{{ movement.signedQuantity }}
                        </span>
          </div>
        </div>

        <p v-else class="m-0 text-sm" style="color: #64748B;">{{ t('product-detail.no-movements') }}</p>
      </div>

      <!-- ── Acciones ────────────────────────────────────────────── -->
      <div class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
        <h3 class="m-0 mb-4" style="color: #0B3558;">{{ t('product-detail.actions-title') }}</h3>
        <div class="grid m-0" style="gap: 0.75rem;">
          <div class="col-12 md:col-6 p-0">
            <button
                class="flex align-items-center gap-2 w-full p-3 border-round-lg cursor-pointer text-left"
                style="background: none; border: 1px solid #E2E8F0; color: #1E293B; font-size: 0.95rem; transition: background-color 0.15s;"
                @click="navigateToBatchIntake"
                @mouseenter="$event.currentTarget.style.backgroundColor = '#F8FAFC'"
                @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
            >
              {{ t('product-detail.action-adjust') }}
            </button>
          </div>
          <div class="col-12 md:col-6 p-0">
            <button
                class="flex align-items-center gap-2 w-full p-3 border-round-lg cursor-pointer text-left"
                style="background: none; border: 1px solid #E2E8F0; color: #1E293B; font-size: 0.95rem; transition: background-color 0.15s;"
                @click="navigateToBatchIntake"
                @mouseenter="$event.currentTarget.style.backgroundColor = '#F8FAFC'"
                @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
            >
              {{ t('product-detail.action-movement') }}
            </button>
          </div>
        </div>
      </div>

    </template>

    <p v-if="errors.length" style="color: #EF4444; font-size: 0.875rem;">
      {{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}
    </p>

  </div>
</template>

<style scoped>
</style>