/**
 * MetricsSnapshot entity within the Dashboard & Analytics bounded context.
 * Represents a point-in-time summary of key business indicators for a given business.
 *
 * Business rules:
 * - totalProducts must be a non-negative integer.
 * - lowStockProducts must be a non-negative integer and cannot exceed totalProducts.
 * - inventoryValue must be a non-negative number representing monetary value in PEN.
 * - totalSales must be a non-negative number representing cumulative sales revenue.
 * - salesCount must be a non-negative integer representing the number of completed sales.
 * - averageSaleValue is computed as totalSales / salesCount; returns 0 when salesCount is 0.
 * - stockHealthPercentage is computed as the ratio of healthy products to totalProducts (× 100).
 *   Returns 100 when totalProducts is 0 (vacuously healthy).
 *
 * @class MetricsSnapshot
 */
export class MetricsSnapshot {
    /**
     * @param {Object} params - Entity attributes.
     * @param {number|null}  [params.id=null]              - Snapshot identifier.
     * @param {number|null}  [params.businessId=null]       - Foreign key of the associated business.
     * @param {number}       [params.totalProducts=0]       - Total number of distinct products.
     * @param {number}       [params.lowStockProducts=0]    - Number of products below the minimum stock threshold.
     * @param {number}       [params.inventoryValue=0]      - Total monetary value of current inventory (PEN).
     * @param {number}       [params.totalSales=0]          - Cumulative sales revenue in the snapshot period (PEN).
     * @param {number}       [params.salesCount=0]          - Number of completed sales transactions.
     * @param {string}       [params.generatedAt='']        - ISO 8601 timestamp when the snapshot was generated.
     */
    constructor({
                    id             = null,
                    businessId     = null,
                    totalProducts  = 0,
                    lowStockProducts = 0,
                    inventoryValue = 0,
                    totalSales     = 0,
                    salesCount     = 0,
                    generatedAt    = ''
                }) {
        this.id               = id;
        this.businessId       = businessId;
        this.totalProducts    = totalProducts;
        this.lowStockProducts = lowStockProducts;
        this.inventoryValue   = inventoryValue;
        this.totalSales       = totalSales;
        this.salesCount       = salesCount;
        this.generatedAt      = generatedAt;
    }

    /**
     * Computes the average monetary value per completed sale.
     * Returns 0 when no sales have been recorded to avoid division by zero.
     *
     * @returns {number} Average sale value in PEN, rounded to two decimal places.
     */
    get averageSaleValue() {
        if (this.salesCount === 0) return 0;
        return Math.round((this.totalSales / this.salesCount) * 100) / 100;
    }

    /**
     * Computes the stock health percentage: the proportion of products NOT in low-stock
     * status, expressed as a value between 0 and 100.
     * When totalProducts is 0 the inventory is considered vacuously healthy (100 %).
     *
     * @returns {number} Stock health percentage (0–100).
     */
    get stockHealthPercentage() {
        if (this.totalProducts === 0) return 100;
        const healthyProducts = this.totalProducts - this.lowStockProducts;
        return Math.round((healthyProducts / this.totalProducts) * 100);
    }
}