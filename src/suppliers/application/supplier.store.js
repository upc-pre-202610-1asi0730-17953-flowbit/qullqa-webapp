/**
 * Application service store for the Supplier & Replenishment Management bounded context.
 *
 * Business rules enforced here:
 * - fetchSuppliers and fetchPurchaseOrders are scoped to the authenticated business.
 * - A supplier cannot be deactivated while it has PENDING or DELAYED purchase orders.
 * - A purchase order requires at least one detail line before being submitted.
 * - A purchase order can only transition to RECEIVED or CANCELLED when its current
 *   status is PENDING or DELAYED; attempts on final states are silently rejected.
 * - When a purchase order is created, its detail lines are persisted individually
 *   via /purchaseDetails after the parent order is confirmed.
 * - totalAmount is computed client-side from detail lineTotals (entity getter).
 * - pendingOrderCount and pendingOrderTotal are derived computed refs for the stats bar.
 *
 * @module useSupplierStore
 */
import { defineStore }  from 'pinia';
import { computed, ref } from 'vue';
import { SupplierApi }              from '../infrastructure/supplier.api.js';
import { SupplierAssembler }        from '../infrastructure/supplier.assembler.js';
import { PurchaseOrderAssembler }   from '../infrastructure/purchase-order.assembler.js';
import { Supplier, SupplierStatus } from '../domain/model/supplier.entity.js';
import { PurchaseOrder, PurchaseOrderStatus } from '../domain/model/purchase-order.entity.js';

const supplierApi = new SupplierApi();

