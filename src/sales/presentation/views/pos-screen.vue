<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n }     from 'vue-i18n';
import { useRouter }   from 'vue-router';
import { useToast }    from 'primevue/usetoast';
import useSalesStore   from '../../application/sales.store.js';
import useProductStore from '../../../product/application/product.store.js';
import useIamStore     from '../../../iam/application/iam.store.js';
import { PaymentMethod } from '../../domain/model/sale.entity.js';

const { t }        = useI18n();
const router       = useRouter();
const toast        = useToast();
const salesStore   = useSalesStore();
const productStore = useProductStore();
const iamStore     = useIamStore();

// ─── State ─────────────────────────────────────────────────────────────────

/** @type {import('vue').Ref<number|null>} The id of the product selected in the dropdown */
const selectedProductId = ref(null);

/** @type {import('vue').Ref<string>} The chosen payment method value */
const paymentMethod = ref('');

/** @type {import('vue').Ref<string>} Inline error message shown in the red banner */
const errorMessage = ref('');

/** @type {import('vue').Ref<boolean>} Whether the sale was registered successfully */
const success = ref(false);

/** @type {import('vue').Ref<boolean>} Whether the confirm call is in progress */
const isSubmitting = ref(false);

// ─── Computed ──────────────────────────────────────────────────────────────

/**
 * Products available for selection in the dropdown.
 * Only ACTIVE products with stock > 0 are included.
 * Label mirrors prototype: "nombre - S/ precio (Stock: N)"
 */
const availableProducts = computed(() => {
  return productStore.products
      .filter(product => product.isActive)
      .map(product => {
        const inventoryItem  = productStore.inventory.find(item => item.productId === product.id);
        const availableStock = inventoryItem ? inventoryItem.currentStock : 0;
        return {
          id:             product.id,
          name:           product.name,
          basePrice:      product.basePrice,
          availableStock: availableStock,
          label:          `${product.name} - S/ ${product.basePrice.toFixed(2)} (${t('pos.stock-label')}: ${availableStock})`
        };
      })
      .filter(product => product.availableStock > 0);
});

/** The detail lines of the current in-progress sale (the cart) */
const cartDetails = computed(() => salesStore.currentSale ? salesStore.currentSale.details : []);

/** Subtotal from the Sale entity: sum of all lineTotal values */
const subtotal = computed(() => salesStore.currentSale ? salesStore.currentSale.subtotal : 0);

/** IGV (18%) from the Sale entity */
const igvAmount = computed(() => salesStore.currentSale ? salesStore.currentSale.igvAmount : 0);

/** Grand total including IGV from the Sale entity */
const grandTotal = computed(() => salesStore.currentSale ? salesStore.currentSale.grandTotal : 0);

