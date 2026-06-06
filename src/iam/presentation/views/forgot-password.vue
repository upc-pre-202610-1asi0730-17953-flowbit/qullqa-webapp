<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t }  = useI18n();
const router = useRouter();

/**
 * The email address entered by the user for password recovery.
 * @type {import('vue').Ref<string>}
 */
const email = ref('');

/**
 * Whether the recovery request is in progress.
 * @type {import('vue').Ref<boolean>}
 */
const isLoading = ref(false);

/**
 * Whether the recovery email has been sent successfully.
 * When true, the success state is shown instead of the form.
 * @type {import('vue').Ref<boolean>}
 */
const emailSent = ref(false);

/**
 * Local validation error message.
 * @type {import('vue').Ref<string>}
 */
const localError = ref('');

/**
 * Submits the password recovery request.
 * Business rule: email must be a non-empty valid address.
 * The actual sending is simulated with a timeout (no real backend call in mock API).
 */
async function submitRecovery() {
  if (!email.value || !email.value.includes('@')) {
    localError.value = t('sign-in.error-invalid-email');
    return;
  }
  localError.value = '';
  isLoading.value  = true;
  await new Promise(resolve => setTimeout(resolve, 1500));
  isLoading.value = false;
  emailSent.value = true;
}

/**
 * Resets the sent state so the user can try a different email.
 */
function retrySubmit() {
  emailSent.value = false;
  email.value     = '';
}

/** Navigates back to the sign-in view. */
function navigateToSignIn() {
  router.push({ name: 'sign-in' });
}
</script>

<template>
  <div class="flex min-h-screen" style="background-color: #FAFAF7;">

    <!-- Left panel (desktop) -->
    <div
        class="hidden lg:flex flex-column justify-content-between p-8 relative overflow-hidden"
        style="width: 58%; background-color: #0B3558; flex-shrink: 0;"
    >
      <div class="absolute" style="top: -144px; right: -144px; width: 440px; height: 440px; border-radius: 50%; background-color: #0E7490; opacity: 0.08;"/>
      <div class="absolute" style="bottom: -176px; left: -112px; width: 400px; height: 400px; border-radius: 50%; background-color: #0E7490; opacity: 0.06;"/>

      <div class="relative flex align-items-center gap-3">
        <img src="../../../assets/qullqa_logo.jpeg" alt="Qullqa" style="width: 48px; height: 48px; border-radius: 10px; object-fit: contain;"/>
        <span style="color: #FAFAF7; font-size: 1.3rem; font-weight: 700;">Qullqa</span>
      </div>

      <div class="relative flex flex-column gap-4">
        <h1 style="color: #FAFAF7; font-size: 2.2rem; font-weight: 700; line-height: 1.22; margin: 0;">
          Controla tu inventario,<br/>impulsa tu rentabilidad.
        </h1>
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
          {{ t('forgot-password.back-link') }}
        </button>

        <div class="mb-6">
          <h2 class="m-0" style="font-size: 1.5rem; font-weight: 700; color: #0B3558;">{{ t('forgot-password.title') }}</h2>
          <p class="m-0 mt-1" style="color: #64748B; font-size: 0.92rem;">{{ t('forgot-password.subtitle') }}</p>
        </div>

        <!-- Success state -->
        <div v-if="emailSent" style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div
              class="border-round-2xl p-5 flex flex-column align-items-center text-center gap-4"
              style="background-color: #E0F2FE; border: 1.5px solid #BAE6FD;"
          >
            <div
                class="flex align-items-center justify-content-center border-circle"
                style="width: 56px; height: 56px; background-color: #0E7490;"
            >
              <i class="pi pi-envelope" style="color: #fff; font-size: 1.3rem;"/>
            </div>
            <div>
              <p class="m-0" style="font-size: 1rem; font-weight: 600; color: #0B3558;">{{ t('forgot-password.success-title') }}</p>
              <p class="m-0 mt-1" style="color: #0E7490; font-size: 0.88rem; line-height: 1.6;">
                {{ t('forgot-password.success-body', { email: email }) }}
              </p>
            </div>
          </div>

          <button
              type="button"
              class="w-full flex align-items-center justify-content-center gap-2 border-round-xl border-none cursor-pointer"
              style="padding: 14px; font-size: 0.95rem; font-weight: 600; color: #fff; background-color: #0E7490; transition: all 0.2s; box-shadow: 0 4px 14px rgba(14,116,144,0.30);"
              @click="navigateToSignIn"
              @mouseenter="(event) => event.currentTarget.style.backgroundColor = '#0B3558'"
              @mouseleave="(event) => event.currentTarget.style.backgroundColor = '#0E7490'"
          >
            {{ t('forgot-password.back-to-login') }}
          </button>

          <p class="text-center m-0" style="color: #94A3B8; font-size: 0.82rem;">
            {{ t('forgot-password.resend-question') }}
            <button
                type="button"
                style="background: none; border: none; color: #0E7490; font-weight: 600; cursor: pointer; padding: 0;"
                @click="retrySubmit"
            >
              {{ t('forgot-password.resend-link') }}
            </button>
          </p>
        </div>

        <!-- Form state -->
        <form v-else @submit.prevent="submitRecovery" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.875rem; font-weight: 500; color: #1E293B;">{{ t('forgot-password.email') }}</label>
            <input
                v-model="email"
                type="email"
                :placeholder="t('forgot-password.email-placeholder')"
                required
                style="border-radius: 12px; padding: 12px 16px; background-color: #F1F5F9; border: 1.5px solid #E2E8F0; color: #0B3558; font-size: 0.92rem; outline: none; transition: all 0.2s;"
                @focus="(event) => { event.target.style.borderColor = '#0E7490'; event.target.style.backgroundColor = '#fff'; event.target.style.boxShadow = '0 0 0 3px rgba(14,116,144,0.12)'; }"
                @blur="(event)  => { event.target.style.borderColor = '#E2E8F0'; event.target.style.backgroundColor = '#F1F5F9'; event.target.style.boxShadow = 'none'; }"
            />
            <p v-if="localError" class="m-0" style="color: #EF4444; font-size: 0.78rem;">{{ localError }}</p>
          </div>

          <button
              type="submit"
              :disabled="isLoading"
              class="w-full flex align-items-center justify-content-center gap-2 border-round-xl border-none"
              style="padding: 14px; font-size: 0.95rem; font-weight: 600; color: #fff; transition: all 0.2s; box-shadow: 0 4px 14px rgba(14,116,144,0.30);"
              :style="{
                            backgroundColor: isLoading ? 'rgba(14,116,144,0.7)' : '#0E7490',
                            cursor: isLoading ? 'not-allowed' : 'pointer'
                        }"
              @mouseenter="(event) => { if (!isLoading) event.currentTarget.style.backgroundColor = '#0B3558'; }"
              @mouseleave="(event) => { if (!isLoading) event.currentTarget.style.backgroundColor = '#0E7490'; }"
          >
                        <span v-if="isLoading" class="flex align-items-center gap-2">
                            <span style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; border-top-color: transparent;" class="animate-spin"/>
                            {{ t('forgot-password.loading') }}
                        </span>
            <span v-else>{{ t('forgot-password.submit') }}</span>
          </button>
        </form>

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