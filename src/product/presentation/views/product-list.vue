<script setup>
import { computed, onMounted, ref, toRefs } from 'vue';
import { useI18n }        from 'vue-i18n';
import useProductStore    from '../../application/product.store.js';
import useIamStore        from '../../../iam/application/iam.store.js';
import { Product, ProductCategory, ProductStatus } from '../../domain/model/product.entity.js';

const { t }        = useI18n();
const productStore = useProductStore();
const iamStore     = useIamStore();

const { products, productsLoaded, inventory, stockMovements } = toRefs(productStore);
const { fetchProducts, fetchInventory, fetchStockMovements,
  addProduct, updateProduct, registerStockIntake } = productStore;

const activeTab            = ref('products');
const searchQuery          = ref('');
const selectedCategory     = ref('Todos');
const selectedStatusFilter = ref('all');
const showProductModal     = ref(false);
const editingProduct       = ref(null);
const showIntakeModal      = ref(false);
const intakeTargetProduct  = ref(null);

const categoryOptions = ['Todos', 'DAIRY', 'GRAINS', 'OILS', 'BEVERAGES', 'CLEANING', 'MEDICINE', 'OTHER'];

const categoryLabels = {
  DAIRY:     'Lácteos',
  GRAINS:    'Granos',
  OILS:      'Aceites',
  BEVERAGES: 'Bebidas',
  CLEANING:  'Limpieza',
  MEDICINE:  'Medicamentos',
  OTHER:     'Otros',
  Todos:     'Todos'
};

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

function getProductInitial(name) {
  return (name || '?').charAt(0).toUpperCase();
}

const statusConfig = {
  normal:   { label: 'Normal',     color: '#16A34A', background: '#DCFCE7', icon: 'pi pi-box'                  },
  low:      { label: 'Stock bajo', color: '#D97706', background: '#FEF3C7', icon: 'pi pi-exclamation-triangle'  },
  expiring: { label: 'Por vencer', color: '#EA580C', background: '#FFEDD5', icon: 'pi pi-clock'                 },
  critical: { label: 'Crítico',    color: '#DC2626', background: '#FEE2E2', icon: 'pi pi-exclamation-circle'    },
  out:      { label: 'Sin stock',  color: '#64748B', background: '#F1F5F9', icon: 'pi pi-times-circle'          }
};

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (businessId) {
    if (!productsLoaded.value) fetchProducts(businessId);
    fetchInventory(businessId);
  }
});

function resolveProductStatus(productId) {
  const inventoryItem = productStore.getInventoryByProduct(productId);
  if (!inventoryItem || inventoryItem.currentStock === 0) return 'out';
  if (inventoryItem.currentStock <= inventoryItem.minimumStock) return 'critical';
  return 'normal';
}

function resolveCurrentStock(productId) {
  const inventoryItem = productStore.getInventoryByProduct(productId);
  return inventoryItem ? inventoryItem.currentStock : 0;
}

function resolveMinimumStock(productId) {
  const inventoryItem = productStore.getInventoryByProduct(productId);
  return inventoryItem ? inventoryItem.minimumStock : 0;
}

const summaryCounts = computed(() => {
  const counts = { total: products.value.length, low: 0, expiring: 0, out: 0 };
  products.value.forEach(product => {
    const status = resolveProductStatus(product.id);
    if (status === 'out')      counts.out      += 1;
    if (status === 'low' || status === 'critical') counts.low += 1;
    if (status === 'expiring' || status === 'critical') counts.expiring += 1;
  });
  return counts;
});

const filteredProducts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return products.value.filter(product => {
    const matchesSearch   = !query || product.name.toLowerCase().includes(query);
    const matchesCategory = selectedCategory.value === 'Todos' || product.category === selectedCategory.value;
    const productStatus   = resolveProductStatus(product.id);
    const matchesStatus   = selectedStatusFilter.value === 'all' || productStatus === selectedStatusFilter.value;
    return matchesSearch && matchesCategory && matchesStatus;
  });
});

function countByStatus(statusKey) {
  return products.value.filter(product => resolveProductStatus(product.id) === statusKey).length;
}

// ── Product modal ──────────────────────────────────────────────────────────────

const productModalForm = ref({
  name:           '',
  category:       'BEVERAGES',
  supplier:       '',
  currentStock:   '',
  minimumStock:   '',
  basePrice:      '',
  cost:           '',
  expirationDate: ''
});

function openCreateProductModal() {
  editingProduct.value   = null;
  productModalForm.value = { name: '', category: 'BEVERAGES', supplier: '', currentStock: '', minimumStock: '', basePrice: '', cost: '', expirationDate: '' };
  showProductModal.value = true;
}

function openEditProductModal(product) {
  editingProduct.value = product;
  productModalForm.value = {
    name:           product.name,
    category:       product.category,
    supplier:       product.description ?? '',
    currentStock:   String(resolveCurrentStock(product.id)),
    minimumStock:   String(resolveMinimumStock(product.id)),
    basePrice:      String(product.basePrice),
    cost:           '',
    expirationDate: ''
  };
  showProductModal.value = true;
}

function saveProductFromModal() {
  if (!productModalForm.value.name.trim()) return;

  const businessId = iamStore.currentUser?.businessId ?? null;
  const productEntity = new Product({
    id:          editingProduct.value ? editingProduct.value.id : null,
    businessId:  businessId,
    name:        productModalForm.value.name.trim(),
    category:    productModalForm.value.category,
    description: productModalForm.value.supplier,
    basePrice:   parseFloat(productModalForm.value.basePrice) || 0,
    status:      ProductStatus.ACTIVE
  });

  if (editingProduct.value) {
    updateProduct(productEntity);
  } else {
    addProduct(productEntity);
    const initialStock = parseInt(productModalForm.value.currentStock) || 0;
    if (initialStock > 0) {
      setTimeout(() => {
        const newProduct = productStore.products[productStore.products.length - 1];
        if (newProduct) {
          registerStockIntake({ productId: newProduct.id, businessId, quantity: initialStock });
        }
      }, 400);
    }
  }

  showProductModal.value = false;
}

// ── Intake modal ───────────────────────────────────────────────────────────────

const intakeForm = ref({ productId: '', quantity: '', supplier: '', note: '' });

