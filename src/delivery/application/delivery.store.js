/**
 * Application service store for the Delivery Tracking bounded context.
 *
 * Business rules enforced here:
 * - fetchDeliveries loads data scoped to the authenticated business.
 * - On loadDeliveryWaypoints: waypoints are fetched and injected into the
 *   matching delivery entity in local state; subsequent calls are skipped
 *   when the delivery already has waypoints loaded (cached).
 * - createDelivery: persists the delivery header (POST), then creates the
 *   initial waypoints (POST) and links them to the new delivery id.
 * - completeDelivery: only allowed when canComplete === true.
 *   Updates status to COMPLETED and sets completedAt (PUT).
 *   Also marks all waypoints as reached.
 * - simulateLocationUpdate: only allowed when canUpdateLocation === true.
 *   Finds the first unreached waypoint, marks it reached, updates currentLabel
 *   and currentLatitude/currentLongitude on the delivery (PUT).
 *   If all waypoints become reached the status transitions to AT_DESTINATION.
 * - cancelDelivery: allowed for any non-COMPLETED, non-CANCELLED delivery.
 * - inTransitDeliveries, atDestinationDeliveries, completedDeliveries are
 *   derived computed properties used by the presentation layer.
 *
 * @module useDeliveryStore
 */
import { defineStore }   from 'pinia';
import { computed, ref } from 'vue';
import { DeliveryApi }         from '../infrastructure/delivery.api.js';
import { DeliveryAssembler }   from '../infrastructure/delivery.assembler.js';
import { WaypointAssembler }   from '../infrastructure/waypoint.assembler.js';
import { Delivery, DeliveryStatus } from '../domain/model/delivery.entity.js';
import { Waypoint }            from '../domain/model/waypoint.entity.js';

const deliveryApi = new DeliveryApi();

