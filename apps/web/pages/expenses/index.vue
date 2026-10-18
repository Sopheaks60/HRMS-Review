<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type Expense = {
  id: string;
  title: string;
  amount: number | string;
  currency: string;
  status: string;
  createdAt: string;
  employee?: { employeeNo: string; firstNameEn: string; lastNameEn: string };
};

const api = useApi();
const auth = useAuthStore();
const canApprove = computed(() => auth.permissions.includes("expense.approve"));
const rows = ref<Expense[]>([]);
const form = reactive({ title: "", amount: "", currency: "KHR" });
const loading = ref(true);
const busy = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    rows.value = await api<Expense[]>("/expenses");
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load expense claims.";
  } finally {
    loading.value = false;
  }
}

async function submitClaim() {
  busy.value = true;
  error.value = "";
  try {
    await api("/expenses", {
      method: "POST",
      body: { title: form.title.trim(), amount: Number(form.amount), currency: form.currency },
    });
    Object.assign(form, { title: "", amount: "", currency: "KHR" });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not submit the expense claim.";
  } finally {
    busy.value = false;
  }
}

async function decide(row: Expense, status: "APPROVED" | "REJECTED") {
  busy.value = true;
  error.value = "";
  try {
    await api(`/expenses/${row.id}/decide`, { method: "PATCH", body: { status } });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not process this claim.";
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-center justify-between">
      <div><h1 class="text-2xl font-semibold">{{ $t("nav.expenses") }}</h1><p class="mt-1 text-sm text-slate-600">Submit and track employee expense claims.</p></div>
      <button class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>

    <form class="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4" @submit.prevent="submitClaim">
      <input v-model="form.title" required maxlength="240" class="rounded border px-3 py-2 md:col-span-2" placeholder="Expense description" />
      <input v-model="form.amount" required type="number" min="0.01" step="0.01" class="rounded border px-3 py-2" placeholder="Amount" />
      <div class="flex gap-2"><select v-model="form.currency" class="rounded border px-3 py-2" aria-label="Currency"><option value="KHR">KHR</option><option value="USD">USD</option></select><button class="flex-1 rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="busy">Submit claim</button></div>
    </form>

    <div v-if="loading" class="rounded border bg-white p-6 text-slate-600">Loading expense claims…</div>
    <div v-else-if="!rows.length" class="rounded border bg-white p-6 text-slate-600">No expense claims yet.</div>
    <div v-else class="overflow-x-auto rounded-lg border bg-white">
      <table class="w-full text-left text-sm"><thead class="border-b bg-slate-50 text-slate-600"><tr><th class="p-3">Expense</th><th v-if="canApprove" class="p-3">Employee</th><th class="p-3">Amount</th><th class="p-3">Submitted</th><th class="p-3">Status</th><th v-if="canApprove" class="p-3">Action</th></tr></thead>
        <tbody><tr v-for="row in rows" :key="row.id" class="border-b last:border-0"><td class="p-3 font-medium">{{ row.title }}</td><td v-if="canApprove" class="p-3">{{ row.employee?.employeeNo }} · {{ row.employee?.firstNameEn }} {{ row.employee?.lastNameEn }}</td><td class="p-3">{{ Number(row.amount).toLocaleString() }} {{ row.currency }}</td><td class="p-3">{{ new Date(row.createdAt).toLocaleDateString() }}</td><td class="p-3"><span class="rounded bg-slate-100 px-2 py-1">{{ row.status }}</span></td><td v-if="canApprove" class="p-3"><div v-if="row.status === 'SUBMITTED'" class="flex gap-2"><button class="rounded border px-2 py-1 text-green-800 disabled:opacity-50" :disabled="busy" @click="decide(row, 'APPROVED')">Approve</button><button class="rounded border px-2 py-1 text-red-800 disabled:opacity-50" :disabled="busy" @click="decide(row, 'REJECTED')">Reject</button></div><span v-else class="text-slate-400">—</span></td></tr></tbody>
      </table>
    </div>
  </section>
</template>
