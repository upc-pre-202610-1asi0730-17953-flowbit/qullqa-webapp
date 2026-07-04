/**
 * Application service store for the Product & Inventory Management bounded context.
 *
 * Business rules enforced here:
 * - fetchProducts and fetchInventory load data scoped to the authenticated business.
 * - A product cannot be deleted when its inventory record has currentStock > 0.
 * - registerStockIntake quantity must be a positive integer greater than zero.
 * - On intake, if an inventory record exists it is updated (PUT); otherwise created (POST).
 * - Every successful registerStockIntake/registerStockSale records a StockMovement
 *   (best-effort: failures to log are swallowed so the underlying stock mutation,
 *   already persisted, is never rolled back over an audit-trail write failing).
 * - stockStatusCounts joins products with their inventory items to compute
 *   { normal, low, critical } counts for the summary cards in the list view.
 *
 * @module useProductStore
 */
import { defineStore }  from 'pinia';
import { computed, ref } from 'vue';
import { ProductApi }               from '../infrastructure/product.api.js';
import { ProductAssembler }         from '../infrastructure/product.assembler.js';
import { InventoryItemAssembler }   from '../infrastructure/inventory-item.assembler.js';
import { StockMovementAssembler }   from '../infrastructure/stock-movement.assembler.js';
import { WarehouseStockAssembler }  from '../infrastructure/warehouse-stock.assembler.js';
import { MovementType }             from '../domain/model/stock-movement.entity.js';
import { ProductStatus }            from '../domain/model/product.entity.js';

const productApi = new ProductApi();

/**
 * Parses a date-only string (yyyy-mm-dd, as stored on batch.expiration) into a
 * Date at local midnight. `new Date('yyyy-mm-dd')` parses as UTC midnight,
 * which in a timezone behind UTC (e.g. Peru, UTC-5) displays/compares as the
 * previous day — this avoids that off-by-one.
 * @param {string} dateOnlyString - 'yyyy-mm-dd'.
 * @returns {Date}
 */
