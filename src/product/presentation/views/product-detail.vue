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

const product = computed(() => productStore.getProductById(route.params.id));
const inventoryItem = computed(() => productStore.getInventoryByProduct(route.params.id));
const firstBatch = computed(() => stockMovements.value[0] ?? null);

const daysUntilExpiration = computed(() => {
  if (!firstBatch.value) return null;
  const expirationDate = new Date(firstBatch.value.registeredAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
});

const stockStatusStyle = computed(() => {
  if (!inventoryItem.value) return { background: '#FEE2E2', color: '#EF4444', label: t('products.status-critical') };
  const styleMap = {
    NORMAL:   { background: '#DCFCE7', color: '#16A34A', label: t('product-detail.stock-normal') },
    LOW:      { background: '#FFEDD5', color: '#F97316', label: t('products.status-low')         },
    CRITICAL: { background: '#FEE2E2', color: '#EF4444', label: t('products.status-critical')    }
  };
  return styleMap[inventoryItem.value.stockStatus] ?? styleMap.CRITICAL;
});

const categoryColors = {
  DAIRY:     { bg: '#DBEAFE', color: '#1D4ED8' },
  GRAINS:    { bg: '#FEF9C3', color: '#A16207' },
  OILS:      { bg: '#D1FAE5', color: '#065F46' },
  BEVERAGES: { bg: '#CFFAFE', color: '#0E7490' },
  CLEANING:  { bg: '#EDE9FE', color: '#6D28D9' },
  MEDICINE:  { bg: '#FFE4E6', color: '#BE123C' },
  OTHER:     { bg: '#F1F5F9', color: '#475569' }
};

function getCategoryColor(category) {
  return categoryColors[category] ?? categoryColors.OTHER;
}

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (businessId) {
    if (!productStore.productsLoaded) fetchProducts(businessId);
    fetchInventory(businessId);
  }
  if (route.params.id) fetchStockMovements(route.params.id);
});

function resolveMovementLabel(movement) {
  const labelKeyMap = {
    [MovementType.INTAKE]:     'product-detail.movement-intake',
    [MovementType.SALE]:       'product-detail.movement-sale',
    [MovementType.ADJUSTMENT]: 'product-detail.movement-adjustment'
  };
  return t(labelKeyMap[movement.type] ?? 'product-detail.movement-intake', { qty: movement.quantity });
}

function resolveMovementStyle(movement) {
  if (movement.isIntake) return { background: '#DCFCE7', iconColor: '#16A34A', icon: 'pi pi-arrow-circle-up' };
  return { background: '#FEE2E2', iconColor: '#EF4444', icon: 'pi pi-arrow-circle-down' };
}

function resolveMovementBadgeStyle(movement) {
  if (movement.isIntake) return { background: '#DCFCE7', color: '#16A34A' };
  return { background: '#FEE2E2', color: '#EF4444' };
}

function resolveCategoryLabel(category) {
  return t(`products.category-${category}`) || category;
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('es-PE');
}

