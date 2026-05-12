/**
 * Application service store for the Sales & POS Management bounded context.
 *
 * Business rules enforced here:
 * - fetchSales and fetchCustomers load data scoped to the authenticated business.
 * - A sale can only be confirmed (PAID) when:
 *     1. The cart has at least one SaleDetail.
 *     2. A valid PaymentMethod is provided.
 *     3. No item quantity exceeds the available stock (validated in the POS view).
 * - A sale can only be cancelled when its status is OPEN or PAID.
 * - On confirmSale: the Sale is first persisted (POST), then each SaleDetail is
 *   persisted individually (POST), then the Sale status is updated to PAID (PUT).
 * - totalAmount stored on the sale resource equals the sum of all line totals
 *   (pre-tax subtotal); IGV and grandTotal are derived in the domain entity.
 * - Stock decrement on sale confirmation is handled by the ProductStore and
 *   should be called from the POS view after this store confirms the sale.
 * - currentSale holds the in-progress POS session (null when no active session).
 *
 * @module useSalesStore
 */
import { defineStore }  from 'pinia';
import { computed, ref } from 'vue';
import { SalesApi }           from '../infrastructure/sales.api.js';
import { SaleAssembler }      from '../infrastructure/sale.assembler.js';
import { SaleDetailAssembler } from '../infrastructure/sale-detail.assembler.js';
import { CustomerAssembler }  from '../infrastructure/customer.assembler.js';
import { Sale }               from '../domain/model/sale.entity.js';
import { SaleDetail }         from '../domain/model/sale-detail.entity.js';

const salesApi = new SalesApi();

