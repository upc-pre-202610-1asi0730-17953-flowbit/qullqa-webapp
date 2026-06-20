import { Waypoint } from '../domain/model/waypoint.entity.js';

/**
 * Maps raw API resources into Waypoint domain entities.
 *
 * @class WaypointAssembler
 */
export class WaypointAssembler {
    /**
     * Converts a single raw resource object into a Waypoint entity.
     *
     * @param {Object} resource - Raw waypoint resource from the API.
     * @returns {Waypoint} Hydrated Waypoint entity.
     */
    static toEntityFromResource(resource) {
        return new Waypoint({ ...resource });
    }

    /**
     * Converts an Axios response containing an array of waypoint resources
     * into an array of Waypoint entities.
     *
     * @param {import('axios').AxiosResponse<Array<Object>|Object>} response - HTTP response.
     * @returns {Waypoint[]} Array of Waypoint entities; empty array on error.
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`WaypointAssembler error — status: ${response.status}, message: ${response.statusText}`);
            return [];
        }
        const resources = response.data instanceof Array ? response.data : response.data['waypoints'];
        return resources.map(resource => this.toEntityFromResource(resource));
    }
}
