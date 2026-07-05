import { Plan } from '../domain/model/plan.entity.js';

/**
 * Maps raw /plans API resources into Plan domain entities.
 * @class PlanAssembler
 */
export class PlanAssembler {
    /**
     * @param {Object} resource - Raw plan resource from the API response.
     * @returns {Plan}
     */
    static toEntityFromResource(resource) {
        return new Plan({ ...resource });
    }

    /**
     * @param {import('axios').AxiosResponse} response
     * @returns {Plan[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`PlanAssembler error — status: ${response.status}, message: ${response.statusText}`);
            return [];
        }
        const resources = response.data instanceof Array ? response.data : response.data['plans'];
        return resources.map(resource => this.toEntityFromResource(resource));
    }
}