const useDeliveryStore = defineStore('delivery', () => {

    /** @type {import('vue').Ref<Delivery[]>} */
    const deliveries = ref([]);

    /** @type {import('vue').Ref<boolean>} */
    const deliveriesLoaded = ref(false);

    /** @type {import('vue').Ref<Error[]>} */
    const errors = ref([]);

    // ─── Computed counters ─────────────────────────────────────────────────────

    /**
     * Deliveries currently IN_TRANSIT (live/active on the road).
     * @type {import('vue').ComputedRef<Delivery[]>}
     */
    const inTransitDeliveries = computed(() =>
        deliveries.value.filter(deliveryItem => deliveryItem.status === DeliveryStatus.IN_TRANSIT)
    );

    /**
     * Deliveries that arrived AT_DESTINATION but not yet confirmed.
     * @type {import('vue').ComputedRef<Delivery[]>}
     */
    const atDestinationDeliveries = computed(() =>
        deliveries.value.filter(deliveryItem => deliveryItem.status === DeliveryStatus.AT_DESTINATION)
    );

    /**
     * Deliveries that have been fully COMPLETED.
     * @type {import('vue').ComputedRef<Delivery[]>}
     */
    const completedDeliveries = computed(() =>
        deliveries.value.filter(deliveryItem => deliveryItem.status === DeliveryStatus.COMPLETED)
    );

    /**
     * Total number of tracked deliveries.
     * @type {import('vue').ComputedRef<number>}
     */
    const totalCount = computed(() => deliveries.value.length);

    /**
     * Number of deliveries currently in transit.
     * @type {import('vue').ComputedRef<number>}
     */
    const inTransitCount = computed(() => inTransitDeliveries.value.length);

    /**
     * Number of deliveries at destination awaiting confirmation.
     * @type {import('vue').ComputedRef<number>}
     */
    const atDestinationCount = computed(() => atDestinationDeliveries.value.length);

    /**
     * Number of completed deliveries.
     * @type {import('vue').ComputedRef<number>}
     */
    const completedCount = computed(() => completedDeliveries.value.length);

    // ─── Queries ───────────────────────────────────────────────────────────────

    /**
     * Finds a Delivery entity by its identifier in local state.
     * @param {number|string} id - Delivery identifier.
     * @returns {Delivery|undefined}
     */
    function getDeliveryById(id) {
        const numericId = parseInt(id);
        return deliveries.value.find(deliveryItem => deliveryItem.id === numericId);
    }

    // ─── Fetch actions ─────────────────────────────────────────────────────────

    /**
     * Loads all deliveries for the given business and updates local state.
     * @param {number|string} businessId - Business identifier from the IAM store.
     * @returns {void}
     */
    function fetchDeliveries(businessId) {
        deliveryApi.getDeliveries(businessId).then(response => {
            deliveries.value    = DeliveryAssembler.toEntitiesFromResponse(response);
            deliveriesLoaded.value = true;
        }).catch(error => {
            errors.value.push(error);
        });
    }

    /**
     * Loads waypoints for a specific delivery and injects them into local state.
     * Skips the API call when the delivery already has waypoints cached.
     *
     * @param {number|string} deliveryId - Delivery identifier.
     * @returns {Promise<void>}
     */
    async function loadDeliveryWaypoints(deliveryId) {
        const numericId      = parseInt(deliveryId);
        const deliveryEntity = deliveries.value.find(deliveryItem => deliveryItem.id === numericId);
        if (!deliveryEntity) return;
        if (deliveryEntity.waypoints.length > 0) return;

        try {
            const response        = await deliveryApi.getWaypointsByDelivery(numericId);
            const loadedWaypoints = WaypointAssembler.toEntitiesFromResponse(response);
            deliveryEntity.waypoints = loadedWaypoints.sort(
                (waypointA, waypointB) => waypointA.sequenceOrder - waypointB.sequenceOrder
            );
        } catch (error) {
            errors.value.push(error);
        }
    }

    // ─── Create delivery ───────────────────────────────────────────────────────

    /**
     * Creates a new delivery and its initial waypoints.
     *
     * Workflow (sequential):
     * 1. POST /deliveries with status REGISTERED and location at origin.
     * 2. POST /waypoints for each initial checkpoint linked to the new delivery id.
     * 3. Append the new Delivery entity (with waypoints) to local state.
     *
     * @param {Object}   params
     * @param {string}   params.orderId          - Purchase order reference.
     * @param {string}   params.supplierName     - Supplier company name.
     * @param {string}   params.origin           - Origin address.
     * @param {string}   params.destination      - Destination address.
     * @param {string}   params.driverName       - Driver full name.
     * @param {string}   params.driverPhone      - Driver contact phone.
     * @param {string}   params.vehicle          - Vehicle description.
     * @param {string}   params.licensePlate     - Vehicle license plate.
     * @param {string}   params.estimatedArrival - Estimated arrival date-time string.
     * @param {string[]} params.products         - List of product description strings.
     * @param {string}   params.totalWeight      - Total weight description.
     * @param {number}   params.businessId       - Business identifier.
     * @returns {Promise<{ success: boolean, errorKey: string|null }>}
     */
    async function createDelivery({
                                      orderId,
                                      supplierName,
                                      origin,
                                      destination,
                                      driverName,
                                      driverPhone,
                                      vehicle,
                                      licensePlate,
                                      estimatedArrival,
                                      products,
                                      totalWeight,
                                      businessId
                                  }) {
        const nowIso         = new Date().toISOString();
        const trackingNumber = `TRK-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

        const deliveryResource = {
            trackingNumber:   trackingNumber,
            orderId:          orderId || '',
            supplierName:     supplierName,
            origin:           origin,
            destination:      destination,
            driverName:       driverName,
            driverPhone:      driverPhone,
            vehicle:          vehicle || 'Vehículo de reparto',
            licensePlate:     licensePlate || '—',
            status:           DeliveryStatus.REGISTERED,
            registeredAt:     nowIso,
            estimatedArrival: estimatedArrival,
            completedAt:      null,
            currentLabel:     origin,
            currentLatitude:  -12.0453,
            currentLongitude: -77.0311,
            products:         products,
            totalWeight:      totalWeight || '—',
            businessId:       businessId,
            purchaseDetailId: null
        };

        try {
            const deliveryResponse = await deliveryApi.createDelivery(deliveryResource);
            const persistedDelivery = DeliveryAssembler.toEntityFromResource(deliveryResponse.data);

            // Create the 3 default waypoints: origin, en-route, destination
            const defaultWaypointDefinitions = [
                {
                    deliveryId:    persistedDelivery.id,
                    label:         `Salida — ${origin}`,
                    district:      origin.split(',')[1]?.trim() || 'Lima',
                    latitude:      -12.0453,
                    longitude:     -77.0311,
                    timestamp:     nowIso,
                    reached:       true,
                    sequenceOrder: 1
                },
                {
                    deliveryId:    persistedDelivery.id,
                    label:         'En ruta',
                    district:      '—',
                    latitude:      -12.0700,
                    longitude:     -77.0200,
                    timestamp:     null,
                    reached:       false,
                    sequenceOrder: 2
                },
                {
                    deliveryId:    persistedDelivery.id,
                    label:         `Destino — ${destination}`,
                    district:      destination.split(',')[1]?.trim() || 'Lima',
                    latitude:      -11.9944,
                    longitude:     -77.0030,
                    timestamp:     null,
                    reached:       false,
                    sequenceOrder: 3
                }
            ];

            const waypointPromises = defaultWaypointDefinitions.map(
                waypointResource => deliveryApi.createWaypoint(waypointResource)
            );
            const waypointResponses = await Promise.all(waypointPromises);
            const persistedWaypoints = waypointResponses.map(
                waypointResponse => WaypointAssembler.toEntityFromResource(waypointResponse.data)
            );

            persistedDelivery.waypoints = persistedWaypoints.sort(
                (waypointA, waypointB) => waypointA.sequenceOrder - waypointB.sequenceOrder
            );

            deliveries.value.unshift(persistedDelivery);
            return { success: true, errorKey: null };
        } catch (error) {
            errors.value.push(error);
            return { success: false, errorKey: 'tracking.error-create-failed' };
        }
    }

    // ─── Status transitions ────────────────────────────────────────────────────

    /**
     * Simulates an IoT location update by advancing the delivery to the
     * next unreached waypoint.
     *
     * Business rules:
     * - Only IN_TRANSIT deliveries can be updated.
     * - The first unreached waypoint is marked as reached.
     * - currentLabel, currentLatitude, currentLongitude are updated to that waypoint.
     * - If all waypoints are now reached, status transitions to AT_DESTINATION.
     *
     * @param {Delivery} delivery - The delivery to update.
     * @returns {Promise<void>}
     */
    async function simulateLocationUpdate(delivery) {
        if (!delivery.canUpdateLocation) return;

        const firstUnreachedIndex = delivery.waypoints.findIndex(
            waypointItem => !waypointItem.reached
        );
        if (firstUnreachedIndex === -1) return;

        const nowIso          = new Date().toISOString();
        const targetWaypoint  = delivery.waypoints[firstUnreachedIndex];
        const updatedWaypoints = delivery.waypoints.map((waypointItem, index) =>
            index === firstUnreachedIndex
                ? new Waypoint({ ...waypointItem, reached: true, timestamp: nowIso })
                : waypointItem
        );
        const allWaypointsReached = updatedWaypoints.every(waypointItem => waypointItem.reached);
        const newStatus = allWaypointsReached
            ? DeliveryStatus.AT_DESTINATION
            : DeliveryStatus.IN_TRANSIT;

        const updatedResource = {
            id:               delivery.id,
            trackingNumber:   delivery.trackingNumber,
            orderId:          delivery.orderId,
            supplierName:     delivery.supplierName,
            origin:           delivery.origin,
            destination:      delivery.destination,
            driverName:       delivery.driverName,
            driverPhone:      delivery.driverPhone,
            vehicle:          delivery.vehicle,
            licensePlate:     delivery.licensePlate,
            status:           newStatus,
            registeredAt:     delivery.registeredAt,
            estimatedArrival: delivery.estimatedArrival,
            completedAt:      null,
            currentLabel:     targetWaypoint.label,
            currentLatitude:  targetWaypoint.latitude,
            currentLongitude: targetWaypoint.longitude,
            products:         delivery.products,
            totalWeight:      delivery.totalWeight,
            businessId:       delivery.businessId,
            purchaseDetailId: delivery.purchaseDetailId
        };

        try {
            // Update delivery location on the API
            await deliveryApi.updateDelivery(delivery.id, updatedResource);

            // Update the reached waypoint on the API
            await deliveryApi.updateWaypoint(targetWaypoint.id, {
                ...targetWaypoint,
                reached:   true,
                timestamp: nowIso
            });

            // Sync local state
            const deliveryIndex = deliveries.value.findIndex(
                deliveryItem => deliveryItem.id === delivery.id
            );
            if (deliveryIndex !== -1) {
                const syncedDelivery        = deliveries.value[deliveryIndex];
                syncedDelivery.status           = newStatus;
                syncedDelivery.currentLabel     = targetWaypoint.label;
                syncedDelivery.currentLatitude  = targetWaypoint.latitude;
                syncedDelivery.currentLongitude = targetWaypoint.longitude;
                syncedDelivery.waypoints        = updatedWaypoints;
            }
        } catch (error) {
            errors.value.push(error);
        }
    }

    /**
     * Marks a delivery as COMPLETED.
     *
     * Business rules:
     * - Only deliveries with canComplete === true are allowed.
     * - All waypoints are marked as reached.
     * - completedAt is set to now.
     *
     * @param {Delivery} delivery - The delivery to complete.
     * @returns {Promise<void>}
     */
    async function completeDelivery(delivery) {
        if (!delivery.canComplete) return;

        const nowIso = new Date().toISOString();

        const updatedResource = {
            id:               delivery.id,
            trackingNumber:   delivery.trackingNumber,
            orderId:          delivery.orderId,
            supplierName:     delivery.supplierName,
            origin:           delivery.origin,
            destination:      delivery.destination,
            driverName:       delivery.driverName,
            driverPhone:      delivery.driverPhone,
            vehicle:          delivery.vehicle,
            licensePlate:     delivery.licensePlate,
            status:           DeliveryStatus.COMPLETED,
            registeredAt:     delivery.registeredAt,
            estimatedArrival: delivery.estimatedArrival,
            completedAt:      nowIso,
            currentLabel:     delivery.destination,
            currentLatitude:  delivery.currentLatitude,
            currentLongitude: delivery.currentLongitude,
            products:         delivery.products,
            totalWeight:      delivery.totalWeight,
            businessId:       delivery.businessId,
            purchaseDetailId: delivery.purchaseDetailId
        };

        try {
            await deliveryApi.updateDelivery(delivery.id, updatedResource);

            // Sync local state
            const deliveryIndex = deliveries.value.findIndex(
                deliveryItem => deliveryItem.id === delivery.id
            );
            if (deliveryIndex !== -1) {
                const syncedDelivery      = deliveries.value[deliveryIndex];
                syncedDelivery.status         = DeliveryStatus.COMPLETED;
                syncedDelivery.completedAt    = nowIso;
                syncedDelivery.currentLabel   = delivery.destination;
                syncedDelivery.waypoints      = syncedDelivery.waypoints.map(
                    waypointItem => new Waypoint({
                        ...waypointItem,
                        reached:   true,
                        timestamp: waypointItem.timestamp ?? nowIso
                    })
                );
            }
        } catch (error) {
            errors.value.push(error);
        }
    }

    /**
     * Transitions a delivery from REGISTERED to IN_TRANSIT.
     *
     * Business rules:
     * - Only REGISTERED deliveries can be started.
     * - The first waypoint is marked as reached with the current timestamp.
     *
     * @param {Delivery} delivery - The delivery to start.
     * @returns {Promise<void>}
     */
    async function startTransit(delivery) {
        if (!delivery.canStartTransit) return;

        const nowIso = new Date().toISOString();

        const updatedResource = {
            id:               delivery.id,
            trackingNumber:   delivery.trackingNumber,
            orderId:          delivery.orderId,
            supplierName:     delivery.supplierName,
            origin:           delivery.origin,
            destination:      delivery.destination,
            driverName:       delivery.driverName,
            driverPhone:      delivery.driverPhone,
            vehicle:          delivery.vehicle,
            licensePlate:     delivery.licensePlate,
            status:           DeliveryStatus.IN_TRANSIT,
            registeredAt:     delivery.registeredAt,
            estimatedArrival: delivery.estimatedArrival,
            completedAt:      null,
            currentLabel:     delivery.origin,
            currentLatitude:  delivery.currentLatitude,
            currentLongitude: delivery.currentLongitude,
            products:         delivery.products,
            totalWeight:      delivery.totalWeight,
            businessId:       delivery.businessId,
            purchaseDetailId: delivery.purchaseDetailId
        };

        try {
            await deliveryApi.updateDelivery(delivery.id, updatedResource);

            // Mark the first waypoint as reached if it exists
            const firstWaypoint = delivery.waypoints[0];
            if (firstWaypoint && !firstWaypoint.reached) {
                await deliveryApi.updateWaypoint(firstWaypoint.id, {
                    ...firstWaypoint,
                    reached:   true,
                    timestamp: nowIso
                });
            }

            // Sync local state
            const deliveryIndex = deliveries.value.findIndex(
                deliveryItem => deliveryItem.id === delivery.id
            );
            if (deliveryIndex !== -1) {
                const syncedDelivery    = deliveries.value[deliveryIndex];
                syncedDelivery.status   = DeliveryStatus.IN_TRANSIT;
                if (syncedDelivery.waypoints[0] && !syncedDelivery.waypoints[0].reached) {
                    syncedDelivery.waypoints[0].reached   = true;
                    syncedDelivery.waypoints[0].timestamp = nowIso;
                }
            }
        } catch (error) {
            errors.value.push(error);
        }
    }

    /**
     * Cancels an in-progress delivery.
     *
     * Business rules:
     * - COMPLETED and already CANCELLED deliveries cannot be cancelled.
     *
     * @param {Delivery} delivery - The delivery to cancel.
     * @returns {Promise<void>}
     */
    async function cancelDelivery(delivery) {
        if (delivery.isCompleted || delivery.isCancelled) return;

        const updatedResource = {
            id:               delivery.id,
            trackingNumber:   delivery.trackingNumber,
            orderId:          delivery.orderId,
            supplierName:     delivery.supplierName,
            origin:           delivery.origin,
            destination:      delivery.destination,
            driverName:       delivery.driverName,
            driverPhone:      delivery.driverPhone,
            vehicle:          delivery.vehicle,
            licensePlate:     delivery.licensePlate,
            status:           DeliveryStatus.CANCELLED,
            registeredAt:     delivery.registeredAt,
            estimatedArrival: delivery.estimatedArrival,
            completedAt:      null,
            currentLabel:     delivery.currentLabel,
            currentLatitude:  delivery.currentLatitude,
            currentLongitude: delivery.currentLongitude,
            products:         delivery.products,
            totalWeight:      delivery.totalWeight,
            businessId:       delivery.businessId,
            purchaseDetailId: delivery.purchaseDetailId
        };

        try {
            await deliveryApi.updateDelivery(delivery.id, updatedResource);
            const deliveryIndex = deliveries.value.findIndex(
                deliveryItem => deliveryItem.id === delivery.id
            );
            if (deliveryIndex !== -1) {
                deliveries.value[deliveryIndex].status = DeliveryStatus.CANCELLED;
            }
        } catch (error) {
            errors.value.push(error);
        }
    }

    return {
        // State
        deliveries,
        deliveriesLoaded,
        errors,
        // Computed
        inTransitDeliveries,
        atDestinationDeliveries,
        completedDeliveries,
        totalCount,
        inTransitCount,
        atDestinationCount,
        completedCount,
        // Queries
        getDeliveryById,
        // Fetch
        fetchDeliveries,
        loadDeliveryWaypoints,
        // CRUD / transitions
        createDelivery,
        startTransit,
        simulateLocationUpdate,
        completeDelivery,
        cancelDelivery
    };
});

export default useDeliveryStore;