/** Payment method options — mirrors prototype exactly */
const paymentMethodOptions = [
  { value: PaymentMethod.CASH, label: t('pos.payment-cash') },
  { value: PaymentMethod.CARD, label: t('pos.payment-card') },
  { value: 'YAPE_PLIN',        label: t('pos.payment-yape-plin') }
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the product name for a given productId, used inside the cart rows.
 * @param {number} productId
 * @returns {string}
 */
function getProductName(productId) {
  const product = productStore.products.find(p => p.id === productId);
  return product ? product.name : t('pos.unknown-product');
}

/**
 * Returns the available stock for a given productId.
 * @param {number} productId
 * @returns {number}
 */
function getAvailableStock(productId) {
  const enriched = availableProducts.value.find(p => p.id === productId);
  if (enriched) return enriched.availableStock;
  // Product might have been sold below threshold mid-session — fall back to inventory
  const inventoryItem = productStore.inventory.find(item => item.productId === productId);
  return inventoryItem ? inventoryItem.currentStock : 0;
}

// ─── Actions ───────────────────────────────────────────────────────────────

/**
 * Adds the selected product to the cart with quantity 1.
 * Mirrors prototype: no quantity field on the "Agregar Productos" card —
 * the user adjusts quantity from the cart row after adding.
 */
function addProductToCart() {
  errorMessage.value = '';
  if (!selectedProductId.value) return;

  const product = availableProducts.value.find(p => p.id === selectedProductId.value);
  if (!product) return;

  const result = salesStore.addDetailToCurrentSale({
    productId:      product.id,
    quantity:       1,
    unitPrice:      product.basePrice,
    availableStock: product.availableStock
  });

  if (!result.success) {
    errorMessage.value = result.errorMessage;
    return;
  }
  selectedProductId.value = null;
}

/**
 * Updates the quantity of a cart line item when the user changes the number input.
 * If the new value exceeds available stock or is < 1, shows an inline error.
 * Mirrors prototype: actualizarCantidad logic.
 *
 * @param {number} productId
 * @param {number} newQuantity - Raw value from the input (may be 0 or NaN)
 */
function updateCartItemQuantity(productId, newQuantity) {
  errorMessage.value = '';
  const quantity    = parseInt(newQuantity) || 0;
  const productName = getProductName(productId);
  const result      = salesStore.updateDetailQuantity({
    productId:      productId,
    newQuantity:    quantity,
    availableStock: getAvailableStock(productId),
    productName:    productName
  });
  if (!result.success) {
    errorMessage.value = result.errorMessage;
  }
}

/**
 * Removes a product line from the cart.
 * @param {number} productId
 */
function removeCartItem(productId) {
  salesStore.removeDetailFromCurrentSale(productId);
  errorMessage.value = '';
}

/**
 * Validates and submits the sale.
 * Mirrors prototype handleSubmit:
 * 1. Cart must not be empty.
 * 2. Payment method must be selected.
 * 3. Stock re-validation per item.
 * On success shows green banner, then navigates to dashboard after 2 s.
 */
async function handleSubmit() {
  errorMessage.value = '';
  success.value      = false;

  if (cartDetails.value.length === 0) {
    errorMessage.value = t('pos.error-empty-cart');
    return;
  }
  if (!paymentMethod.value) {
    errorMessage.value = t('pos.error-no-payment-method');
    return;
  }

  // Per-item stock re-validation (mirrors prototype for-loop)
  for (const detail of cartDetails.value) {
    const available = getAvailableStock(detail.productId);
    if (detail.quantity > available) {
      const name = getProductName(detail.productId);
      errorMessage.value = `${t('pos.error-stock-prefix')} ${name}. ${t('pos.error-stock-available')}: ${available}, ${t('pos.error-stock-requested')}: ${detail.quantity}`;
      return;
    }
  }

  isSubmitting.value = true;

  // Map YAPE_PLIN to YAPE for the API (the prototype shows them together)
  const apiPaymentMethod = paymentMethod.value === 'YAPE_PLIN' ? PaymentMethod.YAPE : paymentMethod.value;

  const result = await salesStore.confirmSale({
    paymentMethod: apiPaymentMethod,
    customerId:    null,
    description:   ''
  });

  isSubmitting.value = false;

  if (result.success) {
    success.value = true;
    setTimeout(() => {
      router.push({ name: 'dashboard' });
    }, 2000);
  } else {
    errorMessage.value = result.errorMessage;
  }
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId;
  if (!productStore.productsLoaded)  productStore.fetchProducts(businessId);
  if (!productStore.inventoryLoaded) productStore.fetchInventory(businessId);
  if (!salesStore.currentSale)       salesStore.startNewSale(businessId);
});
</script>

