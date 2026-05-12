// Lazy-loaded views — each chunk is only downloaded when the user navigates to it.
const posScreen    = () => import('./views/pos-screen.vue');
const saleList     = () => import('./views/sale-list.vue');
const customerList = () => import('./views/customer-list.vue');
const customerForm = () => import('./views/customer-form.vue');

/**
 * Route definitions for the Sales & POS Management bounded context.
 * These are child routes of the authenticated /app layout wrapper.
 *
 * @type {import('vue-router').RouteRecordRaw[]}
 */
const salesRoutes = [
    {
        path:      'sales',
        name:      'sales-list',
        component: saleList,
        meta:      { title: 'Sales' }
    },
    {
        path:      'sales/pos',
        name:      'pos-screen',
        component: posScreen,
        meta:      { title: 'Point of Sale' }
    },
    {
        path:      'sales/customers',
        name:      'customer-list',
        component: customerList,
        meta:      { title: 'Customers' }
    },
    {
        path:      'sales/customers/new',
        name:      'customer-new',
        component: customerForm,
        meta:      { title: 'New Customer' }
    },
    {
        path:      'sales/customers/:id/edit',
        name:      'customer-edit',
        component: customerForm,
        meta:      { title: 'Edit Customer' }
    }
];

export default salesRoutes;