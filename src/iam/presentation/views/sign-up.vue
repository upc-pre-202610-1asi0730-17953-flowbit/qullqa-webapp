<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import useIamStore from '../../application/iam.store.js';

const { t } = useI18n();
const router = useRouter();
const store  = useIamStore();

/**
 * Reactive form state for all sign-up fields.
 */
const form = ref({
  businessName:    '',
  ruc:             '',
  fullName:        '',
  phone:           '',
  email:           '',
  password:        '',
  confirmPassword: ''
});

/**
 * Field-level validation errors.
 * @type {import('vue').Ref<Object.<string,string>>}
 */
const fieldErrors = ref({});

/**
 * Whether the registration succeeded (shows success message).
 * @type {import('vue').Ref<boolean>}
 */
const success = ref(false);

/**
 * Validates all form fields according to business rules:
 * - businessName must not be empty.
 * - fullName must not be empty.
 * - email must contain '@'.
 * - password must be at least 6 characters.
 * - confirmPassword must match password.
 *
 * @returns {boolean} True if all validations pass.
 */
function validateForm() {
  const newErrors = {};

  if (!form.value.businessName.trim()) {
    newErrors.businessName = t('sign-up.error-business-name');
  }
  if (!form.value.fullName.trim()) {
    newErrors.fullName = t('sign-up.error-full-name');
  }
  if (!form.value.email || !form.value.email.includes('@')) {
    newErrors.email = t('sign-up.error-email');
  }
  if (!form.value.password || form.value.password.length < 6) {
    newErrors.password = t('sign-up.error-password');
  }
  if (form.value.password !== form.value.confirmPassword) {
    newErrors.confirmPassword = t('sign-up.error-confirm');
  }

  fieldErrors.value = newErrors;
  return Object.keys(newErrors).length === 0;
}

/**
 * Clears the error for a specific field when the user starts editing it.
 * @param {string} fieldName - Name of the field being edited.
 */
function clearFieldError(fieldName) {
  if (fieldErrors.value[fieldName]) {
    delete fieldErrors.value[fieldName];
  }
}

/**
 * Submits the sign-up form.
 * On success, shows a confirmation message and navigates to home after a short delay.
 */
async function submitSignUp() {
  if (!validateForm()) return;

  store.signUp({
    businessName: form.value.businessName,
    fullName:     form.value.fullName,
    email:        form.value.email,
    password:     form.value.password
  });

  await new Promise(resolve => setTimeout(resolve, 300));

  if (store.isAuthenticated) {
    success.value = true;
    setTimeout(() => {
      router.push({ name: 'home' });
    }, 2000);
  }
}

/**
 * Navigates back to the sign-in view.
 */
function navigateToSignIn() {
  router.push({ name: 'sign-in' });
}
</script>

