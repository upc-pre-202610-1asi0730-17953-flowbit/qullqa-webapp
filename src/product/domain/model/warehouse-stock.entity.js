/**
 * WarehouseStock entity within the Product & Inventory Management bounded context.
 * Represents how many units of one product are stored in a specific warehouse.
 *
 * @class WarehouseStock
 */
export class WarehouseStock {
    /**
     * @param {Object}      params
     * @param {number|null} [params.id=null]
     * @param {number|null} [params.warehouseId=null]
     * @param {number|null} [params.productId=null]
     * @param {number}      [params.stock=0]
     */
    constructor({ id = null, warehouseId = null, productId = null, stock = 0 }) {
        this.id          = id;
        this.warehouseId = warehouseId;
        this.productId   = productId;
        this.stock       = stock;
    }
}