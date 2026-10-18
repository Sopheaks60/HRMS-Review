<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const api = useApi();
const auth = useAuthStore();
const canManageSettings = computed(() => auth.permissions.includes("settings.write") || auth.permissions.includes("admin"));

const usdToKhr = ref(4100);
const savingFx = ref(false);
const fxError = ref("");
const fxNotice = ref("");
const dbConnected = ref(false);
const dbHost = ref("ep-young-wave-b578dmsm-pooler.c-7.us-east-2.aws.neon.tech");
const lastUpdated = ref("");
const loadingSettings = ref(true);

async function loadSystemParameters() {
  loadingSettings.value = true;
  try {
    const res: any = await api("/settings/system-parameters");
    if (res?.data) {
      usdToKhr.value = res.data.exchangeRateKhrUsd || 4100;
      dbConnected.value = res.connected ?? true;
      if (res.databaseHost) dbHost.value = res.databaseHost;
      if (res.data.updatedAt) lastUpdated.value = new Date(res.data.updatedAt).toLocaleString();
    }
  } catch (err: any) {
    console.warn("Could not load system parameters from Neon:", err);
  } finally {
    loadingSettings.value = false;
  }
}

onMounted(() => {
  loadSystemParameters();
});

async function saveExchangeRate() {
  savingFx.value = true;
  fxError.value = "";
  fxNotice.value = "";
  try {
    await api("/settings/exchange-rate", {
      method: "PATCH",
      body: { usdToKhr: Number(usdToKhr.value) },
    });
    fxNotice.value = `Exchange rate saved to Neon PostgreSQL: $1 USD = ${Number(usdToKhr.value).toLocaleString()} KHR`;
    lastUpdated.value = new Date().toLocaleString();
  } catch (cause: any) {
    fxError.value = cause?.data?.message ?? "Could not save exchange rate.";
  } finally {
    savingFx.value = false;
  }
}

// NSSF statutory parameters (Sub-Decree 144) — display only
const nssfSchemes = [
  { scheme: "Occupational Risk", floor: 200_000, ceiling: 1_200_000, erPct: "0.8%", eePct: "0%" },
  { scheme: "Health Care", floor: 200_000, ceiling: 1_200_000, erPct: "2.6%", eePct: "2.6%" },
  { scheme: "Pension", floor: 400_000, ceiling: 1_200_000, erPct: "2.0%", eePct: "2.0%" },
];

// TOS brackets (Sub-Decree No. 48 ANKr.BK, March 2024)
const tosBrackets = [
  { range: "0 – 1,500,000", rate: "0%", quickDeduction: "—" },
  { range: "1,500,001 – 2,000,000", rate: "5%", quickDeduction: "75,000" },
  { range: "2,000,001 – 8,500,000", rate: "10%", quickDeduction: "175,000" },
  { range: "8,500,001 – 12,500,000", rate: "15%", quickDeduction: "600,000" },
  { range: "Over 12,500,000", rate: "20%", quickDeduction: "1,225,000" },
];