const useSupplierStore = defineStore('supplier', () => {

    /** @type {import('vue').Ref<import('../domain/model/supplier.entity.js').Supplier[]>} */
    const suppliers = ref([]);

    /** @type {import('vue').Ref<import('../domain/model/purchase-order.entity.js').PurchaseOrder[]>} */
    const purchaseOrders = ref([]);

    /** @type {import('vue').Ref<boolean>} */
    const suppliersLoaded = ref(false);

    /** @type {import('vue').Ref<boolean>} */
    const purchaseOrdersLoaded = ref(false);

    /** @type {import('vue').Ref<Error[]>} */
    const errors = ref([]);

    // ─── Computed ──────────────────────────────────────────────────────────────

    /**
     * Count of active suppliers available for new orders.
     * @type {import('vue').ComputedRef<number>}
     */
    const activeSupplierCount = computed(() =>
        suppliers.value.filter(supplier => supplier.isActive).length
    );

    /**
     * Count of purchase orders in PENDING or DELAYED state.
     * @type {import('vue').ComputedRef<number>}
     */
    const pendingOrderCount = computed(() =>
        purchaseOrders.value.filter(order => order.isActionable).length
    );

    /**
     * Sum of totalAmount for all PENDING or DELAYED purchase orders.
     * @type {import('vue').ComputedRef<number>}
     */
    const pendingOrderTotal = computed(() => {
        const total = purchaseOrders.value
            .filter(order => order.isActionable)
            .reduce((accumulator, order) => accumulator + order.totalAmount, 0);
        return Math.round(total * 100) / 100;
    });

    /**
     * Count of purchase orders in DELAYED state.
     * @type {import('vue').ComputedRef<number>}
     */
    const delayedOrderCount = computed(() =>
        purchaseOrders.value.filter(order => order.isDelayed).length
    );

    // ─── Queries ───────────────────────────────────────────────────────────────

    /**
     * Finds a supplier entity by its numeric identifier.
     * @param {number|string} id
     * @returns {import('../domain/model/supplier.entity.js').Supplier|undefined}
     */
    function getSupplierById(id) {
        return suppliers.value.find(supplier => supplier.id === parseInt(id));
    }

    /**
     * Finds a purchase order entity by its numeric identifier.
     * @param {number|string} id
     * @returns {import('../domain/model/purchase-order.entity.js').PurchaseOrder|undefined}
     */
    function getPurchaseOrderById(id) {
        return purchaseOrders.value.find(order => order.id === parseInt(id));
    }

    /**
     * Returns all purchase orders for a specific supplier.
     * @param {number|string} supplierId
     * @returns {import('../domain/model/purchase-order.entity.js').PurchaseOrder[]}
     */
    function getPurchaseOrdersBySupplier(supplierId) {
        return purchaseOrders.value.filter(order => order.supplierId === parseInt(supplierId));
    }

    // ─── Commands ──────────────────────────────────────────────────────────────

    /**
     * Fetches all suppliers for the authenticated business.
     * @param {number|string} businessId
     */
    function fetchSuppliers(businessId) {
        supplierApi.getSuppliers(businessId)
            .then(response => {
                suppliers.value       = SupplierAssembler.toEntitiesFromResponse(response);
                suppliersLoaded.value = true;
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Fetches all purchase orders for the authenticated business and hydrates
     * their detail lines by fetching /purchaseDetails for each order.
     *
     * @param {number|string} businessId
     */
    function fetchPurchaseOrders(businessId) {
        supplierApi.getPurchaseOrders(businessId)
            .then(response => {
                const rawOrders = Array.isArray(response.data) ? response.data : [];
                const hydratedOrderPromises = rawOrders.map(rawOrder =>
                    supplierApi.getPurchaseDetailsByOrder(rawOrder.id)
                        .then(detailsResponse => {
                            const rawDetails = Array.isArray(detailsResponse.data)
                                ? detailsResponse.data
                                : [];
                            return PurchaseOrderAssembler.toEntityFromResource({
                                ...rawOrder,
                                details: rawDetails
                            });
                        })
                        .catch(() => PurchaseOrderAssembler.toEntityFromResource(rawOrder))
                );
                return Promise.all(hydratedOrderPromises);
            })
            .then(hydratedOrders => {
                purchaseOrders.value       = hydratedOrders;
                purchaseOrdersLoaded.value = true;
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Creates a new supplier and appends it to local state.
     * @param {import('../domain/model/supplier.entity.js').Supplier} supplier
     */
    function addSupplier(supplier) {
        const resource = SupplierAssembler.toResourceFromEntity(supplier);
        supplierApi.createSupplier(resource)
            .then(response => {
                suppliers.value.push(SupplierAssembler.toEntityFromResource(response.data));
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Updates an existing supplier and synchronizes local state.
     * @param {import('../domain/model/supplier.entity.js').Supplier} supplier - Must include id.
     */
    function updateSupplier(supplier) {
        const resource = SupplierAssembler.toResourceFromEntity(supplier);
        supplierApi.updateSupplier(supplier.id, resource)
            .then(response => {
                const updatedSupplier = SupplierAssembler.toEntityFromResource(response.data);
                const index = suppliers.value.findIndex(existingSupplier => existingSupplier.id === updatedSupplier.id);
                if (index !== -1) suppliers.value[index] = updatedSupplier;
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Deactivates a supplier by setting its status to INACTIVE.
     *
     * Business rule: deactivation is blocked when the supplier has any
     * PENDING or DELAYED purchase orders.
     *
     * @param {number|string} supplierId
     */
    function deactivateSupplier(supplierId) {
        const numericId      = parseInt(supplierId);
        const activeOrders   = purchaseOrders.value.filter(order =>
            order.supplierId === numericId && order.isActionable
        );

        if (activeOrders.length > 0) {
            errors.value.push(
                new Error(
                    `Cannot deactivate supplier #${numericId}: it has ${activeOrders.length} active order(s).`
                )
            );
            return;
        }

        const existingSupplier = suppliers.value.find(supplier => supplier.id === numericId);
        if (!existingSupplier) return;

        const resource = SupplierAssembler.toResourceFromEntity(
            new Supplier({ ...existingSupplier, status: SupplierStatus.INACTIVE })
        );

        supplierApi.deactivateSupplier(numericId, resource)
            .then(response => {
                const updatedSupplier = SupplierAssembler.toEntityFromResource(response.data);
                const index = suppliers.value.findIndex(supplier => supplier.id === numericId);
                if (index !== -1) suppliers.value[index] = updatedSupplier;
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Creates a new purchase order and its detail lines, then updates local state.
     *
     * Business rules:
     * - detailLines must contain at least one item.
     * - Each detail line must have quantity > 0 and unitPrice > 0.
     * - Details are persisted individually after the parent order is confirmed.
     *
     * @param {Object}   orderPayload
     * @param {number}   orderPayload.businessId
     * @param {number}   orderPayload.supplierId
     * @param {string}   orderPayload.expectedDate  - ISO date string.
     * @param {string}   [orderPayload.description]
     * @param {Object[]} orderPayload.detailLines
     * @param {number}   orderPayload.detailLines[].productId
     * @param {string}   orderPayload.detailLines[].productName
     * @param {number}   orderPayload.detailLines[].quantity
     * @param {number}   orderPayload.detailLines[].unitPrice
     * @param {number}   [orderPayload.detailLines[].discount]
     */
    function createPurchaseOrder(orderPayload) {
        if (!orderPayload.detailLines || orderPayload.detailLines.length === 0) {
            errors.value.push(new Error('A purchase order requires at least one detail line.'));
            return;
        }

        const invalidLines = orderPayload.detailLines.filter(
            line => !line.quantity || line.quantity <= 0 || !line.unitPrice || line.unitPrice <= 0
        );

        if (invalidLines.length > 0) {
            errors.value.push(
                new Error('All purchase order lines must have quantity > 0 and unitPrice > 0.')
            );
            return;
        }

        const supplierEntity = suppliers.value.find(supplier => supplier.id === parseInt(orderPayload.supplierId));

        const orderResource = {
            businessId:   parseInt(orderPayload.businessId),
            supplierId:   parseInt(orderPayload.supplierId),
            date:         new Date().toISOString(),
            expectedDate: orderPayload.expectedDate,
            status:       PurchaseOrderStatus.PENDING,
            currency:     'PEN',
            description:  orderPayload.description ?? ''
        };

        supplierApi.createPurchaseOrder(orderResource)
            .then(orderResponse => {
                const createdOrder = orderResponse.data;
                const detailPromises = orderPayload.detailLines.map(line =>
                    supplierApi.createPurchaseDetail({
                        purchaseId:          createdOrder.id,
                        productId:           parseInt(line.productId),
                        quantity:            parseInt(line.quantity),
                        unitPrice:           parseFloat(line.unitPrice),
                        discount:            parseFloat(line.discount ?? 0),
                        deliveryStatus:      'PENDING',
                        deliveryTrackingNum: ''
                    }).then(detailResponse => ({
                        ...detailResponse.data,
                        productName: line.productName
                    }))
                );

                return Promise.all(detailPromises).then(rawDetails => ({
                    ...createdOrder,
                    supplierName: supplierEntity ? supplierEntity.fullName : '',
                    details:      rawDetails
                }));
            })
            .then(hydratedOrder => {
                purchaseOrders.value.unshift(
                    PurchaseOrderAssembler.toEntityFromResource(hydratedOrder)
                );
            })
            .catch(error => errors.value.push(error));
    }

    /**
     * Transitions a purchase order to a new status.
     *
     * Business rule: only PENDING or DELAYED orders can be transitioned.
     * RECEIVED or CANCELLED orders are immutable and this call is rejected silently.
     *
     * @param {number|string}       orderId
     * @param {PurchaseOrderStatus} newStatus - Must be RECEIVED, DELAYED or CANCELLED.
     */
    function updatePurchaseOrderStatus(orderId, newStatus) {
        const numericId    = parseInt(orderId);
        const existingOrder = purchaseOrders.value.find(order => order.id === numericId);

        if (!existingOrder) return;

        if (!existingOrder.isActionable) {
            errors.value.push(
                new Error(
                    `Cannot update purchase order #${numericId}: it is already ${existingOrder.status}.`
                )
            );
            return;
        }

        const resource = PurchaseOrderAssembler.toResourceFromEntity(existingOrder);
        resource.status = newStatus;

        if (newStatus === PurchaseOrderStatus.RECEIVED) {
            resource.receivedDate = new Date().toISOString().slice(0, 10);
        }

        supplierApi.updatePurchaseOrder(numericId, resource)
            .then(response => {
                const updatedOrder = PurchaseOrderAssembler.toEntityFromResource({
                    ...response.data,
                    supplierName: existingOrder.supplierName,
                    details:      existingOrder.details
                });
                const index = purchaseOrders.value.findIndex(order => order.id === numericId);
                if (index !== -1) purchaseOrders.value[index] = updatedOrder;
            })
            .catch(error => errors.value.push(error));
    }

    return {
        suppliers,
        purchaseOrders,
        suppliersLoaded,
        purchaseOrdersLoaded,
        errors,
        activeSupplierCount,
        pendingOrderCount,
        pendingOrderTotal,
        delayedOrderCount,
        getSupplierById,
        getPurchaseOrderById,
        getPurchaseOrdersBySupplier,
        fetchSuppliers,
        fetchPurchaseOrders,
        addSupplier,
        updateSupplier,
        deactivateSupplier,
        createPurchaseOrder,
        updatePurchaseOrderStatus
    };
});

export default useSupplierStore;
