<script setup>
import { computed, onMounted, toRefs } from 'vue';
import { useI18n }    from 'vue-i18n';
import { useRouter }  from 'vue-router';
import { useConfirm } from 'primevue';
import useSalesStore  from '../../application/sales.store.js';
import useIamStore    from '../../../iam/application/iam.store.js';

const { t }      = useI18n();
const router     = useRouter();
const confirm    = useConfirm();
const salesStore = useSalesStore();
const iamStore   = useIamStore();

const { sales, salesLoaded, customers, errors } = toRefs(salesStore);
const { fetchSales, fetchCustomers, cancelSale } = salesStore;

// ─── Computed ──────────────────────────────────────────────────────────────

/**
 * Returns the full name of the customer associated with a sale.
 * @param {number|null} customerId
 * @returns {string}
 */
function getCustomerName(customerId) {
  if (!customerId) return t('pos.anonymous-customer');
  const customer = salesStore.getCustomerById(customerId);
  return customer ? customer.fullName : t('pos.unknown-customer');
}

/**
 * Maps a SaleStatus value to a PrimeVue severity string for the Tag component.
 * @param {string} status
 * @returns {string}
 */
function statusSeverity(status) {
  if (status === SaleStatus.PAID)      return 'success';
  if (status === SaleStatus.OPEN)      return 'warn';
  if (status === SaleStatus.CANCELLED) return 'danger';
  return 'info';
}

/**
 * Returns the i18n key for a given SaleStatus value.
 * @param {string} status
 * @returns {string}
 */
function statusLabel(status) {
  if (status === SaleStatus.PAID)      return 'sales.status-paid';
  if (status === SaleStatus.OPEN)      return 'sales.status-open';
  if (status === SaleStatus.CANCELLED) return 'sales.status-cancelled';
  return status;
}

/**
 * Formats a payment method value for display.
 * @param {string|null} paymentMethod
 * @returns {string}
 */
function formatPaymentMethod(paymentMethod) {
  if (!paymentMethod) return '—';
  return t(`pos.payment-${paymentMethod.toLowerCase()}`);
}

/**
 * Formats an ISO date string as a short locale-aware date-time string.
 * @param {string} dateString
 * @returns {string}
 */
function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString();
}

// ─── Actions ───────────────────────────────────────────────────────────────

/**
 * Navigates to the POS screen to register a new sale.
 */
function navigateToNew() {
  router.push({ name: 'pos-screen' });
}

/**
 * Confirms and executes the cancellation of a sale.
 * @param {import('../../domain/model/sale.entity.js').Sale} sale
 */
function confirmCancel(sale) {
  confirm.require({
    message: t('sales.confirm-cancel', { id: sale.id }),
    header:  t('sales.cancel-header'),
    icon:    'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept:  () => cancelSale(sale)
  });
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId;
  if (!salesStore.salesLoaded)     fetchSales(businessId);
  if (!salesStore.customersLoaded) fetchCustomers(businessId);
});
</script>

<template>
  <div class="p-3 md:p-5">
    <!-- Header -->
    <div class="flex flex-column md:flex-row align-items-start md:align-items-center
                    justify-content-between gap-3 mb-4">
      <div>
        <h2 class="m-0">{{ t('sales.title') }}</h2>
        <p class="m-0 text-color-secondary text-sm">{{ t('sales.subtitle') }}</p>
      </div>
      <pv-button
          :label="t('sales.new-sale')"
          icon="pi pi-plus"
          @click="navigateToNew"
      />
    </div>

    <!-- Summary cards -->
    <div class="grid mb-4">
      <div class="col-12 md:col-4">
        <pv-card class="text-center">
          <template #content>
            <p class="text-color-secondary m-0">{{ t('sales.summary-total') }}</p>
            <h3 class="m-0 text-primary">{{ salesStore.salesCount }}</h3>
          </template>
        </pv-card>
      </div>
      <div class="col-12 md:col-4">
        <pv-card class="text-center">
          <template #content>
            <p class="text-color-secondary m-0">{{ t('sales.summary-paid') }}</p>
            <h3 class="m-0 text-green-600">{{ salesStore.paidSalesCount }}</h3>
          </template>
        </pv-card>
      </div>
      <div class="col-12 md:col-4">
        <pv-card class="text-center">
          <template #content>
            <p class="text-color-secondary m-0">{{ t('sales.summary-revenue') }}</p>
            <h3 class="m-0 text-primary">S/ {{ salesStore.totalRevenue.toFixed(2) }}</h3>
          </template>
        </pv-card>
      </div>
    </div>

    <!-- Sales table -->
    <pv-card>
      <template #content>
        <pv-data-table
            :value="sales"
            :loading="!salesLoaded"
            striped-rows
            paginator
            :rows="10"
            :rows-per-page-options="[5, 10, 20]"
            responsive-layout="scroll"
            table-style="min-width: 40rem"
        >
          <pv-column field="id"   :header="t('sales.col-id')"   sortable style="width: 5rem"/>
          <pv-column field="date" :header="t('sales.col-date')" sortable>
            <template #body="slotProps">
              {{ formatDate(slotProps.data.date) }}
            </template>
          </pv-column>
          <pv-column :header="t('sales.col-customer')">
            <template #body="slotProps">
              {{ getCustomerName(slotProps.data.customerId) }}
            </template>
          </pv-column>
          <pv-column :header="t('sales.col-status')" sortable field="status">
            <template #body="slotProps">
              <pv-tag
                  :value="t(statusLabel(slotProps.data.status))"
                  :severity="statusSeverity(slotProps.data.status)"
              />
            </template>
          </pv-column>
          <pv-column :header="t('sales.col-payment')">
            <template #body="slotProps">
              {{ formatPaymentMethod(slotProps.data.paymentMethod) }}
            </template>
          </pv-column>
          <pv-column field="totalAmount" :header="t('sales.col-total')" sortable>
            <template #body="slotProps">
              S/ {{ Number(slotProps.data.totalAmount).toFixed(2) }}
            </template>
          </pv-column>
          <pv-column :header="t('sales.col-actions')">
            <template #body="slotProps">
              <pv-button
                  v-if="slotProps.data.status !== 'CANCELLED'"
                  icon="pi pi-ban"
                  class="p-button-text p-button-danger"
                  v-tooltip.top="t('sales.cancel-action')"
                  @click="confirmCancel(slotProps.data)"
              />
              <span v-else class="text-color-secondary text-sm">—</span>
            </template>
          </pv-column>
        </pv-data-table>

        <!-- Errors -->
        <div v-if="errors.length" class="text-red-600 mt-3 flex align-items-center gap-2">
          <i class="pi pi-exclamation-circle"/>
          <span>{{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}</span>
        </div>
      </template>
    </pv-card>
  </div>
</template>

<style scoped>
</style>