function openIntakeModal(product) {
  intakeTargetProduct.value = product;
  intakeForm.value = {
    productId: product ? String(product.id) : (products.value[0] ? String(products.value[0].id) : ''),
    quantity:  '',
    supplier:  '',
    note:      ''
  };
  showIntakeModal.value = true;
}

function saveIntake() {
  const quantity = parseInt(intakeForm.value.quantity);
  if (!intakeForm.value.productId || !quantity || quantity <= 0) return;

  const businessId = iamStore.currentUser?.businessId ?? null;
  registerStockIntake({
    productId:  parseInt(intakeForm.value.productId),
    businessId: businessId,
    quantity:   quantity
  });

  const productName = products.value.find(p => p.id === parseInt(intakeForm.value.productId))?.name ?? '';
  stockMovements.value.unshift({
    id:           Date.now(),
    productId:    parseInt(intakeForm.value.productId),
    product:      productName,
    type:         'INTAKE',
    quantity:     quantity,
    supplier:     intakeForm.value.supplier,
    note:         intakeForm.value.note,
    registeredAt: new Date().toLocaleDateString('es-PE')
  });

  showIntakeModal.value = false;
}

function formatCurrency(amount) {
  return `S/ ${Number(amount).toFixed(2)}`;
}

const warehouseSummary = [
  { name: 'Almacén Principal',  location: 'Tienda – Primer piso', itemCount: 8, value: 'S/ 38,450' },
  { name: 'Almacén Secundario', location: 'Depósito – Sótano',   itemCount: 4, value: 'S/ 6,780'  }
];
</script>

