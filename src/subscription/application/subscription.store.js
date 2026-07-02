/**
 * Application service store for the Subscription & Plan Management bounded context.
 *
 * Business rules enforced here:
 * - fetchPlans loads the full plan catalog (not scoped by business — plans are shared).
 * - Only ACTIVE plans are offered for upgrade (see activePlans).
 * - The plan currently assigned to a business is NOT stored here — it lives on
 *   Business.planId, owned by the IAM bounded context. Upgrading a plan is a
 *   cross-context orchestration: the presentation layer resolves the target
 *   Plan from this store and asks the IAM store to persist the new planId on
 *   the Business (see useIamStore.updateBusinessPlan), mirroring how other
 *   cross-context flows already work in this codebase (e.g. purchase-order-list.vue
 *   calling productStore).
 *
 * @module useSubscriptionStore
 */
import { defineStore }  from 'pinia';
import { computed, ref } from 'vue';
import { PlanApi }       from '../infrastructure/plan.api.js';
import { PlanAssembler } from '../infrastructure/plan.assembler.js';

const planApi = new PlanApi();

const useSubscriptionStore = defineStore('subscription', () => {

    /** @type {import('vue').Ref<import('../domain/model/plan.entity.js').Plan[]>} */
    const plans = ref([]);

    /** @type {import('vue').Ref<boolean>} */
    const plansLoaded = ref(false);

    /** @type {import('vue').Ref<Error[]>} */
    const errors = ref([]);

    /**
     * Plans that can currently be offered for subscription/upgrade.
     * @type {import('vue').ComputedRef<import('../domain/model/plan.entity.js').Plan[]>}
     */
    const activePlans = computed(() => plans.value.filter(plan => plan.isActive));

    /**
     * Finds a plan entity by its numeric identifier.
     * @param {number|string} id
     * @returns {import('../domain/model/plan.entity.js').Plan|undefined}
     */
    function getPlanById(id) {
        const numericId = parseInt(id);
        return plans.value.find(plan => plan.id === numericId);
    }

    /**
     * Loads the full plan catalog from the API.
     * @returns {void}
     */
    function fetchPlans() {
        planApi.getPlans()
            .then(response => {
                plans.value       = PlanAssembler.toEntitiesFromResponse(response);
                plansLoaded.value = true;
            })
            .catch(error => errors.value.push(error));
    }

    return {
        plans,
        plansLoaded,
        errors,
        activePlans,
        getPlanById,
        fetchPlans
    };
});

export default useSubscriptionStore;
