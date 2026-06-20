const deliveryList = () => import('./views/delivery-list.vue');

/**
 * Route definitions for the Delivery Tracking bounded context.
 * These are child routes of the authenticated /app layout wrapper.
 *
 * Route structure:
 *   /app/tracking  → delivery-list.vue (delivery table + modals for detail and form)
 *
 * The detail panel and registration form are displayed as in-page modals
 * managed by the delivery-list view's local state (no additional child routes needed).
 *
 * @type {import('vue-router').RouteRecordRaw[]}
 */
const deliveryRoutes = [
    {
        path:      'tracking',
        name:      'deliveries',
        component: deliveryList,
        meta:      { title: 'Delivery Tracking' }
    }
];

export default deliveryRoutes;
