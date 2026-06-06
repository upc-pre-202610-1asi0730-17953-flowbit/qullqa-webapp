<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import useIamStore from '../../application/iam.store.js';

const { t }    = useI18n();
const router   = useRouter();
const iamStore = useIamStore();

/**
 * Reactive form state for the registration fields.
 */
const form = ref({
  fullName:     '',
  businessName: '',
  businessType: '',
  email:        '',
  password:     ''
});

/**
 * Per-field validation error messages.
 */
const fieldErrors = ref({
  fullName:     '',
  businessName: '',
  businessType: '',
  email:        '',
  password:     ''
});

/**
 * Whether the password field is shown as plain text.
 * @type {import('vue').Ref<boolean>}
 */
const showPassword = ref(false);

/**
 * Whether the sign-up request is in progress.
 * @type {import('vue').Ref<boolean>}
 */
const isLoading = ref(false);

/**
 * Available business type options, derived from the Figma prototype.
 * @type {Array<{value: string, labelKey: string, descKey: string}>}
 */
const businessTypeOptions = [
  { value: 'BODEGA',   labelKey: 'sign-up.type-bodega',   descKey: 'sign-up.type-bodega-desc'   },
  { value: 'FARMACIA', labelKey: 'sign-up.type-farmacia', descKey: 'sign-up.type-farmacia-desc' }
];

/**
 * Password strength level (0–4) used to render the strength bar.
 * Business rule:
 * - 0: empty
 * - 1: 1–3 chars
 * - 2: 4–6 chars
 * - 3: 7–9 chars, or < 10 with mixed content
 * - 4: 10+ chars
 * @type {import('vue').ComputedRef<number>}
 */
function computePasswordStrength(password) {
  if (!password) return 0;
  if (password.length < 4)  return 1;
  if (password.length < 7)  return 2;
  if (password.length < 10) return 3;
  return 4;
}

/**
 * Returns the color for the strength bar based on the strength level.
 * @param {number} level - Strength level 1–4.
 * @returns {string} Hex color.
 */
function resolveStrengthBarColor(level) {
  if (level <= 1) return '#EF4444';
  if (level <= 2) return '#FACC15';
  if (level <= 3) return '#0E7490';
  return '#16A34A';
}

/**
 * Validates all registration fields.
 * Business rules:
 * - fullName: required.
 * - businessName: required.
 * - businessType: must be selected.
 * - email: must be a valid address (contains '@').
 * - password: minimum 8 characters.
 * @returns {boolean} True when all fields are valid.
 */
function validateForm() {
  fieldErrors.value = { fullName: '', businessName: '', businessType: '', email: '', password: '' };
  let isValid = true;

  if (!form.value.fullName.trim()) {
    fieldErrors.value.fullName = t('sign-up.error-full-name');
    isValid = false;
  }
  if (!form.value.businessName.trim()) {
    fieldErrors.value.businessName = t('sign-up.error-business-name');
    isValid = false;
  }
  if (!form.value.businessType) {
    fieldErrors.value.businessType = t('sign-up.error-business-type');
    isValid = false;
  }
  if (!form.value.email || !form.value.email.includes('@')) {
    fieldErrors.value.email = t('sign-up.error-email');
    isValid = false;
  }
  if (!form.value.password || form.value.password.length < 8) {
    fieldErrors.value.password = t('sign-up.error-password');
    isValid = false;
  }
  return isValid;
}

/**
 * Submits the registration form to the IAM store.
 * On success navigates to the dashboard.
 */
async function submitSignUp() {
  if (!validateForm()) return;
  isLoading.value = true;

  iamStore.signUp({
    fullName:     form.value.fullName,
    businessName: form.value.businessName,
    email:        form.value.email,
    password:     form.value.password
  });

  await new Promise(resolve => setTimeout(resolve, 700));
  isLoading.value = false;

  if (iamStore.isAuthenticated) {
    router.push({ name: 'dashboard' });
  }
}

/** Navigates back to the sign-in view. */
function navigateToSignIn() {
  router.push({ name: 'sign-in' });
}

