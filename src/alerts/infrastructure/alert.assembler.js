import { Alert } from '../domain/model/alert.entity.js';

/**
 * Maps raw API resources into Alert domain entities.
 *
 * @class AlertAssembler
 */
export class AlertAssembler {
    /**
     * Converts a single API resource object into an Alert entity.
     *
     * @param {Object} resource - Raw resource object from the API response.
     * @returns {Alert} The corresponding domain entity.
     */
    static toEntityFromResource(resource) {
        return new Alert({ ...resource });
    }

    /**
     * Converts an Axios response containing a collection of alert resources
     * into an array of Alert entities.
     * Logs an error and returns an empty array when the response status is not 200.
     *
     * @param {import('axios').AxiosResponse} response - HTTP response with alert resources.
     * @returns {Alert[]} Array of Alert entities.
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`AlertAssembler error — status: ${response.status}, message: ${response.statusText}`);
            return [];
        }
        const resources = response.data instanceof Array
            ? response.data
            : response.data['alerts'];
        return resources.map(resource => this.toEntityFromResource(resource));
    }
}