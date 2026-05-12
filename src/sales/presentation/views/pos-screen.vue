<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n }       from 'vue-i18n';
import { useRouter }     from 'vue-router';
import { useToast }      from 'primevue/usetoast';
import useSalesStore     from '../../application/sales.store.js';
import useProductStore   from '../../../../product/application/product.store.js';
import useIamStore       from '../../../../iam/application/iam.store.js';
import { PaymentMethod } from '../../domain/model/payment-method.js';

const { t }      = useI18n();
const router     = useRouter();
const toast      = useToast();
const salesStore = useSalesStore();
const productStore = useProductStore();
const iamStore   = useIamStore();

// ─── State ─────────────────────────────────────────────────────────────────

/** @type {import('vue').Ref<number|null>} Selected product id from dropdown */
const selectedProductId = ref(null);

/** @type {import('vue').Ref<number>} Quantity to add for the selected product */
const selectedQuantity  = ref(1);

/** @type {import('vue').Ref<string|null>} Chosen payment method */
const chosenPaymentMethod = ref(null);

/** @type {import('vue').Ref<number|null>} Optional customer id */
const chosenCustomerId = ref(null);

/** @type {import('vue').Ref<string>} Optional sale description */
const saleDescription = ref('');

/** @type {import('vue').Ref<boolean>} Whether the confirm dialog is showing */
const showConfirmDialog = ref(false);

/** @type {import('vue').Ref<boolean>} Whether a confirm action is in progress */
const isConfirming = ref(false);

/** @type {import('vue').Ref<string>} Current validation error message key */
const errorKey = ref('');

// ─── Computed ──────────────────────────────────────────────────────────────

/** The active in-progress sale from the store */
const currentSale = computed(() => salesStore.currentSale);

/**
 * Products available for selection, enriched with available stock.
 * Only ACTIVE products with stock > 0 are shown.
 */
const availableProducts = computed(() => {
  return productStore.products
      .filter(product => product.isActive)
      .map(product => {
        const inventoryItem = productStore.inventory.find(item => item.productId === product.id);
        const availableStock = inventoryItem ? inventoryItem.currentStock : 0;
        return {
          id:             product.id,
          name:           product.name,
          basePrice:      product.basePrice,
          availableStock: availableStock,
          label:          `${product.name} — S/ ${product.basePrice.toFixed(2)} (${t('pos.stock-label')}: ${availableStock})`
        };
      })
      .filter(product => product.availableStock > 0);
});

/** Customers formatted as dropdown options */
const customerOptions = computed(() => {
  const anonymous = { id: null, label: t('pos.anonymous-customer') };
  const listed = salesStore.customers.map(customer => ({
    id:    customer.id,
    label: customer.displayLabel
  }));
  return [anonymous, ...listed];
});

/** Payment method options as dropdown entries */
const paymentMethodOptions = computed(() => [
  { value: PaymentMethod.CASH, label: t('pos.payment-cash') },
  { value: PaymentMethod.CARD, label: t('pos.payment-card') },
  { value: PaymentMethod.YAPE, label: t('pos.payment-yape') },
  { value: PaymentMethod.PLIN, label: t('pos.payment-plin') }
]);

/** The product entity currently selected in the dropdown (for max qty validation) */
const selectedProduct = computed(() => {
  if (!selectedProductId.value) return null;
  return availableProducts.value.find(product => product.id === selectedProductId.value) || null;
});

/** Cart is the list of details in the current sale */
const cartDetails = computed(() => currentSale.value ? currentSale.value.details : []);

/** Cart is empty when there are no line items */
const isCartEmpty = computed(() => cartDetails.value.length === 0);

/** Subtotal from the domain entity */
const subtotal = computed(() => currentSale.value ? currentSale.value.subtotal : 0);

/** IGV (18%) from the domain entity */
const igvAmount = computed(() => currentSale.value ? currentSale.value.igvAmount : 0);

/** Grand total including IGV from the domain entity */
const grandTotal = computed(() => currentSale.value ? currentSale.value.grandTotal : 0);

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Finds the product name for a given productId.
 * @param {number} productId
 * @returns {string}
 */
