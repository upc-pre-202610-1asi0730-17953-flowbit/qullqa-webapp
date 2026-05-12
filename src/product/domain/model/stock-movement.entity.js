import { MovementType } from './movement-type.entity.js';

/**
 * StockMovement entity within the Product & Inventory Management bounded context.
 * Records a single stock change event for a product.
 *
 * Business rules:
 * - quantity must be a positive integer; the direction is encoded by type.
 * - INTAKE and ADJUSTMENT movements increase stock.
 * - SALE movements decrease stock.
 * - signedQuantity returns the quantity with the correct sign for display.
 *
 * @class StockMovement
 */
export class StockMovement {
    /**
     * @param {Object} params - Entity attributes.
     * @param {number|null} [params.id=null]                       - Movement identifier.
     * @param {number|null} [params.productId=null]                 - Foreign key of the related product.
     * @param {number|null} [params.businessId=null]                - Foreign key of the owning business.
     * @param {number}      [params.quantity=0]                     - Absolute quantity moved (always positive).
     * @param {string}      [params.type=MovementType.INTAKE]       - Movement type value.
     * @param {string}      [params.registeredAt='']                - ISO 8601 timestamp of the movement.
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
     * Returns the quantity with its directional sign.
     * INTAKE and ADJUSTMENT → positive (+N).
     * SALE → negative (-N).
     *
     * @returns {number} Signed quantity.
     */
    get signedQuantity() {
        return this.type === MovementType.SALE ? -this.quantity : this.quantity;
    }

    /**
     * Returns true when this movement increases stock.
     * @returns {boolean}
     */
    get isIntake() {
        return this.type === MovementType.INTAKE || this.type === MovementType.ADJUSTMENT;
    }
}