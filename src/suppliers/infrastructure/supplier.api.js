import { BaseApi }      from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const suppliersEndpointPath      = import.meta.env.VITE_SUPPLIERS_ENDPOINT_PATH;
const purchasesEndpointPath      = import.meta.env.VITE_PURCHASES_ENDPOINT_PATH;
const purchaseDetailsEndpointPath = import.meta.env.VITE_PURCHASE_DETAILS_ENDPOINT_PATH;

/**
 * Infrastructure gateway for the Supplier & Replenishment Management bounded-context endpoints.
 *
 * Exposes CRUD operations for:
 *  - Suppliers      → /suppliers
 *  - Purchases      → /purchases  (purchase orders)
 *  - PurchaseDetails → /purchaseDetails (order line items)
 *
 * @class SupplierApi
 * @extends BaseApi
 */
export class SupplierApi extends BaseApi {
    /** @type {BaseEndpoint} @private */
    #suppliersEndpoint;
    /** @type {BaseEndpoint} @private */
    #purchasesEndpoint;
    /** @type {BaseEndpoint} @private */
    #purchaseDetailsEndpoint;

    constructor() {
        super();
        this.#suppliersEndpoint       = new BaseEndpoint(this, suppliersEndpointPath);
        this.#purchasesEndpoint        = new BaseEndpoint(this, purchasesEndpointPath);
        this.#purchaseDetailsEndpoint  = new BaseEndpoint(this, purchaseDetailsEndpointPath);
    }

    // ─── Supplier operations ──────────────────────────────────────────────────

    /**
     * Fetches all suppliers for a given business.
     * @param {number|string} businessId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getSuppliers(businessId) {
        return this.#suppliersEndpoint.getAllByParam('businessId', businessId);
    }

    /**
     * Fetches a single supplier by its identifier.
     * @param {number|string} id
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getSupplierById(id) {
        return this.#suppliersEndpoint.getById(id);
    }

    /**
     * Creates a new supplier resource.
     * @param {Object} resource
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    createSupplier(resource) {
        return this.#suppliersEndpoint.create(resource);
    }

    /**
     * Updates an existing supplier resource.
     * @param {number|string} id
     * @param {Object} resource
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    updateSupplier(id, resource) {
        return this.#suppliersEndpoint.update(id, resource);
    }

    /**
     * Deactivates a supplier by setting its status to INACTIVE.
     * Business rule: suppliers with active pending orders cannot be deleted;
     * the store layer must verify this before calling this method.
     * @param {number|string} id
     * @param {Object} resource - Full updated resource with status: 'INACTIVE'.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    deactivateSupplier(id, resource) {
        return this.#suppliersEndpoint.update(id, resource);
    }

    // ─── Purchase order operations ────────────────────────────────────────────

    /**
     * Fetches all purchase orders for a given business.
     * @param {number|string} businessId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getPurchaseOrders(businessId) {
        return this.#purchasesEndpoint.getAllByParam('businessId', businessId);
    }

    /**
     * Fetches all purchase orders for a specific supplier.
     * @param {number|string} supplierId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getPurchaseOrdersBySupplier(supplierId) {
        return this.#purchasesEndpoint.getAllByParam('supplierId', supplierId);
    }

    /**
     * Fetches a single purchase order by its identifier.
     * @param {number|string} id
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getPurchaseOrderById(id) {
        return this.#purchasesEndpoint.getById(id);
    }

    /**
     * Creates a new purchase order resource.
     * @param {Object} resource
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    createPurchaseOrder(resource) {
        return this.#purchasesEndpoint.create(resource);
    }

    /**
     * Updates an existing purchase order (e.g. changing its status).
     * @param {number|string} id
     * @param {Object} resource
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    updatePurchaseOrder(id, resource) {
        return this.#purchasesEndpoint.update(id, resource);
    }

    // ─── Purchase detail operations ───────────────────────────────────────────

    /**
     * Fetches all detail lines for a specific purchase order.
     * @param {number|string} purchaseId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getPurchaseDetailsByOrder(purchaseId) {
        return this.#purchaseDetailsEndpoint.getAllByParam('purchaseId', purchaseId);
    }

    /**
     * Creates a new purchase order detail line.
     * @param {Object} resource
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    createPurchaseDetail(resource) {
        return this.#purchaseDetailsEndpoint.create(resource);
    }
}
