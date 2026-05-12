<script setup>
import { ref }           from 'vue';
import { useRouter }     from 'vue-router';
import { useI18n }       from 'vue-i18n';
import useDashboardStore from '../../application/dashboard.store.js';
import useIamStore       from '../../../iam/application/iam.store.js';
import { ReportType }    from '../../domain/model/report.entity.js';

const { t }          = useI18n();
const router         = useRouter();
const dashboardStore = useDashboardStore();
const iamStore       = useIamStore();

const { errors, generateReport } = dashboardStore;

/**
 * Local validation error message displayed below the form.
 * @type {import('vue').Ref<string>}
 */
const validationError = ref('');

/**
 * Reactive form state bound to the report generation inputs.
 * businessId is read from the IAM store so it is never hardcoded.
 */
const form = ref({
  type:       ReportType.SALES,
  startDate:  '',
  endDate:    '',
  category:   ''
});

/**
 * Available report types mapped to their i18n keys for the dropdown.
 * @type {Array<{label: string, value: string}>}
 */
const reportTypeOptions = [
  { label: t('reports.type-inventory'),     value: ReportType.INVENTORY     },
  { label: t('reports.type-sales'),         value: ReportType.SALES         },
  { label: t('reports.type-low-stock'),     value: ReportType.LOW_STOCK     },
  { label: t('reports.type-replenishment'), value: ReportType.REPLENISHMENT }
];

/**
 * Validates the form inputs, delegates report generation to the store,
 * and navigates to the result view on success.
 *
 * Business rules enforced here (presentation guard, mirrors store rules):
 * - Both startDate and endDate are required.
 * - startDate must not be after endDate.
 */
function applyFilters() {
  validationError.value = '';

  if (!form.value.startDate || !form.value.endDate) {
    validationError.value = t('reports.error-empty-dates');
    return;
  }

  if (new Date(form.value.startDate) > new Date(form.value.endDate)) {
    validationError.value = t('reports.error-date-range');
    return;
  }

  const businessId = iamStore.currentUser?.businessId ?? null;

  generateReport({
    businessId: businessId,
    type:       form.value.type,
    filters: {
      startDate: form.value.startDate,
      endDate:   form.value.endDate,
      category:  form.value.category
    }
  });

  router.push({ name: 'dashboard-report-result' });
}

/**
 * Navigates back to the main dashboard view.
 */
function navigateBack() {
  router.push({ name: 'dashboard' });
}
</script>

<template>
  <div class="p-4" style="max-width: 600px;">
    <div class="flex align-items-center gap-3 mb-4">
      <pv-button icon="pi pi-arrow-left" text rounded @click="navigateBack"/>
      <div>
        <h1 class="m-0" style="color: #0B3558;">{{ t('reports.title') }}</h1>
        <p class="m-0 mt-1" style="color: #64748B;">{{ t('reports.subtitle') }}</p>
      </div>
    </div>

    <pv-card class="shadow-1">
      <template #content>
        <!-- Report Type -->
        <div class="field mb-4">
          <label for="report-type" class="block mb-2" style="color: #0B3558; font-weight: 500;">
            {{ t('reports.type') }}
          </label>
          <pv-select
              id="report-type"
              v-model="form.type"
              :options="reportTypeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
          />
        </div>

        <!-- Start Date -->
        <div class="field mb-4">
          <label for="start-date" class="block mb-2" style="color: #0B3558; font-weight: 500;">
            {{ t('reports.start-date') }}
          </label>
          <pv-input-text
              id="start-date"
              v-model="form.startDate"
              type="date"
              class="w-full"
          />
        </div>

        <!-- End Date -->
        <div class="field mb-4">
          <label for="end-date" class="block mb-2" style="color: #0B3558; font-weight: 500;">
            {{ t('reports.end-date') }}
          </label>
          <pv-input-text
              id="end-date"
              v-model="form.endDate"
              type="date"
              class="w-full"
          />
        </div>

        <!-- Category (optional) -->
        <div class="field mb-4">
          <label for="category" class="block mb-2" style="color: #0B3558; font-weight: 500;">
            {{ t('reports.category') }}
          </label>
          <pv-input-text
              id="category"
              v-model="form.category"
              :placeholder="t('reports.category-placeholder')"
              class="w-full"
          />
        </div>

        <!-- Validation error -->
        <p v-if="validationError" class="mt-2 mb-3" style="color: #EF4444;">
          {{ validationError }}
        </p>

        <!-- Actions -->
        <div class="flex gap-2 justify-content-end">
          <pv-button
              :label="t('reports.cancel')"
              severity="secondary"
              outlined
              @click="navigateBack"
          />
          <pv-button
              :label="t('reports.apply')"
              icon="pi pi-check"
              @click="applyFilters"
          />
        </div>

        <!-- Store errors -->
        <div v-if="errors.length" class="mt-3">
          <p style="color: #EF4444;">{{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}</p>
        </div>
      </template>
    </pv-card>
  </div>
</template>

<style scoped>
</style>