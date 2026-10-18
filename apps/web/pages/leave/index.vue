<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type LeaveType = { id: string; code: string; nameEn: string; nameKm: string; paid: boolean; annualQuotaDays: string | number };
type LeaveBalance = { leaveTypeId: string; year: number; entitled: string | number; used: string | number; pending: string | number };
type LeaveRequest = {
  id: string; startDate: string; endDate: string; days: string | number; reason: string | null;
  status: string; createdAt: string; leaveType: LeaveType;
  employee?: { employeeNo: string; firstNameEn: string; lastNameEn: string };
};

const api = useApi();
const auth = useAuthStore();
const canApprove = computed(() => auth.permissions.includes("leave.approve"));
const rows = ref<LeaveRequest[]>([]);
const types = ref<LeaveType[]>([]);
const balances = ref<LeaveBalance[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const form = reactive({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const requests = api<LeaveRequest[]>("/leave");
    const leaveTypes = api<LeaveType[]>("/leave/types");
    const leaveBalances = api<LeaveBalance[]>("/leave/balances/me").catch(() => []);
    [rows.value, types.value, balances.value] = await Promise.all([requests, leaveTypes, leaveBalances]);
    if (!form.leaveTypeId) form.leaveTypeId = types.value[0]?.id ?? "";
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load leave information.";
  } finally {
    loading.value = false;
  }
}

async function submit() {
  saving.value = true;
  error.value = "";
  try {
    await api("/leave", { method: "POST", body: {
      leaveTypeId: form.leaveTypeId,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason.trim() || undefined,
    } });
    Object.assign(form, { leaveTypeId: types.value[0]?.id ?? "", startDate: "", endDate: "", reason: "" });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not submit leave request.";
  } finally {
    saving.value = false;
  }
}

async function decide(request: LeaveRequest, status: "APPROVED" | "REJECTED") {
  saving.value = true;
  error.value = "";
  try {
    await api(`/leave/${request.id}/decide`, { method: "PATCH", body: { status } });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not decide leave request.";
  } finally {
    saving.value = false;
  }
}

function balanceFor(typeId: string) {
  const balance = balances.value.find((item) => item.leaveTypeId === typeId);
  if (!balance) return null;
  return Number(balance.entitled) - Number(balance.used) - Number(balance.pending);
}

onMounted(load);
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-center justify-between">
      <div><h1 class="text-2xl font-semibold">{{ $t("nav.leave") }}</h1><p class="mt-1 text-sm text-slate-600">Request time off, check balances, and review team requests.</p></div>
      <button class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="load">Refresh</button>
    </header>

    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>

    <form class="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5" @submit.prevent="submit">
      <label class="text-sm">Leave type<select v-model="form.leaveTypeId" required class="mt-1 block w-full rounded border px-3 py-2"><option value="" disabled>Select leave type</option><option v-for="type in types" :key="type.id" :value="type.id">{{ type.nameEn }} · {{ type.paid ? "Paid" : "Unpaid" }}</option></select></label>
      <label class="text-sm">From<input v-model="form.startDate" required type="date" class="mt-1 block w-full rounded border px-3 py-2" /></label>
      <label class="text-sm">Through<input v-model="form.endDate" required type="date" :min="form.startDate" class="mt-1 block w-full rounded border px-3 py-2" /></label>
      <label class="text-sm lg:col-span-1">Reason<input v-model="form.reason" maxlength="1000" class="mt-1 block w-full rounded border px-3 py-2" placeholder="Optional" /></label>
      <div class="flex items-end"><button class="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" :disabled="saving || !types.length">{{ saving ? "Submitting…" : "Submit request" }}</button></div>
    </form>

    <section class="space-y-3">
      <h2 class="font-semibold">My leave balances · {{ new Date().getFullYear() }}</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article v-for="type in types" :key="type.id" class="rounded-lg border bg-white p-4"><div class="font-medium">{{ type.nameEn }}</div><p class="mt-1 text-sm text-slate-600">{{ type.paid ? "Paid leave" : "Unpaid leave" }}</p><p class="mt-3 text-lg font-semibold">{{ balanceFor(type.id) ?? Number(type.annualQuotaDays) }} <span class="text-sm font-normal text-slate-500">days available</span></p><p class="text-xs text-slate-500">{{ type.nameKm }}</p></article>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="font-semibold">{{ canApprove ? "Leave requests" : "My requests" }}</h2>
      <div v-if="loading" class="rounded border bg-white p-5 text-slate-600">Loading leave requests…</div>
      <div v-else-if="!rows.length" class="rounded border bg-white p-5 text-slate-600">No leave requests yet.</div>
      <div v-else class="overflow-x-auto rounded-lg border bg-white"><table class="w-full text-left text-sm"><thead class="border-b bg-slate-50 text-slate-600"><tr><th v-if="canApprove" class="p-3">Employee</th><th class="p-3">Leave type</th><th class="p-3">Dates</th><th class="p-3">Days</th><th class="p-3">Reason</th><th class="p-3">Status</th><th v-if="canApprove" class="p-3">Decision</th></tr></thead><tbody><tr v-for="request in rows" :key="request.id" class="border-b last:border-0"><td v-if="canApprove" class="p-3">{{ request.employee?.employeeNo }} · {{ request.employee?.firstNameEn }} {{ request.employee?.lastNameEn }}</td><td class="p-3">{{ request.leaveType.nameEn }}</td><td class="p-3">{{ new Date(request.startDate).toLocaleDateString() }} – {{ new Date(request.endDate).toLocaleDateString() }}</td><td class="p-3">{{ Number(request.days) }}</td><td class="max-w-64 p-3">{{ request.reason || "—" }}</td><td class="p-3"><span class="rounded bg-slate-100 px-2 py-1">{{ request.status }}</span></td><td v-if="canApprove" class="p-3"><div v-if="request.status === 'SUBMITTED'" class="flex gap-2"><button class="rounded border px-2 py-1 text-green-800 disabled:opacity-50" :disabled="saving" @click="decide(request, 'APPROVED')">Approve</button><button class="rounded border px-2 py-1 text-red-800 disabled:opacity-50" :disabled="saving" @click="decide(request, 'REJECTED')">Reject</button></div><span v-else class="text-slate-400">—</span></td></tr></tbody></table></div>
    </section>
  </section>
</template>
