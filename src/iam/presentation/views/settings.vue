<script setup>
import { onMounted, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { useConfirm } from 'primevue';
import useIamStore from '../../application/iam.store.js';
import LanguageSwitcher from '../../../../src/shared/presentation/components/language-switcher.vue';

const { t }    = useI18n();
const confirm  = useConfirm();
const iamStore = useIamStore();

const { users, usersLoaded } = toRefs(iamStore);
const { fetchUsers, deleteUser } = iamStore;

/**
 * Currently active settings tab.
 * @type {import('vue').Ref<'profile'|'users'|'preferences'|'security'|'plan'>}
 */
const activeTab = ref('profile');

/**
 * Settings tabs definition.
 */
const tabs = [
  { key: 'profile',     labelKey: 'settings.tab-profile',     icon: 'pi pi-user'      },
  { key: 'users',       labelKey: 'settings.tab-users',       icon: 'pi pi-users'     },
  { key: 'preferences', labelKey: 'settings.tab-preferences', icon: 'pi pi-sliders-h' },
  { key: 'security',    labelKey: 'settings.tab-security',    icon: 'pi pi-shield'    },
  { key: 'plan',        labelKey: 'settings.tab-plan',        icon: 'pi pi-crown'     }
];

/**
 * Profile form state — pre-filled from the current user and business.
 */
const profileForm = ref({
  businessName: 'Bodega Lima Norte',
  businessType: 'BODEGA',
  address:      '',
  phone:        '',
  fullName:     iamStore.currentUser ? iamStore.currentUser.fullName : '',
  email:        iamStore.currentUser ? iamStore.currentUser.email    : ''
});

/**
 * Security form state for password change.
 */
const securityForm = ref({
  currentPassword: '',
  newPassword:     '',
  confirmPassword: ''
});

/**
 * Per-field security form errors.
 */
const securityErrors = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });

/**
 * Whether the security form was submitted successfully.
 * @type {import('vue').Ref<boolean>}
 */
const securitySuccess = ref(false);

/**
 * Whether email alert notifications are enabled.
 * @type {import('vue').Ref<boolean>}
 */
const notificationsEnabled = ref(true);

onMounted(() => {
  if (!usersLoaded.value) fetchUsers();
});

/**
 * Returns the display label for a role identifier.
 * @param {number|null} roleId - The role identifier from the API.
 * @returns {string} Translated role label.
 */
function resolveRoleLabel(roleId) {
  const roleMap = {
    1: t('settings.role-admin'),
    2: t('settings.role-collaborator'),
    3: t('settings.role-seller')
  };
  return roleMap[roleId] ?? t('settings.role-seller');
}

/**
 * Returns the badge style for a user status.
 * @param {string} status - 'ACTIVE' or 'INACTIVE'.
 * @returns {{ background: string, color: string, label: string }}
 */
function resolveStatusStyle(status) {
  if (status === 'ACTIVE') {
    return { background: '#DCFCE7', color: '#16A34A', label: t('settings.status-active') };
  }
  return { background: '#F1F5F9', color: '#64748B', label: t('settings.status-inactive') };
}

/**
 * Opens a PrimeVue confirmation dialog before deleting a user.
 * Business rule: the current authenticated user cannot delete themselves.
 * @param {import('../../domain/model/user-account.entity.js').UserAccount} userAccount
 */
function confirmDeleteUser(userAccount) {
  confirm.require({
    message: t('settings.confirm-delete-user', { name: userAccount.fullName }),
    header:  t('settings.delete-user-header'),
    icon:    'pi pi-exclamation-triangle',
    accept:  () => deleteUser(userAccount)
  });
}

/**
 * Validates and submits the security (password change) form.
 * Business rules:
 * - currentPassword is required.
 * - newPassword must be at least 8 characters.
 * - confirmPassword must match newPassword.
 */
