<script setup lang="ts">
definePageMeta({ middleware: "auth" });
const api = useApi();
const auth = useAuthStore();
const me = await api("/employees/me").catch(() => null);
const canManagePii = computed(() => auth.permissions.includes("employee.pii.self"));
const personalData = await api<{ nationalId: string | null; nssfNumber: string | null; bankName: string | null; bankAccount: string | null }>("/employees/me/personal-data").catch(() => null);
const personalForm = reactive({
  nationalId: personalData?.nationalId ?? "",
  nssfNumber: personalData?.nssfNumber ?? "",
  bankName: personalData?.bankName ?? "",
  bankAccount: personalData?.bankAccount ?? "",
});
const saving = ref(false);
const error = ref("");
const saved = ref(false);

async function savePersonalData() {
  saving.value = true;
  error.value = "";
  saved.value = false;
  try {
    await api("/employees/me/personal-data", {
      method: "PATCH",
      body: {
        nationalId: personalForm.nationalId.trim() || null,
        nssfNumber: personalForm.nssfNumber.trim() || null,
        bankName: personalForm.bankName.trim() || null,
        bankAccount: personalForm.bankAccount.trim() || null,
      },
    });
    saved.value = true;
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not save personal data.";
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <section>
    <h1 class="text-2xl font-semibold">{{ $t("nav.ess") }}</h1>
    <p v-if="me" class="mt-4">{{ me.lastNameEn }} {{ me.firstNameEn }} · {{ me.employeeNo }}</p>
    <form v-if="canManagePii" class="mt-6 max-w-3xl space-y-4 rounded-lg border bg-white p-4" @submit.prevent="savePersonalData">
      <div><h2 class="font-semibold">Personal and payroll details</h2><p class="mt-1 text-sm text-slate-600">National ID, NSSF number, and bank account are encrypted when saved.</p></div>
      <p v-if="error" role="alert" class="rounded bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>
      <p v-if="saved" role="status" class="rounded bg-green-50 p-3 text-sm text-green-800">Personal data saved.</p>
      <div class="grid gap-3 sm:grid-cols-2"><label class="text-sm">National ID<input v-model="personalForm.nationalId" maxlength="80" autocomplete="off" class="mt-1 block w-full rounded border px-3 py-2" /></label><label class="text-sm">NSSF number<input v-model="personalForm.nssfNumber" maxlength="80" autocomplete="off" class="mt-1 block w-full rounded border px-3 py-2" /></label><label class="text-sm">Bank name<input v-model="personalForm.bankName" maxlength="120" class="mt-1 block w-full rounded border px-3 py-2" /></label><label class="text-sm">Bank account<input v-model="personalForm.bankAccount" maxlength="100" autocomplete="off" class="mt-1 block w-full rounded border px-3 py-2" /></label></div>
      <button class="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" :disabled="saving">{{ saving ? "Saving…" : "Save personal data" }}</button>
    </form>
    <div class="mt-4 flex gap-3">
      <NuxtLink class="rounded border px-3 py-2" to="/leave">Leave</NuxtLink>
      <NuxtLink class="rounded border px-3 py-2" to="/attendance">Attendance</NuxtLink>
      <NuxtLink class="rounded border px-3 py-2" to="/ess/payslips">Payslips</NuxtLink>
    </div>
  </section>
</template>