function getProductName(productId) {
  const product = productStore.products.find(p => p.id === productId);
  return product ? product.name : t('pos.unknown-product');
}

/**
 * Finds the product unit price for a given productId.
 * @param {number} productId
 * @returns {number}
 */
function getProductPrice(productId) {
  const product = availableProducts.value.find(p => p.id === productId);
  return product ? product.basePrice : 0;
}

/**
 * Returns the available stock for a given productId.
 * @param {number} productId
 * @returns {number}
 */
function getAvailableStock(productId) {
  const product = availableProducts.value.find(p => p.id === productId);
  return product ? product.availableStock : 0;
}

// ─── Actions ───────────────────────────────────────────────────────────────

/**
 * Adds the selected product with the selected quantity to the cart.
 * Validates that a product is selected and quantity is at least 1.
 */
function addProductToCart() {
  errorKey.value = '';
  if (!selectedProductId.value) {
    errorKey.value = 'pos.error-no-product-selected';
    return;
  }
  const product = availableProducts.value.find(p => p.id === selectedProductId.value);
  if (!product) return;

  const result = salesStore.addDetailToCurrentSale({
    productId:      product.id,
    quantity:       selectedQuantity.value,
    unitPrice:      product.basePrice,
    availableStock: product.availableStock,
    discount:       0
  });

  if (!result.success) {
    errorKey.value = result.errorKey;
    return;
  }
  // Reset selection
  selectedProductId.value = null;
  selectedQuantity.value  = 1;
}

/**
 * Updates the quantity of an existing cart line item.
 * @param {number} productId
 * @param {number} newQuantity
 */
function updateCartItemQuantity(productId, newQuantity) {
  errorKey.value = '';
  if (newQuantity < 1) {
    removeCartItem(productId);
    return;
  }
  const availableStock = getAvailableStock(productId);
  const result = salesStore.updateDetailQuantity({ productId, newQuantity, availableStock });
  if (!result.success) {
    errorKey.value = result.errorKey;
  }
}

/**
 * Removes a line item from the cart by productId.
 * @param {number} productId
 */
function removeCartItem(productId) {
  salesStore.removeDetailFromCurrentSale(productId);
  errorKey.value = '';
}

/**
 * Opens the payment confirmation dialog after validating the cart.
 */
function openConfirmDialog() {
  errorKey.value = '';
  if (isCartEmpty.value) {
    errorKey.value = 'pos.error-empty-cart';
    return;
  }
  showConfirmDialog.value = true;
}

/**
 * Confirms and persists the sale after selecting a payment method.
 * Disables the button during the async operation to prevent double submission.
 */
async function submitSale() {
  errorKey.value = '';
  if (!chosenPaymentMethod.value) {
    errorKey.value = 'pos.error-no-payment-method';
    return;
  }
  isConfirming.value = true;
  const result = await salesStore.confirmSale({
    paymentMethod: chosenPaymentMethod.value,
    customerId:    chosenCustomerId.value,
    description:   saleDescription.value
  });
  isConfirming.value = false;

  if (result.success) {
    showConfirmDialog.value   = false;
    chosenPaymentMethod.value = null;
    toast.add({
      severity: 'success',
      summary:  t('pos.success-title'),
      detail:   t('pos.success-message'),
      life:     3000
    });
    router.push({ name: 'sales-list' });
  } else {
    errorKey.value = result.errorKey;
  }
}

/**
 * Discards the current POS session and navigates back to the sale list.
 */
function discardSale() {
  salesStore.discardCurrentSale();
  router.push({ name: 'sales-list' });
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId;
  if (!productStore.productsLoaded)  productStore.fetchProducts(businessId);
  if (!productStore.inventoryLoaded) productStore.fetchInventory(businessId);
  if (!salesStore.customersLoaded)   salesStore.fetchCustomers(businessId);
  if (!salesStore.currentSale)       salesStore.startNewSale(businessId);
});
</script>

