<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n }   from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useToast }  from 'primevue/usetoast';
import useSalesStore from '../../application/sales.store.js';
import useIamStore   from '../../../iam/application/iam.store.js';
import { Customer }  from '../../domain/model/customer.entity.js';

const { t }      = useI18n();
const route      = useRoute();
const router     = useRouter();
const toast      = useToast();
const salesStore = useSalesStore();
const iamStore   = useIamStore();

// ─── State ─────────────────────────────────────────────────────────────────

const form = ref({
  fullName:       '',
  documentNumber: '',
  phoneNumber:    ''
});

/** @type {import('vue').Ref<string[]>} Field-level validation errors */
const formErrors = ref({});

const isEdit = computed(() => !!route.params.id);

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Validates the form fields and populates formErrors.
 * Returns true when the form is valid.
 *
 * Business rules:
 * - fullName is required and must be at least 2 characters.
 * - documentNumber, if provided, must be 8 digits (DNI) or 11 digits (RUC).
 * - phoneNumber is optional; if provided must be 9 digits.
 *
 * @returns {boolean}
 */
function validateForm() {
  formErrors.value = {};
  if (!form.value.fullName || form.value.fullName.trim().length < 2) {
    formErrors.value.fullName = t('customer-form.error-name');
  }
  if (form.value.documentNumber) {
    const length = form.value.documentNumber.replace(/\D/g, '').length;
    if (length !== 8 && length !== 11) {
      formErrors.value.documentNumber = t('customer-form.error-document');
    }
  }
  if (form.value.phoneNumber) {
    const cleaned = form.value.phoneNumber.replace(/\D/g, '');
    if (cleaned.length !== 9) {
      formErrors.value.phoneNumber = t('customer-form.error-phone');
    }
  }
  return Object.keys(formErrors.value).length === 0;
}

// ─── Actions ───────────────────────────────────────────────────────────────

/**
 * Finds a Customer entity by the route param id.
 * @returns {import('../../domain/model/customer.entity.js').Customer|undefined}
 */
function getCustomerById() {
  return salesStore.getCustomerById(route.params.id);
}

/**
 * Persists the customer (create or update) after successful validation.
 */
function saveCustomer() {
  if (!validateForm()) return;

  const businessId = iamStore.currentUser?.businessId;
  const customer   = new Customer({
    id:             isEdit.value ? parseInt(route.params.id) : null,
    businessId:     businessId,
    fullName:       form.value.fullName.trim(),
    documentNumber: form.value.documentNumber.trim(),
    phoneNumber:    form.value.phoneNumber.trim(),
    registeredAt:   isEdit.value
        ? getCustomerById()?.registeredAt
        : new Date().toISOString()
  });

  if (isEdit.value) {
    salesStore.updateCustomer(customer);
  } else {
    salesStore.addCustomer(customer);
  }

  toast.add({
    severity: 'success',
    summary:  t('customer-form.success-title'),
    detail:   isEdit.value
        ? t('customer-form.success-update')
        : t('customer-form.success-create'),
    life: 3000
  });
  navigateBack();
}

/**
 * Navigates back to the customer list.
 */
function navigateBack() {
  router.push({ name: 'customer-list' });
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(() => {
  const businessId = iamStore.currentUser?.businessId;
  if (!salesStore.customersLoaded) salesStore.fetchCustomers(businessId);

  if (isEdit.value) {
    const existing = getCustomerById();
    if (existing) {
      form.value.fullName       = existing.fullName;
      form.value.documentNumber = existing.documentNumber;
      form.value.phoneNumber    = existing.phoneNumber;
    } else {
      navigateBack();
    }
  }
});
</script>

<template>
  <div class="p-3 md:p-5">
    <!-- Header -->
    <div class="flex align-items-center gap-3 mb-4">
      <pv-button
          icon="pi pi-arrow-left"
          class="p-button-text p-button-plain"
          @click="navigateBack"
      />
      <div>
        <h2 class="m-0">
          {{ isEdit ? t('customer-form.edit-title') : t('customer-form.new-title') }}
        </h2>
        <p class="m-0 text-color-secondary text-sm">
          {{ isEdit ? t('customer-form.edit-subtitle') : t('customer-form.new-subtitle') }}
        </p>
      </div>
    </div>

    <pv-card class="md:w-30rem">
      <template #content>
        <div class="flex flex-column gap-4">

          <!-- Full name -->
          <div class="field m-0">
            <label class="block mb-1 font-semibold">
              {{ t('customer-form.full-name') }} *
            </label>
            <pv-input-text
                v-model="form.fullName"
                :placeholder="t('customer-form.full-name-placeholder')"
                :class="['w-full', { 'p-invalid': formErrors.fullName }]"
            />
            <small v-if="formErrors.fullName" class="p-error">
              {{ formErrors.fullName }}
            </small>
          </div>

          <!-- Document number -->
          <div class="field m-0">
            <label class="block mb-1 font-semibold">
              {{ t('customer-form.document-number') }}
            </label>
            <pv-input-text
                v-model="form.documentNumber"
                :placeholder="t('customer-form.document-placeholder')"
                :class="['w-full', { 'p-invalid': formErrors.documentNumber }]"
            />
            <small v-if="formErrors.documentNumber" class="p-error">
              {{ formErrors.documentNumber }}
            </small>
          </div>

          <!-- Phone number -->
          <div class="field m-0">
            <label class="block mb-1 font-semibold">
              {{ t('customer-form.phone-number') }}
            </label>
            <pv-input-text
                v-model="form.phoneNumber"
                :placeholder="t('customer-form.phone-placeholder')"
                :class="['w-full', { 'p-invalid': formErrors.phoneNumber }]"
            />
            <small v-if="formErrors.phoneNumber" class="p-error">
              {{ formErrors.phoneNumber }}
            </small>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 justify-content-end">
            <pv-button
                :label="t('customer-form.cancel')"
                class="p-button-outlined"
                @click="navigateBack"
            />
            <pv-button
                :label="t('customer-form.save')"
                icon="pi pi-save"
                @click="saveCustomer"
            />
          </div>

        </div>
      </template>
    </pv-card>
  </div>
</template>

<style scoped>
</style>