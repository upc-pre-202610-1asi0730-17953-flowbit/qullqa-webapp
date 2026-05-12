import { BaseApi }      from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const productsEndpointPath    = import.meta.env.VITE_PRODUCTS_ENDPOINT_PATH;
const inventoriesEndpointPath = import.meta.env.VITE_INVENTORIES_ENDPOINT_PATH;
const batchesEndpointPath     = import.meta.env.VITE_BATCHES_ENDPOINT_PATH;
const warehousesEndpointPath  = import.meta.env.VITE_WAREHOUSES_ENDPOINT_PATH;
const suppliersEndpointPath   = import.meta.env.VITE_SUPPLIERS_ENDPOINT_PATH;

/**
 * Infrastructure gateway for the Product & Inventory Management bounded-context endpoints.
 *
 * Stock movements are derived client-side from batches (INTAKE) because the mock API
 * does not expose a dedicated /stockMovements endpoint.
 *
 * @class ProductApi
 * @extends BaseApi
 */
export class ProductApi extends BaseApi {
    /** @type {BaseEndpoint} @private */
    #productsEndpoint;
    /** @type {BaseEndpoint} @private */
    #inventoriesEndpoint;
    /** @type {BaseEndpoint} @private */
    #batchesEndpoint;
    /** @type {BaseEndpoint} @private */
    #warehousesEndpoint;
    /** @type {BaseEndpoint} @private */
    #suppliersEndpoint;

    constructor() {
        super();
        this.#productsEndpoint    = new BaseEndpoint(this, productsEndpointPath);
        this.#inventoriesEndpoint = new BaseEndpoint(this, inventoriesEndpointPath);
        this.#batchesEndpoint     = new BaseEndpoint(this, batchesEndpointPath);
        this.#warehousesEndpoint  = new BaseEndpoint(this, warehousesEndpointPath);
        this.#suppliersEndpoint   = new BaseEndpoint(this, suppliersEndpointPath);
    }

    /**
     * Fetches all products for a given business.
     * @param {number|string} businessId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getProducts(businessId) {
        return this.#productsEndpoint.getAllByParam('businessId', businessId);
    }

    /**
     * Fetches a single product by its identifier.
     * @param {number|string} id
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getProductById(id) {
        return this.#productsEndpoint.getById(id);
    }

    /**
     * Creates a new product resource.
     * @param {Object} resource
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    createProduct(resource) {
        return this.#productsEndpoint.create(resource);
    }

    /**
     * Updates an existing product resource.
     * @param {number|string} id
     * @param {Object} resource
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    updateProduct(id, resource) {
        return this.#productsEndpoint.update(id, resource);
    }

    /**
     * Deletes a product by its identifier.
     * Business rule: the store must verify no stock exists before calling this.
     * @param {number|string} id
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    deleteProduct(id) {
        return this.#productsEndpoint.delete(id);
    }

    /**
     * Fetches all inventory records for a given business.
     * @param {number|string} businessId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getInventory(businessId) {
        return this.#inventoriesEndpoint.getAllByParam('businessId', businessId);
    }

    /**
     * Fetches inventory records for a specific product.
     * @param {number|string} productId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getInventoryByProduct(productId) {
        return this.#inventoriesEndpoint.getAllByParam('productId', productId);
    }

    /**
     * Updates an existing inventory record.
     * Used to increase stock on intake registration.
     * @param {number|string} id
     * @param {Object} resource
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    updateInventory(id, resource) {
        return this.#inventoriesEndpoint.update(id, resource);
    }

    /**
     * Creates a new inventory record.
     * Used when a product has no prior inventory entry.
     * @param {Object} resource
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    createInventory(resource) {
        return this.#inventoriesEndpoint.create(resource);
    }

    /**
     * Fetches all batches for a specific product.
     * Batches are used to derive INTAKE stock movements client-side.
     * @param {number|string} productId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getBatchesByProduct(productId) {
        return this.#batchesEndpoint.getAllByParam('productId', productId);
    }

    /**
     * Fetches all warehouses for a given business.
     * @param {number|string} businessId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getWarehouses(businessId) {
        return this.#warehousesEndpoint.getAllByParam('businessId', businessId);
    }

    /**
     * Fetches all inventory records for a specific warehouse.
     * Used to populate the WarehouseStockView.
     * @param {number|string} warehouseId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getWarehouseStock(warehouseId) {
        return this.#inventoriesEndpoint.getAllByParam('warehouseId', warehouseId);
    }

    /**
     * Fetches all suppliers for a given business.
     * Used to populate the supplier dropdown in the stock intake form.
     * @param {number|string} businessId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getSuppliers(businessId) {
        return this.#suppliersEndpoint.getAllByParam('businessId', businessId);
    }
}