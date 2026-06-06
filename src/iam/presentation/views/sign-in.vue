<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import useIamStore from '../../application/iam.store.js';

const { t }   = useI18n();
const router  = useRouter();
const iamStore = useIamStore();

/**
 * Reactive form state for sign-in credentials.
 */
const form = ref({
  email:      '',
  password:   '',
  rememberMe: false
});

/**
 * Whether the password field is shown as plain text.
 * @type {import('vue').Ref<boolean>}
 */
const showPassword = ref(false);

/**
 * Local validation error message shown below the form.
 * @type {import('vue').Ref<string>}
 */
const localError = ref('');

/**
 * Whether the sign-in request is in progress.
 * @type {import('vue').Ref<boolean>}
 */
const isLoading = ref(false);

/**
 * Toggles the password field visibility.
 */
function togglePasswordVisibility() {
  showPassword.value = !showPassword.value;
}

/**
 * Validates the form locally before calling the store.
 * Business rule: email must not be empty and must contain '@'.
 * Password must not be empty.
 * @returns {boolean}
 */
function validateForm() {
  if (!form.value.email || !form.value.password) {
    localError.value = t('sign-in.error-empty');
    return false;
  }
  if (!form.value.email.includes('@')) {
    localError.value = t('sign-in.error-invalid-email');
    return false;
  }
  localError.value = '';
  return true;
}

/**
 * Submits sign-in credentials to the store.
 * On success navigates to the dashboard.
 * On failure displays the error from the store.
 */
async function submitSignIn() {
  if (!validateForm()) return;
  isLoading.value = true;
  iamStore.errors = [];
  iamStore.signIn(form.value.email, form.value.password);
  await new Promise(resolve => setTimeout(resolve, 500));
  isLoading.value = false;
  if (iamStore.isAuthenticated) {
    router.push({ name: 'dashboard' });
  } else if (iamStore.errors.length > 0) {
    localError.value = t(iamStore.errors[0]);
  }
}

/** Navigates to the sign-up view. */
function navigateToSignUp() {
  router.push({ name: 'sign-up' });
}

/** Navigates to the forgot-password view. */
function navigateToForgotPassword() {
  router.push({ name: 'forgot-password' });
}
</script>

