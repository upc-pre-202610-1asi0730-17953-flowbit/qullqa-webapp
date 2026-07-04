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
import { Alert, AlertStatus, AlertType, AlertSeverity } from '../domain/model/alert.entity.js';
import useProductStore   from '../../product/application/product.store.js';

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
     * @returns {Promise<void>}
     */
    function fetchAlerts(businessId) {
        alertsLoaded.value = false;
        return alertsApi.getAlerts(businessId)
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
     * Numeric weight used to rank days-to-expiry into the same severity bands
     * documented on the Alert entity (HIGH ≤3d, MEDIUM ≤14d, LOW ≤30d).
     * @param {number} daysToExpiry
     * @returns {string}
     */
    function expirationSeverity(daysToExpiry) {
        if (daysToExpiry <= 3)  return AlertSeverity.HIGH;
        if (daysToExpiry <= 14) return AlertSeverity.MEDIUM;
        return AlertSeverity.LOW;
    }

    /**
     * Re-evaluates active alerts LIVE from real, current inventory/batch data —
     * using the exact same functions Product & Inventory Management uses for its
     * own "Por vencer"/"Vencido"/"Stock bajo" badges (isProductExpiringSoon,
     * isProductExpired, InventoryItem.isLowStock) — instead of trusting static
     * pre-seeded alert rows, which silently drift out of sync with reality as
     * real time passes (see the 2026-07 alerts/inventory mismatch incident).
     *
     * For each currently-true condition (out of stock / low stock / expiring
     * soon / already expired), reuses an existing non-RESOLVED persisted alert
     * for that exact product+type if one exists (so acknowledge/resolve state
     * and the original "Generada" date are preserved); otherwise synthesizes a
     * new in-memory alert with id: null, which only gets persisted to the mock
     * the first time the user acknowledges or resolves it (see acknowledgeAlert
     * / resolveAlert below). RESOLVED alerts are pure history and pass through
     * untouched — they intentionally are NOT re-evaluated against today's data.
     *
     * Business rules for what counts as "critical enough":
     * - OUT_OF_STOCK / EXPIRED: always HIGH severity.
     * - LOW_STOCK: MEDIUM if stock ≤ 50% of the minimum, otherwise LOW.
     * - EXPIRATION (0–7 days out, not yet expired): HIGH if ≤3 days, else MEDIUM.
     *
     * @param {number|string} businessId
     * @returns {Promise<void>}
     */
    function evaluateLiveAlerts(businessId) {
        const productStore = useProductStore();
        const numericBusinessId = parseInt(businessId);

        alertsLoaded.value = false;
        const loaders = [];
        if (!productStore.productsLoaded)  loaders.push(productStore.fetchProducts(numericBusinessId));
        if (!productStore.inventoryLoaded) loaders.push(productStore.fetchInventory(numericBusinessId));
        if (!productStore.batchesLoaded)   loaders.push(productStore.fetchBatches());

        return Promise.all(loaders).then(() => {
            const persisted = alerts.value;
            const liveAlerts = [];

            productStore.products
                .filter(product => product.businessId === numericBusinessId && product.isActive)
                .forEach(product => {
                    const inventoryItem = productStore.getInventoryByProduct(product.id);
                    const daysToExpiry  = productStore.getDaysToNearestExpiry(product.id);
                    const conditions    = [];

                    if (inventoryItem && inventoryItem.currentStock === 0) {
                        conditions.push({
                            type: AlertType.OUT_OF_STOCK, severity: AlertSeverity.HIGH,
                            message: `${product.name} sin stock — 0 unidades disponibles`,
                            currentStock: 0, minStock: inventoryItem.minimumStock, daysToExpiry: null
                        });
                    } else if (inventoryItem && inventoryItem.isLowStock) {
                        const severity = inventoryItem.currentStock <= inventoryItem.minimumStock * 0.5
                            ? AlertSeverity.MEDIUM : AlertSeverity.LOW;
                        conditions.push({
                            type: AlertType.LOW_STOCK, severity,
                            message: `Stock de ${product.name} por debajo del mínimo (${inventoryItem.currentStock} unidades)`,
                            currentStock: inventoryItem.currentStock, minStock: inventoryItem.minimumStock, daysToExpiry: null
                        });
                    }

                    if (daysToExpiry !== null && daysToExpiry < 0) {
                        conditions.push({
                            type: AlertType.EXPIRED, severity: AlertSeverity.HIGH,
                            message: `Lote de ${product.name} vencido hace ${Math.abs(daysToExpiry)} día(s)`,
                            currentStock: null, minStock: null, daysToExpiry
                        });
                    } else if (daysToExpiry !== null && daysToExpiry <= 7) {
                        conditions.push({
                            type: AlertType.EXPIRATION, severity: expirationSeverity(daysToExpiry),
                            message: `Lote de ${product.name} vence en ${daysToExpiry} día(s)`,
                            currentStock: null, minStock: null, daysToExpiry
                        });
                    }

                    conditions.forEach(condition => {
                        const existing = persisted.find(alert =>
                            alert.productId === product.id && alert.type === condition.type
                            && alert.status !== AlertStatus.RESOLVED
                        );
                        liveAlerts.push(existing ?? new Alert({
                            id:          null,
                            businessId:  numericBusinessId,
                            productId:   product.id,
                            productName: product.name,
                            batchId:     null,
                            status:      AlertStatus.ACTIVE,
                            date:        new Date().toISOString(),
                            notified:    false,
                            notifiedAt:  '',
                            resolvedAt:  '',
                            ...condition
                        }));
                    });
                });

            const resolvedHistory = persisted.filter(alert => alert.status === AlertStatus.RESOLVED);
            alerts.value = [...liveAlerts, ...resolvedHistory];
            alertsLoaded.value = true;
        });
    }

    /**
     * Persists (or updates) an alert after a status change, replacing whichever
     * in-memory entry corresponds to it. Live-evaluated alerts (id: null, see
     * evaluateLiveAlerts) don't exist in the mock yet, so they're POSTed as a
     * new record on their first action instead of PUT — this is what gives a
     * live-detected condition a real, permanent history from that point on.
     * @param {import('../domain/model/alert.entity.js').Alert} alert - Original alert (before the status change).
     * @param {Object} resource - Full resource with the new status applied.
     * @returns {Promise<import('../domain/model/alert.entity.js').Alert>}
     */
    function persistAlertChange(alert, resource) {
        const request = alert.id === null
            ? alertsApi.createAlert({ ...resource, id: undefined }) // let json-server assign a real id
            : alertsApi.acknowledgeAlert(alert.id, resource); // update is a plain PUT either way

        return request.then(response => {
            const updatedAlert = AlertAssembler.toEntityFromResource(response.data);
            const index = alert.id === null
                ? alerts.value.findIndex(existing => existing.id === null
                    && existing.productId === alert.productId && existing.type === alert.type)
                : alerts.value.findIndex(existing => existing.id === alert.id);
            if (index !== -1) alerts.value[index] = updatedAlert;
            return updatedAlert;
        });
    }

    /**
     * Acknowledges an alert — transitions ACTIVE → ACKNOWLEDGED.
     * Business rule: only ACTIVE alerts may be acknowledged.
     * @param {import('../domain/model/alert.entity.js').Alert} alert
     * @returns {Promise<import('../domain/model/alert.entity.js').Alert>}
     */
    function acknowledgeAlert(alert) {
        if (alert.status !== AlertStatus.ACTIVE) return Promise.resolve(alert);

        const resource = {
            ...alert,
            status:     AlertStatus.ACKNOWLEDGED,
            notified:   true,
            notifiedAt: new Date().toISOString()
        };

        return persistAlertChange(alert, resource)
            .catch(error => {
                errors.value.push(error);
                throw error;
            });
    }

    /**
     * Resolves an alert — transitions ACTIVE/ACKNOWLEDGED/SENT → RESOLVED.
     * Business rule: RESOLVED alerts are immutable.
     * @param {import('../domain/model/alert.entity.js').Alert} alert
     * @returns {Promise<import('../domain/model/alert.entity.js').Alert>}
     */
    function resolveAlert(alert) {
        if (alert.status === AlertStatus.RESOLVED) return Promise.resolve(alert);

        const resource = {
            ...alert,
            status:     AlertStatus.RESOLVED,
            resolvedAt: new Date().toISOString()
        };

        return persistAlertChange(alert, resource)
            .catch(error => {
                errors.value.push(error);
                throw error;
            });
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
        evaluateLiveAlerts,
        acknowledgeAlert,
        resolveAlert,
        toggleAlertRule,
        updateAlertRuleThreshold
    };
});

export default useAlertsStore;