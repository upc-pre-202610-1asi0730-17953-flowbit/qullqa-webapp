/**
 * Enumeration of the supported stock movement types within the
 * Product & Inventory Management bounded context.
 *
 * Business rules:
 * - INTAKE    → stock increases; triggered by purchase reception or manual intake.
 * - SALE      → stock decreases; triggered by a completed POS sale.
 * - ADJUSTMENT → manual stock correction; can increase or decrease.
 *
 * @enum {string}
 */
export const MovementType = Object.freeze({
    INTAKE:     'INTAKE',
    SALE:       'SALE',
    ADJUSTMENT: 'ADJUSTMENT'
});