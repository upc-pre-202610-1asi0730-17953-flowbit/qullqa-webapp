import { BaseApi }      from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const alertsEndpointPath = import.meta.env.VITE_ALERTS_ENDPOINT_PATH;

/**
 * Infrastructure gateway for the Alerts & Operational Monitoring bounded-context endpoints.
 *
 * Supports fetching, resolving, and filtering alerts scoped to a business.
 * Alert rules are managed client-side derived from inventory data because the
 * mock API does not expose a dedicated /alertRules endpoint.
 *
 * @class AlertsApi
 * @extends BaseApi
 */
export class AlertsApi extends BaseApi {
    /** @type {BaseEndpoint} @private */
    #alertsEndpoint;

    constructor() {
        super();
        this.#alertsEndpoint = new BaseEndpoint(this, alertsEndpointPath);
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
     * Fetches a single alert by its identifier.
     * @param {number|string} id
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getAlertById(id) {
        return this.#alertsEndpoint.getById(id);
    }

    /**
     * Resolves an alert by patching its status to RESOLVED.
     * Business rule: only ACTIVE or SENT alerts may be resolved.
     * @param {number|string} id - Alert identifier.
     * @param {Object} resource  - Full alert resource with updated status field.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    resolveAlert(id, resource) {
        return this.#alertsEndpoint.update(id, resource);
    }
}