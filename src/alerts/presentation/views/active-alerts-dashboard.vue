<script setup>
import { computed, onMounted, ref, toRefs } from 'vue';
import { useRouter }                         from 'vue-router';
import { useI18n }                           from 'vue-i18n';
import { useConfirm }                        from 'primevue';
import useAlertsStore                        from '../../application/alerts.store.js';
import useIamStore                           from '../../../iam/application/iam.store.js';
import { AlertType, AlertStatus }            from '../../domain/model/alert.entity.js';

const { t }       = useI18n();
const router      = useRouter();
const confirm     = useConfirm();
const alertsStore = useAlertsStore();
const iamStore    = useIamStore();

const {
    alerts,
    alertsLoaded,
    errors,
    lowStockActiveCount,
    expirationActiveCount
} = toRefs(alertsStore);

const { fetchAlerts, resolveAlert, filterByType, filterByStatus } = alertsStore;

/**
 * Currently selected tab identifier.
 * Possible values: 'LOW_STOCK' | 'EXPIRATION' | 'RESOLVED'
 * @type {import('vue').Ref<string>}
 */
const activeTab = ref('LOW_STOCK');

/**
 * Loads all alerts for the authenticated business on mount.
 * Falls back to fetching all alerts without businessId filter when
 * the current user session is not yet available.
 */
onMounted(() => {
    if (alertsLoaded.value) return;
    const businessId = iamStore.currentUser?.businessId ?? null;
    fetchAlerts(businessId);
});

/**
 * Alerts filtered and sorted for the LOW_STOCK tab.
 * Business rule: sorted HIGH → MEDIUM → LOW severity.
 * @type {import('vue').ComputedRef<import('../../domain/model/alert.entity.js').Alert[]>}
 */
const lowStockAlerts = computed(() => filterByType(AlertType.LOW_STOCK));

/**
 * Alerts filtered and sorted for the EXPIRATION tab.
 * Business rule: sorted ascending by date (most urgent first).
 * @type {import('vue').ComputedRef<import('../../domain/model/alert.entity.js').Alert[]>}
 */
const expirationAlerts = computed(() => filterByType(AlertType.EXPIRATION));

/**
 * Resolved alerts shown in the history tab.
 * @type {import('vue').ComputedRef<import('../../domain/model/alert.entity.js').Alert[]>}
 */
const resolvedAlerts = computed(() => filterByStatus(AlertStatus.RESOLVED));

/**
 * Returns the i18n key for a given severity string.
 * @param {string} severity
 * @returns {string}
 */
function severityLabelKey(severity) {
    if (severity === 'HIGH')   return 'alerts.severity-high';
    if (severity === 'MEDIUM') return 'alerts.severity-medium';
    return 'alerts.severity-low';
}

/**
 * Returns the PrimeVue Tag severity prop for a given alert severity.
 * Business rule: HIGH → danger, MEDIUM → warn, LOW → info.
 * @param {string} severity
 * @returns {string}
 */
function badgeSeverity(severity) {
    if (severity === 'HIGH')   return 'danger';
    if (severity === 'MEDIUM') return 'warn';
    return 'info';
}

/**
 * Returns the PrimeIcon class for a given alert type.
 * @param {string} type
 * @returns {string}
 */
function typeIcon(type) {
    return type === AlertType.EXPIRATION ? 'pi pi-calendar' : 'pi pi-exclamation-triangle';
}

/**
 * Navigates to the alert detail view.
 * @param {number} id
 */
function navigateToDetail(id) {
    router.push({ name: 'alert-detail', params: { id } });
}

/**
 * Prompts the user to confirm resolution of an alert.
 * Business rule: only ACTIVE or SENT alerts may be resolved.
 * @param {import('../../domain/model/alert.entity.js').Alert} alert
 */
function confirmResolve(alert) {
    confirm.require({
        message: t('alerts.confirm-resolve', { message: alert.message }),
        header:  t('alerts.resolve-header'),
        icon:    'pi pi-check-circle',
        accept:  () => { resolveAlert(alert); }
    });
}