<template>
  <div class="flex flex-column gap-4 p-3 md:p-0">

    <!-- Header -->
    <div class="flex align-items-center gap-3">
      <pv-button
          icon="pi pi-arrow-left"
          class="p-button-text p-button-plain"
          @click="router.push({ name: 'dashboard' })"
      />
      <div>
        <h2 class="m-0" style="color: #0B3558;">{{ t('pos.title') }}</h2>
        <p class="m-0 text-sm" style="color: #64748B;">{{ t('pos.subtitle') }}</p>
      </div>
    </div>

    <!-- Error banner -->
    <pv-card
        v-if="errorMessage"
        class="border-1"
        style="background-color: #FEE2E2; border-color: #EF4444;"
    >
      <template #content>
        <p class="m-0" style="color: #EF4444;">{{ errorMessage }}</p>
      </template>
    </pv-card>

    <!-- Success banner -->
    <pv-card
        v-if="success"
        class="border-1"
        style="background-color: #DCFCE7; border-color: #22C55E;"
    >
      <template #content>
        <p class="m-0" style="color: #22C55E;">{{ t('pos.success-message') }}</p>
      </template>
    </pv-card>

    <!-- Main grid: 2 cols left + 1 col right -->
    <div class="grid">

      <!-- Left column (col-span-2): product selector + cart -->
      <div class="col-12 lg:col-8 flex flex-column gap-4">

        <!-- Agregar Productos card -->
        <pv-card>
          <template #content>
            <h3 class="mt-0 mb-3" style="color: #0B3558;">{{ t('pos.section-add-product') }}</h3>
            <div class="flex gap-3">
              <pv-select
                  v-model="selectedProductId"
                  :options="availableProducts"
                  option-label="label"
                  option-value="id"
                  :placeholder="t('pos.product-placeholder')"
                  class="flex-1"
                  filter
              />
              <pv-button
                  :label="t('pos.add-to-cart')"
                  icon="pi pi-plus"
                  @click="addProductToCart"
              />
            </div>
          </template>
        </pv-card>

        <!-- Carrito card -->
        <pv-card>
          <template #content>
            <h3 class="mt-0 mb-3" style="color: #0B3558;">
              {{ t('pos.cart-title') }} ({{ cartDetails.length }})
            </h3>

            <!-- Empty state -->
            <div v-if="cartDetails.length === 0" class="text-center py-6">
              <i class="pi pi-shopping-cart" style="font-size: 3rem; color: #E2E8F0;"/>
              <p class="mt-3 mb-0" style="color: #64748B;">{{ t('pos.empty-cart') }}</p>
            </div>

            <!-- Cart items -->
            <div v-else class="flex flex-column gap-3">
              <div
                  v-for="detail in cartDetails"
                  :key="detail.productId"
                  class="flex flex-column md:flex-row md:align-items-center gap-3 p-3 border-round border-1"
                  style="border-color: #E2E8F0;"
              >
                <!-- Product info -->
                <div class="flex-1 min-w-0">
                  <p class="m-0 text-sm md:text-base" style="color: #1E293B;">
                    {{ getProductName(detail.productId) }}
                  </p>
                  <p class="m-0 text-xs md:text-sm" style="color: #64748B;">
                    S/ {{ detail.unitPrice.toFixed(2) }} {{ t('pos.per-unit') }}
                  </p>
                  <!-- Stock badge — orange if < 10, blue otherwise -->
                  <span
                      class="mt-1 inline-block px-2 py-1 border-round text-xs font-medium"
                      :style="{
                                            backgroundColor: getAvailableStock(detail.productId) < 10 ? '#FFEDD5' : '#E0F2FE',
                                            color:           getAvailableStock(detail.productId) < 10 ? '#F97316' : '#0E7490'
                                        }"
                  >
                                        {{ t('pos.stock-label') }}: {{ getAvailableStock(detail.productId) }}
                                    </span>
                </div>

                <!-- Controls row -->
                <div class="flex align-items-center gap-2 md:gap-3">
                  <!-- Quantity: plain number input, mirrors prototype <Input type="number"> -->
                  <pv-input-text
                      :value="String(detail.quantity)"
                      type="number"
                      :min="1"
                      :max="getAvailableStock(detail.productId)"
                      class="w-4rem md:w-5rem text-sm"
                      @change="updateCartItemQuantity(detail.productId, $event.target.value)"
                  />

                  <!-- Line total -->
                  <p
                      class="m-0 text-sm md:text-base font-medium"
                      style="color: #0B3558; min-width: 5rem;"
                  >
                    S/ {{ detail.lineTotal.toFixed(2) }}
                  </p>

                  <!-- Remove -->
                  <pv-button
                      icon="pi pi-trash"
                      class="p-button-text p-button-danger"
                      @click="removeCartItem(detail.productId)"
                  />
                </div>
              </div>
            </div>
          </template>
        </pv-card>
      </div>

      <!-- Right column: summary + payment + submit -->
      <div class="col-12 lg:col-4 flex flex-column gap-4">

        <!-- Resumen de Venta card -->
        <pv-card>
          <template #content>
            <h3 class="mt-0 mb-3" style="color: #0B3558;">{{ t('pos.summary-title') }}</h3>
            <div class="flex flex-column gap-3">
              <div
                  class="flex justify-content-between pb-3 border-bottom-1"
                  style="border-color: #E2E8F0;"
              >
                <span style="color: #64748B;">{{ t('pos.subtotal') }}</span>
                <span style="color: #1E293B;">S/ {{ subtotal.toFixed(2) }}</span>
              </div>
              <div
                  class="flex justify-content-between pb-3 border-bottom-1"
                  style="border-color: #E2E8F0;"
              >
                <span style="color: #64748B;">{{ t('pos.igv') }}</span>
                <span style="color: #1E293B;">S/ {{ igvAmount.toFixed(2) }}</span>
              </div>
              <div class="flex justify-content-between pt-2">
                <span style="color: #0B3558;">{{ t('pos.grand-total') }}</span>
                <h3 class="m-0" style="color: #0B3558;">S/ {{ grandTotal.toFixed(2) }}</h3>
              </div>
            </div>
          </template>
        </pv-card>

        <!-- Método de Pago card -->
        <pv-card>
          <template #content>
            <h3 class="mt-0 mb-3" style="color: #0B3558;">{{ t('pos.payment-method-title') }}</h3>
            <pv-select
                v-model="paymentMethod"
                :options="paymentMethodOptions"
                option-label="label"
                option-value="value"
                :placeholder="t('pos.payment-placeholder')"
                class="w-full"
            />
          </template>
        </pv-card>

        <!-- Submit button -->
        <pv-button
            :label="t('pos.submit')"
            icon="pi pi-dollar"
            class="w-full"
            style="background-color: #0B3558; border-color: #0B3558; color: #FAFAF7;"
            :loading="isSubmitting"
            :disabled="success"
            @click="handleSubmit"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>