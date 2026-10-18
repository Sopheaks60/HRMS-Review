<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type PayrollRun = {
  id: string;
  status: string;
  fxUsdKhr: string | number;
  totalGross: string | number;
  totalNet: string | number;
  totalTos: string | number;
  totalNssfEe: string | number;
  totalNssfEr: string | number;
  createdAt: string;
  approvedAt?: string | null;
  paidAt?: string | null;
  period: { year: number; month: number; startDate?: string; endDate?: string };
  _count?: { items: number };
  items?: PayrollItem[];
  /** True when this run's gross is >10% higher than the prior month */
  varianceFlag?: boolean;
  /** Percentage difference vs. prior month (e.g. 12.4) */
  variancePct?: number | null;
  /** Username/ID of supervisor who approved the variance — null until approved */
  varianceApprovedBy?: string | null;
};
type PayrollItem = {
  id: string;
  employee: { id: string; employeeNo: string; firstNameEn: string; lastNameEn: string };
  basic: string | number;
  allowances: string | number;
  overtime: string | number;
  unpaidLeave: string | number;
  gross: string | number;
  tosAmount: string | number;
  nssfPensionEe: string | number;
  nssfPensionEr: string | number;
  nssfHealthEr: string | number;
  nssfRiskEr: string | number;
  net: string | number;
  breakdown: { familyRelief?: number; statutoryVersion?: string; contract?: { currency: string; originalBasicSalary: number; fxUsdKhr: number } };
};

const api = useApi();
const auth = useAuthStore();
const runtimeConfig = useRuntimeConfig();
const canRun = computed(() => auth.permissions.includes("payroll.run"));
const canApprove = computed(() => auth.permissions.includes("payroll.approve"));
const canRead = computed(() => auth.permissions.includes("payroll.read"));
const canExport = computed(() => auth.permissions.includes("payroll.export") || canApprove.value);
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const fxUsdKhr = ref(4100);
const runs = ref<PayrollRun[]>([]);
const run = ref<PayrollRun | null>(null);
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const notice = ref("");

// Variance approval form state
const varianceJustification = ref("");
const varianceSaving = ref(false);

async function loadRuns() {
  if (!canRead.value) return;
  loading.value = true;
  error.value = "";
  try {
    runs.value = await api<PayrollRun[]>("/payroll/runs");
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load payroll runs.";
  } finally {
    loading.value = false;
  }
}

async function viewRun(id: string) {
  error.value = "";
  varianceJustification.value = "";
  try {
    run.value = await api<PayrollRun>(`/payroll/runs/${id}`);
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load payroll details.";
  }
}

async function calculate() {
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    const created = await api<PayrollRun>("/payroll/runs", {
      method: "POST",
      body: { year: Number(year.value), month: Number(month.value), fxUsdKhr: Number(fxUsdKhr.value) },
    });
    await loadRuns();
    await viewRun(created.id);
    notice.value = "Payroll calculated and submitted for approval.";
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not calculate payroll.";
  } finally {
    busy.value = false;
  }
}

async function approve() {
  if (!run.value) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    await api(`/payroll/runs/${run.value.id}/approve`, { method: "POST" });
    await loadRuns();
    await viewRun(run.value.id);
    notice.value = "Payroll run approved. Payslips are being generated.";
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not approve this payroll run.";
  } finally {
    busy.value = false;
  }
}

async function markPaid() {
  if (!run.value) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    await api(`/payroll/runs/${run.value.id}/pay`, { method: "POST" });
    await loadRuns();
    await viewRun(run.value.id);
    notice.value = "Payroll run marked as paid.";
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not mark this payroll run paid.";
  } finally {
    busy.value = false;
  }
}

async function voidRun() {
  if (!run.value || !window.confirm("Void this pending payroll run so you can correct source data and recalculate?")) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    await api(`/payroll/runs/${run.value.id}/void`, { method: "POST" });
    await loadRuns();
    await viewRun(run.value.id);
    notice.value = "Payroll run voided. You can now calculate this period again.";
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not void this payroll run.";
  } finally {
    busy.value = false;
  }
}

async function submitVarianceApproval() {
  if (!run.value) return;
  if (varianceJustification.value.trim().length < 20) {
    error.value = "Justification must be at least 20 characters.";
    return;
  }
  varianceSaving.value = true;
  error.value = "";
  notice.value = "";
  try {
    await api(`/payroll/runs/${run.value.id}/variance-approval`, {
      method: "POST",
      body: { justification: varianceJustification.value.trim() },
    });
    await loadRuns();
    await viewRun(run.value.id);
    notice.value = "Variance justification accepted. The run can now proceed to approval.";
    varianceJustification.value = "";
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not submit variance justification.";
  } finally {
    varianceSaving.value = false;
  }
}

