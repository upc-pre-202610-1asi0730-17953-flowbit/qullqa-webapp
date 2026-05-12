// Lazy-loaded views for the Identity & Access Management bounded context
const signIn = () => import('./views/sign-in.vue');
const signUp = () => import('./views/sign-up.vue');

/**
 * IAM routes — these are top-level routes (not children of the main layout)
 * because sign-in and sign-up do not use the sidebar layout.
 *
 * They are exported separately so router.js can mount them
 * outside the layout wrapper.
 *
 * @type {import('vue-router').RouteRecordRaw[]}
 */
const iamPublicRoutes = [
    { path: '/sign-in', name: 'sign-in', component: signIn, meta: { title: 'Sign In' } },
    { path: '/sign-up', name: 'sign-up', component: signUp, meta: { title: 'Sign Up' } }
];

export default iamPublicRoutes;
