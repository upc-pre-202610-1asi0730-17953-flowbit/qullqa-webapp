/**
 * Application service store for the Alerts & Operational Monitoring bounded context.
 *
 * Business rules enforced here:
 * - fetchAlerts loads data scoped to the authenticated business.
 * - Only ACTIVE alerts may be acknowledged (→ ACKNOWLEDGED).
 * - Only ACTIVE or ACKNOWLEDGED or SENT alerts may be resolved (→ RESOLVED).
 * - OUT_OF_STOCK and EXPIRED alerts always count as critical regardless of severity field.
 * - filterByType sorts EXPIRATION/EXPIRED ascending by date (most urgent first).
 * - filterByType sorts LOW_STOCK/OUT_OF_STOCK descending by severity (HIGH first).
 * - Alert rules are managed in local state (no backend endpoint for rules in mock API).
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
 * Numeric weight for sorting severity levels highest to lowest urgency.
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

    /**
     * Alert rules managed in local state.
     * These are derived from inventory policy and evaluated client-side.
     * Each rule has: id, nameKey (i18n), type, active, threshold, unit (i18n key).
     *
     * @type {import('vue').Ref<Object[]>}
     */
    const alertRules = ref([
        {
            id:          'r1',
            nameKey:     'alerts.rule-low-stock-name',
            type:        AlertType.LOW_STOCK,
            active:      true,
            threshold:   10,
            unitKey:     'alerts.rule-unit-units',
            descKey:     'alerts.rule-low-stock-desc'
        },
        {
            id:          'r2',
            nameKey:     'alerts.rule-out-of-stock-name',
            type:        AlertType.OUT_OF_STOCK,
            active:      true,
            threshold:   0,
            unitKey:     'alerts.rule-unit-units',
            descKey:     'alerts.rule-out-of-stock-desc'
        },
        {
            id:          'r3',
            nameKey:     'alerts.rule-expiration-name',
            type:        AlertType.EXPIRATION,
            active:      true,
            threshold:   7,
            unitKey:     'alerts.rule-unit-days',
            descKey:     'alerts.rule-expiration-desc'
        },
        {
            id:          'r4',
            nameKey:     'alerts.rule-expired-name',
            type:        AlertType.EXPIRED,
            active:      true,
            threshold:   0,
            unitKey:     'alerts.rule-unit-days',
            descKey:     'alerts.rule-expired-desc'
        }
    ]);

    // ---- Computed ----

    /** @type {import('vue').ComputedRef<number>} */
    const alertsCount = computed(() => alerts.value.length);

    /**
     * Number of alerts whose status is ACTIVE.
     * @type {import('vue').ComputedRef<number>}
     */
    const activeAlertsCount = computed(() =>
        alerts.value.filter(alert => alert.status === AlertStatus.ACTIVE).length
    );

    /**
     * Number of alerts that are critical and still active.
     * Business rule: OUT_OF_STOCK, EXPIRED types, or HIGH severity count as critical.
     * @type {import('vue').ComputedRef<number>}
     */
    const criticalActiveCount = computed(() =>
        alerts.value.filter(alert => alert.isActive && alert.isCritical).length
    );

    /**
     * Number of LOW_STOCK and OUT_OF_STOCK active alerts combined.
     * @type {import('vue').ComputedRef<number>}
     */
    const lowStockActiveCount = computed(() =>
        alerts.value.filter(
            alert => (alert.type === AlertType.LOW_STOCK || alert.type === AlertType.OUT_OF_STOCK)
                && alert.status === AlertStatus.ACTIVE
        ).length
    );

    /**
     * Number of EXPIRATION and EXPIRED active alerts combined.
     * @type {import('vue').ComputedRef<number>}
     */
    const expirationActiveCount = computed(() =>
        alerts.value.filter(
            alert => (alert.type === AlertType.EXPIRATION || alert.type === AlertType.EXPIRED)
                && alert.status === AlertStatus.ACTIVE
        ).length
    );

    // ----- Queries  -----

    /**
     * @param {number|string} id
     * @returns {import('../domain/model/alert.entity.js').Alert|undefined}
     */
    function getAlertById(id) {
        return alerts.value.find(alert => alert.id === parseInt(id));
    }

    /**
     * Returns alerts filtered by type with business-rule sorting applied.
     * @param {string} type - One of AlertType values.
     * @returns {import('../domain/model/alert.entity.js').Alert[]}
     */
    function filterByType(type) {
        const filtered = alerts.value.filter(alert => alert.type === type);
        if (type === AlertType.EXPIRATION || type === AlertType.EXPIRED) {
            return filtered.slice().sort(
                (alertA, alertB) => new Date(alertA.date).getTime() - new Date(alertB.date).getTime()
            );
        }
        return filtered.slice().sort(
            (alertA, alertB) => severityWeight(alertB.severity) - severityWeight(alertA.severity)
        );
    }

    /**
     * Returns alerts filtered by status.
     * @param {string} status - One of AlertStatus values.
     * @returns {import('../domain/model/alert.entity.js').Alert[]}
     */
    function filterByStatus(status) {
        return alerts.value.filter(alert => alert.status === status);
    }

    // ----- Commands -----

    /**
     * Loads all alerts for the given business.
     * @param {number|string} businessId
     */
    function fetchAlerts(businessId) {
        alertsLoaded.value = false;
        alertsApi.getAlerts(businessId)
            .then(response => {
                alerts.value      = AlertAssembler.toEntitiesFromResponse(response);
                alertsLoaded.value = true;
            })
            .catch(error => {
                errors.value.push(error);
                alertsLoaded.value = true;
            });
    }

    /**
     * Acknowledges an alert — transitions ACTIVE → ACKNOWLEDGED.
     * Business rule: only ACTIVE alerts may be acknowledged.
     * @param {import('../domain/model/alert.entity.js').Alert} alert
     */
    function acknowledgeAlert(alert) {
        if (alert.status !== AlertStatus.ACTIVE) return;

        const resource = {
            ...alert,
            status:     AlertStatus.ACKNOWLEDGED,
            notified:   true,
            notifiedAt: new Date().toISOString()
        };

        alertsApi.acknowledgeAlert(alert.id, resource)
            .then(response => {
                const updatedAlert = AlertAssembler.toEntityFromResource(response.data);
                const index = alerts.value.findIndex(existing => existing.id === updatedAlert.id);
                if (index !== -1) alerts.value[index] = updatedAlert;
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Resolves an alert — transitions ACTIVE/ACKNOWLEDGED/SENT → RESOLVED.
     * Business rule: RESOLVED alerts are immutable.
     * @param {import('../domain/model/alert.entity.js').Alert} alert
     */
    function resolveAlert(alert) {
        if (alert.status === AlertStatus.RESOLVED) return;

        const resource = {
            ...alert,
            status:     AlertStatus.RESOLVED,
            resolvedAt: new Date().toISOString()
        };

        alertsApi.resolveAlert(alert.id, resource)
            .then(response => {
                const updatedAlert = AlertAssembler.toEntityFromResource(response.data);
                const index = alerts.value.findIndex(existing => existing.id === updatedAlert.id);
                if (index !== -1) alerts.value[index] = updatedAlert;
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Toggles a rule's active state on/off.
     * @param {string} ruleId
     */
    function toggleAlertRule(ruleId) {
        const rule = alertRules.value.find(existingRule => existingRule.id === ruleId);
        if (rule) rule.active = !rule.active;
    }

    /**
     * Updates the threshold of a rule.
     * Business rule: threshold must be ≥ 0.
     * @param {string} ruleId
     * @param {number} newThreshold
     */
    function updateAlertRuleThreshold(ruleId, newThreshold) {
        if (newThreshold < 0) return;
        const rule = alertRules.value.find(existingRule => existingRule.id === ruleId);
        if (rule) rule.threshold = newThreshold;
    }

    return {
        alerts,
        alertsLoaded,
        errors,
        alertRules,
        alertsCount,
        activeAlertsCount,
        criticalActiveCount,
        lowStockActiveCount,
        expirationActiveCount,
        getAlertById,
        filterByType,
        filterByStatus,
        fetchAlerts,
        acknowledgeAlert,
        resolveAlert,
        toggleAlertRule,
        updateAlertRuleThreshold
    };
});

export default useAlertsStore;