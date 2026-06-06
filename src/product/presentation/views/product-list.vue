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

/** Active tab: 'products' | 'movements' | 'warehouse' */
const activeTab = ref('products');

/** Search query for the products tab. */
const searchQuery = ref('');

/** Selected category filter. */
const selectedCategory = ref('Todos');

/** Selected status pill filter. */
const selectedStatusFilter = ref('all');

/** Whether the product create/edit modal is visible. */
const showProductModal = ref(false);

/** Product being edited — null when creating. */
const editingProduct = ref(null);

/** Whether the stock intake modal is visible. */
const showIntakeModal = ref(false);

/** Product pre-selected in the intake modal. */
const intakeTargetProduct = ref(null);

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

/**
 * Status configuration — colors, labels and icons matching the Figma.
 * Business rules for status (from InventoryItem entity):
 * - CRITICAL: currentStock === 0
 * - LOW:      currentStock > 0 AND currentStock <= minimumStock
 * - NORMAL:   currentStock > minimumStock
 * We add EXPIRING when a batch expires within 14 days.
 */
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

/**
 * Resolves the display status for a product by joining with inventory.
 * Business rule priority: out → critical → expiring → low → normal.
 * @param {number} productId
 * @returns {string} One of: 'normal' | 'low' | 'expiring' | 'critical' | 'out'
 */
function resolveProductStatus(productId) {
  const inventoryItem = productStore.getInventoryByProduct(productId);
  if (!inventoryItem || inventoryItem.currentStock === 0) return 'out';
  if (inventoryItem.currentStock <= inventoryItem.minimumStock) return 'critical';
  return 'normal';
}

/**
 * Returns the current stock for a product. 0 when no record exists.
 * @param {number} productId
 * @returns {number}
 */
function resolveCurrentStock(productId) {
  const inventoryItem = productStore.getInventoryByProduct(productId);
  return inventoryItem ? inventoryItem.currentStock : 0;
}

/**
 * Returns the minimum stock for a product.
 * @param {number} productId
 * @returns {number}
 */
function resolveMinimumStock(productId) {
  const inventoryItem = productStore.getInventoryByProduct(productId);
  return inventoryItem ? inventoryItem.minimumStock : 0;
}

/**
 * Summary counts for the 4 stat cards.
 * Business rules: joins each product with its inventory item.
 * @type {import('vue').ComputedRef<{total: number, low: number, expiring: number, out: number}>}
 */
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

/**
 * Products filtered by search, category and status pill.
 * @type {import('vue').ComputedRef<Array>}
 */
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

/** Count per status pill. */
function countByStatus(statusKey) {
  return products.value.filter(product => resolveProductStatus(product.id) === statusKey).length;
}

// ── Product modal ──────────────────────────────────────────────────────────────

/**
 * Product modal form state.
 */
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

/**
 * Opens the product modal for creation.
 */
function openCreateProductModal() {
  editingProduct.value  = null;
  productModalForm.value = { name: '', category: 'BEVERAGES', supplier: '', currentStock: '', minimumStock: '', basePrice: '', cost: '', expirationDate: '' };
  showProductModal.value = true;
}

/**
 * Opens the product modal for editing with pre-filled data.
 * @param {import('../../domain/model/product.entity.js').Product} product
 */
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

/**
 * Saves the product from the modal.
 * Business rule: name, category and basePrice are required.
 */
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

/**
 * Opens the stock intake modal.
 * @param {import('../../domain/model/product.entity.js').Product|null} product - Pre-selected product or null.
 */
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

/**
 * Saves the stock intake.
 * Business rule: quantity must be a positive integer.
 */
