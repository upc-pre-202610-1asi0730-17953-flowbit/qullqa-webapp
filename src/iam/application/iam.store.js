/**
 * Application service store for the Identity & Access Management bounded context.
 * Coordinates sign-in, sign-up, sign-out and user management use cases.
 *
 * Business rules enforced here:
 * - Sign-in requires a non-empty email containing '@' and a non-empty password.
 * - Password must match the stored value (client-side check against mock API).
 * - Sign-up requires a business name, a full name, a valid email, a password
 *   of at least 6 characters, and matching confirmation.
 * - Only one user can be authenticated at a time (currentUser).
 *
 * @module useIamStore
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { IamApi } from '../infrastructure/iam.api.js';
import { AuthProvider } from '../infrastructure/auth-provider.js';
import { UserAccountAssembler } from '../infrastructure/user-account.assembler.js';
import { UserAccount } from '../domain/model/user-account.entity.js';
import { SESSION_EXPIRED_EVENT } from '../../shared/infrastructure/base-api.js';

const iamApi = new IamApi();
const authProvider = new AuthProvider();

/**
 * Reactive store that exposes IAM commands and queries.
 *
 * @returns {Object} Store state and actions.
 */
const useIamStore = defineStore('iam', () => {
    /**
     * The currently authenticated user.
     * @type {import('vue').Ref<UserAccount|null>}
     */
    const currentUser = ref(null);

    /**
     * All loaded user accounts (for user management view).
     * @type {import('vue').Ref<UserAccount[]>}
     */
    const users = ref([]);

    /**
     * All available roles, fetched from the API.
     * @type {import('vue').Ref<Array<{id: number, position: string}>>}
     */
    const roles = ref([]);

    /**
     * Whether the user list has been loaded from the API.
     * @type {import('vue').Ref<boolean>}
     */
    const usersLoaded = ref(false);

    /**
     * Whether the role list has been loaded from the API.
     * @type {import('vue').Ref<boolean>}
     */
    const rolesLoaded = ref(false);

    /**
     * Whether there is an authenticated user session.
     * @type {import('vue').Ref<boolean>}
     */
    const isAuthenticated = ref(false);

    /**
     * Errors encountered during API or validation operations.
     * @type {import('vue').Ref<string[]>}
     */
    const errors = ref([]);

    /**
     * LocalStorage key under which the active session is persisted so the
     * authenticated user (and its businessId) survives a page reload.
     * @type {string}
     */
    const SESSION_STORAGE_KEY = 'qullqa.session';

    /**
     * Serialises a UserAccount entity into a plain resource (password excluded)
     * suitable for persisting in localStorage and re-feeding to the assembler.
     * @param {UserAccount} user
     * @returns {Object}
     */
    function toPersistableResource(user) {
        return {
            id:         user.id,
            email:      user.email,
            name:       user.firstName,
            lastName:   user.lastName,
            businessId: user.businessId,
            status:     user.status,
            roleId:     user.roleId
        };
    }

    /**
     * Persists the current session so it survives a page reload.
     * @param {UserAccount} user
     * @returns {void}
     */
    function persistSession(user) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(toPersistableResource(user)));
    }

    /**
     * Removes any persisted session from localStorage.
     * @returns {void}
     */
    function clearSession() {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }

    /**
     * Rehydrates the session from localStorage on store initialisation so a
     * page reload keeps the user authenticated and the businessId available.
     * @returns {void}
     */
    function restoreSession() {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return;
        try {
            currentUser.value     = UserAccountAssembler.toEntityFromResource(JSON.parse(raw));
            isAuthenticated.value = true;
        } catch (error) {
            clearSession();
        }
    }

    restoreSession();

    // When BaseApi sees a 401, it clears the token and dispatches this event.
    // Wired here (not in BaseApi) so the shared/infrastructure layer never
    // depends on IAM. Never fires today since no real token is issued yet.
    window.addEventListener(SESSION_EXPIRED_EVENT, () => signOut());

    /**
     * Number of loaded user accounts.
     * @type {import('vue').ComputedRef<number>}
     */
    const usersCount = computed(() => {
        return usersLoaded.value ? users.value.length : 0;
    });

    /**
     * Validates sign-in credentials against the mock API.
     * Business rule: email must be valid; password must match stored value.
     *
     * @param {string} email - User email address.
     * @param {string} password - User password (plain text for mock).
     * @returns {void}
     */
    function signIn(email, password) {
        errors.value = [];

        if (!email || !password) {
            errors.value.push('sign-in.error-empty');
            return;
        }
        if (!email.includes('@')) {
            errors.value.push('sign-in.error-invalid-email');
            return;
        }

        authProvider.signIn(email, password).then(matchedResource => {
            currentUser.value = UserAccountAssembler.toEntityFromResource(matchedResource);
            isAuthenticated.value = true;
            persistSession(currentUser.value);
        }).catch(error => {
            errors.value.push(error.message);
        });
    }

    /**
     * Registers a new user and business account.
     * Business rule: businessName, fullName, valid email, password >= 6 chars,
     * and password confirmation must match (enforced by the Sign Up view).
     *
     * businessName/businessType are forwarded to the payload even though the
     * mock's /users endpoint has no matching columns: the point is that the
     * data captured in the form is no longer silently dropped between the UI
     * and the store. Wiring them into an actual Business record is a phase 2
     * concern (needs a joint User+Business creation endpoint).
     *
     * @param {Object} payload - Registration form data.
     * @param {string} payload.businessName - Name of the business.
     * @param {string} [payload.businessType] - BODEGA or FARMACIA.
     * @param {string} payload.fullName - Full name of the user.
     * @param {string} payload.email - Email address.
     * @param {string} payload.password - Password (min 6 characters).
     * @returns {void}
     */
    function signUp(payload) {
        errors.value = [];

        const resource = {
            name:         payload.fullName.split(' ')[0] ?? payload.fullName,
            lastName:     payload.fullName.split(' ').slice(1).join(' ') ?? '',
            email:        payload.email,
            password:     payload.password,
            status:       'ACTIVE',
            roleId:       1,
            businessId:   null,
            businessName: payload.businessName,
            businessType: payload.businessType ?? null
        };

        authProvider.signUp(resource).then(createdResource => {
            const createdUser = UserAccountAssembler.toEntityFromResource(createdResource);
            currentUser.value  = createdUser;
            isAuthenticated.value = true;
            persistSession(currentUser.value);
        }).catch(error => {
            errors.value.push(error.message);
        });
    }

    /**
     * Signs the current user out and clears session state.
     * @returns {void}
     */
    function signOut() {
        currentUser.value     = null;
        isAuthenticated.value = false;
        errors.value          = [];
        clearSession();
    }

    /**
     * Loads all user accounts from the API.
     * @returns {void}
     */
    function fetchUsers() {
        iamApi.getUsers().then(response => {
            users.value      = UserAccountAssembler.toEntitiesFromResponse(response);
            usersLoaded.value = true;
        }).catch(error => {
            errors.value.push(error.message);
        });
    }

    /**
     * Loads all roles from the API. Roles are the single source of truth for
     * role labels — presentation components must resolve a roleId to its
     * `position` (ADMIN/CASHIER/WAREHOUSE) via getRolePosition instead of
     * hardcoding their own numeric-id-to-label mapping.
     * @returns {void}
     */
    function fetchRoles() {
        iamApi.getRoles().then(response => {
            roles.value = response.data instanceof Array ? response.data : [];
            rolesLoaded.value = true;
        }).catch(error => {
            errors.value.push(error.message);
        });
    }

    /**
     * Resolves a roleId to its position (ADMIN/CASHIER/WAREHOUSE).
     * @param {number|string} roleId
     * @returns {string|null} The role's position, or null if not loaded/found.
     */
    function getRolePosition(roleId) {
        const numericId = parseInt(roleId);
        const role = roles.value.find(roleItem => roleItem.id === numericId);
        return role ? role.position : null;
    }

    /**
     * Finds a user account entity by its identifier.
     * @param {number|string} id - User identifier.
     * @returns {UserAccount|undefined} Matching user account, if available.
     */
    function getUserById(id) {
        const idNum = parseInt(id);
        return users.value.find(user => user.id === idNum);
    }

    /**
     * Creates a new user account and appends it to local state.
     * @param {UserAccount} userAccount - UserAccount entity to persist.
     * @returns {void}
     */
    function addUser(userAccount) {
        iamApi.signUp(userAccount).then(response => {
            const newUser = UserAccountAssembler.toEntityFromResource(response.data);
            users.value.push(newUser);
        }).catch(error => {
            errors.value.push(error.message);
        });
    }

    /**
     * Updates an existing user account and synchronizes local state.
     * @param {UserAccount} userAccount - UserAccount entity with updated data.
     * @returns {void}
     */
    function updateUser(userAccount) {
        iamApi.updateUser(userAccount).then(response => {
            const updatedUser = UserAccountAssembler.toEntityFromResource(response.data);
            const index = users.value.findIndex(user => user.id === updatedUser.id);
            if (index !== -1) users.value[index] = updatedUser;
        }).catch(error => {
            errors.value.push(error.message);
        });
    }

    /**
     * Deletes a user account and removes it from local state.
     * @param {UserAccount} userAccount - UserAccount entity to remove.
     * @returns {void}
     */
    function deleteUser(userAccount) {
        iamApi.deleteUser(userAccount.id).then(() => {
            const index = users.value.findIndex(user => user.id === userAccount.id);
            if (index !== -1) users.value.splice(index, 1);
        }).catch(error => {
            errors.value.push(error.message);
        });
    }

    return {
        currentUser,
        users,
        roles,
        usersLoaded,
        rolesLoaded,
        isAuthenticated,
        errors,
        usersCount,
        signIn,
        signUp,
        signOut,
        fetchUsers,
        fetchRoles,
        getRolePosition,
        getUserById,
        addUser,
        updateUser,
        deleteUser
    };
});

export default useIamStore;
