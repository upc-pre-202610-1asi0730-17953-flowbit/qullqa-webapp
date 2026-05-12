import { ProductCategory } from './product-category.entity.js';
import { ProductStatus }   from './product-status.entity.js';

/**
 * Product entity within the Product & Inventory Management bounded context.
 *
 * Business rules:
 * - name must be a non-empty string.
 * - basePrice must be a non-negative number (free products are allowed at 0).
 * - category must be one of the values defined in ProductCategory.
 * - status defaults to ACTIVE on creation.
 * - isLowStock returns true when the related inventory's currentStock
 *   falls at or below minimumStock. This computation is done in the
 *   presentation layer using the paired InventoryItem entity.
 *
 * @class Product
 */
export class Product {
    /**
     * @param {Object} params - Entity attributes.
     * @param {number|null}  [params.id=null]                        - Product identifier.
     * @param {number|null}  [params.businessId=null]                - Foreign key of the owning business.
     * @param {string}       [params.name='']                        - Product display name.
     * @param {string}       [params.description='']                 - Optional product description.
     * @param {string}       [params.category=ProductCategory.OTHER] - Product category value.
     * @param {number}       [params.basePrice=0]                    - Sale price per unit in PEN.
     * @param {string}       [params.status=ProductStatus.ACTIVE]    - Product status value.
     */
    constructor({
                    id          = null,
                    businessId  = null,
                    name        = '',
                    description = '',
                    category    = ProductCategory.OTHER,
                    basePrice   = 0,
                    status      = ProductStatus.ACTIVE
                }) {
        this.id          = id;
        this.businessId  = businessId;
        this.name        = name;
        this.description = description;
        this.category    = category;
        this.basePrice   = basePrice;
        this.status      = status;
    }

    /**
     * Returns true when the product is available for sale and operations.
     * @returns {boolean}
     */
    get isActive() {
        return this.status === ProductStatus.ACTIVE;
    }
}