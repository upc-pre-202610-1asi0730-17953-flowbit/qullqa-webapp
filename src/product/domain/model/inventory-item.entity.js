/**
 * InventoryItem entity within the Product & Inventory Management bounded context.
 * Represents the current stock state of one product for a given business.
 *
 * Business rules:
 * - currentStock must be a non-negative integer.
 * - minimumStock is the threshold below which an alert should be triggered.
 * - isLowStock returns true when currentStock is at or below minimumStock.
 * - isCritical returns true when currentStock is 0.
 * - stockStatus returns 'CRITICAL', 'LOW', or 'NORMAL' for badge rendering.
 *   CRITICAL: currentStock === 0
 *   LOW:      currentStock > 0 AND currentStock <= minimumStock
 *   NORMAL:   currentStock > minimumStock
 *
 * @class InventoryItem
 */
export class InventoryItem {
    /**
     * @param {Object} params - Entity attributes.
     * @param {number|null} [params.id=null]              - Inventory record identifier.
     * @param {number|null} [params.productId=null]        - Foreign key of the related product.
     * @param {number|null} [params.businessId=null]       - Foreign key of the owning business.
     * @param {number}      [params.stockUnit=0]           - Current stock quantity (json-server field name).
     * @param {number}      [params.minimumStock=0]        - Minimum acceptable stock level.
     * @param {string}      [params.warehouseId=null]      - Foreign key of the warehouse.
     * @param {string}      [params.updatedAt='']          - ISO 8601 timestamp of last update.
     */
    constructor({
                    id           = null,
                    productId    = null,
                    businessId   = null,
                    stockUnit    = 0,
                    minimumStock = 0,
                    warehouseId  = null,
                    updatedAt    = ''
                }) {
        this.id           = id;
        this.productId    = productId;
        this.businessId   = businessId;
        this.currentStock = stockUnit;
        this.minimumStock = minimumStock;
        this.warehouseId  = warehouseId;
        this.updatedAt    = updatedAt;
    }

    /**
     * Returns true when current stock is at or below the minimum threshold.
     * Business rule: stock AT minimum is already considered low.
     * @returns {boolean}
     */
    get isLowStock() {
        return this.currentStock <= this.minimumStock && this.currentStock > 0;
    }

    /**
     * Returns true when current stock is exactly zero.
     * @returns {boolean}
     */
    get isCritical() {
        return this.currentStock === 0;
    }

    /**
     * Returns a stock status string used by the presentation layer for badge rendering.
     * Business rules (priority order):
     *   1. CRITICAL when currentStock === 0.
     *   2. LOW      when currentStock > 0 AND currentStock <= minimumStock.
     *   3. NORMAL   otherwise.
     *
     * @returns {'CRITICAL'|'LOW'|'NORMAL'}
     */
    get stockStatus() {
        if (this.isCritical)  return 'CRITICAL';
        if (this.isLowStock)  return 'LOW';
        return 'NORMAL';
    }
}