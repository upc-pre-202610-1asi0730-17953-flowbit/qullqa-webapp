import { BaseApi }      from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const metricsEndpointPath   = import.meta.env.VITE_METRICS_ENDPOINT_PATH;
const alertsEndpointPath    = import.meta.env.VITE_ALERTS_ENDPOINT_PATH;
const salesEndpointPath     = import.meta.env.VITE_SALES_ENDPOINT_PATH;
const saleDetailsEndpointPath = import.meta.env.VITE_SALE_DETAILS_ENDPOINT_PATH;
const productsEndpointPath  = import.meta.env.VITE_PRODUCTS_ENDPOINT_PATH;

/**
 * Infrastructure gateway for the Dashboard & Analytics bounded-context endpoints.
 * Reads metrics snapshots, alerts, sales and products to populate dashboard views.
 *
 * @class DashboardApi
 * @extends BaseApi
 */
export class DashboardApi extends BaseApi {
    /** @type {BaseEndpoint} @private */
    #metricsEndpoint;
    /** @type {BaseEndpoint} @private */
    #alertsEndpoint;
    /** @type {BaseEndpoint} @private */
    #salesEndpoint;
    /** @type {BaseEndpoint} @private */
    #saleDetailsEndpoint;
    /** @type {BaseEndpoint} @private */
    #productsEndpoint;

    constructor() {
        super();
        this.#metricsEndpoint    = new BaseEndpoint(this, metricsEndpointPath);
        this.#alertsEndpoint     = new BaseEndpoint(this, alertsEndpointPath);
        this.#salesEndpoint      = new BaseEndpoint(this, salesEndpointPath);
        this.#saleDetailsEndpoint = new BaseEndpoint(this, saleDetailsEndpointPath);
        this.#productsEndpoint   = new BaseEndpoint(this, productsEndpointPath);
    }

    /**
     * Fetches the metrics snapshot for a given business.
     * @param {number|string} businessId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getDashboardMetrics(businessId) {
        return this.#metricsEndpoint.getAllByParam('businessId', businessId);
    }

    /**
     * Updates a metrics snapshot (used to simulate refresh).
     * @param {Object} resource - Must include id.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    updateMetrics(resource) {
        return this.#metricsEndpoint.update(resource.id, resource);
    }

    /**
     * Fetches all alerts for a given business.
     * @param {number|string} businessId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getAlerts(businessId) {
        return this.#alertsEndpoint.getAllByParam('businessId', businessId);
    }

    /**
     * Fetches all sales for a given business.
     * @param {number|string} businessId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getSales(businessId) {
        return this.#salesEndpoint.getAllByParam('businessId', businessId);
    }

    /**
     * Fetches all sale detail lines.
     * Used to compute top products by quantity and revenue.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getSaleDetails() {
        return this.#saleDetailsEndpoint.getAll();
    }

    /**
     * Fetches all products for a given business.
     * @param {number|string} businessId
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getProducts(businessId) {
        return this.#productsEndpoint.getAllByParam('businessId', businessId);
    }
}