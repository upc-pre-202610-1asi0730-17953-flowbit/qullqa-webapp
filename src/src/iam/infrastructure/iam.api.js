import { BaseApi } from '../../../shared/infrastructure/base-api.js';
import { BaseEndpoint } from '../../../shared/infrastructure/base-endpoint.js';

const usersEndpointPath = import.meta.env.VITE_USERS_ENDPOINT_PATH;
const rolesEndpointPath = import.meta.env.VITE_ROLES_ENDPOINT_PATH;

/**
 * Infrastructure gateway for the Identity & Access Management bounded context.
 * Handles sign-in, sign-up, and user/role CRUD operations.
 *
 * Sign-in is simulated on the client side by filtering users by email,
 * since the json-server mock does not support authentication tokens.
 *
 * @class IamApi
 * @extends BaseApi
 */
export class IamApi extends BaseApi {
    /**
     * @private
     * @type {BaseEndpoint}
     */
    #usersEndpoint;

    /**
     * @private
     * @type {BaseEndpoint}
     */
    #rolesEndpoint;

    /** Creates endpoint clients for users and roles. */
    constructor() {
        super();
        this.#usersEndpoint = new BaseEndpoint(this, usersEndpointPath);
        this.#rolesEndpoint = new BaseEndpoint(this, rolesEndpointPath);
    }

    /**
     * Simulates sign-in by filtering the users collection by email.
     * Password validation is performed on the client store after fetching.
     *
     * @param {string} email - The user email address.
     * @returns {Promise<import('axios').AxiosResponse>} Users matching the email.
     */
    signIn(email) {
        return this.#usersEndpoint.getAllByParam('email', email);
    }

    /**
     * Creates a new user account (sign-up).
     *
     * @param {Object} resource - User resource payload.
     * @returns {Promise<import('axios').AxiosResponse>} Created user resource.
     */
    signUp(resource) {
        return this.#usersEndpoint.create(resource);
    }

    /**
     * Fetches all user accounts.
     * @returns {Promise<import('axios').AxiosResponse>} All user resources.
     */
    getUsers() {
        return this.#usersEndpoint.getAll();
    }

    /**
     * Fetches a single user account by its identifier.
     * @param {number|string} id - User identifier.
     * @returns {Promise<import('axios').AxiosResponse>} User resource.
     */
    getUserById(id) {
        return this.#usersEndpoint.getById(id);
    }

    /**
     * Updates an existing user account.
     * @param {Object} resource - Updated user resource payload (must include id).
     * @returns {Promise<import('axios').AxiosResponse>} Updated user resource.
     */
    updateUser(resource) {
        return this.#usersEndpoint.update(resource.id, resource);
    }

    /**
     * Deletes a user account by its identifier.
     * @param {number|string} id - User identifier.
     * @returns {Promise<import('axios').AxiosResponse>} Delete response.
     */
    deleteUser(id) {
        return this.#usersEndpoint.delete(id);
    }

    /**
     * Fetches all available roles.
     * @returns {Promise<import('axios').AxiosResponse>} All role resources.
     */
    getRoles() {
        return this.#rolesEndpoint.getAll();
    }
}
