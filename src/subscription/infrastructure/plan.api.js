import { BaseApi }      from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const plansEndpointPath = import.meta.env.VITE_PLANS_ENDPOINT_PATH;

/**
 * Infrastructure gateway for the Subscription & Plan Management bounded context.
 * Plans are a shared catalog (not scoped by businessId); the active plan for
 * a given business is tracked on the Business resource itself (planId), owned
 * by the IAM bounded context.
 *
 * @class PlanApi
 * @extends BaseApi
 */
export class PlanApi extends BaseApi {
    /** @type {BaseEndpoint} @private */
    #plansEndpoint;

    constructor() {
        super();
        this.#plansEndpoint = new BaseEndpoint(this, plansEndpointPath);
    }

    /**
     * Fetches the full plan catalog.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getPlans() {
        return this.#plansEndpoint.getAll();
    }
}
