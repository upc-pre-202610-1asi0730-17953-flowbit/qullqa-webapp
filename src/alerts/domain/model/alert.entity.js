/**
 * Enumeration of the supported alert types
 * within the Alerts & Operational Monitoring bounded context.
 * @enum {string}
 */
export const AlertType = Object.freeze({
    LOW_STOCK:  'LOW_STOCK',
    EXPIRATION: 'EXPIRATION'
});

/**
 * Enumeration of the supported alert statuses.
 *
 * Business rules:
 * - ACTIVE  → alert has been generated and is awaiting attention.
 * - SENT    → alert has been dispatched via a notification channel.
 * - RESOLVED → the underlying issue has been addressed by the user.
 *
 * @enum {string}
 */
export const AlertStatus = Object.freeze({
    ACTIVE:   'ACTIVE',
    SENT:     'SENT',
    RESOLVED: 'RESOLVED'
});

/**
 * Enumeration of alert severity levels.
 *
 * Business rules:
 * - HIGH   → requires immediate action (stock = 0 or batch expires in ≤ 3 days).
 * - MEDIUM → requires attention soon (stock ≤ 50 % of minimum or expires in ≤ 14 days).
 * - LOW    → informational warning (stock below minimum but above 50 % or expires in ≤ 30 days).
 *
 * @enum {string}
 */
export const AlertSeverity = Object.freeze({
    HIGH:   'HIGH',
    MEDIUM: 'MEDIUM',
    LOW:    'LOW'
});

/**
 * Alert entity within the Alerts & Operational Monitoring bounded context.
 *
 * Business rules:
 * - An alert is always scoped to a specific business (businessId must not be null).
 * - An alert is always linked to a product (productId must not be null).
 * - status defaults to ACTIVE on creation.
 * - createdAt is stored as an ISO 8601 string; use Alert.createdAtDate to get a Date object.
 * - isActive returns true only when status is ACTIVE.
 * - isResolved returns true only when status is RESOLVED.
 *
 * @class Alert
 */
export class Alert {
    /**
     * @param {Object}      params
     * @param {number|null} [params.id=null]
     * @param {number|null} [params.businessId=null]
     * @param {number|null} [params.productId=null]
     * @param {number|null} [params.batchId=null]
     * @param {string}      [params.type=AlertType.LOW_STOCK]
     * @param {string}      [params.severity=AlertSeverity.LOW]
     * @param {string}      [params.message='']
     * @param {string}      [params.status=AlertStatus.ACTIVE]
     * @param {string}      [params.date='']
     */
    constructor({
                    id         = null,
                    businessId = null,
                    productId  = null,
                    batchId    = null,
                    type       = AlertType.LOW_STOCK,
                    severity   = AlertSeverity.LOW,
                    message    = '',
                    status     = AlertStatus.ACTIVE,
                    date       = ''
                }) {
        this.id         = id;
        this.businessId = businessId;
        this.productId  = productId;
        this.batchId    = batchId;
        this.type       = type;
        this.severity   = severity;
        this.message    = message;
        this.status     = status;
        this.date       = date;
    }

    /**
     * Returns true when this alert is currently active and requires attention.
     * @returns {boolean}
     */
    get isActive() {
        return this.status === AlertStatus.ACTIVE;
    }

    /**
     * Returns true when this alert has been resolved.
     * @returns {boolean}
     */
    get isResolved() {
        return this.status === AlertStatus.RESOLVED;
    }

    /**
     * Returns the creation date as a native Date object for display formatting.
     * @returns {Date}
     */
    get createdAtDate() {
        return new Date(this.date);
    }
}