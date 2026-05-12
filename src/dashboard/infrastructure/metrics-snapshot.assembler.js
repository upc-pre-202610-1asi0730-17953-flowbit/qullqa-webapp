import { MetricsSnapshot } from '../domain/model/metrics-snapshot.entity.js';

/**
 * Maps raw API resources into MetricsSnapshot domain entities and vice versa.
 *
 * @class MetricsAssembler
 */
export class MetricsAssembler {
    /**
     * Converts a single API resource object into a MetricsSnapshot entity.
     *
     * @param {Object} resource - Raw resource object from the API response.
     * @returns {MetricsSnapshot} The corresponding domain entity.
     */
    static toEntityFromResource(resource) {
        return new MetricsSnapshot({ ...resource });
    }

    /**
     * Converts an Axios response containing a collection of metric resources
     * into an array of MetricsSnapshot entities.
     * Logs an error and returns an empty array when the response status is not 200.
     *
     * @param {import('axios').AxiosResponse} response - HTTP response with metric resources.
     * @returns {MetricsSnapshot[]} Array of MetricsSnapshot entities.
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`MetricsAssembler error — status: ${response.status}, message: ${response.statusText}`);
            return [];
        }
        const resources = response.data instanceof Array
            ? response.data
            : response.data['metrics'];
        return resources.map(resource => this.toEntityFromResource(resource));
    }
}