<template>
  <div class="flex min-h-screen" style="background-color: #FAFAF7;">

    <!-- ── Left panel (desktop only) ──────────────────────────────── -->
    <div
        class="hidden lg:flex flex-column justify-content-between p-8 relative overflow-hidden"
        style="width: 58%; background-color: #0B3558; flex-shrink: 0;"
    >
      <!-- Decorative circles -->
      <div class="absolute" style="top: -144px; right: -144px; width: 440px; height: 440px; border-radius: 50%; background-color: #0E7490; opacity: 0.08;"/>
      <div class="absolute" style="bottom: -176px; left: -112px; width: 400px; height: 400px; border-radius: 50%; background-color: #0E7490; opacity: 0.06;"/>
      <div class="absolute" style="top: 50%; right: -80px; width: 280px; height: 280px; border-radius: 50%; background-color: #E0F2FE; opacity: 0.05; transform: translateY(-50%);"/>

      <!-- Logo -->
      <div class="relative flex align-items-center gap-3">
        <img src="../../../assets/qullqa_logo.jpeg" alt="Qullqa" style="width: 48px; height: 48px; object-fit: contain; border-radius: 10px;"/>
        <span style="color: #FAFAF7; font-size: 1.3rem; font-weight: 700; letter-spacing: 0.02em;">Qullqa</span>
      </div>

      <!-- Center content -->
      <div class="relative flex flex-column gap-6">
        <div class="flex flex-column gap-3">
          <p style="color: #0E7490; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
            Gestión inteligente para tu negocio
          </p>
          <h1 style="color: #FAFAF7; font-size: 2.2rem; font-weight: 700; line-height: 1.22; margin: 0;">
            Controla tu inventario,<br/>impulsa tu rentabilidad.
          </h1>
          <p style="color: #93B5C9; font-size: 0.97rem; line-height: 1.75; margin: 0;">
            La plataforma diseñada para bodegas y farmacias independientes. Gestiona stock, ventas y alertas desde un solo lugar.
          </p>
        </div>
        <div class="flex flex-column gap-3">
          <div v-for="feature in [
                        { icon: 'pi pi-chart-bar', text: 'Dashboard de inventario en tiempo real' },
                        { icon: 'pi pi-bell',      text: 'Alertas de vencimiento y stock bajo' },
                        { icon: 'pi pi-shield',    text: 'Control seguro de accesos por rol' }
                    ]" :key="feature.text" class="flex align-items-center gap-3">
            <div class="flex align-items-center justify-content-center border-round-lg" style="width: 32px; height: 32px; background-color: rgba(14,116,144,0.2); flex-shrink: 0;">
              <i :class="feature.icon" style="color: #0E7490; font-size: 0.85rem;"/>
            </div>
            <span style="color: #BDD4E1; font-size: 0.9rem;">{{ feature.text }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <p style="color: rgba(255,255,255,0.3); font-size: 0.74rem;">© 2026 Flowbit · Qullqa</p>
    </div>

    <!-- ── Right panel ─────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-column align-items-center justify-content-center px-5 sm:px-8 py-10 overflow-y-auto">

      <!-- Mobile logo -->
      <div class="flex lg:hidden align-items-center gap-3 mb-6">
        <img src="../../../assets/qullqa_logo.jpeg" alt="Qullqa" style="width: 40px; height: 40px; object-fit: contain; border-radius: 8px;"/>
        <span style="font-size: 1.2rem; font-weight: 700; color: #0B3558;">Qullqa</span>
      </div>

      <div style="width: 100%; max-width: 420px;">

        <!-- Title -->
        <div class="mb-6">
          <h2 class="m-0" style="font-size: 1.5rem; font-weight: 700; color: #0B3558;">{{ t('sign-in.title') }}</h2>
          <p class="m-0 mt-1" style="color: #64748B; font-size: 0.92rem;">{{ t('sign-in.subtitle') }}</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="submitSignIn" style="display: flex; flex-direction: column; gap: 1.25rem;">

          <!-- Email -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label for="sign-in-email" style="font-size: 0.875rem; font-weight: 500; color: #1E293B;">
              {{ t('sign-in.email') }}
            </label>
            <input
                id="sign-in-email"
                v-model="form.email"
                type="email"
                :placeholder="t('sign-in.email-placeholder')"
                required
                style="border-radius: 12px; padding: 12px 16px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; transition: all 0.2s;"
                @focus="(event) => { event.target.style.borderColor = '#0E7490'; event.target.style.backgroundColor = '#ffffff'; event.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.12)'; }"
                @blur="(event)  => { event.target.style.borderColor = '#E2E8F0'; event.target.style.backgroundColor = '#F1F5F9'; event.target.style.boxShadow = 'none'; }"
            />
          </div>

          <!-- Password -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div class="flex align-items-center justify-content-between">
              <label for="sign-in-password" style="font-size: 0.875rem; font-weight: 500; color: #1E293B;">
                {{ t('sign-in.password') }}
              </label>
              <button
                  type="button"
                  style="background: none; border: none; color: #0E7490; font-size: 0.82rem; font-weight: 500; cursor: pointer; padding: 0;"
                  @click="navigateToForgotPassword"
                  @mouseenter="(event) => event.currentTarget.style.color = '#0B3558'"
                  @mouseleave="(event) => event.currentTarget.style.color = '#0E7490'"
              >
                {{ t('sign-in.forgot-password') }}
              </button>
            </div>
            <div class="relative">
              <input
                  id="sign-in-password"
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  :placeholder="t('sign-in.password-placeholder')"
                  required
                  style="width: 100%; border-radius: 12px; padding: 12px 48px 12px 16px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; transition: all 0.2s; box-sizing: border-box;"
                  @focus="(event) => { event.target.style.borderColor = '#0E7490'; event.target.style.backgroundColor = '#ffffff'; event.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.12)'; }"
                  @blur="(event)  => { event.target.style.borderColor = '#E2E8F0'; event.target.style.backgroundColor = '#F1F5F9'; event.target.style.boxShadow = 'none'; }"
              />
              <button
                  type="button"
                  class="absolute"
                  style="right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94A3B8; cursor: pointer; padding: 4px; border-radius: 6px; display: flex; align-items: center;"
                  @click="togglePasswordVisibility"
                  @mouseenter="(event) => event.currentTarget.style.color = '#0E7490'"
                  @mouseleave="(event) => event.currentTarget.style.color = '#94A3B8'"
              >
                <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" style="font-size: 1rem;"/>
              </button>
            </div>
          </div>

          <!-- Remember me -->
          <div class="flex align-items-center gap-2">
            <button
                type="button"
                class="flex align-items-center justify-content-center border-round flex-shrink-0"
                style="width: 20px; height: 20px; border: none; cursor: pointer; transition: all 0.2s;"
                :style="{
                                backgroundColor: form.rememberMe ? '#0E7490' : '#F1F5F9',
                                border:          form.rememberMe ? 'none' : '1.5px solid #CBD5E1'
                            }"
                @click="form.rememberMe = !form.rememberMe"
            >
              <i v-if="form.rememberMe" class="pi pi-check" style="color: #fff; font-size: 0.65rem;"/>
            </button>
            <span style="color: #64748B; font-size: 0.875rem;">{{ t('sign-in.remember-me') }}</span>
          </div>

          <!-- Error -->
          <div
              v-if="localError"
              class="p-3 border-round-lg"
              style="background-color: #FEE2E2; color: #EF4444; font-size: 0.875rem;"
          >
            {{ localError }}
          </div>

          <!-- Submit -->
          <button
              type="submit"
              :disabled="isLoading"
              class="w-full flex align-items-center justify-content-center gap-2 border-round-xl border-none cursor-pointer"
              style="padding: 14px; font-size: 0.95rem; font-weight: 600; color: #fff; transition: all 0.2s; box-shadow: 0 4px 14px rgba(14,116,144,0.30);"
              :style="{
                            backgroundColor: isLoading ? 'rgba(14,116,144,0.7)' : '#0E7490',
                            cursor: isLoading ? 'not-allowed' : 'pointer'
                        }"
              @mouseenter="(event) => { if (!isLoading) { event.currentTarget.style.backgroundColor = '#0B3558'; event.currentTarget.style.boxShadow = '0 4px 18px rgba(11,53,88,0.30)'; } }"
              @mouseleave="(event) => { if (!isLoading) { event.currentTarget.style.backgroundColor = '#0E7490'; event.currentTarget.style.boxShadow = '0 4px 14px rgba(14,116,144,0.30)'; } }"
          >
                        <span v-if="isLoading" class="flex align-items-center gap-2">
                            <span style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; border-top-color: transparent;" class="animate-spin"/>
                            {{ t('sign-in.loading') }}
                        </span>
            <span v-else class="flex align-items-center gap-2">
                            {{ t('sign-in.submit') }}
                            <i class="pi pi-arrow-right" style="font-size: 0.85rem;"/>
                        </span>
          </button>
        </form>

        <!-- Register link -->
        <p class="text-center mt-5" style="color: #64748B; font-size: 0.875rem;">
          {{ t('sign-in.no-account') }}
          <button
              type="button"
              style="background: none; border: none; color: #0E7490; font-weight: 600; cursor: pointer; padding: 0;"
              @click="navigateToSignUp"
              @mouseenter="(event) => event.currentTarget.style.color = '#0B3558'"
              @mouseleave="(event) => event.currentTarget.style.color = '#0E7490'"
          >
            {{ t('sign-in.register') }}
          </button>
        </p>

      </div>

      <p class="mt-8" style="color: #94A3B8; font-size: 0.74rem;">
        © 2026 Flowbit · Qullqa · Todos los derechos reservados
      </p>
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