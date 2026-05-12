/**
 * WarehouseStock entity within the Product & Inventory Management bounded context.
 * Represents how many units of one product are stored in a specific warehouse.
 *
 * @class WarehouseStock
 */
export class WarehouseStock {
    /**
     * @param {Object} params - Entity attributes.
     * @param {number|null} [params.id=null]          - Record identifier.
     * @param {number|null} [params.warehouseId=null]  - Foreign key of the warehouse.
     * @param {number|null} [params.productId=null]    - Foreign key of the product.
     * @param {number}      [params.stock=0]           - Units stored in this warehouse.
     */
    constructor({ id = null, warehouseId = null, productId = null, stock = 0 }) {
        this.id          = id;
        this.warehouseId = warehouseId;
        this.productId   = productId;
        this.stock       = stock;
    }
}