import { BaseApi }      from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const metricsEndpointPath = import.meta.env.VITE_METRICS_ENDPOINT_PATH;

/**
 * Infrastructure gateway for the Dashboard & Analytics bounded-context endpoints.
 * Provides access to business metrics snapshots and generated reports.
 *
 * Note: The mock API (json-server) does not expose a dedicated /reports endpoint.
 * Report generation and export are simulated client-side using metrics and sales data.
 *
 * @class DashboardApi
 * @extends BaseApi
 */
export class DashboardApi extends BaseApi {
    /**
     * Endpoint client for the /metrics resource.
     * @type {BaseEndpoint}
     * @private
     */
    #metricsEndpoint;

    /**
     * Initializes the metrics endpoint client.
     */
    constructor() {
        super();
        this.#metricsEndpoint = new BaseEndpoint(this, metricsEndpointPath);
    }

    /**
     * Fetches all metrics snapshots for a given business.
     *
     * @param {number|string} businessId - The identifier of the business.
     * @returns {Promise<import('axios').AxiosResponse>} Promise resolving to the metrics response.
     */
    getDashboardMetrics(businessId) {
        return this.#metricsEndpoint.getAllByParam('businessId', businessId);
    }

    /**
     * Fetches a single metrics snapshot by its identifier.
     *
     * @param {number|string} id - The metrics snapshot identifier.
     * @returns {Promise<import('axios').AxiosResponse>} Promise resolving to the metrics response.
     */
    getMetricsById(id) {
        return this.#metricsEndpoint.getById(id);
    }

    /**
     * Persists an updated metrics snapshot (PUT).
     * Used to simulate a "refresh" by overwriting the existing snapshot.
     *
     * @param {Object} resource - Updated metrics resource payload (must include id).
     * @returns {Promise<import('axios').AxiosResponse>} Promise resolving to the updated resource.
     */
    updateMetrics(resource) {
        return this.#metricsEndpoint.update(resource.id, resource);
    }
}