import { Waypoint } from './waypoint.entity.js';

/**
 * Enumeration of the supported delivery lifecycle statuses
 * within the Delivery Tracking bounded context.
 *
 * Business rules:
 * - REGISTERED:     Delivery has been created; not yet in transit.
 * - IN_TRANSIT:     Driver is on the road; location updates are expected.
 * - AT_DESTINATION: Driver has arrived at the drop-off location.
 * - COMPLETED:      Delivery was confirmed as received; completedAt is set.
 * - CANCELLED:      Delivery was voided before completion.
 *
 * @enum {string}
 */
export const DeliveryStatus = Object.freeze({
    REGISTERED:     'REGISTERED',
    IN_TRANSIT:     'IN_TRANSIT',
    AT_DESTINATION: 'AT_DESTINATION',
    COMPLETED:      'COMPLETED',
    CANCELLED:      'CANCELLED'
});

/**
 * Delivery entity within the Delivery Tracking bounded context.
 * Represents a single supplier shipment being tracked in real time.
 *
 * Business rules:
 * - A new Delivery always starts with status REGISTERED.
 * - Only IN_TRANSIT and AT_DESTINATION deliveries can be marked COMPLETED.
 * - Only IN_TRANSIT deliveries can have their location simulated (IoT update).
 * - Waypoints must be traversed in sequenceOrder; the store enforces this.
 * - routeProgress (0–100) is derived from the ratio of reached waypoints.
 * - completedAt must only be set when transitioning to COMPLETED.
 * - A delivery is scoped to a single business (businessId must not be null).
 *
 * @class Delivery
 */
export class Delivery {
    /**
     * @param {Object}         params
     * @param {number|null}    [params.id=null]               - Delivery identifier.
     * @param {string}         [params.trackingNumber='']     - External tracking code (e.g. TRK-2026-0004).
     * @param {string}         [params.orderId='']            - Reference purchase order identifier.
     * @param {string}         [params.supplierName='']       - Name of the supplying company.
     * @param {string}         [params.origin='']             - Full text origin address.
     * @param {string}         [params.destination='']        - Full text destination address.
     * @param {string}         [params.driverName='']         - Name of the assigned driver.
     * @param {string}         [params.driverPhone='']        - Driver contact phone number.
     * @param {string}         [params.vehicle='']            - Vehicle description (e.g. "Camión Mercedes").
     * @param {string}         [params.licensePlate='']       - Vehicle license plate number.
     * @param {string}         [params.status=DeliveryStatus.REGISTERED] - Lifecycle status.
     * @param {string}         [params.registeredAt='']       - ISO 8601 timestamp of registration.
     * @param {string}         [params.estimatedArrival='']   - Estimated delivery date-time string.
     * @param {string|null}    [params.completedAt=null]      - ISO 8601 timestamp of completion.
     * @param {string}         [params.currentLabel='']       - Human-readable current location name.
     * @param {number}         [params.currentLatitude=0]     - Current GPS latitude.
     * @param {number}         [params.currentLongitude=0]    - Current GPS longitude.
     * @param {string[]}       [params.products=[]]           - List of product descriptions in the shipment.
     * @param {string}         [params.totalWeight='']        - Total shipment weight description.
     * @param {number|null}    [params.businessId=null]       - Business this delivery belongs to.
     * @param {number|null}    [params.purchaseDetailId=null] - Linked purchase detail identifier.
     * @param {Waypoint[]}     [params.waypoints=[]]          - Ordered route checkpoints.
     */
    constructor({
                    id               = null,
                    trackingNumber   = '',
                    orderId          = '',
                    supplierName     = '',
                    origin           = '',
                    destination      = '',
                    driverName       = '',
                    driverPhone      = '',
                    vehicle          = '',
                    licensePlate     = '',
                    status           = DeliveryStatus.REGISTERED,
                    registeredAt     = '',
                    estimatedArrival = '',
                    completedAt      = null,
                    currentLabel     = '',
                    currentLatitude  = 0,
                    currentLongitude = 0,
                    products         = [],
                    totalWeight      = '',
                    businessId       = null,
                    purchaseDetailId = null,
                    waypoints        = []
                }) {
        this.id               = id;
        this.trackingNumber   = trackingNumber;
        this.orderId          = orderId;
        this.supplierName     = supplierName;
        this.origin           = origin;
        this.destination      = destination;
        this.driverName       = driverName;
        this.driverPhone      = driverPhone;
        this.vehicle          = vehicle;
        this.licensePlate     = licensePlate;
        this.status           = status;
        this.registeredAt     = registeredAt;
        this.estimatedArrival = estimatedArrival;
        this.completedAt      = completedAt;
        this.currentLabel     = currentLabel;
        this.currentLatitude  = currentLatitude;
        this.currentLongitude = currentLongitude;
        this.products         = Array.isArray(products) ? [...products] : [];
        this.totalWeight      = totalWeight;
        this.businessId       = businessId;
        this.purchaseDetailId = purchaseDetailId;
        this.waypoints        = waypoints
            .map(waypointData => waypointData instanceof Waypoint ? waypointData : new Waypoint(waypointData))
            .sort((waypointA, waypointB) => waypointA.sequenceOrder - waypointB.sequenceOrder);
    }