/**
 * Selects a business type.
 * @param {string} typeValue - The business type value to select.
 */
function selectBusinessType(typeValue) {
  form.value.businessType = typeValue;
  fieldErrors.value.businessType = '';
}
</script>

<template>
  <div class="flex min-h-screen" style="background-color: #FAFAF7;">

    <!-- Left panel -->
    <div
        class="hidden lg:flex flex-column justify-content-between p-8 relative overflow-hidden"
        style="width: 58%; background-color: #0B3558; flex-shrink: 0;"
    >
      <div class="absolute" style="top: -144px; right: -144px; width: 440px; height: 440px; border-radius: 50%; background-color: #0E7490; opacity: 0.08;"/>
      <div class="absolute" style="bottom: -176px; left: -112px; width: 400px; height: 400px; border-radius: 50%; background-color: #0E7490; opacity: 0.06;"/>

      <div class="relative flex align-items-center gap-3">
        <img src="../../../assets/qullqa_logo.jpeg" alt="Qullqa" style="width: 48px; height: 48px; object-fit: contain; border-radius: 10px;"/>
        <span style="color: #FAFAF7; font-size: 1.3rem; font-weight: 700;">Qullqa</span>
      </div>

      <div class="relative flex flex-column gap-4">
        <h1 style="color: #FAFAF7; font-size: 2.2rem; font-weight: 700; line-height: 1.22; margin: 0;">
          Controla tu inventario,<br/>impulsa tu rentabilidad.
        </h1>
        <p style="color: #93B5C9; font-size: 0.97rem; line-height: 1.75; margin: 0;">
          La plataforma diseñada para bodegas y farmacias independientes.
        </p>
      </div>

      <p style="color: rgba(255,255,255,0.3); font-size: 0.74rem;">© 2026 Flowbit · Qullqa</p>
    </div>

    <!-- Right panel -->
    <div class="flex-1 flex flex-column align-items-center justify-content-center px-5 sm:px-8 py-10 overflow-y-auto">

      <!-- Mobile logo -->
      <div class="flex lg:hidden align-items-center gap-3 mb-6">
        <img src="../../../assets/qullqa_logo.jpeg" alt="Qullqa" style="width: 40px; height: 40px; border-radius: 8px;"/>
        <span style="font-size: 1.2rem; font-weight: 700; color: #0B3558;">Qullqa</span>
      </div>

      <div style="width: 100%; max-width: 420px;">

        <!-- Back link -->
        <button
            type="button"
            class="flex align-items-center gap-2 mb-4"
            style="background: none; border: none; color: #64748B; font-size: 0.85rem; font-weight: 500; cursor: pointer; padding: 0;"
            @click="navigateToSignIn"
            @mouseenter="(event) => event.currentTarget.style.color = '#0E7490'"
            @mouseleave="(event) => event.currentTarget.style.color = '#64748B'"
        >
          <i class="pi pi-arrow-left" style="font-size: 0.85rem;"/>
          {{ t('sign-up.back-link') }}
        </button>

        <div class="mb-5">
          <h2 class="m-0" style="font-size: 1.5rem; font-weight: 700; color: #0B3558;">{{ t('sign-up.title') }}</h2>
          <p class="m-0 mt-1" style="color: #64748B; font-size: 0.92rem;">{{ t('sign-up.subtitle') }}</p>
        </div>

        <form @submit.prevent="submitSignUp" style="display: flex; flex-direction: column; gap: 1rem;">

          <!-- Full name -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.875rem; font-weight: 500; color: #1E293B;">{{ t('sign-up.full-name') }}</label>
            <div class="relative">
              <i class="pi pi-user absolute" style="left: 14px; top: 50%; transform: translateY(-50%); color: #94A3B8; font-size: 0.9rem;"/>
              <input
                  v-model="form.fullName"
                  type="text"
                  :placeholder="t('sign-up.full-name-placeholder')"
                  required
                  style="width: 100%; border-radius: 12px; padding: 12px 16px 12px 40px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; transition: all 0.2s; box-sizing: border-box;"
                  @focus="(event) => { event.target.style.borderColor = '#0E7490'; event.target.style.backgroundColor = '#fff'; event.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.12)'; }"
                  @blur="(event)  => { event.target.style.borderColor = '#E2E8F0'; event.target.style.backgroundColor = '#F1F5F9'; event.target.style.boxShadow = 'none'; }"
              />
            </div>
            <p v-if="fieldErrors.fullName" class="m-0" style="color: #EF4444; font-size: 0.78rem;">{{ fieldErrors.fullName }}</p>
          </div>

          <!-- Business name -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.875rem; font-weight: 500; color: #1E293B;">{{ t('sign-up.business-name') }}</label>
            <div class="relative">
              <i class="pi pi-building absolute" style="left: 14px; top: 50%; transform: translateY(-50%); color: #94A3B8; font-size: 0.9rem;"/>
              <input
                  v-model="form.businessName"
                  type="text"
                  :placeholder="t('sign-up.business-placeholder')"
                  required
                  style="width: 100%; border-radius: 12px; padding: 12px 16px 12px 40px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; transition: all 0.2s; box-sizing: border-box;"
                  @focus="(event) => { event.target.style.borderColor = '#0E7490'; event.target.style.backgroundColor = '#fff'; event.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.12)'; }"
                  @blur="(event)  => { event.target.style.borderColor = '#E2E8F0'; event.target.style.backgroundColor = '#F1F5F9'; event.target.style.boxShadow = 'none'; }"
              />
            </div>
            <p v-if="fieldErrors.businessName" class="m-0" style="color: #EF4444; font-size: 0.78rem;">{{ fieldErrors.businessName }}</p>
          </div>

          <!-- Business type selector -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.875rem; font-weight: 500; color: #1E293B;">{{ t('sign-up.business-type') }}</label>
            <div class="grid" style="gap: 0.75rem; grid-template-columns: 1fr 1fr;">
              <button
                  v-for="typeOption in businessTypeOptions"
                  :key="typeOption.value"
                  type="button"
                  class="border-round-xl p-3 text-left cursor-pointer"
                  style="transition: all 0.2s;"
                  :style="{
                                    backgroundColor: form.businessType === typeOption.value ? '#E0F2FE' : '#F1F5F9',
                                    border:          form.businessType === typeOption.value ? '1.5px solid #0E7490' : '1.5px solid #E2E8F0',
                                    boxShadow:       form.businessType === typeOption.value ? '0 0 0 2px rgba(14,116,144,0.12)' : 'none'
                                }"
                  @click="selectBusinessType(typeOption.value)"
              >
                <p class="m-0" style="font-size: 0.82rem; font-weight: 600;"
                   :style="{ color: form.businessType === typeOption.value ? '#0E7490' : '#1E293B' }">
                  {{ t(typeOption.labelKey) }}
                </p>
                <p class="m-0 mt-1" style="font-size: 0.74rem; color: #64748B;">{{ t(typeOption.descKey) }}</p>
              </button>
            </div>
            <p v-if="fieldErrors.businessType" class="m-0" style="color: #EF4444; font-size: 0.78rem;">{{ fieldErrors.businessType }}</p>
          </div>

          <!-- Email -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.875rem; font-weight: 500; color: #1E293B;">{{ t('sign-up.email') }}</label>
            <input
                v-model="form.email"
                type="email"
                :placeholder="t('sign-up.email-placeholder')"
                required
                style="border-radius: 12px; padding: 12px 16px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; transition: all 0.2s;"
                @focus="(event) => { event.target.style.borderColor = '#0E7490'; event.target.style.backgroundColor = '#fff'; event.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.12)'; }"
                @blur="(event)  => { event.target.style.borderColor = '#E2E8F0'; event.target.style.backgroundColor = '#F1F5F9'; event.target.style.boxShadow = 'none'; }"
            />
            <p v-if="fieldErrors.email" class="m-0" style="color: #EF4444; font-size: 0.78rem;">{{ fieldErrors.email }}</p>
          </div>

          <!-- Password -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.875rem; font-weight: 500; color: #1E293B;">{{ t('sign-up.password') }}</label>
            <div class="relative">
              <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  :placeholder="t('sign-up.password-placeholder')"
                  required
                  minlength="8"
                  style="width: 100%; border-radius: 12px; padding: 12px 48px 12px 16px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; transition: all 0.2s; box-sizing: border-box;"
                  @focus="(event) => { event.target.style.borderColor = '#0E7490'; event.target.style.backgroundColor = '#fff'; event.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.12)'; }"
                  @blur="(event)  => { event.target.style.borderColor = '#E2E8F0'; event.target.style.backgroundColor = '#F1F5F9'; event.target.style.boxShadow = 'none'; }"
              />
              <button
                  type="button"
                  class="absolute"
                  style="right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94A3B8; cursor: pointer; padding: 4px; border-radius: 6px;"
                  @click="showPassword = !showPassword"
                  @mouseenter="(event) => event.currentTarget.style.color = '#0E7490'"
                  @mouseleave="(event) => event.currentTarget.style.color = '#94A3B8'"
              >
                <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" style="font-size: 1rem;"/>
              </button>
            </div>
            <!-- Password strength bar -->
            <div v-if="form.password.length > 0" class="flex gap-1 mt-1">
              <div
                  v-for="strengthIndex in [1, 2, 3, 4]"
                  :key="strengthIndex"
                  class="flex-1 border-round-lg"
                  style="height: 4px; transition: background-color 0.3s;"
                  :style="{
                                    backgroundColor: computePasswordStrength(form.password) >= strengthIndex
                                        ? resolveStrengthBarColor(computePasswordStrength(form.password))
                                        : '#E2E8F0'
                                }"
              />
            </div>
            <p v-if="fieldErrors.password" class="m-0" style="color: #EF4444; font-size: 0.78rem;">{{ fieldErrors.password }}</p>
          </div>

          <!-- Submit -->
          <button
              type="submit"
              :disabled="isLoading"
              class="w-full flex align-items-center justify-content-center gap-2 border-round-xl border-none cursor-pointer mt-1"
              style="padding: 14px; font-size: 0.95rem; font-weight: 600; color: #fff; transition: all 0.2s; box-shadow: 0 4px 14px rgba(14,116,144,0.30);"
              :style="{ backgroundColor: isLoading ? 'rgba(14,116,144,0.7)' : '#0E7490' }"
              @mouseenter="(event) => { if (!isLoading) event.currentTarget.style.backgroundColor = '#0B3558'; }"
              @mouseleave="(event) => { if (!isLoading) event.currentTarget.style.backgroundColor = '#0E7490'; }"
          >
                        <span v-if="isLoading" class="flex align-items-center gap-2">
                            <span style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; border-top-color: transparent;" class="animate-spin"/>
                            {{ t('sign-up.loading') }}
                        </span>
            <span v-else>{{ t('sign-up.submit') }}</span>
          </button>

          <!-- Terms -->
          <p class="text-center m-0" style="color: #94A3B8; font-size: 0.78rem; line-height: 1.5;">
            {{ t('sign-up.terms-pre') }}
            <span style="color: #0E7490; font-weight: 500;">{{ t('sign-up.terms-link') }}</span>
            {{ t('sign-up.terms-and') }}
            <span style="color: #0E7490; font-weight: 500;">{{ t('sign-up.privacy-link') }}</span>.
          </p>
        </form>

        <!-- Sign in link -->
        <p class="text-center mt-4" style="color: #64748B; font-size: 0.875rem;">
          {{ t('sign-up.has-account') }}
          <button
              type="button"
              style="background: none; border: none; color: #0E7490; font-weight: 600; cursor: pointer; padding: 0;"
              @click="navigateToSignIn"
              @mouseenter="(event) => event.currentTarget.style.color = '#0B3558'"
              @mouseleave="(event) => event.currentTarget.style.color = '#0E7490'"
          >
            {{ t('sign-up.back-to-login') }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 0.8s linear infinite;
}
</style>