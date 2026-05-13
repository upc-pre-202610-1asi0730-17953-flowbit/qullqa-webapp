/**
 * SaleDetail entity within the Sales & POS Management bounded context.
 * Represents a single line item inside a Sale.
 *
 * Business rules:
 * - quantity must be a positive integer greater than zero.
 * - unitPrice must be a number greater than zero.
 * - discount is a non-negative amount per unit (not a percentage).
 * - lineTotal = (unitPrice - discount) * quantity.
 *   This is the canonical total calculation for a line item.
 *
 * @class SaleDetail
 */
export class SaleDetail {
    /**
     * @param {Object}      params
     * @param {number|null} [params.id=null]        - Detail identifier (null before persisting).
     * @param {number|null} [params.saleId=null]    - Foreign key of the parent Sale.
     * @param {number|null} [params.productId=null] - Foreign key of the sold Product.
     * @param {number}      [params.quantity=1]     - Number of units sold.
     * @param {number}      [params.unitPrice=0]    - Price per unit at the moment of sale.
     * @param {number}      [params.discount=0]     - Discount amount per unit (in currency).
     */
    constructor({
                    id        = null,
                    saleId    = null,
                    productId = null,
                    quantity  = 1,
                    unitPrice = 0,
                    discount  = 0
                }) {
        this.id        = id;
        this.saleId    = saleId;
        this.productId = productId;
        this.quantity  = quantity;
        this.unitPrice = unitPrice;
        this.discount  = discount;
    }

    /**
     * Calculates the total monetary value of this line item after applying the discount.
     *
     * Formula: (unitPrice - discount) × quantity
     *
     * @returns {number} The line-item total rounded to two decimal places.
     */
    get lineTotal() {
        const effectivePrice = Math.max(0, this.unitPrice - this.discount);
        return Math.round(effectivePrice * this.quantity * 100) / 100;
    }
}