export function parseLocalDate(dateOnlyString) {
    const [year, month, day] = dateOnlyString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

const useProductStore = defineStore('product', () => {

    /** @type {import('vue').Ref<import('../domain/model/product.entity.js').Product[]>} */
    const products = ref([]);

    /** @type {import('vue').Ref<import('../domain/model/inventory-item.entity.js').InventoryItem[]>} */
    const inventory = ref([]);

    /** @type {import('vue').Ref<import('../domain/model/stock-movement.entity.js').StockMovement[]>} */
    const stockMovements = ref([]);

    /** @type {import('vue').Ref<import('../domain/model/warehouse-stock.entity.js').WarehouseStock[]>} */
    const warehouseStock = ref([]);

    /**
     * Raw batch resources (id, productId, expiration, status) across every product.
     * Used to determine which products have stock expiring soon — batches carry no
     * businessId of their own, so scoping happens by matching productId against the
     * already business-scoped `products` list.
     * @type {import('vue').Ref<Array>}
     */
    const batches = ref([]);

    /** @type {import('vue').Ref<boolean>} */
    const batchesLoaded = ref(false);

    /** @type {import('vue').Ref<boolean>} */
    const stockMovementsLoaded = ref(false);

    /** @type {import('vue').Ref<boolean>} */
    const productsLoaded = ref(false);

    /** @type {import('vue').Ref<boolean>} */
    const inventoryLoaded = ref(false);

    /** @type {import('vue').Ref<Error[]>} */
    const errors = ref([]);

    /**
     * Total number of loaded products.
     * @type {import('vue').ComputedRef<number>}
     */
    const productsCount = computed(() => products.value.length);

    /**
     * Summary counts for the three stock status categories.
     * Joins each product with its InventoryItem by productId.
     * Products with no inventory record are counted as CRITICAL.
     *
     * @type {import('vue').ComputedRef<{normal: number, low: number, critical: number}>}
     */
    const stockStatusCounts = computed(() => {
        const counts = { normal: 0, low: 0, critical: 0 };
        products.value.forEach(product => {
            const inventoryItem = inventory.value.find(item => item.productId === product.id);
            if (!inventoryItem) {
                counts.critical += 1;
                return;
            }
            const status = inventoryItem.stockStatus;
            if (status === 'NORMAL')   counts.normal   += 1;
            if (status === 'LOW')      counts.low      += 1;
            if (status === 'CRITICAL') counts.critical += 1;
        });
        return counts;
    });

    // ─── Queries ──────────────────────────────────────────────────────────────

    /**
     * Finds a product entity by its numeric identifier.
     * @param {number|string} id
     * @returns {import('../domain/model/product.entity.js').Product|undefined}
     */
    function getProductById(id) {
        return products.value.find(product => product.id === parseInt(id));
    }

    /**
     * Returns the first inventory record linked to the given productId.
     * @param {number|string} productId
     * @returns {import('../domain/model/inventory-item.entity.js').InventoryItem|undefined}
     */
    function getInventoryByProduct(productId) {
        return inventory.value.find(item => item.productId === parseInt(productId));
    }

    // ─── Commands ─────────────────────────────────────────────────────────────

    /**
     * Fetches all products for the authenticated business.
     * @param {number|string} businessId
     */
    function fetchProducts(businessId) {
        return productApi.getProducts(businessId)
            .then(response => {
                products.value       = ProductAssembler.toEntitiesFromResponse(response);
                productsLoaded.value = true;
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Fetches all inventory records for the authenticated business.
     * @param {number|string} businessId
     */
    function fetchInventory(businessId) {
        return productApi.getInventory(businessId)
            .then(response => {
                inventory.value       = InventoryItemAssembler.toEntitiesFromResponse(response);
                inventoryLoaded.value = true;
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Fetches stock movements for a product by loading its batches.
     * Each batch is mapped to an INTAKE StockMovement with its expiration as registeredAt.
     * @param {number|string} productId
     */
    function fetchStockMovements(productId) {
        productApi.getBatchesByProduct(productId)
            .then(response => {
                const batches = response.data instanceof Array ? response.data : [];
                stockMovements.value = batches.map(batch =>
                    StockMovementAssembler.toEntityFromResource({
                        id:           batch.id,
                        productId:    batch.productId,
                        businessId:   null,
                        quantity:     1,
                        type:         MovementType.INTAKE,
                        registeredAt: batch.expiration
                    })
                );
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Fetches the real, persisted stock movement history for a business
     * (every INTAKE/SALE logged by registerStockIntake/registerStockSale),
     * sorted most-recent-first. Used by the Inventory "Movimientos" tab.
     * @param {number|string} businessId
     */
    function fetchAllStockMovements(businessId) {
        productApi.getStockMovements(businessId)
            .then(response => {
                const entities = StockMovementAssembler.toEntitiesFromResponse(response);
                stockMovements.value = entities.sort(
                    (first, second) => new Date(second.registeredAt) - new Date(first.registeredAt)
                );
                stockMovementsLoaded.value = true;
            })
            .catch(error => {
                errors.value.push(error);
                stockMovementsLoaded.value = true;
            });
    }

    /**
     * Persists a StockMovement audit-trail entry. Best-effort: failures are
     * logged but never rejected, so a logging outage never blocks or rolls
     * back the stock mutation that already succeeded.
     * @param {Object} resource
     * @returns {Promise<void>}
     */
    function recordStockMovement(resource) {
        return productApi.createStockMovement(resource)
            .then(response => {
                stockMovements.value.unshift(StockMovementAssembler.toEntityFromResource(response.data));
            })
            .catch(error => {
                console.error('Failed to record stock movement (stock itself was already updated):', error);
            });
    }

    /**
     * Fetches warehouse stock records for a specific warehouse.
     * @param {number|string} warehouseId
     */
    function fetchWarehouseStock(warehouseId) {
        productApi.getWarehouseStock(warehouseId)
            .then(response => {
                warehouseStock.value = WarehouseStockAssembler.toEntitiesFromResponse(response);
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Fetches every batch across all products, used to determine which
     * products have stock expiring soon (see getDaysToNearestExpiry).
     */
    function fetchBatches() {
        return productApi.getAllBatches()
            .then(response => {
                batches.value = response.data instanceof Array ? response.data : [];
                batchesLoaded.value = true;
            })
            .catch(error => {
                errors.value.push(error);
                batchesLoaded.value = true;
            });
    }

    /**
     * Returns the number of days until the nearest active batch of a product expires.
     * Business rule: only ACTIVE batches are considered; when a product has several,
     * the soonest expiration date wins. Negative values mean the batch already expired.
     *
     * @param {number|string} productId
     * @returns {number|null} Days to the nearest expiration, or null if the product
     *   has no active batch with an expiration date.
     */
    function getDaysToNearestExpiry(productId) {
        const numericId = parseInt(productId);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeExpirations = batches.value
            .filter(batch => batch.productId === numericId && batch.status === 'ACTIVE' && batch.expiration)
            .map(batch => {
                const expirationDate = parseLocalDate(batch.expiration);
                return Math.round((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            });

        return activeExpirations.length > 0 ? Math.min(...activeExpirations) : null;
    }

    /**
     * Returns true when a product has an active batch expiring within the given
     * threshold (default 7 days, matching the Alerts bounded context's EXPIRATION
     * rule) but NOT already expired — see isProductExpired for that case.
     *
     * @param {number|string} productId
     * @param {number} [thresholdDays=7]
     * @returns {boolean}
     */
    function isProductExpiringSoon(productId, thresholdDays = 7) {
        const daysToExpiry = getDaysToNearestExpiry(productId);
        return daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= thresholdDays;
    }

    /**
     * Returns true when a product's nearest active batch has already passed
     * its expiration date (negative days to expiry). Kept distinct from
     * isProductExpiringSoon so the UI can tell "will expire soon" apart from
     * "already expired" instead of collapsing both into one bucket.
     *
     * @param {number|string} productId
     * @returns {boolean}
     */
    function isProductExpired(productId) {
        const daysToExpiry = getDaysToNearestExpiry(productId);
        return daysToExpiry !== null && daysToExpiry < 0;
    }

    /**
     * Fetches warehouses for a business and returns them as a plain array.
     * Warehouses are not kept in store state because warehouse management
     * belongs to a separate bounded context.
     * @param {number|string} businessId
     * @returns {Promise<Array>}
     */
    function fetchWarehousesForBusiness(businessId) {
        return productApi.getWarehouses(businessId)
            .then(response => response.data instanceof Array ? response.data : [])
            .catch(error => {
                errors.value.push(error);
                return [];
            });
    }

    /**
     * Creates a new warehouse for a business.
     * Not kept in this store's own state, matching fetchWarehousesForBusiness
     * above — the caller (Inventario's Almacén tab) manages its own local list.
     * @param {Object} resource
     * @returns {Promise<Object>} The created warehouse.
     */
    function createWarehouse(resource) {
        return productApi.createWarehouse(resource)
            .then(response => response.data)
            .catch(error => {
                errors.value.push(error);
                throw error;
            });
    }

    /**
     * Fetches suppliers for a business and returns them as a plain array.
     * @param {number|string} businessId
     * @returns {Promise<Array>}
     */
    function fetchSuppliersForBusiness(businessId) {
        return productApi.getSuppliers(businessId)
            .then(response => response.data instanceof Array ? response.data : [])
            .catch(error => {
                errors.value.push(error);
                return [];
            });
    }

    /**
     * Creates a new product and appends it to local state.
     * @param {import('../domain/model/product.entity.js').Product} product
     * @returns {Promise<import('../domain/model/product.entity.js').Product>}
     */
    function addProduct(product) {
        return productApi.createProduct(product)
            .then(response => {
                const createdProduct = ProductAssembler.toEntityFromResource(response.data);
                products.value.push(createdProduct);
                return createdProduct;
            })
            .catch(error => {
                errors.value.push(error);
                throw error;
            });
    }

    /**
     * Updates an existing product and synchronizes local state.
     * @param {import('../domain/model/product.entity.js').Product} product - Must include id.
     * @returns {Promise<import('../domain/model/product.entity.js').Product>}
     */
    function updateProduct(product) {
        return productApi.updateProduct(product.id, product)
            .then(response => {
                const updatedProduct = ProductAssembler.toEntityFromResource(response.data);
                const index = products.value.findIndex(existingProduct => existingProduct.id === updatedProduct.id);
                if (index !== -1) products.value[index] = updatedProduct;
                return updatedProduct;
            })
            .catch(error => {
                errors.value.push(error);
                throw error;
            });
    }

    /**
     * Deletes a product and removes it from local state.
     *
     * Business rule: deletion is blocked when the product has an inventory record
     * with currentStock > 0. An error is pushed and no API call is made.
     *
     * @param {number|string} id
     * @returns {Promise<void>}
     */
    function deleteProduct(id) {
        const numericId     = parseInt(id);
        const inventoryItem = inventory.value.find(item => item.productId === numericId);

        if (inventoryItem && inventoryItem.currentStock > 0) {
            const error = new Error(`Cannot delete product #${numericId}: it has ${inventoryItem.currentStock} units in stock.`);
            errors.value.push(error);
            return Promise.reject(error);
        }

        return productApi.deleteProduct(numericId)
            .then(() => {
                const productIndex = products.value.findIndex(product => product.id === numericId);
                if (productIndex !== -1) products.value.splice(productIndex, 1);

                const inventoryIndex = inventory.value.findIndex(item => item.productId === numericId);
                if (inventoryIndex !== -1) inventory.value.splice(inventoryIndex, 1);
            })
            .catch(error => {
                errors.value.push(error);
                throw error;
            });
    }

    /**
     * Registers a stock intake for a product by updating (or creating) its inventory record.
     *
     * Business rules:
     * - Topping up an existing record requires a positive quantity (zero/negative rejected)
     *   — an intake of nothing isn't a real movement.
     * - Creating a new record accepts quantity >= 0: a product can be registered in the
     *   catalog with no stock yet (e.g. only a minimumStock threshold set), still
     *   getting an InventoryItem to persist minimumStock against. Negative is rejected.
     * - If an inventory record exists → increment currentStock via PUT.
     * - If no inventory record exists → create a new one via POST.
     *
     * @param {Object} resource
     * @param {number} resource.productId
     * @param {number} resource.businessId
     * @param {number} resource.quantity   - Must be > 0 to top up; >= 0 to create.
     * @param {number} [resource.warehouseId]
     * @param {number} [resource.minimumStock] - Only applied when creating a new
     *   inventory record; ignored (existing value preserved) on top-up.
     * @returns {Promise<import('../domain/model/inventory-item.entity.js').InventoryItem>}
     */
    function registerStockIntake(resource) {
        if (resource.quantity == null || resource.quantity < 0) {
            const error = new Error('Stock intake quantity must be zero or a positive integer.');
            errors.value.push(error);
            return Promise.reject(error);
        }

        const existingItem = inventory.value.find(item => item.productId === parseInt(resource.productId));

        if (existingItem) {
            if (resource.quantity <= 0) {
                const error = new Error('Stock intake quantity must be a positive integer greater than zero.');
                errors.value.push(error);
                return Promise.reject(error);
            }
            const updatedResource = {
                id:           existingItem.id,
                productId:    existingItem.productId,
                businessId:   existingItem.businessId,
                // Respects a warehouse explicitly chosen on this intake (e.g. the admin
                // is moving the product to a different warehouse) — previously this
                // always kept the product's existing warehouse no matter what was
                // selected on the intake form, silently ignoring the choice.
                warehouseId:  resource.warehouseId ?? existingItem.warehouseId,
                minimumStock: existingItem.minimumStock,
                stockUnit:    existingItem.currentStock + resource.quantity
            };
            return productApi.updateInventory(existingItem.id, updatedResource)
                .then(response => {
                    const updatedItem = InventoryItemAssembler.toEntityFromResource(response.data);
                    const index = inventory.value.findIndex(item => item.id === updatedItem.id);
                    if (index !== -1) inventory.value[index] = updatedItem;
                    recordStockMovement({
                        productId:    updatedItem.productId,
                        businessId:   updatedItem.businessId,
                        warehouseId:  updatedItem.warehouseId,
                        type:         MovementType.INTAKE,
                        quantity:     resource.quantity,
                        supplier:     resource.supplier ?? '',
                        note:         resource.note ?? '',
                        registeredAt: new Date().toISOString()
                    });
                    return updatedItem;
                })
                .catch(error => {
                    errors.value.push(error);
                    throw error;
                });
        }

        const newResource = {
            productId:    parseInt(resource.productId),
            businessId:   parseInt(resource.businessId),
            warehouseId:  resource.warehouseId ? parseInt(resource.warehouseId) : null,
            stockUnit:    resource.quantity,
            minimumStock: resource.minimumStock != null ? parseInt(resource.minimumStock) || 0 : 0
        };
        return productApi.createInventory(newResource)
            .then(response => {
                const createdItem = InventoryItemAssembler.toEntityFromResource(response.data);
                inventory.value.push(createdItem);
                if (resource.quantity > 0) {
                    recordStockMovement({
                        productId:    createdItem.productId,
                        businessId:   createdItem.businessId,
                        warehouseId:  createdItem.warehouseId,
                        type:         MovementType.INTAKE,
                        quantity:     resource.quantity,
                        supplier:     resource.supplier ?? '',
                        note:         resource.note ?? '',
                        registeredAt: new Date().toISOString()
                    });
                }
                return createdItem;
            })
            .catch(error => {
                errors.value.push(error);
                throw error;
            });
    }

    /**
     * Updates the minimum stock threshold on a product's existing inventory record.
     *
     * Business rule: minimumStock must be a non-negative integer. A product with
     * no inventory record yet (never had a stock intake) has nowhere to persist
     * this value, so the call resolves without effect — an intake must happen first.
     *
     * @param {number|string} productId
     * @param {number} minimumStock
     * @returns {Promise<import('../domain/model/inventory-item.entity.js').InventoryItem|void>}
     */
    function updateMinimumStock(productId, minimumStock) {
        if (minimumStock == null || Number.isNaN(minimumStock) || minimumStock < 0) {
            const error = new Error('Minimum stock must be a non-negative integer.');
            errors.value.push(error);
            return Promise.reject(error);
        }

        const existingItem = inventory.value.find(item => item.productId === parseInt(productId));
        if (!existingItem) return Promise.resolve();

        const updatedResource = {
            id:           existingItem.id,
            productId:    existingItem.productId,
            businessId:   existingItem.businessId,
            warehouseId:  existingItem.warehouseId,
            stockUnit:    existingItem.currentStock,
            minimumStock: parseInt(minimumStock)
        };
        return productApi.updateInventory(existingItem.id, updatedResource)
            .then(response => {
                const updatedItem = InventoryItemAssembler.toEntityFromResource(response.data);
                const index = inventory.value.findIndex(item => item.id === updatedItem.id);
                if (index !== -1) inventory.value[index] = updatedItem;
                return updatedItem;
            })
            .catch(error => {
                errors.value.push(error);
                throw error;
            });
    }

    /**
     * Registers or updates a product's batch (used to track its expiration —
     * see isProductExpiringSoon / getDaysToNearestExpiry).
     *
     * Business rule: this app's product form only captures a single expiration
     * date per product (no batch selector UI), so if the product already has
     * an active batch it is updated in place instead of creating another one —
     * otherwise re-editing a product would pile up batches and the "nearest
     * expiration" query would keep surfacing the oldest one instead of the
     * date the user just entered.
     *
     * @param {Object} resource
     * @param {number} resource.productId
     * @param {string} resource.expiration - ISO date string (yyyy-mm-dd).
     * @param {number} [resource.purchasePrice=0]
     * @param {number|null} [resource.inventoryId=null]
     * @returns {Promise<void>}
     */
    function createBatchForProduct(resource) {
        const productId = parseInt(resource.productId);
        const existingBatch = batches.value.find(batch => batch.productId === productId && batch.status === 'ACTIVE');

        const batchResource = {
            productId,
            expiration:    resource.expiration,
            purchasePrice: resource.purchasePrice || 0,
            status:        'ACTIVE',
            inventoryId:   resource.inventoryId ?? existingBatch?.inventoryId ?? null
        };

        const savePromise = existingBatch
            ? productApi.updateBatch(existingBatch.id, { ...batchResource, id: existingBatch.id })
            : productApi.createBatch(batchResource);

        return savePromise
            .then(response => {
                if (existingBatch) {
                    const index = batches.value.findIndex(batch => batch.id === existingBatch.id);
                    if (index !== -1) batches.value[index] = response.data;
                } else {
                    batches.value.push(response.data);
                }
            })
            .catch(error => {
                errors.value.push(error);
                throw error;
            });
    }

    /**
     * Decrements a product's inventory after a confirmed sale.
     *
     * Business rules:
     * - quantity must be a positive integer greater than zero.
     * - Requires an existing inventory record (a sale cannot happen for a
     *   product that was never stocked); errors otherwise.
     * - Resulting stock is clamped at 0 to avoid negative inventory.
     *
     * @param {Object} resource
     * @param {number} resource.productId
     * @param {number} resource.quantity - Units sold. Must be > 0.
     * @returns {Promise<import('../domain/model/inventory-item.entity.js').InventoryItem>}
     */
    function registerStockSale(resource) {
        if (!resource.quantity || resource.quantity <= 0) {
            const error = new Error('Sale stock deduction quantity must be a positive integer greater than zero.');
            errors.value.push(error);
            return Promise.reject(error);
        }

        const existingItem = inventory.value.find(item => item.productId === parseInt(resource.productId));
        if (!existingItem) {
            const error = new Error(`Cannot deduct stock for product #${resource.productId}: no inventory record found.`);
            errors.value.push(error);
            return Promise.reject(error);
        }

        const updatedResource = {
            id:           existingItem.id,
            productId:    existingItem.productId,
            businessId:   existingItem.businessId,
            warehouseId:  existingItem.warehouseId,
            minimumStock: existingItem.minimumStock,
            stockUnit:    Math.max(0, existingItem.currentStock - resource.quantity)
        };
        return productApi.updateInventory(existingItem.id, updatedResource)
            .then(response => {
                const updatedItem = InventoryItemAssembler.toEntityFromResource(response.data);
                const index = inventory.value.findIndex(item => item.id === updatedItem.id);
                if (index !== -1) inventory.value[index] = updatedItem;
                recordStockMovement({
                    productId:    updatedItem.productId,
                    businessId:   updatedItem.businessId,
                    warehouseId:  updatedItem.warehouseId,
                    type:         MovementType.SALE,
                    quantity:     resource.quantity,
                    registeredAt: new Date().toISOString()
                });
                return updatedItem;
            })
            .catch(error => {
                errors.value.push(error);
                throw error;
            });
    }

    return {
        products,
        inventory,
        stockMovements,
        warehouseStock,
        batches,
        productsLoaded,
        inventoryLoaded,
        batchesLoaded,
        stockMovementsLoaded,
        errors,
        productsCount,
        stockStatusCounts,
        getProductById,
        getInventoryByProduct,
        getDaysToNearestExpiry,
        isProductExpiringSoon,
        isProductExpired,
        fetchProducts,
        fetchInventory,
        fetchBatches,
        fetchStockMovements,
        fetchAllStockMovements,
        fetchWarehouseStock,
        fetchWarehousesForBusiness,
        createWarehouse,
        fetchSuppliersForBusiness,
        addProduct,
        updateProduct,
        deleteProduct,
        registerStockIntake,
        updateMinimumStock,
        createBatchForProduct,
        registerStockSale
    };
});

export default useProductStore;