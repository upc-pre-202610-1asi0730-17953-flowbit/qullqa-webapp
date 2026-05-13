<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import LanguageSwitcher from './language-switcher.vue';
import useIamStore from '../../../iam/application/iam.store.js';

const { t } = useI18n();
const router = useRouter();
const iamStore = useIamStore();

/**
 * Controls whether the sidebar is visible on mobile.
 * On desktop (lg+) the sidebar is always visible.
 */
const sidebarOpen = ref(false);

/**
 * Toggles the mobile sidebar open/closed state.
 */
const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
};

/**
 * Closes the mobile sidebar overlay.
 */
const closeSidebar = () => {
  sidebarOpen.value = false;
};

/**
 * Navigation items for the sidebar menu.
 * Each entry maps a translation key, an icon and a route name.
 * Routes are intentionally left as placeholders — each bounded context
 * will wire its own views in a later sprint.
 */
const menuItems = [
  { labelKey: 'option.dashboard',  icon: 'pi pi-home',          routeName: 'dashboard' },
  { labelKey: 'option.products',   icon: 'pi pi-box',           routeName: 'products' },
  { labelKey: 'option.pos',        icon: 'pi pi-shopping-cart', routeName: 'sales-list' },
  { labelKey: 'option.customers',  icon: 'pi pi-users',         routeName: 'customer-list' },
  { labelKey: 'option.movements',  icon: 'pi pi-chart-line',    routeName: 'home' },
  { labelKey: 'option.warehouses', icon: 'pi pi-building',      routeName: 'home' },
  { labelKey: 'option.suppliers',  icon: 'pi pi-truck',         routeName: 'home' },
  { labelKey: 'option.alerts',     icon: 'pi pi-bell',          routeName: 'alerts' },
  { labelKey: 'option.reports',    icon: 'pi pi-chart-bar',     routeName: 'home' },
  { labelKey: 'option.deliveries', icon: 'pi pi-map-marker',    routeName: 'home' },
  { labelKey: 'option.users',      icon: 'pi pi-cog',         routeName: 'home' },
  { labelKey: 'option.plan',       icon: 'pi pi-crown',         routeName: 'home' }
];

/**
 * Navigates to the selected route and closes the mobile sidebar.
 * @param {string} routeName - Name of the target route.
 */
function navigateTo(routeName) {
  router.push({ name: routeName });
  closeSidebar();
}

/**
 * Signs the current user out and navigates to the sign-in view.
 */
function handleSignOut() {
  iamStore.signOut();
  router.push({ name: 'sign-in' });
}
</script>

<template>
  <pv-toast/>
  <pv-confirm-dialog/>

  <div class="min-h-screen" style="background-color: #FAFAF7;">

    <div
        class="lg:hidden fixed top-0 left-0 right-0 z-50 flex align-items-center justify-content-between px-4 py-3"
        style="background-color: #0B3558;"
    >
      <img src="../../../assets/qullqa_logo.jpeg" alt="Qullqa" style="height: 40px;" />
      <div class="flex align-items-center gap-2">
        <language-switcher/>
        <pv-button
            :icon="sidebarOpen ? 'pi pi-times' : 'pi pi-bars'"
            text
            rounded
            style="color: #FAFAF7;"
            @click="toggleSidebar"
        />
      </div>
    </div>

    <aside
        class="fixed top-0 left-0 h-full z-40 flex flex-column"
        style="
        width: 256px;
        background-color: #0B3558;
        transition: transform 0.3s ease;
      "
        :style="{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }"
        :class="{ 'lg:translate-x-0': true }"
    >
      <!-- Logo — hidden on mobile (shown in top bar instead) -->
      <div class="hidden lg:flex justify-content-center align-items-center p-5">
        <img src="../../../assets/qullqa_logo.jpeg" alt="Qullqa" style="height: 64px;" />
      </div>

      <!-- Navigation menu -->
      <nav class="flex-1 px-3 mt-6 lg:mt-0 overflow-y-auto">
        <button
            v-for="item in menuItems"
            :key="item.labelKey"
            class="w-full flex align-items-center gap-3 px-4 py-3 border-round-lg mb-1 cursor-pointer border-none"
            style="
            background-color: transparent;
            color: #FAFAF7;
            transition: background-color 0.2s;
            font-size: 0.95rem;
          "
            @click="navigateTo(item.routeName)"
            @mouseenter="$event.currentTarget.style.backgroundColor = '#0E7490'"
            @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
        >
          <i :class="item.icon" style="font-size: 1.1rem;"/>
          <span>{{ t(item.labelKey) }}</span>
        </button>

        <!-- Sign out button -->
        <button
            class="w-full flex align-items-center gap-3 px-4 py-3 border-round-lg mt-4 cursor-pointer border-none"
            style="
            background-color: transparent;
            color: #FAFAF7;
            transition: background-color 0.2s;
            font-size: 0.95rem;
          "
            @click="handleSignOut"
            @mouseenter="$event.currentTarget.style.backgroundColor = '#0E7490'"
            @mouseleave="$event.currentTarget.style.backgroundColor = 'transparent'"
        >
          <i class="pi pi-sign-out" style="font-size: 1.1rem;"/>
          <span>{{ t('sidebar.logout') }}</span>
        </button>
      </nav>

      <!-- User avatar at bottom -->
      <div
          class="p-4 flex align-items-center gap-3"
          style="border-top: 1px solid #0E7490;"
      >
        <div
            class="flex align-items-center justify-content-center border-circle"
            style="width: 40px; height: 40px; background-color: #0E7490; flex-shrink: 0;"
        >
          <span style="color: #FAFAF7; font-weight: 600; font-size: 0.875rem;">
            {{ iamStore.currentUser ? iamStore.currentUser.initials : 'Q' }}
          </span>
        </div>
        <div class="overflow-hidden">
          <p class="m-0 text-sm font-medium" style="color: #FAFAF7;">
            {{ iamStore.currentUser ? iamStore.currentUser.fullName : 'Qullqa' }}
          </p>
          <p class="m-0 text-xs" style="color: #06B6D4;">
            {{ t('sidebar.admin-label') }}
          </p>
        </div>
      </div>
    </aside>

    <!-- Mobile overlay -->
    <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 lg:hidden"
        style="background-color: rgba(0,0,0,0.5);"
        @click="closeSidebar"
    />

    <main
        class="pt-16 lg:pt-0 px-4 lg:px-8 py-6"
        style="margin-left: 0; transition: margin-left 0.3s ease;"
        :style="{ 'margin-left': '256px' }"
    >
      <div style="max-width: 1280px; margin: 0 auto;">
        <router-view/>
      </div>
    </main>

  </div>
</template>

<style scoped>
/* Force sidebar visible on desktop via inline class complement */
@media (min-width: 1024px) {
  aside {
    transform: translateX(0) !important;
  }
}
</style>
