import { IamApi } from './iam.api.js';
import { setSessionToken } from '../../shared/infrastructure/session-token.js';

const iamApi = new IamApi();

/**
 * Abstracts the authentication mechanism behind a stable interface so that
 * `iam.store.js` and the Sign In / Sign Up views never change when phase 2
 * swaps the mock (json-server) implementation for the real backend.
 *
 * Today:   signIn  → GET /users?email= + client-side password compare.
 *          signUp  → POST /users.
 * Phase 2: signIn  → POST /authentication/sign-in (returns a real JWT).
 *          signUp  → POST /authentication/sign-up.
 * Only this class needs to change when that happens.
 *
 * @class AuthProvider
 */
export class AuthProvider {
    /**
     * @param {string} email
     * @param {string} password
     * @returns {Promise<Object>} The matched user resource.
     * @throws {Error} With message 'sign-in.error-credentials' when invalid.
     */
    async signIn(email, password) {
        const response = await iamApi.signIn(email);
        const matchedUsers = response.data instanceof Array ? response.data : [];
        const matched = matchedUsers.find(user => user.email === email && user.password === password);

        if (!matched) {
            throw new Error('sign-in.error-credentials');
        }

        // The mock issues no real token; cleared so BaseApi sends no Authorization
        // header until phase 2 sets a real one here after a successful sign-in.
        setSessionToken(null);
        return matched;
    }

    /**
     * @param {Object} resource - IAM user resource payload.
     * @returns {Promise<Object>} The created user resource.
     */
    async signUp(resource) {
        const response = await iamApi.signUp(resource);
        setSessionToken(null);
        return response.data;
    }
}