function exportRun(format: "aba" | "canadia" | "gdt-xml" | "nssf-csv") {
  if (!run.value) return;
  const base = runtimeConfig.public.apiUrl as string;
  window.open(`${base}/payroll/runs/${run.value.id}/export/${format}`, "_blank");
}

function money(value: string | number | undefined) {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

onMounted(loadRuns);
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ $t("nav.payroll") }}</h1>
        <p class="mt-1 text-sm text-slate-600">Calculate and review Cambodia payroll runs in KHR.</p>
      </div>
      <button v-if="canRead" class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="loadRuns">Refresh</button>
    </header>

    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>
    <p v-if="notice" role="status" class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{{ notice }}</p>

    <form v-if="canRun" class="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="calculate">
      <label class="text-sm">Year<input v-model.number="year" required type="number" min="2020" class="mt-1 block w-full rounded border px-3 py-2" /></label>
      <label class="text-sm">Month<input v-model.number="month" required type="number" min="1" max="12" class="mt-1 block w-full rounded border px-3 py-2" /></label>
      <label class="text-sm">USD → KHR exchange rate<input v-model.number="fxUsdKhr" required type="number" min="1000" max="100000" step="0.01" class="mt-1 block w-full rounded border px-3 py-2" /><span class="mt-1 block text-xs text-slate-500">Saved on the run and applied to USD contracts.</span></label>
      <div class="flex items-end"><button class="w-full rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" :disabled="busy">{{ busy ? "Calculating…" : $t("payroll.run") }}</button></div>
    </form>

    <section v-if="canRead" class="space-y-3">
      <h2 class="font-semibold">Payroll history</h2>
      <div v-if="loading" class="rounded border bg-white p-5 text-slate-600">Loading payroll runs…</div>
      <div v-else-if="!runs.length" class="rounded border bg-white p-5 text-slate-600">No payroll runs found.</div>
      <div v-else class="overflow-x-auto rounded-lg border bg-white">
        <table class="w-full text-left text-sm">
          <thead class="border-b bg-slate-50 text-slate-600">
            <tr>
              <th class="p-3">Period</th>
              <th class="p-3">Employees</th>
              <th class="p-3">Gross</th>
              <th class="p-3">TOS</th>
              <th class="p-3">Net</th>
              <th class="p-3">USD/KHR</th>
              <th class="p-3">Status</th>
              <th class="p-3">Review</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in runs" :key="item.id" class="border-b last:border-0">
              <td class="p-3 font-medium">
                {{ item.period.year }}-{{ String(item.period.month).padStart(2, "0") }}
                <span v-if="item.varianceFlag && !item.varianceApprovedBy" title="Variance threshold exceeded" class="ml-1 text-amber-600">⚠️</span>
              </td>
              <td class="p-3">{{ item._count?.items ?? "—" }}</td>
              <td class="p-3">{{ money(item.totalGross) }} KHR</td>
              <td class="p-3">{{ money(item.totalTos) }} KHR</td>
              <td class="p-3">{{ money(item.totalNet) }} KHR</td>
              <td class="p-3">{{ Number(item.fxUsdKhr).toLocaleString() }}</td>
              <td class="p-3"><span class="rounded bg-slate-100 px-2 py-1">{{ item.status }}</span></td>
              <td class="p-3"><button class="text-blue-700 underline" @click="viewRun(item.id)">View details</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="run" class="space-y-4 rounded-lg border bg-white p-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">Payroll detail · {{ run.period.year }}-{{ String(run.period.month).padStart(2, "0") }}</h2>
          <p class="mt-1 text-sm text-slate-600">Status {{ run.status }} · Exchange rate {{ Number(run.fxUsdKhr).toLocaleString() }} KHR/USD</p>
        </div>
        <div class="flex gap-2">
          <button v-if="canRun && run.status === 'PENDING_APPROVAL'" class="rounded border border-red-300 px-3 py-2 text-red-800 disabled:opacity-50" :disabled="busy" @click="voidRun">Void run</button>
          <button v-if="canApprove && run.status === 'PENDING_APPROVAL'" class="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50" :disabled="busy" @click="approve">{{ $t("payroll.approve") }}</button>
          <button v-if="canApprove && run.status === 'APPROVED'" class="rounded bg-emerald-700 px-3 py-2 text-white disabled:opacity-50" :disabled="busy" @click="markPaid">Mark paid</button>
        </div>
      </header>

      <!-- ── Variance Alert Banner ───────────────────────────────────────── -->
      <div
        v-if="run.varianceFlag && !run.varianceApprovedBy"
        role="alert"
        class="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <p class="font-semibold">
          ⚠️ Variance Alert: This payroll run is
          {{ run.variancePct != null ? run.variancePct.toFixed(1) : "?" }}% higher than last month,
          exceeding the 10% threshold.
        </p>
        <p class="mt-1">A supervisor justification is required before this run can be approved.</p>
      </div>

      <!-- ── Variance Approval Form ──────────────────────────────────────── -->
      <form
        v-if="run.varianceFlag && !run.varianceApprovedBy && canApprove"
        class="space-y-3 rounded border border-amber-200 bg-amber-50 p-4"
        @submit.prevent="submitVarianceApproval"
      >
        <h3 class="font-medium text-amber-900">Supervisor Variance Justification</h3>
        <label class="block text-sm text-amber-800">
          Justification (min. 20 characters, required)
          <textarea
            v-model="varianceJustification"
            required
            minlength="20"
            rows="3"
            class="mt-1 block w-full rounded border border-amber-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
            placeholder="Explain why the payroll total increased by more than 10% compared to last month…"
          />
        </label>
        <button
          class="rounded bg-amber-700 px-4 py-2 text-white disabled:opacity-50"
          :disabled="varianceSaving || varianceJustification.trim().length < 20"
        >
          {{ varianceSaving ? "Submitting…" : "Submit Variance Justification" }}
        </button>
      </form>

      <div v-if="run.varianceFlag && run.varianceApprovedBy" class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        ✅ Variance approved by {{ run.varianceApprovedBy }}. This run may proceed.
      </div>

      <!-- ── Summary cards ──────────────────────────────────────────────── -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article class="rounded bg-slate-50 p-3"><span class="text-xs text-slate-500">Gross</span><p class="font-semibold">{{ money(run.totalGross) }} KHR</p></article>
        <article class="rounded bg-slate-50 p-3"><span class="text-xs text-slate-500">TOS</span><p class="font-semibold">{{ money(run.totalTos) }} KHR</p></article>
        <article class="rounded bg-slate-50 p-3"><span class="text-xs text-slate-500">NSSF employee</span><p class="font-semibold">{{ money(run.totalNssfEe) }} KHR</p></article>
        <article class="rounded bg-slate-50 p-3"><span class="text-xs text-slate-500">NSSF employer</span><p class="font-semibold">{{ money(run.totalNssfEr) }} KHR</p></article>
        <article class="rounded bg-slate-50 p-3"><span class="text-xs text-slate-500">Net pay</span><p class="font-semibold">{{ money(run.totalNet) }} KHR</p></article>
      </div>

      <!-- ── Payroll items table ─────────────────────────────────────────── -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b text-slate-600">
            <tr>
              <th class="p-2">Employee</th>
              <th class="p-2">Basic</th>
              <th class="p-2">Allowances</th>
              <th class="p-2">Overtime</th>
              <th class="p-2">Unpaid leave</th>
              <th class="p-2">Gross</th>
              <th class="p-2">TOS</th>
              <th class="p-2">NSSF EE</th>
              <th class="p-2">Net</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in run.items" :key="item.id" class="border-b last:border-0">
              <td class="p-2">
                {{ item.employee.employeeNo }} · {{ item.employee.lastNameEn }} {{ item.employee.firstNameEn }}
                <span v-if="item.breakdown.contract?.currency === 'USD'" class="block text-xs text-slate-500">
                  USD {{ item.breakdown.contract.originalBasicSalary }} × {{ Number(run.fxUsdKhr).toLocaleString() }}
                </span>
              </td>
              <td class="p-2">{{ money(item.basic) }}</td>
              <td class="p-2">{{ money(item.allowances) }}</td>
              <td class="p-2">{{ money(item.overtime) }}</td>
              <td class="p-2">{{ money(item.unpaidLeave) }}</td>
              <td class="p-2">{{ money(item.gross) }}</td>
              <td class="p-2">{{ money(item.tosAmount) }}</td>
              <td class="p-2">{{ money(item.nssfPensionEe) }}</td>
              <td class="p-2 font-medium">{{ money(item.net) }}</td>
            </tr>
            <tr v-if="!run.items?.length">
              <td colspan="9" class="p-3 text-slate-500">This run has no payroll items.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Export & Filing ────────────────────────────────────────────── -->
      <div v-if="(run.status === 'APPROVED' || run.status === 'PAID') && canExport" class="rounded-lg border bg-white p-4">
        <h3 class="mb-3 font-semibold">Export &amp; Filing</h3>
        <p class="mb-4 text-sm text-slate-500">Download statutory filing and bank disbursement files for this approved payroll run.</p>
        <div class="flex flex-wrap gap-3">
          <button
            class="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
            @click="exportRun('aba')"
          >
            📥 ABA PayWay CSV
          </button>
          <button
            class="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
            @click="exportRun('canadia')"
          >
            📥 Canadia Flat File
          </button>
          <button
            class="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
            @click="exportRun('gdt-xml')"
          >
            📄 GDT Monthly TOS XML
          </button>
          <button
            class="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
            @click="exportRun('nssf-csv')"
          >
            📄 NSSF Monthly Schedule CSV
          </button>
        </div>
      </div>
    </section>
  </section>
</template>
