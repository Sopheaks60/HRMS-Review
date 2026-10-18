<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type PayrollRun = {
  id: string;
  status: string;
  period: { year: number; month: number };
  totalGross: string | number;
  totalNet: string | number;
};

const api = useApi();
const auth = useAuthStore();
const canExport = computed(() => auth.permissions.includes("payroll.export") || auth.permissions.includes("payroll.approve"));

const allRuns = ref<PayrollRun[]>([]);
const selectedRunId = ref("");
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const loading = ref(true);
const error = ref("");

const runtimeConfig = useRuntimeConfig();

// Only APPROVED + PAID runs are eligible for filing exports
const eligibleRuns = computed(() =>
  allRuns.value.filter((r) => r.status === "APPROVED" || r.status === "PAID")
);

async function loadRuns() {
  loading.value = true;
  error.value = "";
  try {
    allRuns.value = await api<PayrollRun[]>("/payroll/runs");
    if (!selectedRunId.value && eligibleRuns.value.length) {
      selectedRunId.value = eligibleRuns.value[0].id;
    }
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load payroll runs.";
  } finally {
    loading.value = false;
  }
}

function download(format: "aba" | "canadia" | "gdt-xml" | "nssf-csv") {
  if (!selectedRunId.value) return;
  const base = runtimeConfig.public.apiUrl as string;
  window.open(`${base}/payroll/runs/${selectedRunId.value}/export/${format}`, "_blank");
}

function periodLabel(run: PayrollRun) {
  return `${run.period.year}-${String(run.period.month).padStart(2, "0")} · ${run.status}`;
}

onMounted(loadRuns);
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Reports Center</h1>
        <p class="mt-1 text-sm text-slate-600">Download statutory filings and bank disbursement files.</p>
      </div>
      <button class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="loadRuns">Refresh</button>
    </header>

    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>

    <!-- Run selector & period filter -->
    <div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
      <label class="text-sm">
        Year
        <input v-model.number="year" type="number" min="2020" class="mt-1 block w-24 rounded border px-3 py-2" />
      </label>
      <label class="text-sm">
        Month
        <input v-model.number="month" type="number" min="1" max="12" class="mt-1 block w-20 rounded border px-3 py-2" />
      </label>
      <label class="text-sm flex-1 min-w-48">
        Payroll Run (Approved / Paid)
        <select
          v-model="selectedRunId"
          class="mt-1 block w-full rounded border px-3 py-2"
          :disabled="loading || !eligibleRuns.length"
        >
          <option value="" disabled>Select a payroll run…</option>
          <option v-for="run in eligibleRuns" :key="run.id" :value="run.id">
            {{ periodLabel(run) }}
          </option>
        </select>
        <span v-if="!loading && !eligibleRuns.length" class="mt-1 block text-xs text-amber-700">
          No approved or paid runs found. Runs must be approved before exports are available.
        </span>
      </label>
    </div>

    <!-- Report cards grid -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

      <!-- GDT TOS XML -->
      <article class="rounded-lg border bg-white p-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-semibold">GDT Monthly TOS Declaration</h3>
            <span class="mt-0.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">XML</span>
          </div>
          <span class="text-2xl">🏛️</span>
        </div>
        <p class="text-sm text-slate-600 flex-1">
          Official monthly Tax on Salary declaration for General Department of Taxation.
          Required by the <strong>20th of the following month</strong>.
        </p>
        <button
          class="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          :disabled="!selectedRunId || !canExport"
          @click="download('gdt-xml')"
        >
          📄 Download XML
        </button>
      </article>

      <!-- NSSF CSV -->
      <article class="rounded-lg border bg-white p-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-semibold">NSSF Monthly Contribution Schedule</h3>
            <span class="mt-0.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">CSV</span>
          </div>
          <span class="text-2xl">🏥</span>
        </div>
        <p class="text-sm text-slate-600 flex-1">
          Monthly social security contribution report for submission to NSSF Cambodia.
        </p>
        <button
          class="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          :disabled="!selectedRunId || !canExport"
          @click="download('nssf-csv')"
        >
          📄 Download CSV
        </button>
      </article>

      <!-- ABA PayWay -->
      <article class="rounded-lg border bg-white p-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-semibold">ABA PayWay Batch Disbursement</h3>
            <span class="mt-0.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">CSV</span>
          </div>
          <span class="text-2xl">🏦</span>
        </div>
        <p class="text-sm text-slate-600 flex-1">
          Bank disbursement batch file for <strong>ABA Bank PayWay</strong> system.
        </p>
        <button
          class="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          :disabled="!selectedRunId || !canExport"
          @click="download('aba')"
        >
          📥 Download CSV
        </button>
      </article>

      <!-- Canadia -->
      <article class="rounded-lg border bg-white p-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-semibold">Canadia Bank Transfer File</h3>
            <span class="mt-0.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">TXT</span>
          </div>
          <span class="text-2xl">🏦</span>
        </div>
        <p class="text-sm text-slate-600 flex-1">
          Flat-file batch for <strong>Canadia Bank</strong> payroll disbursement.
        </p>
        <button
          class="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          :disabled="!selectedRunId || !canExport"
          @click="download('canadia')"
        >
          📥 Download TXT
        </button>
      </article>

      <!-- Payroll Register (coming soon) -->
      <article class="rounded-lg border bg-white p-4 flex flex-col gap-3 opacity-70">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-semibold">Payroll Register</h3>
            <span class="mt-0.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">PDF / XLS</span>
          </div>
          <span class="text-2xl">📊</span>
        </div>
        <p class="text-sm text-slate-600 flex-1">
          Complete gross-to-net payroll register with all statutory deductions.
        </p>
        <button class="rounded border px-4 py-2 text-sm text-slate-500" disabled>
          🔒 Coming Soon
        </button>
      </article>

      <!-- Prakas 442 Seniority Report -->
      <article class="rounded-lg border bg-white p-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-semibold">Prakas 442 Seniority Report</h3>
            <span class="mt-0.5 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Semi-Annual</span>
          </div>
          <span class="text-2xl">📋</span>
        </div>
        <p class="text-sm text-slate-600 flex-1">
          Semi-annual seniority indemnity schedule under Cambodian Labour Law Prakas 442.
        </p>
        <NuxtLink
          to="/payroll/seniority"
          class="block rounded bg-slate-900 px-4 py-2 text-center text-sm text-white"
        >
          Open Seniority Module
        </NuxtLink>
      </article>

    </div>
  </section>
</template>