    // ─── Status predicates ────────────────────────────────────────────────────

    /** @returns {boolean} */
    get isRegistered() { return this.status === DeliveryStatus.REGISTERED; }

    /** @returns {boolean} */
    get isInTransit() { return this.status === DeliveryStatus.IN_TRANSIT; }

    /** @returns {boolean} */
    get isAtDestination() { return this.status === DeliveryStatus.AT_DESTINATION; }

    /** @returns {boolean} */
    get isCompleted() { return this.status === DeliveryStatus.COMPLETED; }

    /** @returns {boolean} */
    get isCancelled() { return this.status === DeliveryStatus.CANCELLED; }

    /**
     * Returns true when the delivery can be started (moved to IN_TRANSIT).
     * Business rule: only REGISTERED deliveries can be started.
     * @returns {boolean}
     */
    get canStartTransit() { return this.status === DeliveryStatus.REGISTERED; }

    /**
     * Returns true when the delivery should show a live indicator.
     * Business rule: only IN_TRANSIT deliveries are considered live.
     * @returns {boolean}
     */
    get isLive() { return this.status === DeliveryStatus.IN_TRANSIT; }

    /**
     * Returns true when a location (IoT) update can be applied to this delivery.
     * Business rule: only IN_TRANSIT deliveries accept location updates.
     * @returns {boolean}
     */
    get canUpdateLocation() { return this.status === DeliveryStatus.IN_TRANSIT; }

    /**
     * Returns true when the delivery can be marked as COMPLETED.
     * Business rule: only IN_TRANSIT and AT_DESTINATION deliveries can complete.
     * @returns {boolean}
     */
    get canComplete() {
        return this.status === DeliveryStatus.IN_TRANSIT
            || this.status === DeliveryStatus.AT_DESTINATION;
    }

    // ─── Route progress ───────────────────────────────────────────────────────

    /**
     * Number of waypoints that have been reached.
     * @returns {number}
     */
    get reachedWaypointsCount() {
        return this.waypoints.filter(waypointItem => waypointItem.reached).length;
    }

    /**
     * Route completion percentage (0–100), derived from waypoint progress.
     * Formula: ((reachedCount - 1) / (total - 1)) × 100, clamped to [0, 100].
     * Returns 0 when there are fewer than 2 waypoints.
     *
     * @returns {number} Integer between 0 and 100.
     */
    get routeProgress() {
        if (this.waypoints.length <= 1) return 0;
        const rawProgress = ((this.reachedWaypointsCount - 1) / (this.waypoints.length - 1)) * 100;
        return Math.round(Math.max(0, Math.min(100, rawProgress)));
    }

    /**
     * Returns the waypoint that is currently active (the last reached one,
     * when the delivery is IN_TRANSIT).
     * @returns {Waypoint|null}
     */
    get currentWaypoint() {
        if (!this.isInTransit) return null;
        const reachedWaypoints = this.waypoints.filter(waypointItem => waypointItem.reached);
        return reachedWaypoints.length > 0 ? reachedWaypoints[reachedWaypoints.length - 1] : null;
    }
}
