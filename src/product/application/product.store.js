/**
 * Application service store for the Product & Inventory Management bounded context.
 *
 * Business rules enforced here:
 * - fetchProducts and fetchInventory load data scoped to the authenticated business.
 * - A product cannot be deleted when its inventory record has currentStock > 0.
 * - registerStockIntake quantity must be a positive integer greater than zero.
 * - On intake, if an inventory record exists it is updated (PUT); otherwise created (POST).
 * - stockMovements are derived client-side from batches (INTAKE) because the mock API
 *   has no dedicated /stockMovements endpoint.
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

const useProductStore = defineStore('product', () => {

    /** @type {import('vue').Ref<import('../domain/model/product.entity.js').Product[]>} */
    const products = ref([]);

    /** @type {import('vue').Ref<import('../domain/model/inventory-item.entity.js').InventoryItem[]>} */
    const inventory = ref([]);

    /** @type {import('vue').Ref<import('../domain/model/stock-movement.entity.js').StockMovement[]>} */
    const stockMovements = ref([]);

    /** @type {import('vue').Ref<import('../domain/model/warehouse-stock.entity.js').WarehouseStock[]>} */
    const warehouseStock = ref([]);

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
        productApi.getProducts(businessId)
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
        productApi.getInventory(businessId)
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
     */
    function addProduct(product) {
        productApi.createProduct(product)
            .then(response => {
                products.value.push(ProductAssembler.toEntityFromResource(response.data));
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Updates an existing product and synchronizes local state.
     * @param {import('../domain/model/product.entity.js').Product} product - Must include id.
     */
    function updateProduct(product) {
        productApi.updateProduct(product.id, product)
            .then(response => {
                const updatedProduct = ProductAssembler.toEntityFromResource(response.data);
                const index = products.value.findIndex(existingProduct => existingProduct.id === updatedProduct.id);
                if (index !== -1) products.value[index] = updatedProduct;
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Deletes a product and removes it from local state.
     *
     * Business rule: deletion is blocked when the product has an inventory record
     * with currentStock > 0. An error is pushed and no API call is made.
     *
     * @param {number|string} id
     */
    function deleteProduct(id) {
        const numericId     = parseInt(id);
        const inventoryItem = inventory.value.find(item => item.productId === numericId);

        if (inventoryItem && inventoryItem.currentStock > 0) {
            errors.value.push(
                new Error(`Cannot delete product #${numericId}: it has ${inventoryItem.currentStock} units in stock.`)
            );
            return;
        }

        productApi.deleteProduct(numericId)
            .then(() => {
                const productIndex = products.value.findIndex(product => product.id === numericId);
                if (productIndex !== -1) products.value.splice(productIndex, 1);

                const inventoryIndex = inventory.value.findIndex(item => item.productId === numericId);
                if (inventoryIndex !== -1) inventory.value.splice(inventoryIndex, 1);
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Registers a stock intake for a product by updating (or creating) its inventory record.
     *
     * Business rules:
     * - quantity must be a positive integer; zero or negative values are rejected.
     * - If an inventory record exists → increment currentStock via PUT.
     * - If no inventory record exists → create a new one via POST.
     *
     * @param {Object} resource
     * @param {number} resource.productId
     * @param {number} resource.businessId
     * @param {number} resource.quantity   - Must be > 0.
     * @param {number} [resource.warehouseId]
     */
    function registerStockIntake(resource) {
        if (!resource.quantity || resource.quantity <= 0) {
            errors.value.push(new Error('Stock intake quantity must be a positive integer greater than zero.'));
            return;
        }

        const existingItem = inventory.value.find(item => item.productId === parseInt(resource.productId));

        if (existingItem) {
            const updatedResource = {
                ...existingItem,
                stockUnit: existingItem.currentStock + resource.quantity
            };
            productApi.updateInventory(existingItem.id, updatedResource)
                .then(response => {
                    const updatedItem = InventoryItemAssembler.toEntityFromResource(response.data);
                    const index = inventory.value.findIndex(item => item.id === updatedItem.id);
                    if (index !== -1) inventory.value[index] = updatedItem;
                })
                .catch(error => errors.value.push(error));
        } else {
            const newResource = {
                productId:    parseInt(resource.productId),
                businessId:   parseInt(resource.businessId),
                warehouseId:  resource.warehouseId ? parseInt(resource.warehouseId) : null,
                stockUnit:    resource.quantity,
                minimumStock: 0
            };
            productApi.createInventory(newResource)
                .then(response => {
                    inventory.value.push(InventoryItemAssembler.toEntityFromResource(response.data));
                })
                .catch(error => errors.value.push(error));
        }
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
     */
    function registerStockSale(resource) {
        if (!resource.quantity || resource.quantity <= 0) {
            errors.value.push(new Error('Sale stock deduction quantity must be a positive integer greater than zero.'));
            return;
        }

        const existingItem = inventory.value.find(item => item.productId === parseInt(resource.productId));
        if (!existingItem) {
            errors.value.push(new Error(`Cannot deduct stock for product #${resource.productId}: no inventory record found.`));
            return;
        }

        const updatedResource = {
            ...existingItem,
            stockUnit: Math.max(0, existingItem.currentStock - resource.quantity)
        };
        productApi.updateInventory(existingItem.id, updatedResource)
            .then(response => {
                const updatedItem = InventoryItemAssembler.toEntityFromResource(response.data);
                const index = inventory.value.findIndex(item => item.id === updatedItem.id);
                if (index !== -1) inventory.value[index] = updatedItem;
            })
            .catch(error => errors.value.push(error));
    }

    return {
        products,
        inventory,
        stockMovements,
        warehouseStock,
        productsLoaded,
        inventoryLoaded,
        errors,
        productsCount,
        stockStatusCounts,
        getProductById,
        getInventoryByProduct,
        fetchProducts,
        fetchInventory,
        fetchStockMovements,
        fetchWarehouseStock,
        fetchWarehousesForBusiness,
        fetchSuppliersForBusiness,
        addProduct,
        updateProduct,
        deleteProduct,
        registerStockIntake,
        registerStockSale
    };
});

export default useProductStore;