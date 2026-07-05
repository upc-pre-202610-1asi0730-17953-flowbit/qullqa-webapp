/**
 * Enumeration of the supported plan statuses
 * within the Subscription & Plan Management bounded context.
 * @enum {string}
 */
export const PlanStatus = Object.freeze({
    ACTIVE:   'ACTIVE',
    INACTIVE: 'INACTIVE'
});

/**
 * Plan entity within the Subscription & Plan Management bounded context.
 * Represents a subscription tier that a Business can be enrolled in.
 *
 * Business rules:
 * - price must be a non-negative number.
 * - features is a free-text list of benefits shown to the user.
 * - Only ACTIVE plans should be offered for upgrade.
 *
 * @class Plan
 */
export class Plan {
    /**
     * @param {Object}        params
     * @param {number|null}   [params.id=null]
     * @param {string}        [params.name='']
     * @param {string}        [params.description='']
     * @param {number}        [params.price=0]
     * @param {string}        [params.currency='PEN']
     * @param {string}        [params.timeLength='MONTHLY']
     * @param {string}        [params.status=PlanStatus.ACTIVE]
     * @param {string[]}      [params.features=[]]
     */
    constructor({
                    id          = null,
                    name        = '',
                    description = '',
                    price       = 0,
                    currency    = 'PEN',
                    timeLength  = 'MONTHLY',
                    status      = PlanStatus.ACTIVE,
                    features    = []
                }) {
        this.id          = id;
        this.name        = name;
        this.description = description;
        this.price       = price;
        this.currency    = currency;
        this.timeLength  = timeLength;
        this.status      = status;
        this.features    = Array.isArray(features) ? [...features] : [];
    }

    /**
     * Returns true when the plan can be offered for subscription/upgrade.
     * @returns {boolean}
     */
    get isActive() {
        return this.status === PlanStatus.ACTIVE;
    }
}
