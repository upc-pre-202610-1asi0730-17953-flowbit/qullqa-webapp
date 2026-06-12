import { BaseApi }      from '../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../shared/infrastructure/base-endpoint.js';

const deliveriesEndpointPath = import.meta.env.VITE_DELIVERIES_ENDPOINT_PATH;
const waypointsEndpointPath  = import.meta.env.VITE_WAYPOINTS_ENDPOINT_PATH;

/**
 * Infrastructure gateway for the Delivery Tracking bounded-context endpoints.
 *
 * Responsibilities:
 * - Wraps all HTTP calls for Deliveries and Waypoints.
 * - Delegates CRUD to BaseEndpoint instances; one per resource path.
 * - Status transitions (e.g. IN_TRANSIT → COMPLETED) are performed via PUT
 *   since the mock API does not support dedicated action endpoints.
 *
 * @class DeliveryApi
 * @extends BaseApi
 */
export class DeliveryApi extends BaseApi {
    /** @type {BaseEndpoint} @private */
    #deliveriesEndpoint;

    /** @type {BaseEndpoint} @private */
    #waypointsEndpoint;

    /**
     * Creates endpoint clients for deliveries and waypoints.
     */
    constructor() {
        super();
        this.#deliveriesEndpoint = new BaseEndpoint(this, deliveriesEndpointPath);
        this.#waypointsEndpoint  = new BaseEndpoint(this, waypointsEndpointPath);
    }

    // ─── Deliveries ───────────────────────────────────────────────────────────

    /**
     * Fetches all deliveries for a given business.
     * @param {number|string} businessId - Business identifier.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getDeliveries(businessId) {
        return this.#deliveriesEndpoint.getAllByParam('businessId', businessId);
    }

    /**
     * Fetches a single delivery by its identifier.
     * @param {number|string} id - Delivery identifier.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getDeliveryById(id) {
        return this.#deliveriesEndpoint.getById(id);
    }

    /**
     * Creates a new delivery resource.
     * @param {Object} resource - Delivery resource payload.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    createDelivery(resource) {
        return this.#deliveriesEndpoint.create(resource);
    }

    /**
     * Updates an existing delivery resource by its identifier.
     * Used to transition status and update current location.
     * @param {number|string} id       - Delivery identifier.
     * @param {Object}        resource - Updated delivery resource payload.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    updateDelivery(id, resource) {
        return this.#deliveriesEndpoint.update(id, resource);
    }

    // ─── Waypoints ────────────────────────────────────────────────────────────

    /**
     * Fetches all waypoints for a specific delivery.
     * @param {number|string} deliveryId - Delivery identifier.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    getWaypointsByDelivery(deliveryId) {
        return this.#waypointsEndpoint.getAllByParam('deliveryId', deliveryId);
    }

    /**
     * Creates a new waypoint resource linked to a delivery.
     * @param {Object} resource - Waypoint resource payload.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    createWaypoint(resource) {
        return this.#waypointsEndpoint.create(resource);
    }

    /**
     * Updates an existing waypoint resource (e.g., marking it as reached).
     * @param {number|string} id       - Waypoint identifier.
     * @param {Object}        resource - Updated waypoint resource payload.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    updateWaypoint(id, resource) {
        return this.#waypointsEndpoint.update(id, resource);
    }
}
