import { createRouter, createWebHistory } from 'vue-router';
import iamPublicRoutes from './iam/presentation/iam.routes.js';
import Layout from './shared/presentation/components/layout.vue';
import Home from './shared/presentation/views/home.vue';

const about        = () => import('./shared/presentation/views/about.vue');
const pageNotFound = () => import('./shared/presentation/views/page-not-found.vue');

/**
 * Route definitions.
 *
 * Public routes (no layout/sidebar):
 *   /sign-in, /sign-up
 *
 * Authenticated routes (wrapped by Layout):
 *   /home, /about, and future bounded context paths.
 *
 * @type {import('vue-router').RouteRecordRaw[]}
 */
const routes = [
    // Public IAM routes
    ...iamPublicRoutes,

    // Authenticated routes wrapped in the sidebar Layout
    {
        path:      '/',
        component: Layout,
        children: [
            { path: 'home',  name: 'home',  component: Home,  meta: { title: 'Home' } },

        ]
    },

    // Default redirect
    { path: '/', redirect: '/sign-in' },

    // Catch-all 404
    { path: '/:pathMatch(.*)*', name: 'not-found', component: pageNotFound, meta: { title: 'Page Not Found' } }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: routes,
});

/**
 * Global navigation guard.
 * Updates the browser document title on every route change.
 *
 * @param {import('vue-router').RouteLocationNormalized} to - Target route.
 * @param {import('vue-router').RouteLocationNormalized} from - Previous route.
 * @param {import('vue-router').NavigationGuardNext} next - Guard continuation callback.
 * @returns {void}
 */
router.beforeEach((to, from, next) => {
    console.log(`Navigating from ${from.name} to ${to.name}`);
    const baseTitle    = 'Qullqa';
    document.title     = `${baseTitle} - ${to.meta['title'] ?? ''}`;
    return next();
});

export default router;