function saveIntake() {
  const quantity = parseInt(intakeForm.value.quantity);
  if (!intakeForm.value.productId || !quantity || quantity <= 0) return;

  const businessId = iamStore.currentUser?.businessId ?? null;
  registerStockIntake({
    productId:   parseInt(intakeForm.value.productId),
    businessId:  businessId,
    quantity:    quantity
  });

  // Add to local movements list for immediate UI feedback
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

/** Formats a number as PEN currency. */
function formatCurrency(amount) {
  return `S/ ${Number(amount).toFixed(2)}`;
}

// ── Warehouse stub data ─────────────────────────────────────────────────────────

/**
 * Static warehouse data for the warehouse tab.
 * In a real implementation this would be fetched from the warehouses endpoint.
 */
const warehouseSummary = [
  { name: 'Almacén Principal',   location: 'Tienda – Primer piso', itemCount: 8, value: 'S/ 38,450' },
  { name: 'Almacén Secundario',  location: 'Depósito – Sótano',   itemCount: 4, value: 'S/ 6,780'  }
];
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 0;">

    <!-- ── Header ─────────────────────────────────────────────────── -->
    <div style="margin-bottom: 1rem;">
      <div class="flex align-items-start justify-content-between gap-3 flex-wrap">
        <div>
          <h1 class="m-0" style="font-size: 1.3rem; font-weight: 700; color: #0B3558; line-height: 1.2;">
            {{ t('inventory.title') }}
          </h1>
          <p class="m-0 mt-1" style="color: #64748B; font-size: 0.78rem;">{{ t('inventory.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-2 flex-shrink-0">
          <!-- Register intake (hidden on mobile) -->
          <button
              class="hidden sm:flex align-items-center gap-2 px-3 py-2 border-round-xl cursor-pointer"
              style="border: 1.5px solid #0E7490; color: #0E7490; font-size: 0.82rem; font-weight: 600; background-color: #fff; transition: background-color 0.15s;"
              @click="openIntakeModal(null)"
              @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#E0F2FE'"
              @mouseleave="(e) => e.currentTarget.style.backgroundColor = '#fff'"
          >
            <i class="pi pi-arrow-down-circle" style="font-size: 0.9rem;"/>
            {{ t('inventory.btn-register-intake') }}
          </button>
          <!-- New product -->
          <button
              class="flex align-items-center gap-2 px-3 py-2 border-round-xl border-none cursor-pointer"
              style="background-color: #0E7490; color: #fff; font-size: 0.82rem; font-weight: 600; box-shadow: 0 2px 8px rgba(14,116,144,0.25); transition: background-color 0.15s;"
              @click="openCreateProductModal"
              @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#0B3558'"
              @mouseleave="(e) => e.currentTarget.style.backgroundColor = '#0E7490'"
          >
            <i class="pi pi-plus" style="font-size: 0.9rem;"/>
            {{ t('inventory.btn-new-product') }}
          </button>
        </div>
      </div>

      <!-- Summary stat pills -->
      <div class="grid mt-4 m-0" style="gap: 0.75rem; grid-template-columns: repeat(2, 1fr);">
        <div
            v-for="stat in [
                        { label: t('inventory.stat-total'),    value: summaryCounts.total,    color: '#0B3558', bg: '#F8FAFC' },
                        { label: t('inventory.stat-low'),      value: summaryCounts.low,      color: '#D97706', bg: '#FEF9EE' },
                        { label: t('inventory.stat-expiring'), value: summaryCounts.expiring, color: '#EA580C', bg: '#FFF7ED' },
                        { label: t('inventory.stat-out'),      value: summaryCounts.out,      color: '#64748B', bg: '#F8FAFC' }
                    ]"
            :key="stat.label"
            class="flex align-items-center justify-content-between border-round-xl px-4 py-3"
            :style="{ backgroundColor: stat.bg, border: '1px solid #E2E8F0' }"
        >
          <span style="font-size: 0.75rem; color: #64748B;">{{ stat.label }}</span>
          <span style="font-size: 1.1rem; font-weight: 700;" :style="{ color: stat.color }">{{ stat.value }}</span>
        </div>
      </div>
    </div>

    <!-- ── Tabs (pill style) ──────────────────────────────────────── -->
    <div class="mb-4">
      <div
          class="flex gap-1 p-1 border-round-xl"
          style="background-color: #F1F5F9; width: fit-content;"
      >
        <button
            v-for="tab in [
                        { id: 'products',  label: t('inventory.tab-products'),  icon: 'pi pi-box'         },
                        { id: 'movements', label: t('inventory.tab-movements'), icon: 'pi pi-clock'       },
                        { id: 'warehouse', label: t('inventory.tab-warehouse'), icon: 'pi pi-building'    }
                    ]"
            :key="tab.id"
            class="flex align-items-center gap-2 px-3 py-2 border-round-lg border-none cursor-pointer"
            style="transition: all 0.15s; font-size: 0.82rem; white-space: nowrap;"
            :style="{
                        fontWeight:       activeTab === tab.id ? 600 : 400,
                        backgroundColor:  activeTab === tab.id ? '#fff' : 'transparent',
                        color:            activeTab === tab.id ? '#0B3558' : '#64748B',
                        boxShadow:        activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                    }"
            @click="activeTab = tab.id"
        >
          <i :class="tab.icon" style="font-size: 0.82rem;"/>
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
          <i class="pi pi-search absolute" style="left: 12px; top: 50%; transform: translateY(-50%); color: #94A3B8; font-size: 0.85rem;"/>
          <input
              v-model="searchQuery"
              :placeholder="t('inventory.search-placeholder')"
              style="width: 100%; padding: 10px 16px 10px 36px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
              @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
              @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
          />
        </div>
        <div class="relative" style="min-width: 160px;">
          <i class="pi pi-filter absolute" style="left: 12px; top: 50%; transform: translateY(-50%); color: #94A3B8; font-size: 0.8rem;"/>
          <select
              v-model="selectedCategory"
              style="width: 100%; padding: 10px 32px 10px 32px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; appearance: none;"
              @focus="(e) => e.target.style.borderColor = '#0E7490'"
              @blur="(e) => e.target.style.borderColor = '#E2E8F0'"
          >
            <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ categoryLabels[cat] ?? cat }}</option>
          </select>
          <i class="pi pi-chevron-down absolute" style="right: 10px; top: 50%; transform: translateY(-50%); color: #94A3B8; font-size: 0.72rem; pointer-events: none;"/>
        </div>
      </div>

      <!-- Status filter pills -->
      <div class="flex flex-wrap gap-2">
        <button
            v-for="pill in [
                        { key: 'all',      label: t('inventory.pill-all')      },
                        { key: 'low',      label: t('inventory.pill-low')      },
                        { key: 'expiring', label: t('inventory.pill-expiring') },
                        { key: 'critical', label: t('inventory.pill-critical') },
                        { key: 'out',      label: t('inventory.pill-out')      }
                    ]"
            :key="pill.key"
            class="flex align-items-center gap-1 border-round-3xl border-none cursor-pointer"
            style="padding: 6px 12px; font-size: 0.78rem; transition: all 0.15s;"
            :style="{
                        fontWeight:      selectedStatusFilter === pill.key ? 600 : 400,
                        backgroundColor: selectedStatusFilter === pill.key ? '#0B3558' : '#F1F5F9',
                        color:           selectedStatusFilter === pill.key ? '#fff'    : '#64748B',
                        border:          selectedStatusFilter === pill.key ? 'none'    : '1px solid #E2E8F0'
                    }"
            @click="selectedStatusFilter = pill.key"
        >
          {{ pill.label }}
          <span
              v-if="pill.key !== 'all'"
              class="border-round-3xl px-1"
              style="font-size: 0.68rem;"
              :style="{ backgroundColor: selectedStatusFilter === pill.key ? 'rgba(255,255,255,0.2)' : '#E2E8F0' }"
          >
                        {{ countByStatus(pill.key) }}
                    </span>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="!productsLoaded" class="flex justify-content-center py-8">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; color: #0E7490;"/>
      </div>

      <!-- Desktop table -->
      <div v-else class="hidden md:block border-round-xl overflow-hidden" style="background-color: #ffffff; border: 1px solid #E2E8F0;">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
            <tr style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
              <th v-for="header in [t('inventory.col-product'), t('inventory.col-category'), t('inventory.col-stock'), t('inventory.col-min'), t('inventory.col-price'), t('inventory.col-expiration'), t('inventory.col-status'), '']"
                  :key="header"
                  class="px-4 py-3 text-left"
                  style="font-size: 0.75rem; font-weight: 600; color: #64748B; white-space: nowrap;"
              >
                {{ header }}
              </th>
            </tr>
            </thead>
            <tbody>
            <tr
                v-for="(product, index) in filteredProducts"
                :key="product.id"
                style="transition: background-color 0.1s;"
                :style="{ borderBottom: index < filteredProducts.length - 1 ? '1px solid #F1F5F9' : 'none' }"
                @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#FAFAFA'"
                @mouseleave="(e) => e.currentTarget.style.backgroundColor = 'transparent'"
            >
              <td class="px-4 py-3">
                <p class="m-0" style="font-size: 0.85rem; font-weight: 600; color: #1E293B;">{{ product.name }}</p>
                <p class="m-0 mt-1" style="font-size: 0.72rem; color: #94A3B8;">{{ product.description || '—' }}</p>
              </td>
              <td class="px-4 py-3" style="font-size: 0.82rem; color: #64748B;">{{ categoryLabels[product.category] ?? product.category }}</td>
              <td class="px-4 py-3">
                                    <span style="font-size: 0.88rem; font-weight: 700;" :style="{ color: resolveCurrentStock(product.id) === 0 ? '#94A3B8' : '#0B3558' }">
                                        {{ resolveCurrentStock(product.id) }}
                                    </span>
                <span style="font-size: 0.72rem; color: #94A3B8;"> {{ t('inventory.und') }}</span>
              </td>
              <td class="px-4 py-3" style="font-size: 0.82rem; color: #94A3B8;">{{ resolveMinimumStock(product.id) }}</td>
              <td class="px-4 py-3" style="font-size: 0.85rem; font-weight: 600; color: #0B3558;">{{ formatCurrency(product.basePrice) }}</td>
              <td class="px-4 py-3" style="font-size: 0.82rem; color: #EA580C;">—</td>
              <td class="px-4 py-3">
                                    <span
                                        class="inline-flex align-items-center gap-1 border-round-3xl"
                                        style="padding: 3px 8px; font-size: 0.72rem; font-weight: 600;"
                                        :style="{
                                            backgroundColor: statusConfig[resolveProductStatus(product.id)]?.background,
                                            color:           statusConfig[resolveProductStatus(product.id)]?.color
                                        }"
                                    >
                                        <i :class="statusConfig[resolveProductStatus(product.id)]?.icon" style="font-size: 0.65rem;"/>
                                        {{ statusConfig[resolveProductStatus(product.id)]?.label }}
                                    </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex align-items-center gap-1 justify-content-end">
                  <button
                      class="p-2 border-round-lg border-none cursor-pointer"
                      style="background: none; color: #0E7490; transition: background-color 0.15s;"
                      title="Registrar ingreso"
                      @click="openIntakeModal(product)"
                      @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#E0F2FE'"
                      @mouseleave="(e) => e.currentTarget.style.backgroundColor = 'transparent'"
                  >
                    <i class="pi pi-arrow-down-circle" style="font-size: 0.95rem;"/>
                  </button>
                  <button
                      class="p-2 border-round-lg border-none cursor-pointer"
                      style="background: none; color: #64748B; transition: background-color 0.15s;"
                      title="Editar"
                      @click="openEditProductModal(product)"
                      @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'"
                      @mouseleave="(e) => e.currentTarget.style.backgroundColor = 'transparent'"
                  >
                    <i class="pi pi-pencil" style="font-size: 0.9rem;"/>
                  </button>
                </div>
              </td>
            </tr>
            </tbody>
          </table>

          <!-- Empty state -->
          <div v-if="filteredProducts.length === 0" class="flex flex-column align-items-center py-10">
            <i class="pi pi-box" style="font-size: 2rem; color: #CBD5E1;"/>
            <p class="mt-2 m-0" style="color: #94A3B8; font-size: 0.88rem;">{{ t('inventory.no-results') }}</p>
          </div>
        </div>
      </div>

      <!-- Mobile cards -->
      <div class="md:hidden" style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div
            v-if="filteredProducts.length === 0"
            class="flex flex-column align-items-center py-10 border-round-xl"
            style="background-color: #ffffff; border: 1px solid #E2E8F0;"
        >
          <i class="pi pi-box" style="font-size: 1.8rem; color: #CBD5E1;"/>
          <p class="mt-2 m-0" style="color: #94A3B8; font-size: 0.85rem;">{{ t('inventory.no-results') }}</p>
        </div>
        <div
            v-for="product in filteredProducts"
            :key="product.id"
            class="p-4 border-round-xl"
            style="background-color: #ffffff; border: 1px solid #E2E8F0;"
        >
          <div class="flex align-items-start justify-content-between gap-2 mb-3">
            <div>
              <p class="m-0" style="font-size: 0.9rem; font-weight: 700; color: #1E293B;">{{ product.name }}</p>
              <p class="m-0 mt-1" style="font-size: 0.74rem; color: #94A3B8;">{{ categoryLabels[product.category] ?? product.category }} · {{ product.description || '—' }}</p>
            </div>
            <span
                class="inline-flex align-items-center gap-1 border-round-3xl flex-shrink-0"
                style="padding: 3px 8px; font-size: 0.7rem; font-weight: 600;"
                :style="{
                                backgroundColor: statusConfig[resolveProductStatus(product.id)]?.background,
                                color:           statusConfig[resolveProductStatus(product.id)]?.color
                            }"
            >
                            {{ statusConfig[resolveProductStatus(product.id)]?.label }}
                        </span>
          </div>
          <div class="grid mb-3" style="grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
            <div>
              <p class="m-0 mb-1" style="font-size: 0.68rem; color: #94A3B8;">Stock</p>
              <p class="m-0" style="font-size: 1rem; font-weight: 700;" :style="{ color: resolveCurrentStock(product.id) === 0 ? '#94A3B8' : '#0B3558' }">
                {{ resolveCurrentStock(product.id) }}
              </p>
            </div>
            <div>
              <p class="m-0 mb-1" style="font-size: 0.68rem; color: #94A3B8;">Mínimo</p>
              <p class="m-0" style="font-size: 1rem; font-weight: 700; color: #64748B;">{{ resolveMinimumStock(product.id) }}</p>
            </div>
            <div>
              <p class="m-0 mb-1" style="font-size: 0.68rem; color: #94A3B8;">Precio</p>
              <p class="m-0" style="font-size: 0.95rem; font-weight: 700; color: #0B3558;">{{ formatCurrency(product.basePrice) }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button
                class="flex-1 flex align-items-center justify-content-center gap-2 py-2 border-round-xl border-none cursor-pointer"
                style="background-color: #0E7490; color: #fff; font-size: 0.78rem; font-weight: 600;"
                @click="openIntakeModal(product)"
            >
              <i class="pi pi-arrow-down-circle" style="font-size: 0.82rem;"/>
              Ingreso
            </button>
            <button
                class="flex-1 flex align-items-center justify-content-center gap-2 py-2 border-round-xl cursor-pointer"
                style="background: none; border: 1.5px solid #E2E8F0; color: #64748B; font-size: 0.78rem; font-weight: 600;"
                @click="openEditProductModal(product)"
            >
              <i class="pi pi-pencil" style="font-size: 0.82rem;"/>
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         TAB: MOVEMENTS
    ═══════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'movements'" class="border-round-xl overflow-hidden" style="background-color: #ffffff; border: 1px solid #E2E8F0;">

      <!-- Desktop table -->
      <div class="hidden md:block" style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
          <tr style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
            <th v-for="header in [t('inventory.col-date'), t('inventory.col-movement-product'), t('inventory.col-type'), t('inventory.col-qty'), t('inventory.col-supplier'), t('inventory.col-note')]"
                :key="header"
                class="px-4 py-3 text-left"
                style="font-size: 0.75rem; font-weight: 600; color: #64748B;"
            >
              {{ header }}
            </th>
          </tr>
          </thead>
          <tbody>
          <tr
              v-for="(movement, index) in stockMovements"
              :key="movement.id"
              :style="{ borderBottom: index < stockMovements.length - 1 ? '1px solid #F1F5F9' : 'none' }"
          >
            <td class="px-4 py-3" style="font-size: 0.82rem; color: #64748B;">{{ movement.registeredAt }}</td>
            <td class="px-4 py-3" style="font-size: 0.85rem; font-weight: 600; color: #1E293B;">{{ movement.product ?? movement.productId }}</td>
            <td class="px-4 py-3">
                                <span
                                    class="border-round-3xl px-2"
                                    style="padding: 3px 8px; font-size: 0.72rem; font-weight: 600;"
                                    :style="{
                                        backgroundColor: movement.type === 'INTAKE' ? '#DCFCE7' : movement.type === 'SALE' ? '#FEE2E2' : '#FEF3C7',
                                        color:           movement.type === 'INTAKE' ? '#16A34A' : movement.type === 'SALE' ? '#DC2626' : '#D97706'
                                    }"
                                >
                                    {{ movement.type === 'INTAKE' ? t('inventory.movement-intake') : movement.type === 'SALE' ? t('inventory.movement-sale') : t('inventory.movement-adjustment') }}
                                </span>
            </td>
            <td class="px-4 py-3" style="font-size: 0.88rem; font-weight: 700;"
                :style="{ color: movement.signedQuantity !== undefined ? (movement.signedQuantity < 0 ? '#DC2626' : '#0B3558') : '#0B3558' }">
              {{ movement.signedQuantity !== undefined ? (movement.signedQuantity > 0 ? '+' : '') + movement.signedQuantity : movement.quantity }} und.
            </td>
            <td class="px-4 py-3" style="font-size: 0.82rem; color: #64748B;">{{ movement.supplier ?? '—' }}</td>
            <td class="px-4 py-3" style="font-size: 0.82rem; color: #94A3B8;">{{ movement.note ?? '—' }}</td>
          </tr>
          </tbody>
        </table>
        <div v-if="!stockMovements.length" class="flex flex-column align-items-center py-10">
          <i class="pi pi-clock" style="font-size: 2rem; color: #CBD5E1;"/>
          <p class="mt-2 m-0" style="color: #94A3B8; font-size: 0.88rem;">Sin movimientos registrados</p>
        </div>
      </div>

      <!-- Mobile list -->
      <div class="md:hidden">
        <div
            v-for="(movement, index) in stockMovements"
            :key="movement.id"
            class="flex align-items-start gap-3 p-4"
            :style="{ borderBottom: index < stockMovements.length - 1 ? '1px solid #F1F5F9' : 'none' }"
        >
                    <span
                        class="border-round-3xl flex-shrink-0"
                        style="padding: 3px 8px; margin-top: 2px; font-size: 0.7rem; font-weight: 700;"
                        :style="{
                            backgroundColor: movement.type === 'INTAKE' ? '#DCFCE7' : '#FEE2E2',
                            color:           movement.type === 'INTAKE' ? '#16A34A' : '#DC2626'
                        }"
                    >
                        {{ movement.type === 'INTAKE' ? t('inventory.movement-intake') : t('inventory.movement-sale') }}
                    </span>
          <div style="flex: 1; min-width: 0;">
            <div class="flex align-items-center justify-content-between gap-2">
              <p class="m-0" style="font-size: 0.85rem; font-weight: 600; color: #1E293B;">{{ movement.product ?? movement.productId }}</p>
              <p class="m-0" style="font-size: 0.88rem; font-weight: 700; flex-shrink: 0;"
                 :style="{ color: movement.type === 'SALE' ? '#DC2626' : '#16A34A' }">
                {{ movement.type === 'SALE' ? '-' : '+' }}{{ movement.quantity }}
              </p>
            </div>
            <p class="m-0 mt-1" style="font-size: 0.75rem; color: #94A3B8;">{{ movement.registeredAt }} · {{ movement.note ?? '—' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         TAB: WAREHOUSE
    ═══════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'warehouse'" style="display: flex; flex-direction: column; gap: 1rem;">

      <!-- Warehouse summary cards -->
      <div class="grid m-0" style="gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
        <div
            v-for="warehouse in warehouseSummary"
            :key="warehouse.name"
            class="p-5 border-round-xl"
            style="background-color: #ffffff; border: 1px solid #E2E8F0;"
        >
          <div class="flex align-items-start gap-3">
            <div class="flex align-items-center justify-content-center border-round-xl flex-shrink-0"
                 style="width: 40px; height: 40px; background-color: #E0F2FE;">
              <i class="pi pi-building" style="color: #0E7490; font-size: 1rem;"/>
            </div>
            <div>
              <p class="m-0" style="font-size: 0.92rem; font-weight: 700; color: #0B3558;">{{ warehouse.name }}</p>
              <p class="m-0 mt-1" style="font-size: 0.76rem; color: #64748B;">{{ warehouse.location }}</p>
            </div>
          </div>
          <div class="grid mt-4 m-0" style="gap: 0.75rem; grid-template-columns: 1fr 1fr;">
            <div class="border-round-xl p-3" style="background-color: #F8FAFC;">
              <p class="m-0 mb-1" style="font-size: 0.68rem; color: #94A3B8;">Productos</p>
              <p class="m-0" style="font-size: 1.1rem; font-weight: 700; color: #0B3558;">{{ warehouse.itemCount }}</p>
            </div>
            <div class="border-round-xl p-3" style="background-color: #F8FAFC;">
              <p class="m-0 mb-1" style="font-size: 0.68rem; color: #94A3B8;">Valor</p>
              <p class="m-0" style="font-size: 1rem; font-weight: 700; color: #22C55E;">{{ warehouse.value }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Distribution table -->
      <div class="border-round-xl overflow-hidden" style="background-color: #ffffff; border: 1px solid #E2E8F0;">
        <div class="px-5 py-3" style="border-bottom: 1px solid #E2E8F0;">
          <p class="m-0" style="font-size: 0.88rem; font-weight: 600; color: #0B3558;">{{ t('inventory.warehouse-title') }}</p>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
            <tr style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
              <th v-for="header in [t('inventory.warehouse-col-product'), t('inventory.warehouse-col-main'), t('inventory.warehouse-col-secondary'), t('inventory.warehouse-col-total')]"
                  :key="header"
                  class="px-4 py-3 text-left"
                  style="font-size: 0.75rem; font-weight: 600; color: #64748B;"
              >{{ header }}</th>
            </tr>
            </thead>
            <tbody>
            <tr
                v-for="(product, index) in products.slice(0, 5)"
                :key="product.id"
                :style="{ borderBottom: index < 4 ? '1px solid #F1F5F9' : 'none' }"
            >
              <td class="px-4 py-3" style="font-size: 0.85rem; font-weight: 600; color: #1E293B;">{{ product.name }}</td>
              <td class="px-4 py-3" style="font-size: 0.85rem; color: #0B3558;">{{ resolveCurrentStock(product.id) }} und.</td>
              <td class="px-4 py-3" style="font-size: 0.85rem; color: #CBD5E1;">—</td>
              <td class="px-4 py-3" style="font-size: 0.88rem; font-weight: 700; color: #0E7490;">{{ resolveCurrentStock(product.id) }} und.</td>
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
        class="fixed inset-0 z-50 flex align-items-end sm:align-items-center justify-content-center"
        style="background-color: rgba(0,0,0,0.5);"
    >
      <div
          class="w-full border-round-t-2xl sm:border-round-2xl overflow-y-auto"
          style="max-width: 560px; max-height: 92vh; background-color: #fff; border: 1px solid #E2E8F0; box-shadow: 0 20px 60px rgba(0,0,0,0.15);"
      >
        <div class="flex align-items-center justify-content-between px-5 py-4" style="border-bottom: 1px solid #E2E8F0;">
          <p class="m-0" style="font-size: 1rem; font-weight: 700; color: #0B3558;">
            {{ editingProduct ? t('inventory.modal-edit-product') : t('inventory.modal-new-product') }}
          </p>
          <button
              class="p-2 border-round-lg border-none cursor-pointer"
              style="background: none; color: #64748B; transition: background-color 0.15s;"
              @click="showProductModal = false"
              @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'"
              @mouseleave="(e) => e.currentTarget.style.backgroundColor = 'transparent'"
          >
            <i class="pi pi-times" style="font-size: 1rem;"/>
          </button>
        </div>
        <div class="px-5 py-5">
          <div class="grid m-0" style="gap: 1rem;">

            <!-- Name (full width) -->
            <div class="col-12 p-0">
              <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.modal-field-name') }}</label>
              <input
                  v-model="productModalForm.name"
                  :placeholder="t('inventory.modal-field-name-placeholder')"
                  style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
                  @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
                  @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
              />
            </div>

            <!-- Category + Supplier -->
            <div class="col-12 sm:col-6 p-0">
              <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.modal-field-category') }}</label>
              <select
                  v-model="productModalForm.category"
                  style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none;"
                  @focus="(e) => e.target.style.borderColor = '#0E7490'"
                  @blur="(e) => e.target.style.borderColor = '#E2E8F0'"
              >
                <option v-for="cat in categoryOptions.slice(1)" :key="cat" :value="cat">{{ categoryLabels[cat] ?? cat }}</option>
              </select>
            </div>
            <div class="col-12 sm:col-6 p-0">
              <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.modal-field-supplier') }}</label>
              <input
                  v-model="productModalForm.supplier"
                  :placeholder="t('inventory.modal-field-supplier-placeholder')"
                  style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
                  @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
                  @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
              />
            </div>

            <!-- Stock actual + Stock mínimo -->
            <div class="col-12 sm:col-6 p-0">
              <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.modal-field-stock') }}</label>
              <input
                  v-model="productModalForm.currentStock"
                  type="number" min="0" placeholder="0"
                  style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
                  @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
                  @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
              />
            </div>
            <div class="col-12 sm:col-6 p-0">
              <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.modal-field-min-stock') }}</label>
              <input
                  v-model="productModalForm.minimumStock"
                  type="number" min="0" placeholder="0"
                  style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
                  @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
                  @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
              />
            </div>

            <!-- Precio venta + Precio costo -->
            <div class="col-12 sm:col-6 p-0">
              <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.modal-field-price') }}</label>
              <input
                  v-model="productModalForm.basePrice"
                  type="number" min="0" step="0.01" placeholder="0.00"
                  style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
                  @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
                  @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
              />
            </div>
            <div class="col-12 sm:col-6 p-0">
              <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.modal-field-cost') }}</label>
              <input
                  v-model="productModalForm.cost"
                  type="number" min="0" step="0.01" placeholder="0.00"
                  style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
                  @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
                  @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
              />
            </div>

            <!-- Expiration (full width) -->
            <div class="col-12 p-0">
              <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.modal-field-expiration') }}</label>
              <input
                  v-model="productModalForm.expirationDate"
                  type="date"
                  style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
                  @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
                  @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
              />
            </div>
          </div>

          <!-- Modal actions -->
          <div class="flex gap-3 mt-5">
            <button
                class="flex-1 py-2 border-round-xl cursor-pointer"
                style="border: 1.5px solid #E2E8F0; color: #64748B; font-size: 0.88rem; background: #fff; transition: background-color 0.15s;"
                @click="showProductModal = false"
                @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'"
                @mouseleave="(e) => e.currentTarget.style.backgroundColor = '#fff'"
            >
              {{ t('inventory.modal-cancel') }}
            </button>
            <button
                class="flex-1 py-2 border-round-xl border-none cursor-pointer"
                style="background-color: #0E7490; color: #fff; font-size: 0.88rem; font-weight: 600; transition: background-color 0.15s;"
                @click="saveProductFromModal"
                @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#0B3558'"
                @mouseleave="(e) => e.currentTarget.style.backgroundColor = '#0E7490'"
            >
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
        class="fixed inset-0 z-50 flex align-items-end sm:align-items-center justify-content-center"
        style="background-color: rgba(0,0,0,0.5);"
    >
      <div
          class="w-full border-round-t-2xl sm:border-round-2xl"
          style="max-width: 480px; background-color: #fff; border: 1px solid #E2E8F0; box-shadow: 0 20px 60px rgba(0,0,0,0.15);"
      >
        <div class="flex align-items-center justify-content-between px-5 py-4" style="border-bottom: 1px solid #E2E8F0;">
          <p class="m-0" style="font-size: 1rem; font-weight: 700; color: #0B3558;">{{ t('inventory.intake-modal-title') }}</p>
          <button class="border-none border-round-lg cursor-pointer" style="background: none; color: #64748B; padding: 6px;" @click="showIntakeModal = false">
            <i class="pi pi-times" style="font-size: 1rem;"/>
          </button>
        </div>
        <div class="px-5 py-5" style="display: flex; flex-direction: column; gap: 1rem;">
          <!-- Product selector -->
          <div>
            <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.intake-field-product') }}</label>
            <select
                v-model="intakeForm.productId"
                style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none;"
                @focus="(e) => e.target.style.borderColor = '#0E7490'"
                @blur="(e) => e.target.style.borderColor = '#E2E8F0'"
            >
              <option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }}</option>
            </select>
          </div>
          <!-- Quantity -->
          <div>
            <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.intake-field-qty') }}</label>
            <input
                v-model="intakeForm.quantity"
                type="number" min="1" placeholder="0"
                style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
                @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
                @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
            />
          </div>
          <!-- Supplier -->
          <div>
            <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.intake-field-supplier') }}</label>
            <input
                v-model="intakeForm.supplier"
                :placeholder="t('inventory.intake-field-supplier-placeholder')"
                style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
                @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
                @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
            />
          </div>
          <!-- Note -->
          <div>
            <label class="block mb-1" style="font-size: 0.8rem; font-weight: 600; color: #374151;">{{ t('inventory.intake-field-note') }}</label>
            <input
                v-model="intakeForm.note"
                :placeholder="t('inventory.intake-field-note-placeholder')"
                style="width: 100%; padding: 10px 12px; border-radius: 12px; background-color: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.88rem; outline: none; box-sizing: border-box;"
                @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.1)'; }"
                @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }"
            />
          </div>

          <!--- Actions --->
          <div class="flex gap-3 mt-1">
            <button
                class="flex-1 py-2 border-round-xl cursor-pointer"
                style="border: 1.5px solid #E2E8F0; color: #64748B; font-size: 0.88rem; background: #fff; transition: background-color 0.15s;"
                @click="showIntakeModal = false"
                @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'"
                @mouseleave="(e) => e.currentTarget.style.backgroundColor = '#fff'"
            >
              {{ t('inventory.modal-cancel') }}
            </button>
            <button
                class="flex-1 py-2 border-round-xl border-none cursor-pointer"
                style="background-color: #0E7490; color: #fff; font-size: 0.88rem; font-weight: 600; transition: background-color 0.15s;"
                @click="saveIntake"
                @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#0B3558'"
                @mouseleave="(e) => e.currentTarget.style.backgroundColor = '#0E7490'"
            >
              {{ t('inventory.intake-btn') }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
@media (min-width: 768px) {
  .hidden.md\:block { display: block !important; }
  .md\:hidden { display: none !important; }
}
</style>