const useSalesStore = defineStore('sales', () => {

    /** @type {import('vue').Ref<Sale[]>} */
    const sales = ref([]);

    /** @type {import('vue').Ref<import('../domain/model/customer.entity.js').Customer[]>} */
    const customers = ref([]);

    /**
     * The in-progress sale being built in the POS screen.
     * Null when no POS session is active.
     * @type {import('vue').Ref<Sale|null>}
     */
    const currentSale = ref(null);

    /** @type {import('vue').Ref<boolean>} */
    const salesLoaded = ref(false);

    /** @type {import('vue').Ref<boolean>} */
    const customersLoaded = ref(false);

    /** @type {import('vue').Ref<Error[]>} */
    const errors = ref([]);

    /**
     * Total number of loaded sales.
     * @type {import('vue').ComputedRef<number>}
     */
    const salesCount = computed(() => sales.value.length);

    /**
     * Total revenue from PAID sales (pre-tax subtotal sum).
     * Used for quick summary cards.
     * @type {import('vue').ComputedRef<number>}
     */
    const totalRevenue = computed(() => {
        const paidSales = sales.value.filter(sale => sale.status === SaleStatus.PAID);
        const sum = paidSales.reduce((accumulator, sale) => accumulator + (sale.totalAmount || 0), 0);
        return Math.round(sum * 100) / 100;
    });

    /**
     * Count of PAID sales.
     * @type {import('vue').ComputedRef<number>}
     */
    const paidSalesCount = computed(() => {
        return sales.value.filter(sale => sale.status === SaleStatus.PAID).length;
    });

    /**
     * Count of OPEN sales.
     * @type {import('vue').ComputedRef<number>}
     */
    const openSalesCount = computed(() => {
        return sales.value.filter(sale => sale.status === SaleStatus.OPEN).length;
    });

    // ─── Queries ──────────────────────────────────────────────────────────────

    /**
     * Finds a Sale entity by its identifier in the local state.
     * @param {number|string} id - Sale identifier.
     * @returns {Sale|undefined} Matching Sale, or undefined if not found.
     */
    function getSaleById(id) {
        const numericId = parseInt(id);
        return sales.value.find(sale => sale.id === numericId);
    }

    /**
     * Finds a Customer entity by its identifier in the local state.
     * @param {number|string} id - Customer identifier.
     * @returns {import('../domain/model/customer.entity.js').Customer|undefined}
     */
    function getCustomerById(id) {
        const numericId = parseInt(id);
        return customers.value.find(customer => customer.id === numericId);
    }

    // ─── Fetch Actions ────────────────────────────────────────────────────────

    /**
     * Loads all sales for the given business and updates local state.
     * @param {number|string} businessId - Business identifier from the IAM store.
     * @returns {void}
     */
    function fetchSales(businessId) {
        salesApi.getSales(businessId).then(response => {
            sales.value   = SaleAssembler.toEntitiesFromResponse(response);
            salesLoaded.value = true;
        }).catch(error => {
            errors.value.push(error);
        });
    }

    /**
     * Loads all customers for the given business and updates local state.
     * @param {number|string} businessId - Business identifier from the IAM store.
     * @returns {void}
     */
    function fetchCustomers(businessId) {
        salesApi.getCustomers(businessId).then(response => {
            customers.value   = CustomerAssembler.toEntitiesFromResponse(response);
            customersLoaded.value = true;
        }).catch(error => {
            errors.value.push(error);
        });
    }

    // ─── POS Session ──────────────────────────────────────────────────────────

    /**
     * Initialises a fresh in-memory POS session for the given business.
     * Does NOT persist to the API yet; persistence happens on confirmSale.
     *
     * @param {number|string} businessId - Business identifier.
     * @returns {void}
     */
    function startNewSale(businessId) {
        currentSale.value = new Sale({
            businessId: businessId,
            status:     SaleStatus.OPEN,
            date:       new Date().toISOString(),
            details:    []
        });
    }

    /**
     * Adds a SaleDetail line item to the current in-memory sale.
     *
     * Business rules:
     * - The sale must be in OPEN status.
     * - A product can only appear once; calling this for an existing productId
     *   increments quantity instead of adding a duplicate line.
     * - quantity must be a positive integer > 0.
     * - quantity must not exceed the available stock (caller is responsible for passing
     *   the correct availableStock value from the ProductStore).
     *
     * @param {number|string} productId      - Product to add.
     * @param {number}        quantity       - Number of units.
     * @param {number}        unitPrice      - Price per unit at point of sale.
     * @param {number}        availableStock - Current inventory count (for validation).
     * @param {number}        [discount=0]   - Per-unit discount amount.
     * @returns {{ success: boolean, errorKey: string|null }}
     *   Object indicating success or the i18n key of the validation error.
     */
    function addDetailToCurrentSale({ productId, quantity, unitPrice, availableStock, discount = 0 }) {
        if (!currentSale.value || !currentSale.value.isOpen) {
            return { success: false, errorKey: 'pos.error-no-active-sale' };
        }
        if (!quantity || quantity < 1) {
            return { success: false, errorKey: 'pos.error-quantity-invalid' };
        }
        if (quantity > availableStock) {
            return { success: false, errorKey: 'pos.error-insufficient-stock' };
        }

        const existingDetail = currentSale.value.details.find(
            detail => detail.productId === productId
        );

        if (existingDetail) {
            const newQuantity = existingDetail.quantity + quantity;
            if (newQuantity > availableStock) {
                return { success: false, errorKey: 'pos.error-insufficient-stock' };
            }
            existingDetail.quantity = newQuantity;
        } else {
            currentSale.value.details.push(new SaleDetail({
                productId: productId,
                quantity:  quantity,
                unitPrice: unitPrice,
                discount:  discount
            }));
        }
        return { success: true, errorKey: null };
    }

    /**
     * Updates the quantity of an existing detail line in the current in-memory sale.
     *
     * Business rules:
     * - newQuantity must be >= 1.
     * - newQuantity must not exceed availableStock.
     * - If newQuantity is 0 or less, the line item should be removed instead (use removeDetailFromCurrentSale).
     *
     * @param {number|string} productId      - Product whose quantity to update.
     * @param {number}        newQuantity    - Desired new quantity.
     * @param {number}        availableStock - Current inventory count (for validation).
     * @returns {{ success: boolean, errorKey: string|null }}
     */
    function updateDetailQuantity({ productId, newQuantity, availableStock }) {
        if (!currentSale.value || !currentSale.value.isOpen) {
            return { success: false, errorKey: 'pos.error-no-active-sale' };
        }
        if (newQuantity < 1) {
            return { success: false, errorKey: 'pos.error-quantity-invalid' };
        }
        if (newQuantity > availableStock) {
            return { success: false, errorKey: 'pos.error-insufficient-stock' };
        }
        const detail = currentSale.value.details.find(d => d.productId === productId);
        if (detail) {
            detail.quantity = newQuantity;
        }
        return { success: true, errorKey: null };
    }

    /**
     * Removes a detail line item from the current in-memory sale by productId.
     *
     * @param {number|string} productId - Product whose line to remove.
     * @returns {void}
     */
    function removeDetailFromCurrentSale(productId) {
        if (!currentSale.value) return;
        currentSale.value.details = currentSale.value.details.filter(
            detail => detail.productId !== productId
        );
    }

    /**
     * Confirms and persists the current POS sale.
     *
     * Workflow (sequential):
     * 1. Validate: cart is non-empty and paymentMethod is valid.
     * 2. POST /sales with status OPEN and subtotal.
     * 3. POST /saleDetails for each line item, referencing the new sale id.
     * 4. PUT /sales/:id to update status to PAID and set paymentMethod.
     * 5. Append the final Sale entity to local state.
     *
     * @param {string} paymentMethod - One of the PaymentMethod enum values.
     * @param {number|null} customerId - Optional customer id.
     * @param {string} description - Optional sale description/note.
     * @returns {Promise<{ success: boolean, errorKey: string|null }>}
     */
    async function confirmSale({ paymentMethod, customerId = null, description = '' }) {
        if (!currentSale.value || !currentSale.value.isOpen) {
            return { success: false, errorKey: 'pos.error-no-active-sale' };
        }
        if (currentSale.value.details.length === 0) {
            return { success: false, errorKey: 'pos.error-empty-cart' };
        }
        if (!paymentMethod || !Object.values(PaymentMethod).includes(paymentMethod)) {
            return { success: false, errorKey: 'pos.error-no-payment-method' };
        }

        const subtotal = currentSale.value.subtotal;

        try {
            // Step 1: Persist the sale header with status OPEN
            const saleResource = {
                businessId:    currentSale.value.businessId,
                customerId:    customerId,
                status:        SaleStatus.OPEN,
                totalAmount:   subtotal,
                paymentMethod: null,
                date:          currentSale.value.date,
                description:   description,
                currency:      'PEN'
            };
            const saleResponse   = await salesApi.createSale(saleResource);
            const persistedSale  = SaleAssembler.toEntityFromResource(saleResponse.data);

            // Step 2: Persist each line item referencing the new sale id
            const detailPromises = currentSale.value.details.map(detail => {
                const detailResource = {
                    saleId:    persistedSale.id,
                    productId: detail.productId,
                    quantity:  detail.quantity,
                    unitPrice: detail.unitPrice,
                    discount:  detail.discount
                };
                return salesApi.createSaleDetail(detailResource);
            });
            const detailResponses = await Promise.all(detailPromises);
            const persistedDetails = detailResponses.map(response =>
                SaleDetailAssembler.toEntityFromResource(response.data)
            );

            // Step 3: Mark sale as PAID with the chosen payment method
            const updatedResource = {
                ...saleResource,
                status:        SaleStatus.PAID,
                paymentMethod: paymentMethod
            };
            const updatedResponse = await salesApi.updateSale(persistedSale.id, updatedResource);
            const finalSale       = SaleAssembler.toEntityFromResource(updatedResponse.data);
            finalSale.details     = persistedDetails;

            // Step 4: Update local state
            sales.value.push(finalSale);
            currentSale.value = null;

            return { success: true, errorKey: null };
        } catch (error) {
            errors.value.push(error);
            return { success: false, errorKey: 'pos.error-confirm-failed' };
        }
    }

    /**
     * Cancels the current in-memory POS session without persisting anything.
     * Clears the cart and resets currentSale to null.
     *
     * @returns {void}
     */
    function discardCurrentSale() {
        currentSale.value = null;
    }

    /**
     * Cancels a previously persisted sale by updating its status to CANCELLED.
     *
     * Business rule: only OPEN or PAID sales can be cancelled.
     *
     * @param {Sale} sale - The Sale entity to cancel.
     * @returns {void}
     */
    function cancelSale(sale) {
        if (sale.status === SaleStatus.CANCELLED) return;

        const updatedResource = {
            id:            sale.id,
            businessId:    sale.businessId,
            customerId:    sale.customerId,
            status:        SaleStatus.CANCELLED,
            totalAmount:   sale.totalAmount,
            paymentMethod: sale.paymentMethod,
            date:          sale.date,
            description:   sale.description,
            currency:      sale.currency
        };

        salesApi.updateSale(sale.id, updatedResource).then(response => {
            const cancelledSale = SaleAssembler.toEntityFromResource(response.data);
            const index = sales.value.findIndex(existingSale => existingSale.id === cancelledSale.id);
            if (index !== -1) {
                sales.value[index] = cancelledSale;
            }
        }).catch(error => {
            errors.value.push(error);
        });
    }

    // ─── Customer CRUD ────────────────────────────────────────────────────────

    /**
     * Creates a new customer and appends it to local state.
     * @param {import('../domain/model/customer.entity.js').Customer} customer - Customer entity to persist.
     * @returns {void}
     */
    function addCustomer(customer) {
        salesApi.createCustomer(customer).then(response => {
            const newCustomer = CustomerAssembler.toEntityFromResource(response.data);
            customers.value.push(newCustomer);
        }).catch(error => {
            errors.value.push(error);
        });
    }

    /**
     * Updates an existing customer and synchronises local state.
     * @param {import('../domain/model/customer.entity.js').Customer} customer - Customer entity with updated data.
     * @returns {void}
     */
    function updateCustomer(customer) {
        salesApi.updateCustomer(customer.id, customer).then(response => {
            const updatedCustomer = CustomerAssembler.toEntityFromResource(response.data);
            const index = customers.value.findIndex(existingCustomer => existingCustomer.id === updatedCustomer.id);
            if (index !== -1) {
                customers.value[index] = updatedCustomer;
            }
        }).catch(error => {
            errors.value.push(error);
        });
    }

    /**
     * Deletes a customer and removes it from local state.
     * @param {number|string} customerId - Identifier of the customer to delete.
     * @returns {void}
     */
    function deleteCustomer(customerId) {
        salesApi.deleteCustomer(customerId).then(() => {
            const index = customers.value.findIndex(customer => customer.id === parseInt(customerId));
            if (index !== -1) {
                customers.value.splice(index, 1);
            }
        }).catch(error => {
            errors.value.push(error);
        });
    }

    return {
        // State
        sales,
        customers,
        currentSale,
        salesLoaded,
        customersLoaded,
        errors,
        // Computed
        salesCount,
        totalRevenue,
        paidSalesCount,
        openSalesCount,
        // Queries
        getSaleById,
        getCustomerById,
        // Fetch
        fetchSales,
        fetchCustomers,
        // POS session
        startNewSale,
        addDetailToCurrentSale,
        updateDetailQuantity,
        removeDetailFromCurrentSale,
        confirmSale,
        discardCurrentSale,
        cancelSale,
        // Customer CRUD
        addCustomer,
        updateCustomer,
        deleteCustomer
    };
});

export default useSalesStore;