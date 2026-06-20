import { Delivery } from '../domain/model/delivery.entity.js';

/**
 * Maps raw API resources into Delivery domain entities.
 *
 * @class DeliveryAssembler
 */
export class DeliveryAssembler {
    /**
     * Converts a single raw resource object into a Delivery entity.
     * Waypoints embedded in the resource (as an array) will be hydrated automatically
     * by the Delivery constructor.
     *
     * @param {Object} resource - Raw delivery resource from the API.
     * @returns {Delivery} Hydrated Delivery entity.
     */
    static toEntityFromResource(resource) {
        return new Delivery({ ...resource });
    }

    /**
     * Converts an Axios response containing an array of delivery resources
     * into an array of Delivery entities.
     *
     * @param {import('axios').AxiosResponse<Array<Object>|Object>} response - HTTP response.
     * @returns {Delivery[]} Array of Delivery entities; empty array on error.
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`DeliveryAssembler error — status: ${response.status}, message: ${response.statusText}`);
            return [];
        }
        const resources = response.data instanceof Array ? response.data : response.data['deliveries'];
        return resources.map(resource => this.toEntityFromResource(resource));
    }
}
