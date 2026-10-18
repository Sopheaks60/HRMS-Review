<script setup lang="ts">
definePageMeta({ layout: "auth" });
const email = ref("owner@demo.krompay.app");
const password = ref("");
const tenantSlug = ref("demo");
const auth = useAuthStore();
async function submit() {
  await auth.login(email.value, password.value, tenantSlug.value);
  await navigateTo("/");
}
</script>

<template>
  <form class="w-96 space-y-4 rounded-xl bg-white p-8 text-slate-900" @submit.prevent="submit">
    <h1 class="text-2xl font-semibold text-emerald-800">{{ $t("auth.login") }}</h1>
    <input v-model="tenantSlug" class="w-full rounded border p-2" :placeholder="$t('auth.tenant')" />
    <input v-model="email" class="w-full rounded border p-2" type="email" :placeholder="$t('auth.email')" />
    <input v-model="password" class="w-full rounded border p-2" type="password" :placeholder="$t('auth.password')" />
    <button class="w-full rounded bg-emerald-700 p-2 text-white">{{ $t("auth.login") }}</button>
  </form>
</template>
