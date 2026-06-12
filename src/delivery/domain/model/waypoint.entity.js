/**
 * Waypoint entity within the Delivery Tracking bounded context.
 * Represents a single geographical checkpoint along a delivery route.
 *
 * Business rules:
 * - Waypoints are ordered by sequenceOrder (ascending).
 * - A waypoint is considered reached when reached === true and timestamp is set.
 * - The first waypoint (sequenceOrder = 1) represents the origin.
 * - The last waypoint represents the destination.
 * - A waypoint can only be marked as reached in sequence
 *   (enforced by the store when simulating IoT updates).
 *
 * @class Waypoint
 */
export class Waypoint {
    /**
     * @param {Object}         params
     * @param {number|null}    [params.id=null]            - Waypoint identifier.
     * @param {number|null}    [params.deliveryId=null]    - Foreign key of the owning Delivery.
     * @param {string}         [params.label='']           - Human-readable checkpoint name.
     * @param {string}         [params.district='']        - District or zone name for display.
     * @param {number}         [params.latitude=0]         - Geographical latitude.
     * @param {number}         [params.longitude=0]        - Geographical longitude.
     * @param {string|null}    [params.timestamp=null]     - ISO 8601 timestamp when this point was reached.
     * @param {boolean}        [params.reached=false]      - Whether the delivery has passed this point.
     * @param {number}         [params.sequenceOrder=1]    - 1-based ordering index along the route.
     */
    constructor({
                    id            = null,
                    deliveryId    = null,
                    label         = '',
                    district      = '',
                    latitude      = 0,
                    longitude     = 0,
                    timestamp     = null,
                    reached       = false,
                    sequenceOrder = 1
                }) {
        this.id            = id;
        this.deliveryId    = deliveryId;
        this.label         = label;
        this.district      = district;
        this.latitude      = latitude;
        this.longitude     = longitude;
        this.timestamp     = timestamp;
        this.reached       = reached;
        this.sequenceOrder = sequenceOrder;
    }

    /**
     * Returns true when this waypoint is the origin (first in the route).
     * @returns {boolean}
     */
    get isOrigin() {
        return this.sequenceOrder === 1;
    }

    /**
     * Returns a formatted coordinates string for display purposes.
     * @returns {string} e.g. "-12.0464, -77.0428"
     */
    get coordinatesDisplay() {
        return `${this.latitude.toFixed(4)}, ${this.longitude.toFixed(4)}`;
    }
}
