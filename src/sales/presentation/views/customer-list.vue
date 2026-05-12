<script setup>
import { onMounted, toRefs } from 'vue';
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

const { customers, customersLoaded, errors } = toRefs(salesStore);
const { fetchCustomers, deleteCustomer }      = salesStore;

// ─── Actions ───────────────────────────────────────────────────────────────

/**
 * Navigates to the customer creation form.
 */
function navigateToNew() {
  router.push({ name: 'customer-new' });
}

/**
 * Navigates to the customer edit form.
 * @param {number} id - Customer identifier.
 */
function navigateToEdit(id) {
  router.push({ name: 'customer-edit', params: { id } });
}

/**
 * Shows a confirmation dialog and deletes the customer on acceptance.
 * @param {import('../../domain/model/customer.entity.js').Customer} customer
 */
function confirmDelete(customer) {
  confirm.require({
    message:     t('customers.confirm-delete', { name: customer.fullName }),
    header:      t('customers.delete-header'),
    icon:        'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept:      () => deleteCustomer(customer.id)
  });
}

/**
 * Formats an ISO date string as a short locale date.
 * @param {string} dateString
 * @returns {string}
 */
function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString();
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId;
  if (!salesStore.customersLoaded) fetchCustomers(businessId);
});
</script>

<template>
  <div class="p-3 md:p-5">
    <!-- Header -->
    <div class="flex flex-column md:flex-row align-items-start md:align-items-center
                    justify-content-between gap-3 mb-4">
      <div>
        <h2 class="m-0">{{ t('customers.title') }}</h2>
        <p class="m-0 text-color-secondary text-sm">{{ t('customers.subtitle') }}</p>
      </div>
      <pv-button
          :label="t('customers.new-customer')"
          icon="pi pi-plus"
          @click="navigateToNew"
      />
    </div>

    <!-- Customers table -->
    <pv-card>
      <template #content>
        <pv-data-table
            :value="customers"
            :loading="!customersLoaded"
            striped-rows
            paginator
            :rows="10"
            :rows-per-page-options="[5, 10, 20]"
            responsive-layout="scroll"
            table-style="min-width: 40rem"
        >
          <pv-column field="id"             :header="t('customers.col-id')"       sortable style="width: 5rem"/>
          <pv-column field="fullName"        :header="t('customers.col-name')"     sortable/>
          <pv-column field="documentNumber"  :header="t('customers.col-document')"/>
          <pv-column field="phoneNumber"     :header="t('customers.col-phone')"/>
          <pv-column :header="t('customers.col-registered')">
            <template #body="slotProps">
              {{ formatDate(slotProps.data.registeredAt) }}
            </template>
          </pv-column>
          <pv-column :header="t('customers.col-actions')">
            <template #body="slotProps">
              <pv-button
                  icon="pi pi-pencil"
                  class="p-button-text"
                  v-tooltip.top="t('customers.edit-action')"
                  @click="navigateToEdit(slotProps.data.id)"
              />
              <pv-button
                  icon="pi pi-trash"
                  class="p-button-text p-button-danger"
                  v-tooltip.top="t('customers.delete-action')"
                  @click="confirmDelete(slotProps.data)"
              />
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