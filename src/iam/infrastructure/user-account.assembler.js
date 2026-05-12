import { UserAccount } from '../domain/model/user-account.entity.js';

/**
 * Maps IAM user-account resources into domain entities.
 * Follows the same assembler pattern used in the Learning Center reference.
 *
 * @class UserAccountAssembler
 */
export class UserAccountAssembler {
    /**
     * Converts a single raw API resource object into a UserAccount entity.
     *
     * @param {Object} resource - Raw user resource from the API response.
     * @returns {UserAccount} UserAccount domain entity.
     */
    static toEntityFromResource(resource) {
        return new UserAccount({
            id:         resource.id         ?? null,
            email:      resource.email      ?? '',
            firstName:  resource.name       ?? '',
            lastName:   resource.lastName   ?? '',
            businessId: resource.businessId ?? null,
            status:     resource.status     ?? 'ACTIVE',
            roleId:     resource.roleId     ?? null
        });
    }

    /**
     * Converts an Axios response containing an array of user resources
     * into an array of UserAccount entities.
     *
     * @param {import('axios').AxiosResponse<Array<Object>|Object>} response
     *   HTTP response with user resources.
     * @returns {UserAccount[]} Array of UserAccount domain entities.
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`${response.status}, ${response.statusText}`);
            return [];
        }
        const resources = response.data instanceof Array
            ? response.data
            : response.data['users'];
        return resources.map(resource => this.toEntityFromResource(resource));
    }
}
