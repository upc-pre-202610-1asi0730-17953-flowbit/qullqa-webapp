<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import useIamStore from '../../application/iam.store.js';

const { t } = useI18n();
const router = useRouter();
const store  = useIamStore();

/**
 * Reactive form state for the sign-in fields.
 */
const form = ref({
  email:    '',
  password: ''
});

/**
 * Local validation error message shown below the form.
 * @type {import('vue').Ref<string>}
 */
const localError = ref('');

/**
 * Validates the form fields locally before calling the store.
 * Business rule: email must not be empty and must contain '@'.
 * Password must not be empty.
 *
 * @returns {boolean} True if the form is valid.
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
 * On success, navigates to the home view.
 * On failure, displays the error returned by the store.
 */
async function submitSignIn() {
  if (!validateForm()) return;

  store.errors = [];
  store.signIn(form.value.email, form.value.password);

  // Allow the store to process the async call before checking state
  await new Promise(resolve => setTimeout(resolve, 300));

  if (store.isAuthenticated) {
    router.push({ name: 'home' });
  } else if (store.errors.length > 0) {
    localError.value = t(store.errors[0]);
  }
}

/**
 * Navigates to the sign-up view.
 */
function navigateToSignUp() {
  router.push({ name: 'sign-up' });
}
</script>

<template>
  <div
      class="min-h-screen flex align-items-center justify-content-center p-4"
      style="background-color: #FAFAF7;"
  >
    <pv-card class="w-full" style="max-width: 440px;">
      <template #content>

        <!-- Logo + title -->
        <div class="flex flex-column align-items-center mb-5">
          <img
              src="../../../assets/qullqa_logo.jpeg"
              alt="Qullqa Logo"
              style="width: 96px; height: 96px; margin-bottom: 1rem;"
          />
          <h1 class="text-center m-0" style="color: #0B3558;">
            {{ t('sign-in.title') }}
          </h1>
          <p class="text-center mt-2 mb-0" style="color: #64748B;">
            {{ t('sign-in.subtitle') }}
          </p>
        </div>

        <!-- Sign-in form -->
        <form @submit.prevent="submitSignIn" class="flex flex-column gap-3">

          <!-- Email -->
          <div class="flex flex-column gap-1">
            <label for="sign-in-email" style="color: #1E293B;">
              {{ t('sign-in.email') }}
            </label>
            <pv-input-text
                id="sign-in-email"
                v-model="form.email"
                type="email"
                :placeholder="t('sign-in.email-placeholder')"
                class="w-full"
                required
            />
          </div>

          <!-- Password -->
          <div class="flex flex-column gap-1">
            <label for="sign-in-password" style="color: #1E293B;">
              {{ t('sign-in.password') }}
            </label>
            <pv-input-text
                id="sign-in-password"
                v-model="form.password"
                type="password"
                :placeholder="t('sign-in.password-placeholder')"
                class="w-full"
                required
            />
          </div>

          <!-- Error message -->
          <div
              v-if="localError"
              class="p-3 border-round"
              style="background-color: #FEE2E2; color: #EF4444;"
          >
            {{ localError }}
          </div>

          <!-- Submit -->
          <pv-button
              type="submit"
              :label="t('sign-in.submit')"
              class="w-full mt-1"
              style="background-color: #0B3558; border-color: #0B3558; color: #FAFAF7;"
          />

          <!-- Forgot password link -->
          <div class="text-center mt-1">
            <a href="#" style="color: #0E7490; font-size: 0.875rem;">
              {{ t('sign-in.forgot-password') }}
            </a>
          </div>

        </form>

        <!-- Divider + register -->
        <div class="mt-4 pt-4" style="border-top: 1px solid #E2E8F0;">
          <p class="text-center mb-3" style="color: #64748B; font-size: 0.875rem;">
            {{ t('sign-in.no-account') }}
          </p>
          <pv-button
              type="button"
              :label="t('sign-in.register')"
              class="w-full"
              severity="secondary"
              outlined
              @click="navigateToSignUp"
          />
        </div>

      </template>
    </pv-card>
  </div>
</template>

<style scoped>
</style>