function formatCurrency(amount) {
  return `S/ ${Number(amount).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function navigateBack() {
  router.push({ name: 'products' });
}

function navigateToEdit() {
  router.push({ name: 'product-edit', params: { id: route.params.id } });
}

function navigateToBatchIntake() {
  router.push({ name: 'product-batch-intake' });
}
</script>

<template>
  <div class="page-wrapper">

    <div v-if="!product && productStore.productsLoaded" class="flex justify-content-center align-items-center py-12">
      <div class="flex flex-column align-items-center gap-3">
        <div class="flex align-items-center justify-content-center border-round-xl empty-icon-wrap">
          <i class="pi pi-search" style="font-size: 1.8rem; color: #CBD5E1;"/>
        </div>
        <p class="text-muted">{{ t('products.no-results') }}</p>
      </div>
    </div>

    <template v-if="product">

      <!-- ── Header ──────────────────────────────────────────────── -->
      <div class="flex align-items-center justify-content-between flex-wrap gap-3">
        <div class="flex align-items-center gap-3">
          <button class="flex align-items-center justify-content-center border-round-lg border-none cursor-pointer flex-shrink-0 btn-back" @click="navigateBack">
            <i class="pi pi-arrow-left" style="font-size: 1rem;"/>
          </button>

          <div class="flex align-items-center gap-3">
            <div
                class="flex align-items-center justify-content-center border-round-xl flex-shrink-0 product-avatar"
                :style="{ backgroundColor: getCategoryColor(product.category).bg, color: getCategoryColor(product.category).color }"
            >
              {{ (product.name || '?').charAt(0).toUpperCase() }}
            </div>
            <div>
              <h1 class="m-0 page-title">{{ product.name }}</h1>
              <p class="m-0 mt-1 text-muted">{{ t('product-detail.field-code') }}: {{ product.id }}</p>
            </div>
          </div>
        </div>

        <button class="flex align-items-center gap-2 px-4 py-2 border-round-xl cursor-pointer border-none btn-primary" @click="navigateToEdit">
          <i class="pi pi-pencil" style="font-size: 0.85rem;"/>
          {{ t('product-detail.edit') }}
        </button>
      </div>

      <!-- ── KPI Cards ───────────────────────────────────────────── -->
      <div class="kpi-grid">

        <!-- Stock Actual -->
        <div class="border-round-xl overflow-hidden card">
          <div style="height: 4px; background: linear-gradient(to right, #0E7490, #0B3558);"/>
          <div class="p-5">
            <div class="flex align-items-center justify-content-between mb-3">
              <p class="kpi-label">{{ t('product-detail.current-stock') }}</p>
              <div class="flex align-items-center justify-content-center border-round-lg kpi-icon" style="background-color: #E0F2FE;">
                <i class="pi pi-box" style="color: #0E7490; font-size: 0.9rem;"/>
              </div>
            </div>
            <p class="m-0" style="color: #0B3558; font-size: 2.8rem; font-weight: 700; line-height: 1; letter-spacing: -0.02em;">
              {{ inventoryItem ? inventoryItem.currentStock : '—' }}
            </p>
            <p class="m-0 mt-2 text-muted">
              {{ t('product-detail.minimum-label', { min: inventoryItem ? inventoryItem.minimumStock : '—' }) }}
            </p>
            <span
                class="border-round mt-3 inline-flex align-items-center gap-1 px-2 py-1 status-badge"
                :style="{ backgroundColor: stockStatusStyle.background, color: stockStatusStyle.color }"
            >
              {{ stockStatusStyle.label }}
            </span>
          </div>
        </div>

        <!-- Precio -->
        <div class="border-round-xl overflow-hidden card">
          <div style="height: 4px; background: linear-gradient(to right, #16A34A, #15803D);"/>
          <div class="p-5">
            <div class="flex align-items-center justify-content-between mb-3">
              <p class="kpi-label">{{ t('product-detail.price-card') }}</p>
              <div class="flex align-items-center justify-content-center border-round-lg kpi-icon" style="background-color: #DCFCE7;">
                <i class="pi pi-tag" style="color: #16A34A; font-size: 0.9rem;"/>
              </div>
            </div>
            <p class="m-0" style="color: #0B3558; font-size: 2rem; font-weight: 700; line-height: 1.2; letter-spacing: -0.02em;">
              {{ formatCurrency(product.basePrice) }}
            </p>
            <p class="m-0 mt-2 text-muted">{{ t('product-detail.per-unit') }}</p>
          </div>
        </div>

        <!-- Vencimiento -->
        <div class="border-round-xl overflow-hidden card">
          <div
              style="height: 4px;"
              :style="{ background: daysUntilExpiration !== null && daysUntilExpiration <= 0 ? 'linear-gradient(to right, #DC2626, #B91C1C)' : daysUntilExpiration !== null && daysUntilExpiration <= 30 ? 'linear-gradient(to right, #EA580C, #C2410C)' : 'linear-gradient(to right, #6366F1, #4F46E5)' }"
          />
          <div class="p-5">
            <div class="flex align-items-center justify-content-between mb-3">
              <p class="kpi-label">{{ t('product-detail.expiration-card') }}</p>
              <div class="flex align-items-center justify-content-center border-round-lg kpi-icon" style="background-color: #EDE9FE;">
                <i class="pi pi-calendar" style="color: #6366F1; font-size: 0.9rem;"/>
              </div>
            </div>
            <p class="m-0" style="color: #0B3558; font-size: 1.1rem; font-weight: 700;">
              {{ firstBatch ? formatDate(firstBatch.registeredAt) : '—' }}
            </p>
            <p
                v-if="daysUntilExpiration !== null"
                class="m-0 mt-2"
                style="font-size: 0.8rem; font-weight: 500;"
                :style="{ color: daysUntilExpiration <= 0 ? '#DC2626' : daysUntilExpiration <= 30 ? '#EA580C' : '#64748B' }"
            >
              <i
                  :class="daysUntilExpiration <= 0 ? 'pi pi-times-circle' : daysUntilExpiration <= 30 ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle'"
                  style="font-size: 0.75rem;"
              />
              {{ daysUntilExpiration <= 0 ? t('product-detail.expired') : t('product-detail.days-remaining', { days: daysUntilExpiration }) }}
            </p>
            <p v-else class="m-0 mt-2 text-muted-light">Sin fecha registrada</p>
          </div>
        </div>
      </div>

      <!-- ── Información del Producto ────────────────────────────── -->
      <div class="border-round-xl overflow-hidden card">
        <div class="px-5 py-4 flex align-items-center gap-2 section-header">
          <i class="pi pi-info-circle" style="color: #0E7490; font-size: 0.9rem;"/>
          <h3 class="section-title">{{ t('product-detail.info-title') }}</h3>
        </div>
        <div class="p-5">
          <div class="info-grid">
            <div class="info-field">
              <div class="flex align-items-center gap-2 mb-1">
                <i class="pi pi-tag" style="font-size: 0.75rem; color: #94A3B8;"/>
                <p class="field-label">{{ t('product-detail.field-name') }}</p>
              </div>
              <p class="field-value">{{ product.name }}</p>
            </div>
            <div class="info-field">
              <div class="flex align-items-center gap-2 mb-1">
                <i class="pi pi-th-large" style="font-size: 0.75rem; color: #94A3B8;"/>
                <p class="field-label">{{ t('product-detail.field-category') }}</p>
              </div>
              <span
                  class="border-round-2xl inline-block category-badge"
                  :style="{ backgroundColor: getCategoryColor(product.category).bg, color: getCategoryColor(product.category).color }"
              >
                {{ resolveCategoryLabel(product.category) }}
              </span>
            </div>
            <div class="info-field">
              <div class="flex align-items-center gap-2 mb-1">
                <i class="pi pi-hashtag" style="font-size: 0.75rem; color: #94A3B8;"/>
                <p class="field-label">{{ t('product-detail.field-code') }}</p>
              </div>
              <p class="field-value" style="font-family: monospace;">{{ product.id }}</p>
            </div>
            <div class="info-field">
              <div class="flex align-items-center gap-2 mb-1">
                <i class="pi pi-align-left" style="font-size: 0.75rem; color: #94A3B8;"/>
                <p class="field-label">{{ t('product-detail.field-description') }}</p>
              </div>
              <p class="field-value">{{ product.description || '—' }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Movimientos Recientes ───────────────────────────────── -->
      <div class="border-round-xl overflow-hidden card">
        <div class="px-5 py-4 flex align-items-center justify-content-between section-header">
          <div class="flex align-items-center gap-2">
            <i class="pi pi-arrow-right-arrow-left" style="color: #0E7490; font-size: 0.9rem;"/>
            <h3 class="section-title">{{ t('product-detail.movements-title') }}</h3>
          </div>
          <button class="btn-link" @click="navigateToBatchIntake">
            {{ t('product-detail.movements-see-all') }} <i class="pi pi-arrow-right" style="font-size: 0.72rem;"/>
          </button>
        </div>

        <div class="p-4" style="display: flex; flex-direction: column; gap: 0.5rem;">
          <div
              v-for="movement in stockMovements.slice(0, 3)"
              :key="movement.id"
              class="flex align-items-center gap-3 p-3 border-round-lg movement-row"
          >
            <div
                class="flex align-items-center justify-content-center border-round-lg flex-shrink-0 movement-icon"
                :style="{ backgroundColor: resolveMovementStyle(movement).background }"
            >
              <i
                  :class="resolveMovementStyle(movement).icon"
                  :style="{ color: resolveMovementStyle(movement).iconColor, fontSize: '1rem' }"
              />
            </div>
            <div style="flex: 1; min-width: 0;">
              <p class="m-0 movement-name">{{ resolveMovementLabel(movement) }}</p>
              <p class="m-0 mt-1 text-muted-light">{{ formatDate(movement.registeredAt) }}</p>
            </div>
            <span class="border-round-lg px-3 py-1 flex-shrink-0 movement-badge" :style="resolveMovementBadgeStyle(movement)">
              {{ movement.signedQuantity > 0 ? '+' : '' }}{{ movement.signedQuantity }}
            </span>
          </div>

          <div v-if="!stockMovements.length" class="flex flex-column align-items-center py-6 gap-2">
            <i class="pi pi-inbox" style="font-size: 1.6rem; color: #CBD5E1;"/>
            <p class="m-0 text-muted">{{ t('product-detail.no-movements') }}</p>
          </div>
        </div>
      </div>

      <!-- ── Acciones ────────────────────────────────────────────── -->
      <div class="border-round-xl overflow-hidden card">
        <div class="px-5 py-4 flex align-items-center gap-2 section-header">
          <i class="pi pi-bolt" style="color: #0E7490; font-size: 0.9rem;"/>
          <h3 class="section-title">{{ t('product-detail.actions-title') }}</h3>
        </div>
        <div class="p-4 actions-grid">
          <button class="flex align-items-center gap-3 p-4 border-round-xl cursor-pointer btn-action" @click="navigateToBatchIntake">
            <div class="flex align-items-center justify-content-center border-round-lg flex-shrink-0 action-icon-wrap" style="background-color: #E0F2FE;">
              <i class="pi pi-arrow-circle-up" style="color: #0E7490; font-size: 0.9rem;"/>
            </div>
            <div>
              <p class="m-0 action-title">{{ t('product-detail.action-adjust') }}</p>
              <p class="m-0 mt-1 text-muted-light">Registrar entrada de inventario</p>
            </div>
          </button>
          <button class="flex align-items-center gap-3 p-4 border-round-xl cursor-pointer btn-action" @click="navigateToBatchIntake">
            <div class="flex align-items-center justify-content-center border-round-lg flex-shrink-0 action-icon-wrap" style="background-color: #FFEDD5;">
              <i class="pi pi-sync" style="color: #EA580C; font-size: 0.9rem;"/>
            </div>
            <div>
              <p class="m-0 action-title">{{ t('product-detail.action-movement') }}</p>
              <p class="m-0 mt-1 text-muted-light">Ver historial de movimientos</p>
            </div>
          </button>
        </div>
      </div>

    </template>

    <p v-if="errors.length" class="error-banner">
      {{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}
    </p>

  </div>
</template>

<style scoped>
/* Page wrapper */
.page-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Card */
.card {
  background-color: #ffffff;
  border: 1px solid #E2E8F0;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
}

/* Section header */
.section-header {
  border-bottom: 1px solid #E2E8F0;
  background-color: #F8FAFC;
}

.section-title {
  margin: 0;
  color: #0B3558;
  font-size: 0.92rem;
  font-weight: 700;
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

/* Product avatar (letter-based) */
.product-avatar {
  width: 52px;
  height: 52px;
  font-size: 1.3rem;
  font-weight: 700;
}

/* Page title */
.page-title {
  color: #0B3558;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

/* Primary gradient button */
.btn-primary {
  background: linear-gradient(135deg, #0E7490, #0B3558);
  color: #fff;
  font-size: 0.88rem;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(14, 116, 144, 0.3);
  transition: all 0.18s;
}
.btn-primary:hover {
  box-shadow: 0 4px 16px rgba(14, 116, 144, 0.45);
  transform: translateY(-1px);
}

/* KPI cards: 1-col mobile → 3-col desktop */
.kpi-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
@media (min-width: 640px) {
  .kpi-grid { grid-template-columns: repeat(3, 1fr); }
}

/* KPI label */
.kpi-label {
  margin: 0;
  color: #64748B;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* KPI icon */
.kpi-icon {
  width: 34px;
  height: 34px;
}

/* Status badge */
.status-badge {
  font-size: 0.75rem;
  font-weight: 700;
}

/* Info fields: 1-col mobile → 2-col desktop */
.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}
@media (min-width: 640px) {
  .info-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Info field label */
.field-label {
  margin: 0;
  font-size: 0.75rem;
  color: #94A3B8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Info field value */
.field-value {
  margin: 0;
  color: #1E293B;
  font-size: 0.92rem;
  font-weight: 500;
}

/* Category badge */
.category-badge {
  padding: 3px 12px;
  font-size: 0.78rem;
  font-weight: 600;
}

/* Text utilities */
.text-muted {
  color: #64748B;
  font-size: 0.8rem;
  margin: 0;
}
.text-muted-light {
  color: #94A3B8;
  font-size: 0.75rem;
  margin: 0;
}

/* Link-style button */
.btn-link {
  background: none;
  border: none;
  cursor: pointer;
  color: #0E7490;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background-color 0.15s;
}
.btn-link:hover {
  background-color: #E0F2FE;
}

/* Movement list row */
.movement-row {
  border: 1px solid #F1F5F9;
  transition: all 0.15s;
}
.movement-row:hover {
  border-color: #E2E8F0;
  background-color: #FAFBFE;
}

.movement-icon {
  width: 38px;
  height: 38px;
}

.movement-name {
  color: #1E293B;
  font-size: 0.88rem;
  font-weight: 600;
}

.movement-badge {
  font-size: 0.82rem;
  font-weight: 700;
}

/* Actions: 1-col mobile → 2-col desktop */
.actions-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
@media (min-width: 640px) {
  .actions-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Action button */
.btn-action {
  background: none;
  border: 1.5px solid #E2E8F0;
  color: #1E293B;
  font-size: 0.9rem;
  font-weight: 500;
  text-align: left;
  transition: all 0.18s;
  width: 100%;
}
.btn-action:hover {
  background-color: #F8FAFC;
  border-color: #0E7490;
}
.btn-action:focus-visible {
  outline: 2px solid #0E7490;
  outline-offset: 2px;
}

.action-icon-wrap {
  width: 36px;
  height: 36px;
}

.action-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: #0B3558;
}

/* Empty state icon */
.empty-icon-wrap {
  width: 64px;
  height: 64px;
  background-color: #F1F5F9;
}

/* Error banner */
.error-banner {
  color: #EF4444;
  font-size: 0.875rem;
  padding: 12px 16px;
  background-color: #FEE2E2;
  border-radius: 10px;
  border: 1px solid #FECACA;
}
</style>