<template>
  <div class="page-wrapper">

    <!-- ── Header ─────────────────────────────────────────────────── -->
    <div style="margin-bottom: 1.25rem;">
      <div class="flex align-items-start justify-content-between gap-3 flex-wrap">
        <div>
          <h1 class="m-0 page-title">{{ t('inventory.title') }}</h1>
          <p class="m-0 mt-1 page-subtitle">{{ t('inventory.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2 flex-shrink-0">
          <!-- Register intake (hidden on mobile, replaced by FAB) -->
          <button
              class="hidden sm:flex align-items-center gap-2 px-3 py-2 border-round-xl cursor-pointer btn-intake-outline"
              @click="openIntakeModal(null)"
          >
            <i class="pi pi-arrow-down-circle" style="font-size: 0.9rem;"/>
            {{ t('inventory.btn-register-intake') }}
          </button>
          <!-- New product -->
          <button
              class="flex align-items-center gap-2 px-3 py-2 border-round-xl border-none cursor-pointer btn-primary"
              @click="openCreateProductModal"
          >
            <i class="pi pi-plus" style="font-size: 0.9rem;"/>
            {{ t('inventory.btn-new-product') }}
          </button>
        </div>
      </div>

      <!-- Stat cards: 2-col mobile → 4-col desktop -->
      <div class="stat-grid mt-4">
        <div
            v-for="stat in [
              { label: t('inventory.stat-total'),    value: summaryCounts.total,    color: '#0B3558', bg: '#EFF6FF', iconBg: '#DBEAFE', icon: 'pi pi-box'                  },
              { label: t('inventory.stat-low'),      value: summaryCounts.low,      color: '#D97706', bg: '#FFFBEB', iconBg: '#FEF3C7', icon: 'pi pi-exclamation-triangle'  },
              { label: t('inventory.stat-expiring'), value: summaryCounts.expiring, color: '#EA580C', bg: '#FFF7ED', iconBg: '#FFEDD5', icon: 'pi pi-clock'                 },
              { label: t('inventory.stat-out'),      value: summaryCounts.out,      color: '#64748B', bg: '#F8FAFC', iconBg: '#E2E8F0', icon: 'pi pi-times-circle'           }
            ]"
            :key="stat.label"
            class="flex align-items-center gap-3 border-round-xl px-4 py-3"
            :style="{ backgroundColor: stat.bg, border: '1px solid #E2E8F0' }"
        >
          <div
              class="flex align-items-center justify-content-center border-round-xl flex-shrink-0 stat-icon"
              :style="{ backgroundColor: stat.iconBg }"
          >
            <i :class="stat.icon" :style="{ color: stat.color, fontSize: '1rem' }"/>
          </div>
          <div>
            <p class="m-0 stat-label">{{ stat.label }}</p>
            <p class="m-0 mt-1 stat-value" :style="{ color: stat.color }">{{ stat.value }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Tabs ────────────────────────────────────────────────────── -->
    <div class="mb-4">
      <div class="flex gap-1 p-1 border-round-xl tab-bar">
        <button
            v-for="tab in [
              { id: 'products',  label: t('inventory.tab-products'),  icon: 'pi pi-box'      },
              { id: 'movements', label: t('inventory.tab-movements'), icon: 'pi pi-clock'    },
              { id: 'warehouse', label: t('inventory.tab-warehouse'), icon: 'pi pi-building' }
            ]"
            :key="tab.id"
            class="flex align-items-center gap-2 px-3 py-2 border-round-lg border-none cursor-pointer tab-btn"
            :style="{
              fontWeight:      activeTab === tab.id ? 700 : 400,
              backgroundColor: activeTab === tab.id ? '#fff' : 'transparent',
              color:           activeTab === tab.id ? '#0B3558' : '#64748B',
              boxShadow:       activeTab === tab.id ? '0 1px 6px rgba(0,0,0,0.10)' : 'none'
            }"
            @click="activeTab = tab.id"
        >
          <i
              :class="tab.icon"
              style="font-size: 0.82rem;"
              :style="{ color: activeTab === tab.id ? '#0E7490' : '#94A3B8' }"
          />
          <span class="hidden sm:inline">{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         TAB: PRODUCTS
    ═══════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'products'" style="display: flex; flex-direction: column; gap: 1rem;">

      <!-- Search + category filter -->
      <div class="flex flex-column sm:flex-row gap-3">
        <div class="relative" style="flex: 1;">
          <i class="pi pi-search absolute search-icon"/>
          <input
              v-model="searchQuery"
              :placeholder="t('inventory.search-placeholder')"
              class="search-input"
          />
        </div>
        <div class="relative" style="min-width: 160px;">
          <i class="pi pi-filter absolute filter-icon"/>
          <select v-model="selectedCategory" class="category-select">
            <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ categoryLabels[cat] ?? cat }}</option>
          </select>
          <i class="pi pi-chevron-down absolute select-arrow"/>
        </div>
      </div>

      <!-- Status filter pills — horizontally scrollable on mobile -->
      <div class="pills-scroll">
        <div class="flex gap-2" style="white-space: nowrap;">
          <button
              v-for="pill in [
                { key: 'all',      label: t('inventory.pill-all')      },
                { key: 'low',      label: t('inventory.pill-low')      },
                { key: 'expiring', label: t('inventory.pill-expiring') },
                { key: 'critical', label: t('inventory.pill-critical') },
                { key: 'out',      label: t('inventory.pill-out')      }
              ]"
              :key="pill.key"
              class="inline-flex align-items-center gap-1 border-round-3xl border-none cursor-pointer pill-btn"
              :style="{
                fontWeight:      selectedStatusFilter === pill.key ? 700 : 400,
                backgroundColor: selectedStatusFilter === pill.key ? '#0B3558' : '#F1F5F9',
                color:           selectedStatusFilter === pill.key ? '#fff'    : '#64748B',
                border:          selectedStatusFilter === pill.key ? 'none'    : '1px solid #E2E8F0',
                transform:       selectedStatusFilter === pill.key ? 'scale(1.05)' : 'scale(1)'
              }"
              @click="selectedStatusFilter = pill.key"
          >
            {{ pill.label }}
            <span
                v-if="pill.key !== 'all'"
                class="border-round-3xl pill-count"
                :style="{
                  backgroundColor: selectedStatusFilter === pill.key ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                  color:           selectedStatusFilter === pill.key ? '#fff' : '#64748B'
                }"
            >
              {{ countByStatus(pill.key) }}
            </span>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="!productsLoaded" class="flex justify-content-center align-items-center gap-3 py-8">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; color: #0E7490;"/>
        <span class="loading-text">Cargando productos…</span>
      </div>

      <!-- Desktop table -->
      <div v-else class="hidden md:block border-round-xl overflow-hidden table-card">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
            <tr class="table-head">
              <th
                  v-for="header in [t('inventory.col-product'), t('inventory.col-category'), t('inventory.col-stock'), t('inventory.col-min'), t('inventory.col-price'), t('inventory.col-expiration'), t('inventory.col-status'), '']"
                  :key="header"
                  class="px-4 py-3 text-left col-header"
              >
                {{ header }}
              </th>
            </tr>
            </thead>
            <tbody>
            <tr
                v-for="(product, index) in filteredProducts"
                :key="product.id"
                class="table-row"
                :style="{ borderBottom: index < filteredProducts.length - 1 ? '1px solid #F1F5F9' : 'none' }"
            >
              <!-- Product name + avatar -->
              <td class="px-4 py-3">
                <div class="flex align-items-center gap-3">
                  <div
                      class="flex align-items-center justify-content-center border-round-lg flex-shrink-0 product-avatar-sm"
                      :style="{ backgroundColor: getCategoryColor(product.category).bg, color: getCategoryColor(product.category).color }"
                  >
                    {{ getProductInitial(product.name) }}
                  </div>
                  <div>
                    <p class="m-0 product-name">{{ product.name }}</p>
                    <p class="m-0 mt-1 product-desc">{{ product.description || '—' }}</p>
                  </div>
                </div>
              </td>
              <!-- Category badge -->
              <td class="px-4 py-3">
                <span
                    class="border-round-2xl category-badge"
                    :style="{ backgroundColor: getCategoryColor(product.category).bg, color: getCategoryColor(product.category).color }"
                >
                  {{ categoryLabels[product.category] ?? product.category }}
                </span>
              </td>
              <!-- Stock -->
              <td class="px-4 py-3">
                <span class="stock-value" :style="{ color: resolveCurrentStock(product.id) === 0 ? '#CBD5E1' : '#0B3558' }">
                  {{ resolveCurrentStock(product.id) }}
                </span>
                <span class="stock-unit"> {{ t('inventory.und') }}</span>
              </td>
              <!-- Min -->
              <td class="px-4 py-3 min-stock-value">{{ resolveMinimumStock(product.id) }}</td>
              <!-- Price -->
              <td class="px-4 py-3 price-value">{{ formatCurrency(product.basePrice) }}</td>
              <!-- Expiration -->
              <td class="px-4 py-3 expiration-placeholder">—</td>
              <!-- Status badge -->
              <td class="px-4 py-3">
                <span
                    class="inline-flex align-items-center gap-1 border-round-3xl status-badge"
                    :style="{
                      backgroundColor: statusConfig[resolveProductStatus(product.id)]?.background,
                      color:           statusConfig[resolveProductStatus(product.id)]?.color
                    }"
                >
                  <i :class="statusConfig[resolveProductStatus(product.id)]?.icon" style="font-size: 0.65rem;"/>
                  {{ statusConfig[resolveProductStatus(product.id)]?.label }}
                </span>
              </td>
              <!-- Actions -->
              <td class="px-4 py-3">
                <div class="flex align-items-center gap-1 justify-content-end">
                  <button
                      class="p-2 border-round-lg border-none cursor-pointer btn-icon-intake"
                      title="Registrar ingreso"
                      @click="openIntakeModal(product)"
                  >
                    <i class="pi pi-arrow-down-circle" style="font-size: 0.95rem;"/>
                  </button>
                  <button
                      class="p-2 border-round-lg border-none cursor-pointer btn-icon-edit"
                      title="Editar"
                      @click="openEditProductModal(product)"
                  >
                    <i class="pi pi-pencil" style="font-size: 0.9rem;"/>
                  </button>
                </div>
              </td>
            </tr>
            </tbody>
          </table>

          <!-- Empty state -->
          <div v-if="filteredProducts.length === 0" class="flex flex-column align-items-center py-12 gap-3">
            <div class="flex align-items-center justify-content-center border-round-xl empty-icon-wrap">
              <i class="pi pi-box" style="font-size: 1.8rem; color: #CBD5E1;"/>
            </div>
            <p class="m-0 empty-text">{{ t('inventory.no-results') }}</p>
          </div>
        </div>
      </div>

      <!-- Mobile cards -->
      <div class="md:hidden" style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div
            v-if="filteredProducts.length === 0"
            class="flex flex-column align-items-center py-10 border-round-xl gap-3 table-card"
        >
          <div class="flex align-items-center justify-content-center border-round-xl empty-icon-wrap-sm">
            <i class="pi pi-box" style="font-size: 1.6rem; color: #CBD5E1;"/>
          </div>
          <p class="m-0 empty-text">{{ t('inventory.no-results') }}</p>
        </div>

        <div
            v-for="product in filteredProducts"
            :key="product.id"
            class="p-4 border-round-xl mobile-card"
        >
          <!-- Card header: avatar + name + status -->
          <div class="flex align-items-start gap-3 mb-3">
            <div
                class="flex align-items-center justify-content-center border-round-lg flex-shrink-0 product-avatar-lg"
                :style="{ backgroundColor: getCategoryColor(product.category).bg, color: getCategoryColor(product.category).color }"
            >
              {{ getProductInitial(product.name) }}
            </div>
            <div style="flex: 1; min-width: 0;">
              <p class="m-0 mobile-product-name">{{ product.name }}</p>
              <span
                  class="border-round-2xl mt-1 inline-block category-badge-sm"
                  :style="{ backgroundColor: getCategoryColor(product.category).bg, color: getCategoryColor(product.category).color }"
              >
                {{ categoryLabels[product.category] ?? product.category }}
              </span>
            </div>
            <span
                class="inline-flex align-items-center gap-1 border-round-3xl flex-shrink-0 status-badge"
                :style="{
                  backgroundColor: statusConfig[resolveProductStatus(product.id)]?.background,
                  color:           statusConfig[resolveProductStatus(product.id)]?.color
                }"
            >
              <i :class="statusConfig[resolveProductStatus(product.id)]?.icon" style="font-size: 0.65rem;"/>
              {{ statusConfig[resolveProductStatus(product.id)]?.label }}
            </span>
          </div>

          <!-- Stats mini-cards -->
          <div class="mb-3 mini-stats-grid">
            <div class="border-round-lg p-2 text-center mini-stat">
              <p class="m-0 mb-1 mini-stat-label">Stock</p>
              <p class="m-0 mini-stat-value" :style="{ color: resolveCurrentStock(product.id) === 0 ? '#CBD5E1' : '#0B3558' }">
                {{ resolveCurrentStock(product.id) }}
              </p>
            </div>
            <div class="border-round-lg p-2 text-center mini-stat">
              <p class="m-0 mb-1 mini-stat-label">Mínimo</p>
              <p class="m-0 mini-stat-value" style="color: #64748B;">{{ resolveMinimumStock(product.id) }}</p>
            </div>
            <div class="border-round-lg p-2 text-center mini-stat">
              <p class="m-0 mb-1 mini-stat-label">Precio</p>
              <p class="m-0 mini-price-value">{{ formatCurrency(product.basePrice) }}</p>
            </div>
          </div>

          <!-- Action buttons -->
          <div class="flex gap-2">
            <button
                class="flex-1 flex align-items-center justify-content-center gap-2 py-2 border-round-xl border-none cursor-pointer btn-mobile-intake"
                @click="openIntakeModal(product)"
            >
              <i class="pi pi-arrow-down-circle" style="font-size: 0.82rem;"/>
              Ingreso
            </button>
            <button
                class="flex-1 flex align-items-center justify-content-center gap-2 py-2 border-round-xl cursor-pointer btn-mobile-edit"
                @click="openEditProductModal(product)"
            >
              <i class="pi pi-pencil" style="font-size: 0.82rem;"/>
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- FAB: mobile quick intake -->
    <button
        v-if="activeTab === 'products'"
        class="sm:hidden fixed flex align-items-center justify-content-center border-round-3xl border-none cursor-pointer fab"
        @click="openIntakeModal(null)"
    >
      <i class="pi pi-arrow-down-circle" style="font-size: 1.3rem;"/>
    </button>

    <!-- ══════════════════════════════════════════════════════════════
         TAB: MOVEMENTS
    ═══════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'movements'" class="border-round-xl overflow-hidden table-card">
      <!-- Desktop table -->
      <div class="hidden md:block" style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
          <tr class="table-head">
            <th
                v-for="header in [t('inventory.col-date'), t('inventory.col-movement-product'), t('inventory.col-type'), t('inventory.col-qty'), t('inventory.col-supplier'), t('inventory.col-note')]"
                :key="header"
                class="px-4 py-3 text-left col-header"
            >
              {{ header }}
            </th>
          </tr>
          </thead>
          <tbody>
          <tr
              v-for="(movement, index) in stockMovements"
              :key="movement.id"
              class="table-row"
              :style="{ borderBottom: index < stockMovements.length - 1 ? '1px solid #F1F5F9' : 'none' }"
          >
            <td class="px-4 py-3 movement-date">{{ movement.registeredAt }}</td>
            <td class="px-4 py-3 movement-product">{{ movement.product ?? movement.productId }}</td>
            <td class="px-4 py-3">
              <span
                  class="inline-flex align-items-center gap-1 border-round-3xl status-badge"
                  :style="{
                    backgroundColor: movement.type === 'INTAKE' ? '#DCFCE7' : movement.type === 'SALE' ? '#FEE2E2' : '#FEF3C7',
                    color:           movement.type === 'INTAKE' ? '#16A34A' : movement.type === 'SALE' ? '#DC2626' : '#D97706'
                  }"
              >
                <i
                    :class="movement.type === 'INTAKE' ? 'pi pi-arrow-circle-up' : movement.type === 'SALE' ? 'pi pi-arrow-circle-down' : 'pi pi-refresh'"
                    style="font-size: 0.65rem;"
                />
                {{ movement.type === 'INTAKE' ? t('inventory.movement-intake') : movement.type === 'SALE' ? t('inventory.movement-sale') : t('inventory.movement-adjustment') }}
              </span>
            </td>
            <td class="px-4 py-3">
              <span
                  class="stock-value"
                  :style="{ color: movement.signedQuantity !== undefined ? (movement.signedQuantity < 0 ? '#DC2626' : '#16A34A') : '#16A34A' }"
              >
                {{ movement.signedQuantity !== undefined ? (movement.signedQuantity > 0 ? '+' : '') + movement.signedQuantity : '+' + movement.quantity }}
              </span>
              <span class="stock-unit"> und.</span>
            </td>
            <td class="px-4 py-3 movement-date">{{ movement.supplier ?? '—' }}</td>
            <td class="px-4 py-3 product-desc">{{ movement.note ?? '—' }}</td>
          </tr>
          </tbody>
        </table>
        <div v-if="!stockMovements.length" class="flex flex-column align-items-center py-12 gap-3">
          <div class="flex align-items-center justify-content-center border-round-xl empty-icon-wrap">
            <i class="pi pi-clock" style="font-size: 1.8rem; color: #CBD5E1;"/>
          </div>
          <p class="m-0 empty-text">Sin movimientos registrados</p>
        </div>
      </div>

      <!-- Mobile movement list -->
      <div class="md:hidden">
        <div v-if="!stockMovements.length" class="flex flex-column align-items-center py-10 gap-3">
          <div class="flex align-items-center justify-content-center border-round-xl empty-icon-wrap-sm">
            <i class="pi pi-clock" style="font-size: 1.6rem; color: #CBD5E1;"/>
          </div>
          <p class="m-0 empty-text">Sin movimientos registrados</p>
        </div>
        <div
            v-for="(movement, index) in stockMovements"
            :key="movement.id"
            class="flex align-items-start gap-3 p-4"
            :style="{ borderBottom: index < stockMovements.length - 1 ? '1px solid #F1F5F9' : 'none' }"
        >
          <!-- Type icon circle -->
          <div
              class="flex align-items-center justify-content-center border-round-lg flex-shrink-0 movement-type-icon"
              :style="{ backgroundColor: movement.type === 'INTAKE' ? '#DCFCE7' : movement.type === 'SALE' ? '#FEE2E2' : '#FEF3C7' }"
          >
            <i
                :class="movement.type === 'INTAKE' ? 'pi pi-arrow-circle-up' : movement.type === 'SALE' ? 'pi pi-arrow-circle-down' : 'pi pi-refresh'"
                style="font-size: 1.05rem;"
                :style="{ color: movement.type === 'INTAKE' ? '#16A34A' : movement.type === 'SALE' ? '#DC2626' : '#D97706' }"
            />
          </div>
          <div style="flex: 1; min-width: 0;">
            <div class="flex align-items-center justify-content-between gap-2">
              <p class="m-0 mobile-product-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{ movement.product ?? movement.productId }}</p>
              <p
                  class="m-0 flex-shrink-0 stock-value"
                  :style="{ color: movement.type === 'SALE' ? '#DC2626' : '#16A34A' }"
              >
                {{ movement.type === 'SALE' ? '-' : '+' }}{{ movement.quantity }}
              </p>
            </div>
            <div class="flex align-items-center gap-2 mt-1 flex-wrap">
              <span
                  class="border-round-3xl inline-block category-badge-sm"
                  :style="{
                    backgroundColor: movement.type === 'INTAKE' ? '#DCFCE7' : movement.type === 'SALE' ? '#FEE2E2' : '#FEF3C7',
                    color:           movement.type === 'INTAKE' ? '#16A34A' : movement.type === 'SALE' ? '#DC2626' : '#D97706'
                  }"
              >
                {{ movement.type === 'INTAKE' ? t('inventory.movement-intake') : movement.type === 'SALE' ? t('inventory.movement-sale') : t('inventory.movement-adjustment') }}
              </span>
              <p class="m-0 product-desc">{{ movement.registeredAt }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         TAB: WAREHOUSE
    ═══════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'warehouse'" style="display: flex; flex-direction: column; gap: 1rem;">

      <!-- Warehouse summary cards -->
      <div class="stat-grid">
        <div
            v-for="warehouse in warehouseSummary"
            :key="warehouse.name"
            class="border-round-xl overflow-hidden table-card"
        >
          <div style="height: 4px; background: linear-gradient(to right, #0E7490, #0B3558);"/>
          <div class="p-5">
            <div class="flex align-items-start gap-3 mb-4">
              <div class="flex align-items-center justify-content-center border-round-xl flex-shrink-0 warehouse-icon">
                <i class="pi pi-building" style="color: #0E7490; font-size: 1.1rem;"/>
              </div>
              <div>
                <p class="m-0 warehouse-name">{{ warehouse.name }}</p>
                <p class="m-0 mt-1 product-desc">
                  <i class="pi pi-map-marker" style="font-size: 0.7rem;"/> {{ warehouse.location }}
                </p>
              </div>
            </div>
            <div class="warehouse-stats-grid">
              <div class="border-round-xl p-3 mini-stat">
                <p class="m-0 mb-1 mini-stat-label">Productos</p>
                <p class="m-0 warehouse-count">{{ warehouse.itemCount }}</p>
              </div>
              <div class="border-round-xl p-3 warehouse-value-card">
                <p class="m-0 mb-1 warehouse-value-label">Valor</p>
                <p class="m-0 warehouse-value">{{ warehouse.value }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Distribution table -->
      <div class="border-round-xl overflow-hidden table-card">
        <div class="px-5 py-3 flex align-items-center gap-2 section-header">
          <i class="pi pi-table" style="color: #0E7490; font-size: 0.88rem;"/>
          <p class="m-0 section-header-text">{{ t('inventory.warehouse-title') }}</p>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
            <tr class="table-head">
              <th
                  v-for="header in [t('inventory.warehouse-col-product'), t('inventory.warehouse-col-main'), t('inventory.warehouse-col-secondary'), t('inventory.warehouse-col-total')]"
                  :key="header"
                  class="px-4 py-3 text-left col-header"
              >{{ header }}</th>
            </tr>
            </thead>
            <tbody>
            <tr
                v-for="(product, index) in products.slice(0, 5)"
                :key="product.id"
                class="table-row"
                :style="{ borderBottom: index < 4 ? '1px solid #F1F5F9' : 'none' }"
            >
              <td class="px-4 py-3">
                <div class="flex align-items-center gap-2">
                  <div
                      class="flex align-items-center justify-content-center border-round flex-shrink-0 product-avatar-xs"
                      :style="{ backgroundColor: getCategoryColor(product.category).bg, color: getCategoryColor(product.category).color }"
                  >
                    {{ getProductInitial(product.name) }}
                  </div>
                  <span class="product-name">{{ product.name }}</span>
                </div>
              </td>
              <td class="px-4 py-3 warehouse-stock">{{ resolveCurrentStock(product.id) }} und.</td>
              <td class="px-4 py-3 expiration-placeholder">—</td>
              <td class="px-4 py-3">
                <span class="warehouse-total">{{ resolveCurrentStock(product.id) }} und.</span>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         MODAL: PRODUCT CREATE / EDIT
    ═══════════════════════════════════════════════════════════════ -->
    <div
        v-if="showProductModal"
        class="fixed inset-0 z-50 flex align-items-end sm:align-items-center justify-content-center modal-overlay"
        @click.self="showProductModal = false"
    >
      <div class="w-full border-round-t-2xl sm:border-round-2xl overflow-y-auto modal-container">
        <!-- Modal header -->
        <div class="flex align-items-center justify-content-between px-5 py-4 modal-header">
          <div class="flex align-items-center gap-3">
            <div class="flex align-items-center justify-content-center border-round-lg modal-icon-wrap" style="background: linear-gradient(135deg, #E0F2FE, #DBEAFE);">
              <i class="pi pi-box" style="color: #0E7490; font-size: 0.95rem;"/>
            </div>
            <p class="m-0 modal-title">
              {{ editingProduct ? t('inventory.modal-edit-product') : t('inventory.modal-new-product') }}
            </p>
          </div>
          <button class="p-2 border-round-lg border-none cursor-pointer btn-modal-close" @click="showProductModal = false">
            <i class="pi pi-times" style="font-size: 1rem;"/>
          </button>
        </div>

        <div class="px-5 py-5">
          <div class="flex flex-column gap-4">

            <!-- Name -->
            <div>
              <label class="modal-label">{{ t('inventory.modal-field-name') }}</label>
              <input v-model="productModalForm.name" :placeholder="t('inventory.modal-field-name-placeholder')" class="modal-input"/>
            </div>

            <!-- Category + Supplier (2-col on sm+) -->
            <div class="flex flex-column sm:flex-row gap-4">
              <div style="flex: 1;">
                <label class="modal-label">{{ t('inventory.modal-field-category') }}</label>
                <select v-model="productModalForm.category" class="modal-input modal-select">
                  <option v-for="cat in categoryOptions.slice(1)" :key="cat" :value="cat">{{ categoryLabels[cat] ?? cat }}</option>
                </select>
              </div>
              <div style="flex: 1;">
                <label class="modal-label">{{ t('inventory.modal-field-supplier') }}</label>
                <input v-model="productModalForm.supplier" :placeholder="t('inventory.modal-field-supplier-placeholder')" class="modal-input"/>
              </div>
            </div>

            <!-- Stock actual + Stock mínimo -->
            <div class="flex flex-column sm:flex-row gap-4">
              <div style="flex: 1;">
                <label class="modal-label">{{ t('inventory.modal-field-stock') }}</label>
                <input v-model="productModalForm.currentStock" type="number" min="0" placeholder="0" class="modal-input"/>
              </div>
              <div style="flex: 1;">
                <label class="modal-label">{{ t('inventory.modal-field-min-stock') }}</label>
                <input v-model="productModalForm.minimumStock" type="number" min="0" placeholder="0" class="modal-input"/>
              </div>
            </div>

            <!-- Precio venta + Precio costo -->
            <div class="flex flex-column sm:flex-row gap-4">
              <div style="flex: 1;">
                <label class="modal-label">{{ t('inventory.modal-field-price') }}</label>
                <input v-model="productModalForm.basePrice" type="number" min="0" step="0.01" placeholder="0.00" class="modal-input"/>
              </div>
              <div style="flex: 1;">
                <label class="modal-label">{{ t('inventory.modal-field-cost') }}</label>
                <input v-model="productModalForm.cost" type="number" min="0" step="0.01" placeholder="0.00" class="modal-input"/>
              </div>
            </div>

            <!-- Expiration date -->
            <div>
              <label class="modal-label">{{ t('inventory.modal-field-expiration') }}</label>
              <input v-model="productModalForm.expirationDate" type="date" class="modal-input"/>
            </div>
          </div>

          <!-- Modal actions -->
          <div class="flex gap-3 mt-5">
            <button class="flex-1 py-2 border-round-xl cursor-pointer btn-modal-cancel" @click="showProductModal = false">
              {{ t('inventory.modal-cancel') }}
            </button>
            <button class="flex-1 py-2 border-round-xl border-none cursor-pointer btn-modal-primary" @click="saveProductFromModal">
              {{ editingProduct ? t('inventory.modal-save') : t('inventory.modal-register') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         MODAL: STOCK INTAKE
    ═══════════════════════════════════════════════════════════════ -->
    <div
        v-if="showIntakeModal"
        class="fixed inset-0 z-50 flex align-items-end sm:align-items-center justify-content-center modal-overlay"
        @click.self="showIntakeModal = false"
    >
      <div class="w-full border-round-t-2xl sm:border-round-2xl modal-container-sm">
        <!-- Modal header -->
        <div class="flex align-items-center justify-content-between px-5 py-4 modal-header">
          <div class="flex align-items-center gap-3">
            <div class="flex align-items-center justify-content-center border-round-lg modal-icon-wrap" style="background: linear-gradient(135deg, #DCFCE7, #BBF7D0);">
              <i class="pi pi-arrow-down-circle" style="color: #16A34A; font-size: 0.95rem;"/>
            </div>
            <p class="m-0 modal-title">{{ t('inventory.intake-modal-title') }}</p>
          </div>
          <button class="p-2 border-round-lg border-none cursor-pointer btn-modal-close" @click="showIntakeModal = false">
            <i class="pi pi-times" style="font-size: 1rem;"/>
          </button>
        </div>

        <div class="px-5 py-5 flex flex-column gap-4">
          <!-- Product selector -->
          <div>
            <label class="modal-label">{{ t('inventory.intake-field-product') }}</label>
            <select v-model="intakeForm.productId" class="modal-input modal-select">
              <option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }}</option>
            </select>
          </div>
          <!-- Quantity -->
          <div>
            <label class="modal-label">{{ t('inventory.intake-field-qty') }}</label>
            <input v-model="intakeForm.quantity" type="number" min="1" placeholder="0" class="modal-input"/>
          </div>
          <!-- Supplier -->
          <div>
            <label class="modal-label">{{ t('inventory.intake-field-supplier') }}</label>
            <input v-model="intakeForm.supplier" :placeholder="t('inventory.intake-field-supplier-placeholder')" class="modal-input"/>
          </div>
          <!-- Note -->
          <div>
            <label class="modal-label">{{ t('inventory.intake-field-note') }}</label>
            <input v-model="intakeForm.note" :placeholder="t('inventory.intake-field-note-placeholder')" class="modal-input"/>
          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <button class="flex-1 py-2 border-round-xl cursor-pointer btn-modal-cancel" @click="showIntakeModal = false">
              {{ t('inventory.modal-cancel') }}
            </button>
            <button class="flex-1 py-2 border-round-xl border-none cursor-pointer btn-intake-confirm" @click="saveIntake">
              {{ t('inventory.intake-btn') }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Page wrapper */
.page-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
}

/* ── Header text ─────────────────────────────────────────────── */
.page-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #0B3558;
  line-height: 1.2;
}

.page-subtitle {
  color: #64748B;
  font-size: 0.8rem;
}

/* ── Header buttons ──────────────────────────────────────────── */
.btn-intake-outline {
  border: 1.5px solid #0E7490;
  color: #0E7490;
  font-size: 0.82rem;
  font-weight: 600;
  background-color: #fff;
  transition: all 0.15s;
}
.btn-intake-outline:hover {
  background-color: #E0F2FE;
  border-color: #0B3558;
}

.btn-primary {
  background: linear-gradient(135deg, #0E7490 0%, #0B3558 100%);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(14, 116, 144, 0.35);
  transition: all 0.18s;
}
.btn-primary:hover {
  box-shadow: 0 6px 20px rgba(14, 116, 144, 0.45);
  transform: translateY(-1px);
}

/* ── Stat cards ──────────────────────────────────────────────── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}
@media (min-width: 768px) {
  .stat-grid { grid-template-columns: repeat(4, 1fr); }
}

.stat-icon {
  width: 42px;
  height: 42px;
}

.stat-label {
  font-size: 0.72rem;
  color: #64748B;
  line-height: 1.2;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

/* ── Tab bar ─────────────────────────────────────────────────── */
.tab-bar {
  background-color: #F1F5F9;
  width: fit-content;
  max-width: 100%;
}

.tab-btn {
  transition: all 0.2s;
  font-size: 0.82rem;
  white-space: nowrap;
}

/* ── Search & filters ────────────────────────────────────────── */
.search-icon {
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94A3B8;
  font-size: 0.85rem;
  z-index: 1;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 10px 16px 10px 36px;
  border-radius: 12px;
  background-color: #F8FAFC;
  border: 1.5px solid #E2E8F0;
  color: #0B3558;
  font-size: 0.88rem;
  outline: none;
  box-sizing: border-box;
  transition: all 0.18s;
}
.search-input:focus {
  border-color: #0E7490;
  box-shadow: 0 0 0 3px rgba(14, 116, 144, 0.12);
  background-color: #fff;
}

.filter-icon {
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94A3B8;
  font-size: 0.8rem;
  z-index: 1;
  pointer-events: none;
}

.category-select {
  width: 100%;
  padding: 10px 32px 10px 32px;
  border-radius: 12px;
  background-color: #F8FAFC;
  border: 1.5px solid #E2E8F0;
  color: #0B3558;
  font-size: 0.88rem;
  outline: none;
  appearance: none;
  transition: border-color 0.18s;
  cursor: pointer;
}
.category-select:focus {
  border-color: #0E7490;
}

.select-arrow {
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #94A3B8;
  font-size: 0.72rem;
  pointer-events: none;
}

/* ── Filter pills ────────────────────────────────────────────── */
.pills-scroll {
  overflow-x: auto;
  padding-bottom: 4px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.pills-scroll::-webkit-scrollbar { display: none; }

.pill-btn {
  padding: 6px 14px;
  font-size: 0.78rem;
  transition: all 0.18s;
}

.pill-count {
  padding: 1px 6px;
  font-size: 0.68rem;
  font-weight: 700;
  min-width: 18px;
  text-align: center;
}

/* ── Loading ─────────────────────────────────────────────────── */
.loading-text {
  color: #64748B;
  font-size: 0.88rem;
}

/* ── Table card ──────────────────────────────────────────────── */
.table-card {
  background-color: #ffffff;
  border: 1px solid #E2E8F0;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
}

.table-head {
  background: linear-gradient(to right, #F8FAFC, #F1F5F9);
  border-bottom: 2px solid #E2E8F0;
}

.col-header {
  font-size: 0.7rem;
  font-weight: 700;
  color: #64748B;
  white-space: nowrap;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.table-row { transition: background-color 0.1s; }
.table-row:hover { background-color: #F8FBFF; }

/* ── Table cell text ─────────────────────────────────────────── */
.product-avatar-sm {
  width: 36px;
  height: 36px;
  font-size: 0.9rem;
  font-weight: 700;
}

.product-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1E293B;
}

.product-desc {
  font-size: 0.72rem;
  color: #94A3B8;
}

.category-badge {
  padding: 3px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  display: inline-block;
}

.stock-value {
  font-size: 0.9rem;
  font-weight: 700;
}

.stock-unit {
  font-size: 0.72rem;
  color: #94A3B8;
}

.min-stock-value {
  font-size: 0.82rem;
  color: #94A3B8;
}

.price-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: #0B3558;
}

.expiration-placeholder {
  font-size: 0.82rem;
  color: #CBD5E1;
}

.status-badge {
  padding: 4px 10px;
  font-size: 0.72rem;
  font-weight: 700;
}

/* ── Table icon buttons ──────────────────────────────────────── */
.btn-icon-intake {
  background: none;
  color: #0E7490;
  transition: all 0.15s;
}
.btn-icon-intake:hover {
  background-color: #E0F2FE;
  transform: scale(1.12);
}

.btn-icon-edit {
  background: none;
  color: #64748B;
  transition: all 0.15s;
}
.btn-icon-edit:hover {
  background-color: #F1F5F9;
  transform: scale(1.12);
}

/* ── Empty states ────────────────────────────────────────────── */
.empty-icon-wrap {
  width: 64px;
  height: 64px;
  background-color: #F1F5F9;
}

.empty-icon-wrap-sm {
  width: 56px;
  height: 56px;
  background-color: #F1F5F9;
}

.empty-text {
  color: #94A3B8;
  font-size: 0.9rem;
  font-weight: 500;
}

/* ── Mobile product cards ────────────────────────────────────── */
.mobile-card {
  background-color: #ffffff;
  border: 1px solid #E2E8F0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.product-avatar-lg {
  width: 44px;
  height: 44px;
  font-size: 1rem;
  font-weight: 700;
}

.mobile-product-name {
  font-size: 0.92rem;
  font-weight: 700;
  color: #1E293B;
}

.category-badge-sm {
  padding: 2px 8px;
  font-size: 0.68rem;
  font-weight: 600;
}

.mini-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.mini-stat {
  background-color: #F8FAFC;
}

.mini-stat-label {
  font-size: 0.62rem;
  color: #94A3B8;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mini-stat-value {
  font-size: 1.05rem;
  font-weight: 700;
}

.mini-price-value {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0B3558;
}

.btn-mobile-intake {
  background: linear-gradient(135deg, #0E7490, #0B3558);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(14, 116, 144, 0.3);
}

.btn-mobile-edit {
  background: none;
  border: 1.5px solid #E2E8F0;
  color: #64748B;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.15s;
}
.btn-mobile-edit:hover {
  background-color: #F8FAFC;
  border-color: #CBD5E1;
}

/* ── FAB ─────────────────────────────────────────────────────── */
.fab {
  bottom: 24px;
  right: 20px;
  width: 54px;
  height: 54px;
  background: linear-gradient(135deg, #0E7490, #0B3558);
  color: #fff;
  box-shadow: 0 4px 18px rgba(14, 116, 144, 0.5);
  z-index: 40;
  transition: transform 0.18s;
}
.fab:hover { transform: scale(1.1); }

/* ── Movement table specifics ────────────────────────────────── */
.movement-date {
  font-size: 0.82rem;
  color: #64748B;
}

.movement-product {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1E293B;
}

.movement-type-icon {
  width: 40px;
  height: 40px;
}

/* ── Warehouse cards ─────────────────────────────────────────── */
.warehouse-icon {
  width: 46px;
  height: 46px;
  background: linear-gradient(135deg, #E0F2FE, #DBEAFE);
}

.warehouse-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0B3558;
}

.warehouse-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.warehouse-count {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0B3558;
}

.warehouse-value-card {
  background-color: #F0FDF4;
  border: 1px solid #BBF7D0;
}

.warehouse-value-label {
  font-size: 0.62rem;
  color: #16A34A;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.warehouse-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #16A34A;
}

.warehouse-stock {
  font-size: 0.85rem;
  color: #0B3558;
  font-weight: 500;
}

.warehouse-total {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0E7490;
}

/* ── Section header (warehouse table) ───────────────────────── */
.section-header {
  border-bottom: 1px solid #E2E8F0;
  background-color: #F8FAFC;
}

.section-header-text {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0B3558;
}

/* ── Product avatar (warehouse table) ───────────────────────── */
.product-avatar-xs {
  width: 28px;
  height: 28px;
  font-size: 0.72rem;
  font-weight: 700;
}

/* ── Modal overlay ───────────────────────────────────────────── */
.modal-overlay {
  background-color: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(2px);
}

.modal-container {
  max-width: 560px;
  max-height: 92vh;
  background-color: #fff;
  border: 1px solid #E2E8F0;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
}

.modal-container-sm {
  max-width: 480px;
  background-color: #fff;
  border: 1px solid #E2E8F0;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
}

.modal-header {
  border-bottom: 1px solid #E2E8F0;
}

.modal-icon-wrap {
  width: 36px;
  height: 36px;
}

.modal-title {
  font-size: 1rem;
  font-weight: 700;
  color: #0B3558;
}

.modal-label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #374151;
  letter-spacing: 0.02em;
}

/* ── Modal buttons ───────────────────────────────────────────── */
.btn-modal-close {
  background: none;
  color: #64748B;
  transition: all 0.15s;
}
.btn-modal-close:hover { background-color: #F1F5F9; }

.btn-modal-cancel {
  border: 1.5px solid #E2E8F0;
  color: #64748B;
  font-size: 0.88rem;
  background: #fff;
  font-weight: 500;
  transition: all 0.15s;
}
.btn-modal-cancel:hover { background-color: #F8FAFC; }

.btn-modal-primary {
  background: linear-gradient(135deg, #0E7490, #0B3558);
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  box-shadow: 0 2px 10px rgba(14, 116, 144, 0.3);
  transition: all 0.18s;
}
.btn-modal-primary:hover {
  box-shadow: 0 4px 16px rgba(14, 116, 144, 0.45);
  transform: translateY(-1px);
}

.btn-intake-confirm {
  background: linear-gradient(135deg, #16A34A, #15803D);
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  box-shadow: 0 2px 10px rgba(22, 163, 74, 0.3);
  transition: all 0.18s;
}
.btn-intake-confirm:hover {
  box-shadow: 0 4px 16px rgba(22, 163, 74, 0.45);
  transform: translateY(-1px);
}

/* ── Modal input ─────────────────────────────────────────────── */
.modal-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  background-color: #F8FAFC;
  border: 1.5px solid #E2E8F0;
  color: #0B3558;
  font-size: 0.88rem;
  outline: none;
  box-sizing: border-box;
  transition: all 0.18s;
  font-family: inherit;
}
.modal-input:focus {
  border-color: #0E7490;
  box-shadow: 0 0 0 3px rgba(14, 116, 144, 0.12);
  background-color: #fff;
}

.modal-select {
  appearance: none;
  cursor: pointer;
}

/* ── Responsive: hidden/visible helpers ──────────────────────── */
@media (min-width: 768px) {
  .hidden.md\:block { display: block !important; }
  .md\:hidden { display: none !important; }
}
</style>