<template>
  <div class="p-3 md:p-5">
    <!-- Header -->
    <div class="flex flex-column md:flex-row align-items-start md:align-items-center gap-3 mb-4">
      <pv-button
          icon="pi pi-arrow-left"
          class="p-button-text p-button-plain"
          :label="t('pos.back')"
          @click="discardSale"
      />
      <div>
        <h2 class="m-0">{{ t('pos.title') }}</h2>
        <p class="m-0 text-color-secondary text-sm">{{ t('pos.subtitle') }}</p>
      </div>
    </div>

    <!-- Validation error banner -->
    <div v-if="errorKey" class="mb-3">
      <pv-card class="border-1 border-red-400 surface-overlay">
        <template #content>
          <div class="flex align-items-center gap-2 text-red-600">
            <i class="pi pi-exclamation-circle"/>
            <span>{{ t(errorKey) }}</span>
          </div>
        </template>
      </pv-card>
    </div>

    <div class="grid">
      <!-- Left column: product selector + cart -->
      <div class="col-12 lg:col-8">

        <!-- Product selector card -->
        <pv-card class="mb-3">
          <template #title>{{ t('pos.section-add-product') }}</template>
          <template #content>
            <div class="flex flex-column md:flex-row gap-3">
              <pv-select
                  v-model="selectedProductId"
                  :options="availableProducts"
                  option-label="label"
                  option-value="id"
                  :placeholder="t('pos.product-placeholder')"
                  class="flex-1"
                  filter
              />
              <pv-input-number
                  v-model="selectedQuantity"
                  :min="1"
                  :max="selectedProduct ? selectedProduct.availableStock : 999"
                  show-buttons
                  button-layout="horizontal"
                  :step="1"
                  class="w-8rem"
                  :disabled="!selectedProductId"
              />
              <pv-button
                  :label="t('pos.add-to-cart')"
                  icon="pi pi-plus"
                  @click="addProductToCart"
              />
            </div>
          </template>
        </pv-card>

        <!-- Cart card -->
        <pv-card>
          <template #title>
            {{ t('pos.cart-title') }} ({{ cartDetails.length }})
          </template>
          <template #content>
            <div v-if="isCartEmpty" class="text-center py-6">
              <i class="pi pi-shopping-cart text-5xl text-color-secondary"/>
              <p class="text-color-secondary mt-3">{{ t('pos.empty-cart') }}</p>
            </div>

            <div v-else class="flex flex-column gap-3">
              <div
                  v-for="detail in cartDetails"
                  :key="detail.productId"
                  class="flex flex-column md:flex-row align-items-start md:align-items-center
                                       gap-3 p-3 border-1 border-round surface-border"
              >
                <!-- Product info -->
                <div class="flex-1 min-w-0">
                  <p class="font-semibold m-0">{{ getProductName(detail.productId) }}</p>
                  <p class="text-sm text-color-secondary m-0">
                    S/ {{ detail.unitPrice.toFixed(2) }} {{ t('pos.per-unit') }}
                  </p>
                  <pv-tag
                      :value="`${t('pos.stock-label')}: ${getAvailableStock(detail.productId)}`"
                      :severity="getAvailableStock(detail.productId) < 10 ? 'warning' : 'info'"
                      class="mt-1"
                  />
                </div>

                <!-- Quantity input -->
                <pv-input-number
                    :model-value="detail.quantity"
                    :min="1"
                    :max="getAvailableStock(detail.productId)"
                    show-buttons
                    button-layout="horizontal"
                    :step="1"
                    class="w-8rem"
                    @update:model-value="updateCartItemQuantity(detail.productId, $event)"
                />

                <!-- Line total -->
                <p class="font-semibold m-0 min-w-max">
                  S/ {{ detail.lineTotal.toFixed(2) }}
                </p>

                <!-- Remove button -->
                <pv-button
                    icon="pi pi-trash"
                    class="p-button-text p-button-danger"
                    @click="removeCartItem(detail.productId)"
                />
              </div>
            </div>
          </template>
        </pv-card>
      </div>

      <!-- Right column: sale summary + actions -->
      <div class="col-12 lg:col-4">

        <!-- Summary card -->
        <pv-card class="mb-3">
          <template #title>{{ t('pos.summary-title') }}</template>
          <template #content>
            <div class="flex flex-column gap-3">
              <div class="flex justify-content-between border-bottom-1 surface-border pb-2">
                <span class="text-color-secondary">{{ t('pos.subtotal') }}</span>
                <span>S/ {{ subtotal.toFixed(2) }}</span>
              </div>
              <div class="flex justify-content-between border-bottom-1 surface-border pb-2">
                <span class="text-color-secondary">{{ t('pos.igv') }}</span>
                <span>S/ {{ igvAmount.toFixed(2) }}</span>
              </div>
              <div class="flex justify-content-between pt-1">
                <span class="font-bold text-lg">{{ t('pos.grand-total') }}</span>
                <span class="font-bold text-lg text-primary">S/ {{ grandTotal.toFixed(2) }}</span>
              </div>
            </div>
          </template>
        </pv-card>

        <!-- Customer selector (optional) -->
        <pv-card class="mb-3">
          <template #title>{{ t('pos.customer-title') }}</template>
          <template #content>
            <pv-select
                v-model="chosenCustomerId"
                :options="customerOptions"
                option-label="label"
                option-value="id"
                :placeholder="t('pos.customer-placeholder')"
                class="w-full"
                filter
            />
          </template>
        </pv-card>

        <!-- Description (optional) -->
        <pv-card class="mb-3">
          <template #title>{{ t('pos.description-title') }}</template>
          <template #content>
            <pv-textarea
                v-model="saleDescription"
                :placeholder="t('pos.description-placeholder')"
                class="w-full"
                rows="2"
                auto-resize
            />
          </template>
        </pv-card>

        <!-- Action buttons -->
        <div class="flex flex-column gap-2">
          <pv-button
              :label="t('pos.confirm-sale')"
              icon="pi pi-check-circle"
              class="w-full"
              :disabled="isCartEmpty"
              @click="openConfirmDialog"
          />
          <pv-button
              :label="t('pos.discard-sale')"
              icon="pi pi-times"
              class="w-full p-button-outlined p-button-danger"
              @click="discardSale"
          />
        </div>
      </div>
    </div>

    <!-- Payment method dialog -->
    <pv-dialog
        v-model:visible="showConfirmDialog"
        :header="t('pos.payment-dialog-title')"
        :modal="true"
        :closable="!isConfirming"
        class="w-full md:w-30rem"
    >
      <div class="flex flex-column gap-4 py-2">
        <!-- Sale totals recap -->
        <div class="surface-section border-round p-3">
          <div class="flex justify-content-between mb-2">
            <span class="text-color-secondary">{{ t('pos.subtotal') }}</span>
            <span>S/ {{ subtotal.toFixed(2) }}</span>
          </div>
          <div class="flex justify-content-between mb-2">
            <span class="text-color-secondary">{{ t('pos.igv') }}</span>
            <span>S/ {{ igvAmount.toFixed(2) }}</span>
          </div>
          <div class="flex justify-content-between font-bold text-lg">
            <span>{{ t('pos.grand-total') }}</span>
            <span class="text-primary">S/ {{ grandTotal.toFixed(2) }}</span>
          </div>
        </div>

        <!-- Payment method selector -->
        <div>
          <label class="block mb-2 font-semibold">{{ t('pos.payment-method-label') }}</label>
          <div class="flex flex-wrap gap-2">
            <pv-button
                v-for="option in paymentMethodOptions"
                :key="option.value"
                :label="option.label"
                :class="chosenPaymentMethod === option.value
                                ? 'p-button-primary'
                                : 'p-button-outlined'"
                @click="chosenPaymentMethod = option.value"
            />
          </div>
        </div>

        <!-- Dialog error -->
        <div v-if="errorKey" class="text-red-600 flex align-items-center gap-2">
          <i class="pi pi-exclamation-triangle"/>
          <span>{{ t(errorKey) }}</span>
        </div>
      </div>

      <template #footer>
        <pv-button
            :label="t('pos.cancel')"
            class="p-button-text"
            :disabled="isConfirming"
            @click="showConfirmDialog = false"
        />
        <pv-button
            :label="t('pos.confirm-payment')"
            icon="pi pi-check"
            :loading="isConfirming"
            @click="submitSale"
        />
      </template>
    </pv-dialog>
  </div>
</template>

<style scoped>
</style>