/**
 * Enumeration of the supported stock movement types.
 *
 * Business rules:
 * - INTAKE     → stock increases; triggered by purchase reception or manual intake.
 * - SALE       → stock decreases; triggered by a completed POS sale.
 * - ADJUSTMENT → manual stock correction; direction depends on signed quantity.
 *
 * @enum {string}
 */
export const MovementType = Object.freeze({
    INTAKE:     'INTAKE',
    SALE:       'SALE',
    ADJUSTMENT: 'ADJUSTMENT'
});

/**
 * StockMovement entity within the Product & Inventory Management bounded context.
 * Records a single stock change event for a product.
 *
 * Business rules:
 * - quantity is always a positive integer stored as an absolute value.
 * - The direction of the change is determined by the type field.
 * - signedQuantity returns a negative value for SALE movements and positive for all others.
 *
 * @class StockMovement
 */
export class StockMovement {
    /**
     * @param {Object}      params
     * @param {number|null} [params.id=null]
     * @param {number|null} [params.productId=null]
     * @param {number|null} [params.businessId=null]
     * @param {number}      [params.quantity=0]
     * @param {string}      [params.type=MovementType.INTAKE]
     * @param {string}      [params.registeredAt='']
     */
    constructor({
                    id           = null,
                    productId    = null,
                    businessId   = null,
                    quantity     = 0,
                    type         = MovementType.INTAKE,
                    registeredAt = ''
                }) {
        this.id           = id;
        this.productId    = productId;
        this.businessId   = businessId;
        this.quantity     = quantity;
        this.type         = type;
        this.registeredAt = registeredAt;
    }

    /**
     * Returns true when this movement increases stock (INTAKE or ADJUSTMENT).
     * @returns {boolean}
     */
    get isIntake() {
        return this.type === MovementType.INTAKE || this.type === MovementType.ADJUSTMENT;
    }

    /**
     * Returns the quantity with the correct directional sign for display.
     * SALE → negative. INTAKE / ADJUSTMENT → positive.
     * @returns {number}
     */
    get signedQuantity() {
        return this.type === MovementType.SALE ? -this.quantity : this.quantity;
    }
}