<template>
  <div
      class="min-h-screen flex align-items-center justify-content-center p-4"
      style="background-color: #FAFAF7;"
  >
    <pv-card class="w-full" style="max-width: 640px;">
      <template #content>

        <!-- Header -->
        <div class="flex align-items-center gap-3 mb-5">
          <pv-button
              icon="pi pi-arrow-left"
              text
              rounded
              severity="secondary"
              @click="navigateToSignIn"
          />
          <div>
            <h1 class="m-0" style="color: #0B3558;">{{ t('sign-up.title') }}</h1>
            <p class="m-0 mt-1" style="color: #64748B;">{{ t('sign-up.subtitle') }}</p>
          </div>
        </div>

        <!-- Success banner -->
        <div
            v-if="success"
            class="p-3 border-round mb-4"
            style="background-color: #DCFCE7; border: 1px solid #22C55E; color: #22C55E;"
        >
          {{ t('sign-up.success') }}
        </div>

        <form @submit.prevent="submitSignUp" class="flex flex-column gap-5">

          <!-- Section: Business -->
          <div>
            <h3 class="mt-0 mb-3" style="color: #0B3558;">
              {{ t('sign-up.section-business') }}
            </h3>
            <div class="grid">
              <div class="col-12 md:col-6">
                <div class="flex flex-column gap-1">
                  <label for="businessName" style="color: #1E293B;">
                    {{ t('sign-up.business-name') }} *
                  </label>
                  <pv-input-text
                      id="businessName"
                      v-model="form.businessName"
                      :placeholder="t('sign-up.business-placeholder')"
                      class="w-full"
                      @input="clearFieldError('businessName')"
                  />
                  <small v-if="fieldErrors.businessName" style="color: #EF4444;">
                    {{ fieldErrors.businessName }}
                  </small>
                </div>
              </div>
              <div class="col-12 md:col-6">
                <div class="flex flex-column gap-1">
                  <label for="ruc" style="color: #1E293B;">
                    {{ t('sign-up.ruc') }}
                  </label>
                  <pv-input-text
                      id="ruc"
                      v-model="form.ruc"
                      :placeholder="t('sign-up.ruc-placeholder')"
                      class="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Section: Personal -->
          <div>
            <h3 class="mt-0 mb-3" style="color: #0B3558;">
              {{ t('sign-up.section-personal') }}
            </h3>
            <div class="grid">
              <div class="col-12 md:col-6">
                <div class="flex flex-column gap-1">
                  <label for="fullName" style="color: #1E293B;">
                    {{ t('sign-up.full-name') }} *
                  </label>
                  <pv-input-text
                      id="fullName"
                      v-model="form.fullName"
                      :placeholder="t('sign-up.full-name-placeholder')"
                      class="w-full"
                      @input="clearFieldError('fullName')"
                  />
                  <small v-if="fieldErrors.fullName" style="color: #EF4444;">
                    {{ fieldErrors.fullName }}
                  </small>
                </div>
              </div>
              <div class="col-12 md:col-6">
                <div class="flex flex-column gap-1">
                  <label for="phone" style="color: #1E293B;">
                    {{ t('sign-up.phone') }}
                  </label>
                  <pv-input-text
                      id="phone"
                      v-model="form.phone"
                      :placeholder="t('sign-up.phone-placeholder')"
                      class="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Section: Credentials -->
          <div>
            <h3 class="mt-0 mb-3" style="color: #0B3558;">
              {{ t('sign-up.section-credentials') }}
            </h3>
            <div class="flex flex-column gap-3">
              <div class="flex flex-column gap-1">
                <label for="signUpEmail" style="color: #1E293B;">
                  {{ t('sign-up.email') }} *
                </label>
                <pv-input-text
                    id="signUpEmail"
                    v-model="form.email"
                    type="email"
                    :placeholder="t('sign-up.email-placeholder')"
                    class="w-full"
                    @input="clearFieldError('email')"
                />
                <small v-if="fieldErrors.email" style="color: #EF4444;">
                  {{ fieldErrors.email }}
                </small>
              </div>

              <div class="grid">
                <div class="col-12 md:col-6">
                  <div class="flex flex-column gap-1">
                    <label for="signUpPassword" style="color: #1E293B;">
                      {{ t('sign-up.password') }} *
                    </label>
                    <pv-input-text
                        id="signUpPassword"
                        v-model="form.password"
                        type="password"
                        :placeholder="t('sign-up.password-placeholder')"
                        class="w-full"
                        @input="clearFieldError('password')"
                    />
                    <small v-if="fieldErrors.password" style="color: #EF4444;">
                      {{ fieldErrors.password }}
                    </small>
                  </div>
                </div>
                <div class="col-12 md:col-6">
                  <div class="flex flex-column gap-1">
                    <label for="confirmPassword" style="color: #1E293B;">
                      {{ t('sign-up.confirm-password') }} *
                    </label>
                    <pv-input-text
                        id="confirmPassword"
                        v-model="form.confirmPassword"
                        type="password"
                        :placeholder="t('sign-up.password-placeholder')"
                        class="w-full"
                        @input="clearFieldError('confirmPassword')"
                    />
                    <small v-if="fieldErrors.confirmPassword" style="color: #EF4444;">
                      {{ fieldErrors.confirmPassword }}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Submit -->
          <div class="pt-3" style="border-top: 1px solid #E2E8F0;">
            <pv-button
                type="submit"
                :label="t('sign-up.submit')"
                class="w-full"
                style="background-color: #0B3558; border-color: #0B3558; color: #FAFAF7;"
            />
            <p class="text-center mt-3 mb-0" style="color: #64748B; font-size: 0.875rem;">
              {{ t('sign-up.terms') }}
            </p>
          </div>

        </form>

      </template>
    </pv-card>
  </div>
</template>

<style scoped>
</style>
