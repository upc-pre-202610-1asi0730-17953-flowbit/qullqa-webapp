<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter }      from 'vue-router';
import { useI18n }                  from 'vue-i18n';
import { useConfirm }               from 'primevue';
import useAlertsStore               from '../../application/alerts.store.js';
import useIamStore                  from '../../../iam/application/iam.store.js';
import { AlertType, AlertStatus, AlertSeverity } from '../../domain/model/alert.entity.js';

const { t }      = useI18n();
const route      = useRoute();
const router     = useRouter();
const confirm    = useConfirm();
const alertsStore = useAlertsStore();
const iamStore    = useIamStore();

const { fetchAlerts, resolveAlert } = alertsStore;

/** The alert entity loaded for this detail view. */
const alert = ref(null);

/**
 * Loads the alert by ID from the store.
 * If the store has not yet fetched alerts for this session, triggers a fetch first.
 * Business rule: if the alert ID does not exist, navigate back to the list.
 */
onMounted(async () => {
  const businessId = iamStore.currentUser?.businessId ?? null;
  if (!alertsStore.alertsLoaded && businessId) {
    fetchAlerts(businessId);
    // Wait a tick for the store to populate
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  const found = alertsStore.getAlertById(route.params.id);
  if (!found) {
    router.push({ name: 'alerts' });
    return;
  }
  alert.value = found;
});

/**
 * Returns the PrimeVue severity prop for a given alert severity.
 * Business rule: HIGH → danger, MEDIUM → warn, LOW → info.
 * @param {string} severity
 * @returns {string}
 */
const badgeSeverity = computed(() => {
  if (!alert.value) return 'info';
  if (alert.value.severity === AlertSeverity.HIGH)   return 'danger';
  if (alert.value.severity === AlertSeverity.MEDIUM) return 'warn';
  return 'info';
});

/**
 * Returns the display icon class for the current alert type.
 * @returns {string}
 */
const alertIcon = computed(() => {
  if (!alert.value) return 'pi pi-bell';
  return alert.value.type === AlertType.EXPIRATION
      ? 'pi pi-calendar'
      : 'pi pi-exclamation-triangle';
});

/**
 * Returns the background color for the alert icon container based on type.
 * @returns {string}
 */
const iconBackground = computed(() => {
  if (!alert.value) return '#F3F4F6';
  return alert.value.type === AlertType.EXPIRATION ? '#FEE2E2' : '#FFEDD5';
});

/**
 * Returns the icon color based on alert type.
 * @returns {string}
 */
const iconColor = computed(() => {
  if (!alert.value) return '#6B7280';
  return alert.value.type === AlertType.EXPIRATION ? '#EF4444' : '#F97316';
});

/**
 * Returns the human-readable status label key.
 * @returns {string}
 */
const statusLabelKey = computed(() => {
  if (!alert.value) return 'alerts.status-active';
  if (alert.value.status === AlertStatus.RESOLVED) return 'alerts.status-resolved';
  if (alert.value.status === AlertStatus.SENT)     return 'alerts.status-sent';
  return 'alerts.status-active';
});

/**
 * Returns the PrimeVue severity for the status tag.
 * @returns {string}
 */
const statusSeverity = computed(() => {
  if (!alert.value) return 'info';
  if (alert.value.status === AlertStatus.RESOLVED) return 'success';
  if (alert.value.status === AlertStatus.SENT)     return 'warn';
  return 'danger';
});

/**
 * Formats an ISO date string for display.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('es-PE', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Prompts the user to confirm resolution of the current alert.
 * Business rule: only ACTIVE or SENT alerts may be resolved.
 */
function confirmResolve() {
  if (!alert.value || alert.value.status === AlertStatus.RESOLVED) return;
  confirm.require({
    message: t('alerts.confirm-resolve', { message: alert.value.message }),
    header:  t('alerts.resolve-header'),
    icon:    'pi pi-check-circle',
    accept:  () => {
      resolveAlert(alert.value);
      alert.value = { ...alert.value, status: AlertStatus.RESOLVED };
    }
  });
}

/**
 * Navigates back to the alerts list.
 */
function navigateBack() {
  router.push({ name: 'alerts' });
}

/**
 * Navigates to the product detail view for the product linked to this alert.
 */
function navigateToProduct() {
  if (alert.value?.productId) {
    router.push({ name: 'product-detail', params: { id: alert.value.productId } });
  }
}
</script>

<template>
  <div class="p-3 md:p-5">
    <!-- Back button -->
    <pv-button
        icon="pi pi-arrow-left"
        :label="t('alerts.back')"
        text
        class="mb-4"
        @click="navigateBack"
    />

    <!-- Loading state -->
    <div v-if="!alert" class="flex justify-content-center align-items-center py-6">
      <i class="pi pi-spin pi-spinner text-4xl text-primary"></i>
    </div>

    <div v-else>
      <!-- Alert detail card -->
      <pv-card class="mb-4">
        <template #content>
          <div class="flex flex-column gap-4">

            <!-- Header row -->
            <div class="flex flex-column md:flex-row md:align-items-center gap-3">
              <div
                  class="border-round p-4 flex-shrink-0 align-self-start"
                  :style="{ backgroundColor: iconBackground }"
              >
                <i :class="alertIcon" class="text-3xl" :style="{ color: iconColor }"></i>
              </div>
              <div class="flex-1">
                <div class="flex flex-wrap gap-2 mb-2">
                  <pv-tag :severity="badgeSeverity" :value="t('alerts.severity-' + alert.severity.toLowerCase())" />
                  <pv-tag :severity="statusSeverity" :value="t(statusLabelKey)" />
                </div>
                <p class="text-lg font-medium m-0">{{ alert.message }}</p>
              </div>
            </div>

            <!-- Detail fields -->
            <div class="grid">
              <div class="col-12 md:col-6">
                <div class="flex flex-column gap-1">
                  <span class="text-color-secondary text-sm font-medium">{{ t('alerts.field-type') }}</span>
                  <span class="font-medium">
                                        {{ alert.type === 'LOW_STOCK' ? t('alerts.type-low-stock') : t('alerts.type-expiration') }}
                                    </span>
                </div>
              </div>
              <div class="col-12 md:col-6">
                <div class="flex flex-column gap-1">
                  <span class="text-color-secondary text-sm font-medium">{{ t('alerts.field-date') }}</span>
                  <span class="font-medium">{{ formatDate(alert.date) }}</span>
                </div>
              </div>
              <div class="col-12 md:col-6">
                <div class="flex flex-column gap-1">
                  <span class="text-color-secondary text-sm font-medium">{{ t('alerts.field-severity') }}</span>
                  <pv-tag :severity="badgeSeverity" :value="t('alerts.severity-' + alert.severity.toLowerCase())" />
                </div>
              </div>
              <div class="col-12 md:col-6">
                <div class="flex flex-column gap-1">
                  <span class="text-color-secondary text-sm font-medium">{{ t('alerts.field-status') }}</span>
                  <pv-tag :severity="statusSeverity" :value="t(statusLabelKey)" />
                </div>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex flex-column md:flex-row gap-2">
              <pv-button
                  v-if="alert.status !== 'RESOLVED'"
                  icon="pi pi-check"
                  :label="t('alerts.btn-resolve')"
                  severity="success"
                  @click="confirmResolve"
              />
              <pv-button
                  v-if="alert.productId"
                  icon="pi pi-box"
                  :label="t('alerts.btn-view-product')"
                  outlined
                  @click="navigateToProduct"
              />
            </div>
          </div>
        </template>
      </pv-card>
    </div>
  </div>
</template>

<style scoped>
</style>