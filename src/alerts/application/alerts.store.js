/**
 * Application service store for the Alerts & Operational Monitoring bounded context.
 *
 * Business rules enforced here:
 * - fetchAlerts loads data scoped to the authenticated business (businessId).
 * - activeAlertsCount counts only alerts whose status is ACTIVE.
 * - resolveAlert performs a full PUT with the updated status; only ACTIVE or SENT
 *   alerts may transition to RESOLVED.
 * - filterByType returns all alerts of a given AlertType regardless of status.
 * - filterByStatus returns all alerts matching a specific AlertStatus.
 * - Expiration alerts are sorted ascending by date so the most urgent appear first.
 * - Low-stock alerts are sorted by severity: HIGH → MEDIUM → LOW.
 *
 * @module useAlertsStore
 */
import { defineStore }   from 'pinia';
import { computed, ref } from 'vue';
import { AlertsApi }     from '../infrastructure/alerts.api.js';
import { AlertAssembler } from '../infrastructure/alert.assembler.js';
import { AlertStatus, AlertType, AlertSeverity } from '../domain/model/alert.entity.js';

const alertsApi = new AlertsApi();

/**
 * Numeric weight for sorting severity levels from highest to lowest urgency.
 * @param {string} severity
 * @returns {number}
 */
function severityWeight(severity) {
    if (severity === AlertSeverity.HIGH)   return 3;
    if (severity === AlertSeverity.MEDIUM) return 2;
    return 1;
}

const useAlertsStore = defineStore('alerts', () => {

    /** @type {import('vue').Ref<import('../domain/model/alert.entity.js').Alert[]>} */
    const alerts = ref([]);

    /** @type {import('vue').Ref<boolean>} */
    const alertsLoaded = ref(false);

    /** @type {import('vue').Ref<Error[]>} */
    const errors = ref([]);

    // ─── Computed ─────────────────────────────────────────────────────────────

    /**
     * Total number of loaded alerts.
     * @type {import('vue').ComputedRef<number>}
     */
    const alertsCount = computed(() => alerts.value.length);

    /**
     * Number of alerts whose status is ACTIVE.
     * Business rule: only ACTIVE alerts count as "pending attention".
     * @type {import('vue').ComputedRef<number>}
     */
    const activeAlertsCount = computed(() =>
        alerts.value.filter(alert => alert.status === AlertStatus.ACTIVE).length
    );

    /**
     * Number of LOW_STOCK type alerts that are currently ACTIVE.
     * @type {import('vue').ComputedRef<number>}
     */
    const lowStockActiveCount = computed(() =>
        alerts.value.filter(
            alert => alert.type === AlertType.LOW_STOCK && alert.status === AlertStatus.ACTIVE
        ).length
    );

    /**
     * Number of EXPIRATION type alerts that are currently ACTIVE.
     * @type {import('vue').ComputedRef<number>}
     */
    const expirationActiveCount = computed(() =>
        alerts.value.filter(
            alert => alert.type === AlertType.EXPIRATION && alert.status === AlertStatus.ACTIVE
        ).length
    );

    // ─── Queries ──────────────────────────────────────────────────────────────

    /**
     * Returns a single alert entity by its identifier.
     * @param {number|string} id
     * @returns {import('../domain/model/alert.entity.js').Alert|undefined}
     */
    function getAlertById(id) {
        const numericId = parseInt(id);
        return alerts.value.find(alert => alert.id === numericId);
    }

    /**
     * Returns all alerts of a given type.
     * Expiration alerts are sorted ascending by date (most urgent first).
     * Low-stock alerts are sorted by severity descending (HIGH first).
     *
     * @param {string} type - One of AlertType values.
     * @returns {import('../domain/model/alert.entity.js').Alert[]}
     */
    function filterByType(type) {
        const filtered = alerts.value.filter(alert => alert.type === type);
        if (type === AlertType.EXPIRATION) {
            return filtered.slice().sort(
                (alertA, alertB) => new Date(alertA.date).getTime() - new Date(alertB.date).getTime()
            );
        }
        if (type === AlertType.LOW_STOCK) {
            return filtered.slice().sort(
                (alertA, alertB) => severityWeight(alertB.severity) - severityWeight(alertA.severity)
            );
        }
        return filtered;
    }

    /**
     * Returns all alerts matching a specific status.
     * @param {string} status - One of AlertStatus values.
     * @returns {import('../domain/model/alert.entity.js').Alert[]}
     */
    function filterByStatus(status) {
        return alerts.value.filter(alert => alert.status === status);
    }

    // ─── Commands ─────────────────────────────────────────────────────────────

    /**
     * Loads all alerts scoped to the given business from the API.
     * @param {number|string} businessId
     * @returns {void}
     */
    function fetchAlerts(businessId) {
        alertsLoaded.value = false;
        alertsApi.getAlerts(businessId)
            .then(response => {
                alerts.value = AlertAssembler.toEntitiesFromResponse(response);
                alertsLoaded.value = true;
            })
            .catch(error => {
                errors.value.push(error);
                alertsLoaded.value = true;
            });
    }

    /**
     * Resolves an alert by transitioning its status to RESOLVED.
     *
     * Business rule: only alerts with status ACTIVE or SENT may be resolved.
     * The store updates the alert in the local collection after the API responds.
     *
     * @param {import('../domain/model/alert.entity.js').Alert} alert - Alert entity to resolve.
     * @returns {void}
     */
    function resolveAlert(alert) {
        if (alert.status === AlertStatus.RESOLVED) {
            console.warn(`Alert ${alert.id} is already resolved.`);
            return;
        }
        const resolvedResource = {
            ...alert,
            status: AlertStatus.RESOLVED
        };
        alertsApi.resolveAlert(alert.id, resolvedResource)
            .then(response => {
                const updatedAlert = AlertAssembler.toEntityFromResource(response.data);
                const index = alerts.value.findIndex(existingAlert => existingAlert.id === updatedAlert.id);
                if (index !== -1) alerts.value[index] = updatedAlert;
            })
            .catch(error => {
                errors.value.push(error);
            });
    }

    return {
        alerts,
        alertsLoaded,
        errors,
        alertsCount,
        activeAlertsCount,
        lowStockActiveCount,
        expirationActiveCount,
        getAlertById,
        filterByType,
        filterByStatus,
        fetchAlerts,
        resolveAlert
    };
});

export default useAlertsStore;