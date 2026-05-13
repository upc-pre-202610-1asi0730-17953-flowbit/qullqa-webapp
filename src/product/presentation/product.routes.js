const productList           = () => import('./views/product-list.vue');
const productForm           = () => import('./views/product-form.vue');
const productDetail         = () => import('./views/product-detail.vue');
const stockIntakeHistory    = () => import('./views/stock-intake-history.vue');
const batchIntake           = () => import('./views/batch-intake.vue');

/**
 * Route definitions for the Product & Inventory Management bounded context.
 * These are child routes of the authenticated /app layout wrapper.
 *
 * @type {import('vue-router').RouteRecordRaw[]}
 */
const productRoutes = [
    {
        path:      'products',
        name:      'products',
        component: productList,
        meta:      { title: 'Products' }
    },
    {
        path:      'products/new',
        name:      'product-new',
        component: productForm,
        meta:      { title: 'New Product' }
    },
    {
        path:      'products/stock/intake',
        name:      'product-stock-intake-history',
        component: stockIntakeHistory,
        meta:      { title: 'Stock Intake History' }
    },
    {
        path:      'products/stock/intake/new',
        name:      'product-batch-intake',
        component: batchIntake,
        meta:      { title: 'Batch Intake' }
    },
    {
        path:      'products/:id',
        name:      'product-detail',
        component: productDetail,
        meta:      { title: 'Product Detail' }
    },
    {
        path:      'products/:id/edit',
        name:      'product-edit',
        component: productForm,
        meta:      { title: 'Edit Product' }
    }
];

export default productRoutes;