function money(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
</script>

<template>
  <section class="space-y-8">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">Centralized System Parameters</h1>
        <p class="mt-1 text-sm text-slate-600">Centralized statutory parameters and configuration stored in Neon PostgreSQL for KromPay Cambodia.</p>
      </div>
      <div class="flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-1.5 text-xs font-mono">
        <span class="h-2.5 w-2.5 rounded-full" :class="dbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"></span>
        <span class="font-medium text-slate-700">Neon PostgreSQL:</span>
        <span class="text-slate-500">{{ dbHost }}</span>
        <span v-if="lastUpdated" class="border-l pl-2 text-slate-400">Synced: {{ lastUpdated }}</span>
      </div>
    </header>

    <!-- ── Section 1: Exchange Rate ──────────────────────────────────────── -->
    <section class="space-y-4 rounded-lg border bg-white p-6">
      <div>
        <h2 class="text-lg font-semibold">Exchange Rate Settings</h2>
        <p class="mt-1 text-sm text-slate-500">
          The official GDT monthly exchange rate is published by the Ministry of Economy and Finance.
          <strong>Current rate: $1 USD = 4,100 KHR (2026)</strong>. This rate is applied to all USD-denominated contracts at payroll calculation time.
        </p>
      </div>

      <p v-if="fxError" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ fxError }}</p>
      <p v-if="fxNotice" role="status" class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{{ fxNotice }}</p>

      <form class="flex flex-wrap items-end gap-3" @submit.prevent="saveExchangeRate">
        <label class="text-sm">
          GDT Official Rate (KHR per 1 USD)
          <input
            v-model.number="usdToKhr"
            required
            type="number"
            min="1000"
            max="100000"
            step="1"
            :disabled="!canManageSettings"
            class="mt-1 block w-40 rounded border px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </label>
        <button
          v-if="canManageSettings"
          class="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          :disabled="savingFx"
        >
          {{ savingFx ? "Saving…" : "Save Exchange Rate" }}
        </button>
        <span v-else class="text-sm text-slate-500">Read-only — requires settings.write permission</span>
      </form>
    </section>

    <!-- ── Section 2: NSSF Parameters ───────────────────────────────────── -->
    <section class="space-y-4 rounded-lg border bg-white p-6">
      <div>
        <h2 class="text-lg font-semibold">NSSF Contribution Parameters</h2>
        <p class="mt-1 text-sm text-slate-500">
          Parameters governed by <strong>Sub-Decree 144</strong>. Changes require a new StatutoryTable record via the backend.
        </p>
      </div>

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full text-left text-sm">
          <thead class="border-b bg-slate-50 text-slate-600">
            <tr>
              <th class="p-3">Scheme</th>
              <th class="p-3">Floor (KHR)</th>
              <th class="p-3">Ceiling (KHR)</th>
              <th class="p-3">Employer %</th>
              <th class="p-3">Employee %</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in nssfSchemes" :key="s.scheme" class="border-b last:border-0">
              <td class="p-3 font-medium">{{ s.scheme }}</td>
              <td class="p-3">{{ money(s.floor) }}</td>
              <td class="p-3">{{ money(s.ceiling) }}</td>
              <td class="p-3">
                <span class="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">{{ s.erPct }}</span>
              </td>
              <td class="p-3">
                <span class="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">{{ s.eePct }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-xs text-slate-500">
        ⓘ Combined employer NSSF rate: 5.4% (Occupational Risk 0.8% + Health Care 2.6% + Pension 2.0%).
        Employee contribution: 4.6% (Health Care 2.6% + Pension 2.0%). Contributions are capped at the ceiling amount.
      </p>
    </section>

    <!-- ── Section 3: TOS Brackets ───────────────────────────────────────── -->
    <section class="space-y-4 rounded-lg border bg-white p-6">
      <div>
        <h2 class="text-lg font-semibold">Tax on Salary (TOS) Brackets</h2>
        <p class="mt-1 text-sm text-slate-500">
          Progressive tax brackets per <strong>Sub-Decree No. 48 ANKr.BK (March 2024)</strong>.
          Applied to monthly taxable income after NSSF employee deductions and family relief.
        </p>
      </div>

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full text-left text-sm">
          <thead class="border-b bg-slate-50 text-slate-600">
            <tr>
              <th class="p-3">Monthly Income Range (KHR)</th>
              <th class="p-3">Marginal Rate</th>
              <th class="p-3">Quick Deduction (KHR)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bracket in tosBrackets" :key="bracket.range" class="border-b last:border-0">
              <td class="p-3 font-mono text-xs">{{ bracket.range }}</td>
              <td class="p-3">
                <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">{{ bracket.rate }}</span>
              </td>
              <td class="p-3 font-mono text-xs text-slate-600">{{ bracket.quickDeduction }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="rounded border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
        <strong>Family Relief:</strong> ៛150,000 per qualifying dependent child per month, plus ៛150,000 for a non-working spouse.
        Relief requires a recorded dependent with <em>qualifiesTos = true</em> on the employee's profile.
      </div>
    </section>
  </section>
</template>