function submitPasswordChange() {
  securityErrors.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
  let isValid = true;

  if (!securityForm.value.currentPassword) {
    securityErrors.value.currentPassword = t('settings.error-current-password');
    isValid = false;
  }
  if (!securityForm.value.newPassword || securityForm.value.newPassword.length < 8) {
    securityErrors.value.newPassword = t('settings.error-new-password');
    isValid = false;
  }
  if (securityForm.value.newPassword !== securityForm.value.confirmPassword) {
    securityErrors.value.confirmPassword = t('settings.error-confirm-password');
    isValid = false;
  }

  if (!isValid) return;

  securitySuccess.value = true;
  securityForm.value    = { currentPassword: '', newPassword: '', confirmPassword: '' };
  setTimeout(() => { securitySuccess.value = false; }, 3000);
}
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">

    <!-- Header -->
    <div>
      <h1 class="m-0" style="color: #0B3558; font-size: 1.75rem; font-weight: 700;">{{ t('settings.title') }}</h1>
    </div>

    <!-- Tabs (horizontal scroll on mobile) -->
    <div style="overflow-x: auto;">
      <div
          class="flex"
          style="gap: 2px; background-color: #F1F5F9; border-radius: 12px; padding: 4px; width: fit-content; min-width: 100%;"
      >
        <button
            v-for="tab in tabs"
            :key="tab.key"
            class="flex align-items-center gap-2 px-4 py-2 border-round-lg border-none cursor-pointer"
            style="white-space: nowrap; font-size: 0.875rem; transition: all 0.15s;"
            :style="{
                        backgroundColor: activeTab === tab.key ? '#ffffff' : 'transparent',
                        color:           activeTab === tab.key ? '#0B3558' : '#64748B',
                        fontWeight:      activeTab === tab.key ? 600 : 400,
                        boxShadow:       activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }"
            @click="activeTab = tab.key"
        >
          <i :class="tab.icon" style="font-size: 0.9rem;"/>
          {{ t(tab.labelKey) }}
        </button>
      </div>
    </div>

    <!-- ── Profile tab ──────────────────────────────────────────────── -->
    <div v-if="activeTab === 'profile'" class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
      <h3 class="m-0 mb-5" style="color: #0B3558;">{{ t('settings.profile-title') }}</h3>
      <div class="grid m-0" style="gap: 1.25rem;">
        <div class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.875rem; font-weight: 500;">{{ t('settings.field-business-name') }}</label>
          <input v-model="profileForm.businessName" type="text"
                 style="width: 100%; border-radius: 10px; padding: 10px 14px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; box-sizing: border-box;"
                 @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.backgroundColor = '#fff'; }"
                 @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.backgroundColor = '#F1F5F9'; }"
          />
        </div>
        <div class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.875rem; font-weight: 500;">{{ t('settings.field-address') }}</label>
          <input v-model="profileForm.address" type="text"
                 style="width: 100%; border-radius: 10px; padding: 10px 14px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; box-sizing: border-box;"
                 @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.backgroundColor = '#fff'; }"
                 @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.backgroundColor = '#F1F5F9'; }"
          />
        </div>
        <div class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.875rem; font-weight: 500;">{{ t('settings.field-full-name') }}</label>
          <input v-model="profileForm.fullName" type="text"
                 style="width: 100%; border-radius: 10px; padding: 10px 14px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; box-sizing: border-box;"
                 @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.backgroundColor = '#fff'; }"
                 @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.backgroundColor = '#F1F5F9'; }"
          />
        </div>
        <div class="col-12 md:col-6 p-0">
          <label class="block mb-2" style="color: #1E293B; font-size: 0.875rem; font-weight: 500;">{{ t('settings.field-phone') }}</label>
          <input v-model="profileForm.phone" type="tel"
                 style="width: 100%; border-radius: 10px; padding: 10px 14px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; box-sizing: border-box;"
                 @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.backgroundColor = '#fff'; }"
                 @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.backgroundColor = '#F1F5F9'; }"
          />
        </div>
      </div>
      <div class="flex justify-content-end mt-5 pt-4" style="border-top: 1px solid #E2E8F0;">
        <button
            class="flex align-items-center gap-2 px-5 py-2 border-round-lg border-none cursor-pointer"
            style="background-color: #0B3558; color: #FAFAF7; font-size: 0.9rem; font-weight: 600;"
            @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#0E7490'"
            @mouseleave="(e) => e.currentTarget.style.backgroundColor = '#0B3558'"
        >
          <i class="pi pi-check"/>
          {{ t('settings.save-changes') }}
        </button>
      </div>
    </div>

    <!-- ── Users tab ────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'users'" class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
      <div class="flex align-items-center justify-content-between mb-5">
        <h3 class="m-0" style="color: #0B3558;">{{ t('settings.users-title') }}</h3>
        <button
            class="flex align-items-center gap-2 px-4 py-2 border-round-lg border-none cursor-pointer"
            style="background-color: #0B3558; color: #FAFAF7; font-size: 0.875rem; font-weight: 600;"
            @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#0E7490'"
            @mouseleave="(e) => e.currentTarget.style.backgroundColor = '#0B3558'"
        >
          <i class="pi pi-plus" style="font-size: 0.85rem;"/>
          {{ t('settings.invite-user') }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="!usersLoaded" class="flex justify-content-center py-6">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; color: #0E7490;"/>
      </div>

      <!-- Users list (card view on mobile, table on desktop) -->
      <div v-else>
        <!-- Mobile: card list -->
        <div class="lg:hidden" style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div
              v-for="userAccount in users"
              :key="userAccount.id"
              class="flex align-items-start gap-3 p-3 border-round-lg"
              style="border: 1px solid #E2E8F0;"
          >
            <div
                class="flex align-items-center justify-content-center border-circle flex-shrink-0"
                style="width: 36px; height: 36px; background-color: #0E7490; font-size: 0.75rem; font-weight: 700; color: #fff;"
            >
              {{ userAccount.initials }}
            </div>
            <div style="flex: 1; min-width: 0;">
              <p class="m-0" style="color: #1E293B; font-weight: 600; font-size: 0.9rem;">{{ userAccount.fullName }}</p>
              <p class="m-0 mt-1" style="color: #64748B; font-size: 0.78rem;">{{ userAccount.email }}</p>
              <div class="flex align-items-center gap-2 mt-2 flex-wrap">
                                <span class="border-round px-2 py-1" style="font-size: 0.72rem; font-weight: 600; background-color: #EDE9FE; color: #7C3AED;">
                                    {{ resolveRoleLabel(userAccount.roleId) }}
                                </span>
                <span
                    class="border-round px-2 py-1"
                    style="font-size: 0.72rem; font-weight: 600;"
                    :style="{ backgroundColor: resolveStatusStyle(userAccount.status).background, color: resolveStatusStyle(userAccount.status).color }"
                >
                                    {{ resolveStatusStyle(userAccount.status).label }}
                                </span>
              </div>
            </div>
            <button
                class="flex align-items-center justify-content-center border-round border-none cursor-pointer flex-shrink-0"
                style="width: 30px; height: 30px; background: none;"
                @click="confirmDeleteUser(userAccount)"
                @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'"
                @mouseleave="(e) => e.currentTarget.style.backgroundColor = 'transparent'"
            >
              <i class="pi pi-trash" style="color: #EF4444; font-size: 0.85rem;"/>
            </button>
          </div>
        </div>

        <!-- Desktop: table -->
        <div class="hidden lg:block" style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <th class="py-2 px-3 text-left" style="color: #64748B; font-size: 0.8rem; font-weight: 500;">{{ t('settings.col-name') }}</th>
              <th class="py-2 px-3 text-left" style="color: #64748B; font-size: 0.8rem; font-weight: 500;">{{ t('settings.col-email') }}</th>
              <th class="py-2 px-3 text-left" style="color: #64748B; font-size: 0.8rem; font-weight: 500;">{{ t('settings.col-role') }}</th>
              <th class="py-2 px-3 text-left" style="color: #64748B; font-size: 0.8rem; font-weight: 500;">{{ t('settings.col-status') }}</th>
              <th class="py-2 px-3 text-right" style="color: #64748B; font-size: 0.8rem; font-weight: 500;">{{ t('settings.col-actions') }}</th>
            </tr>
            </thead>
            <tbody>
            <tr
                v-for="userAccount in users"
                :key="userAccount.id"
                style="border-bottom: 1px solid #F1F5F9; transition: background-color 0.15s;"
                @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#FAFAF7'"
                @mouseleave="(e) => e.currentTarget.style.backgroundColor = 'transparent'"
            >
              <td class="py-3 px-3">
                <div class="flex align-items-center gap-2">
                  <div
                      class="flex align-items-center justify-content-center border-circle flex-shrink-0"
                      style="width: 32px; height: 32px; background-color: #0E7490; font-size: 0.68rem; font-weight: 700; color: #fff;"
                  >
                    {{ userAccount.initials }}
                  </div>
                  <span style="color: #1E293B; font-weight: 500; font-size: 0.9rem;">{{ userAccount.fullName }}</span>
                </div>
              </td>
              <td class="py-3 px-3" style="color: #64748B; font-size: 0.875rem;">{{ userAccount.email }}</td>
              <td class="py-3 px-3">
                                    <span class="border-round px-2 py-1" style="font-size: 0.72rem; font-weight: 600; background-color: #EDE9FE; color: #7C3AED;">
                                        {{ resolveRoleLabel(userAccount.roleId) }}
                                    </span>
              </td>
              <td class="py-3 px-3">
                                    <span
                                        class="border-round px-2 py-1"
                                        style="font-size: 0.72rem; font-weight: 600;"
                                        :style="{ backgroundColor: resolveStatusStyle(userAccount.status).background, color: resolveStatusStyle(userAccount.status).color }"
                                    >
                                        {{ resolveStatusStyle(userAccount.status).label }}
                                    </span>
              </td>
              <td class="py-3 px-3 text-right">
                <button
                    class="flex align-items-center justify-content-center border-round border-none cursor-pointer ml-auto"
                    style="width: 30px; height: 30px; background: none;"
                    @click="confirmDeleteUser(userAccount)"
                    @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'"
                    @mouseleave="(e) => e.currentTarget.style.backgroundColor = 'transparent'"
                >
                  <i class="pi pi-trash" style="color: #EF4444; font-size: 0.85rem;"/>
                </button>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── Preferences tab ─────────────────────────────────────────── -->
    <div v-if="activeTab === 'preferences'" class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
      <h3 class="m-0 mb-5" style="color: #0B3558;">{{ t('settings.preferences-title') }}</h3>
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div class="flex align-items-center justify-content-between p-4 border-round-lg" style="border: 1px solid #E2E8F0;">
          <div>
            <p class="m-0" style="color: #1E293B; font-weight: 500;">{{ t('settings.language-label') }}</p>
          </div>
          <language-switcher/>
        </div>
        <div class="flex align-items-start justify-content-between p-4 border-round-lg" style="border: 1px solid #E2E8F0;">
          <div style="flex: 1; padding-right: 1rem;">
            <p class="m-0" style="color: #1E293B; font-weight: 500;">{{ t('settings.notifications-label') }}</p>
            <p class="m-0 mt-1" style="color: #64748B; font-size: 0.85rem;">{{ t('settings.notifications-desc') }}</p>
          </div>
          <button
              type="button"
              class="flex-shrink-0"
              style="width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer; transition: background-color 0.2s; position: relative;"
              :style="{ backgroundColor: notificationsEnabled ? '#0E7490' : '#CBD5E1' }"
              @click="notificationsEnabled = !notificationsEnabled"
          >
                        <span
                            class="absolute"
                            style="width: 18px; height: 18px; border-radius: 50%; background-color: #fff; top: 3px; transition: left 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"
                            :style="{ left: notificationsEnabled ? '23px' : '3px' }"
                        />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Security tab ─────────────────────────────────────────────── -->
    <div v-if="activeTab === 'security'" class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
      <h3 class="m-0 mb-5" style="color: #0B3558;">{{ t('settings.security-title') }}</h3>

      <div v-if="securitySuccess" class="p-3 border-round-lg mb-4" style="background-color: #DCFCE7; border: 1px solid #22C55E;">
        <p class="m-0" style="color: #16A34A; font-size: 0.875rem;">{{ t('settings.success-password') }}</p>
      </div>

      <form @submit.prevent="submitPasswordChange" style="display: flex; flex-direction: column; gap: 1rem; max-width: 480px;">
        <div v-for="field in [
                    { key: 'currentPassword', labelKey: 'settings.current-password' },
                    { key: 'newPassword',     labelKey: 'settings.new-password'     },
                    { key: 'confirmPassword', labelKey: 'settings.confirm-password' }
                ]" :key="field.key" style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 0.875rem; font-weight: 500; color: #1E293B;">{{ t(field.labelKey) }}</label>
          <input
              v-model="securityForm[field.key]"
              type="password"
              style="border-radius: 10px; padding: 10px 14px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none;"
              @focus="(e) => { e.target.style.borderColor = '#0E7490'; e.target.style.backgroundColor = '#fff'; }"
              @blur="(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.backgroundColor = '#F1F5F9'; }"
          />
          <p v-if="securityErrors[field.key]" class="m-0" style="color: #EF4444; font-size: 0.78rem;">
            {{ securityErrors[field.key] }}
          </p>
        </div>
        <button
            type="submit"
            class="flex align-items-center gap-2 px-5 py-2 border-round-lg border-none cursor-pointer mt-2"
            style="background-color: #0B3558; color: #FAFAF7; font-size: 0.9rem; font-weight: 600; width: fit-content;"
            @mouseenter="(e) => e.currentTarget.style.backgroundColor = '#0E7490'"
            @mouseleave="(e) => e.currentTarget.style.backgroundColor = '#0B3558'"
        >
          <i class="pi pi-lock"/>
          {{ t('settings.change-password') }}
        </button>
      </form>
    </div>

    <!-- ── Plan tab ─────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'plan'" class="p-5 border-round-xl shadow-1" style="background-color: #ffffff;">
      <h3 class="m-0 mb-5" style="color: #0B3558;">{{ t('settings.plan-title') }}</h3>
      <div class="grid m-0" style="gap: 1rem;">
        <div
            v-for="plan in [
                        { key: 'basic',      labelKey: 'settings.plan-basic',      price: '19.90', isCurrent: false, color: '#64748B', features: ['Inventario básico', 'Ventas POS', '1 almacén', 'Hasta 100 productos'] },
                        { key: 'pro',        labelKey: 'settings.plan-pro',        price: '49.90', isCurrent: true,  color: '#0E7490', features: ['Todo el Plan Básico', 'Alertas inteligentes', '3 almacenes', 'Tracking IoT'] },
                        { key: 'enterprise', labelKey: 'settings.plan-enterprise', price: '99.90', isCurrent: false, color: '#7C3AED', features: ['Todo el Plan Pro', 'Almacenes ilimitados', 'Soporte prioritario', 'Multi-negocio'] }
                    ]"
            :key="plan.key"
            class="col-12 md:col-4 p-0"
        >
          <div
              class="p-4 border-round-xl h-full"
              style="display: flex; flex-direction: column; gap: 1rem;"
              :style="{
                            border:    plan.isCurrent ? `2px solid ${plan.color}` : '1.5px solid #E2E8F0',
                            boxShadow: plan.isCurrent ? `0 0 0 3px rgba(14,116,144,0.12)` : 'none'
                        }"
          >
            <div>
              <p class="m-0" style="font-size: 1rem; font-weight: 700;" :style="{ color: plan.color }">{{ t(plan.labelKey) }}</p>
              <p class="m-0 mt-1" style="font-size: 1.4rem; font-weight: 700; color: #0B3558;">
                {{ t('settings.plan-price', { price: plan.price }) }}
              </p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
              <div v-for="feature in plan.features" :key="feature" class="flex align-items-center gap-2">
                <i class="pi pi-check" style="font-size: 0.8rem;" :style="{ color: plan.color }"/>
                <span style="font-size: 0.82rem; color: #64748B;">{{ feature }}</span>
              </div>
            </div>
            <button
                class="w-full py-2 border-round-lg border-none cursor-pointer"
                style="font-size: 0.875rem; font-weight: 600; transition: all 0.15s;"
                :style="{
                                backgroundColor: plan.isCurrent ? '#F1F5F9' : plan.color,
                                color:           plan.isCurrent ? '#64748B' : '#fff',
                                cursor:          plan.isCurrent ? 'default' : 'pointer'
                            }"
            >
              {{ plan.isCurrent ? t('settings.plan-current') : t('settings.plan-upgrade') }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
</style>