/**
 * Formats an ISO date string for display in Peruvian locale.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
    if (!isoDate) return '';
    return new Date(isoDate).toLocaleDateString('es-PE', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}
</script>

<template>
    <div class="p-3 md:p-5">

        <!-- Page header -->
        <div class="mb-4">
            <h1 class="text-2xl font-bold m-0">{{ t('alerts.title') }}</h1>
            <p class="text-color-secondary mt-1 mb-0">{{ t('alerts.subtitle') }}</p>
        </div>

        <!-- Loading indicator -->
        <div v-if="!alertsLoaded" class="flex justify-content-center align-items-center py-6">
            <i class="pi pi-spin pi-spinner text-4xl text-primary"></i>
            <span class="ml-3 text-color-secondary">{{ t('alerts.loading') }}</span>
        </div>

        <div v-else>
            <!-- Summary cards -->
            <div class="grid mb-4">
                <div class="col-12 md:col-6 lg:col-4">
                    <pv-card class="h-full">
                        <template #content>
                            <div class="flex align-items-center justify-content-between">
                                <div>
                                    <p class="text-color-secondary text-sm mt-0 mb-1">{{ t('alerts.low-stock-count') }}</p>
                                    <p class="text-3xl font-bold m-0" style="color: #F97316;">
                                        {{ lowStockActiveCount }}
                                    </p>
                                </div>
                                <div class="border-round p-3" style="background-color: #FFEDD5;">
                                    <i class="pi pi-exclamation-triangle text-2xl" style="color: #F97316;"></i>
                                </div>
                            </div>
                        </template>
                    </pv-card>
                </div>

                <div class="col-12 md:col-6 lg:col-4">
                    <pv-card class="h-full">
                        <template #content>
                            <div class="flex align-items-center justify-content-between">
                                <div>
                                    <p class="text-color-secondary text-sm mt-0 mb-1">{{ t('alerts.expiration-count') }}</p>
                                    <p class="text-3xl font-bold m-0" style="color: #EF4444;">
                                        {{ expirationActiveCount }}
                                    </p>
                                </div>
                                <div class="border-round p-3" style="background-color: #FEE2E2;">
                                    <i class="pi pi-calendar text-2xl" style="color: #EF4444;"></i>
                                </div>
                            </div>
                        </template>
                    </pv-card>
                </div>

                <div class="col-12 md:col-6 lg:col-4">
                    <pv-card class="h-full">
                        <template #content>
                            <div class="flex align-items-center justify-content-between">
                                <div>
                                    <p class="text-color-secondary text-sm mt-0 mb-1">{{ t('alerts.resolved-count') }}</p>
                                    <p class="text-3xl font-bold m-0" style="color: #22C55E;">
                                        {{ resolvedAlerts.length }}
                                    </p>
                                </div>
                                <div class="border-round p-3" style="background-color: #DCFCE7;">
                                    <i class="pi pi-check-circle text-2xl" style="color: #22C55E;"></i>
                                </div>
                            </div>
                        </template>
                    </pv-card>
                </div>
            </div>

            <!-- Tab selector -->
            <pv-select-button
                v-model="activeTab"
                :options="[
                    { label: t('alerts.tab-low-stock'),  value: 'LOW_STOCK' },
                    { label: t('alerts.tab-expiration'), value: 'EXPIRATION' },
                    { label: t('alerts.tab-resolved'),   value: 'RESOLVED' }
                ]"
                option-label="label"
                option-value="value"
                class="mb-4 w-full"
            />

      <!-- LOW_STOCK tab -->
      <div v-if="activeTab === 'LOW_STOCK'" class="flex flex-column gap-3">
        <div v-if="lowStockAlerts.length === 0" class="text-center text-color-secondary py-5">
          <i class="pi pi-check-circle text-4xl text-green-500 mb-2 block"></i>
          <p>{{ t('alerts.no-low-stock') }}</p>
        </div>
        <pv-card
            v-for="currentAlert in lowStockAlerts"
            :key="currentAlert.id"
            class="border-left-alert"
            :style="{ borderLeftColor: currentAlert.severity === 'HIGH' ? '#EF4444' : currentAlert.severity === 'MEDIUM' ? '#F97316' : '#FACC15' }"
        >
          <template #content>
            <div class="flex flex-column md:flex-row md:align-items-center gap-3">
              <div class="border-round p-3 flex-shrink-0 align-self-start" style="background-color: #FFEDD5;">
                <i :class="typeIcon(currentAlert.type)" class="text-xl" style="color: #F97316;"></i>
              </div>
              <div class="flex-1">
                <div class="flex flex-wrap align-items-center gap-2 mb-2">
                  <pv-tag
                      :severity="badgeSeverity(currentAlert.severity)"
                      :value="t(severityLabelKey(currentAlert.severity))"
                  />
                  <span class="text-color-secondary text-sm">{{ formatDate(currentAlert.date) }}</span>
                </div>
                <p class="m-0 font-medium">{{ currentAlert.message }}</p>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <pv-button
                    icon="pi pi-eye"
                    :label="t('alerts.btn-detail')"
                    size="small"
                    text
                    @click="navigateToDetail(currentAlert.id)"
                />
                <pv-button
                    v-if="currentAlert.status !== 'RESOLVED'"
                    icon="pi pi-check"
                    :label="t('alerts.btn-resolve')"
                    size="small"
                    severity="success"
                    outlined
                    @click="confirmResolve(currentAlert)"
                />
              </div>
            </div>

      <!-- EXPIRATION tab -->
      <div v-if="activeTab === 'EXPIRATION'" class="flex flex-column gap-3">
        <div v-if="expirationAlerts.length === 0" class="text-center text-color-secondary py-5">
          <i class="pi pi-check-circle text-4xl text-green-500 mb-2 block"></i>
          <p>{{ t('alerts.no-expiration') }}</p>
        </div>
        <pv-card
            v-for="currentAlert in expirationAlerts"
            :key="currentAlert.id"
            class="border-left-alert"
            :style="{ borderLeftColor: currentAlert.severity === 'HIGH' ? '#EF4444' : currentAlert.severity === 'MEDIUM' ? '#F97316' : '#FACC15' }"
        >
          <template #content>
            <div class="flex flex-column md:flex-row md:align-items-center gap-3">
              <div class="border-round p-3 flex-shrink-0 align-self-start" style="background-color: #FEE2E2;">
                <i :class="typeIcon(currentAlert.type)" class="text-xl" style="color: #EF4444;"></i>
              </div>
              <div class="flex-1">
                <div class="flex flex-wrap align-items-center gap-2 mb-2">
                  <pv-tag
                      :severity="badgeSeverity(currentAlert.severity)"
                      :value="t(severityLabelKey(currentAlert.severity))"
                  />
                  <span class="text-color-secondary text-sm">{{ formatDate(currentAlert.date) }}</span>
                </div>
                <p class="m-0 font-medium">{{ currentAlert.message }}</p>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <pv-button
                    icon="pi pi-eye"
                    :label="t('alerts.btn-detail')"
                    size="small"
                    text
                    @click="navigateToDetail(currentAlert.id)"
                />
                <pv-button
                    v-if="currentAlert.status !== 'RESOLVED'"
                    icon="pi pi-check"
                    :label="t('alerts.btn-resolve')"
                    size="small"
                    severity="success"
                    outlined
                    @click="confirmResolve(currentAlert)"
                />
              </div>
            </div>

      <!-- RESOLVED tab -->
      <div v-if="activeTab === 'RESOLVED'" class="flex flex-column gap-3">
        <div v-if="resolvedAlerts.length === 0" class="text-center text-color-secondary py-5">
          <i class="pi pi-inbox text-4xl text-color-secondary mb-2 block"></i>
          <p>{{ t('alerts.no-resolved') }}</p>
        </div>
        <pv-card
            v-for="currentAlert in resolvedAlerts"
            :key="currentAlert.id"
            class="border-left-alert"
            style="border-left-color: #22C55E;"
        >
          <template #content>
            <div class="flex flex-column md:flex-row md:align-items-center gap-3">
              <div class="border-round p-3 flex-shrink-0 align-self-start" style="background-color: #DCFCE7;">
                <i class="pi pi-check-circle text-xl" style="color: #22C55E;"></i>
              </div>
              <div class="flex-1">
                <div class="flex flex-wrap align-items-center gap-2 mb-2">
                  <pv-tag severity="success" :value="t('alerts.status-resolved')" />
                  <span class="text-color-secondary text-sm">{{ formatDate(currentAlert.date) }}</span>
                </div>
                <p class="m-0 font-medium text-color-secondary">{{ currentAlert.message }}</p>
              </div>
              <pv-button
                  icon="pi pi-eye"
                  :label="t('alerts.btn-detail')"
                  size="small"
                  text
                  @click="navigateToDetail(currentAlert.id)"
              />
            </div>

            <!-- Error display -->
            <div v-if="errors.length > 0" class="mt-3">
                <pv-card>
                    <template #content>
                        <p class="text-red-500 m-0">
                            {{ t('errors.occurred') }}: {{ errors.map(error => error.message).join(', ') }}
                        </p>
                    </template>
                </pv-card>
            </div>
        </div>
    </div>
</template>

<style scoped>
.border-left-alert {
    border-left-width: 4px;
    border-left-style: solid;
}
</style>