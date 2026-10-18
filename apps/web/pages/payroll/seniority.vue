<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type SeniorityPreview = {
  employeeNo: string;
  employeeNameEn: string;
  contractType: "UDC" | "FDC" | string;
  hireDate: string;
  averageMonthlyKhr: number;
  daysEarned: number;
  dailyWageKhr: number;
  seniorityPayKhr: number;
  tosAmount: 0;
  isFdcSeverance: boolean;
};

const api = useApi();
const auth = useAuthStore();
const canRun = computed(() => auth.permissions.includes("payroll.run"));

// Determine default semester from current month
const currentSemester: 1 | 2 = new Date().getMonth() + 1 >= 7 ? 2 : 1;

const year = ref(new Date().getFullYear());
const semester = ref<1 | 2>(currentSemester);
const fxUsdKhr = ref(4100);
const previews = ref<SeniorityPreview[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const notice = ref("");

const semesterLabel = computed(() =>
  semester.value === 1 ? "January–June (June Payout)" : "July–December (December Payout)"
);

const periodEndDate = computed(() =>
  semester.value === 1 ? `${year.value}-06-30` : `${year.value}-12-31`
);

const udcCount = computed(() => previews.value.filter((p) => !p.isFdcSeverance).length);
const fdcCount = computed(() => previews.value.filter((p) => p.isFdcSeverance).length);
const totalPayout = computed(() =>
  previews.value.reduce((sum, p) => sum + p.seniorityPayKhr, 0)
);

function money(value: number | undefined) {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

async function loadPreview() {
  loading.value = true;
  error.value = "";
  notice.value = "";
  try {
    previews.value = await api<SeniorityPreview[]>(
      `/payroll/seniority/preview?year=${year.value}&semester=${semester.value}&fxUsdKhr=${fxUsdKhr.value}`
    );
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load seniority preview.";
  } finally {
    loading.value = false;
  }
}

async function runSeniority() {
  if (!canRun.value) return;
  if (!previews.value.length) {
    error.value = "Please load a preview before processing.";
    return;
  }
  if (!window.confirm(`Process Prakas 442 seniority run for ${year.value} Semester ${semester.value} (${semesterLabel.value})?`)) return;
  saving.value = true;
  error.value = "";
  notice.value = "";
  try {
    await api("/payroll/seniority/run", {
      method: "POST",
      body: { year: year.value, semester: semester.value, fxUsdKhr: fxUsdKhr.value },
    });
    notice.value = `Seniority run for ${year.value} S${semester.value} processed successfully. Payslips are being generated.`;
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not process seniority run.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <!-- Header -->
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Prakas 442 — Seniority Indemnity</h1>
        <p class="mt-1 text-sm text-slate-600">Semi-annual entitlement under Cambodian Labour Law</p>
      </div>
    </header>

    <!-- Alerts -->
    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>
    <p v-if="notice" role="status" class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{{ notice }}</p>

    <!-- Prakas 442 info card -->
    <div class="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p class="font-semibold">ℹ️ Prakas 442 — Legal Context</p>
      <p class="mt-1">
        Prakas 442 mandates <strong>15 days/year (7.5 days per semester)</strong> for UDC/CDI (undetermined duration contract) employees.
        This payment is <strong>100% exempt from Tax on Salary and NSSF</strong>.
        FDC/CDD employees receive <strong>5% Article 73 severance</strong> upon contract completion instead —
        these are flagged for separate processing.
      </p>
    </div>

    <!-- Controls -->
    <div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
      <label class="text-sm">
        Year
        <input
          v-model.number="year"
          type="number"
          min="2020"
          max="2100"
          class="mt-1 block w-28 rounded border px-3 py-2"
        />
      </label>
      <label class="text-sm">
        Semester
        <select v-model.number="semester" class="mt-1 block rounded border px-3 py-2">
          <option :value="1">S1 — January–June</option>
          <option :value="2">S2 — July–December</option>
        </select>
      </label>
      <label class="text-sm">
        FX Rate (USD→KHR)
        <input
          v-model.number="fxUsdKhr"
          type="number"
          min="1000"
          max="100000"
          step="1"
          class="mt-1 block w-28 rounded border px-3 py-2"
        />
      </label>
      <div class="flex gap-3">
        <button
          class="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          :disabled="loading"
          @click="loadPreview"
        >
          {{ loading ? "Loading…" : "Preview" }}
        </button>
        <button
          v-if="canRun"
          class="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
          :disabled="saving || !previews.length"
          @click="runSeniority"
        >
          {{ saving ? "Processing…" : "Process Seniority Run" }}
        </button>
      </div>
    </div>

    <!-- Period info badge -->
    <p v-if="previews.length" class="text-sm text-slate-500">
      Period end date: <strong>{{ periodEndDate }}</strong> · {{ semesterLabel }}
    </p>

    <!-- Summary cards -->
    <div v-if="previews.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <article class="rounded-lg border bg-white p-4">
        <span class="text-xs text-slate-500">Total employees</span>
        <p class="mt-1 text-2xl font-semibold">{{ previews.length }}</p>
      </article>
      <article class="rounded-lg border bg-white p-4">
        <span class="text-xs text-slate-500">UDC / CDI (seniority)</span>
        <p class="mt-1 text-2xl font-semibold text-emerald-700">{{ udcCount }}</p>
      </article>
      <article class="rounded-lg border bg-white p-4">
        <span class="text-xs text-slate-500">FDC / CDD (Art. 73)</span>
        <p class="mt-1 text-2xl font-semibold text-amber-700">{{ fdcCount }}</p>
      </article>
      <article class="rounded-lg border bg-white p-4">
        <span class="text-xs text-slate-500">Total Payout (KHR)</span>
        <p class="mt-1 text-2xl font-semibold">{{ money(totalPayout) }}</p>
      </article>
    </div>

    <!-- Preview Table -->
    <section v-if="previews.length" class="space-y-3">
      <h2 class="font-semibold">Seniority Preview</h2>
      <div class="overflow-x-auto rounded-lg border bg-white">
        <table class="w-full text-left text-sm">
          <thead class="border-b bg-slate-50 text-slate-600">
            <tr>
              <th class="p-3">Employee No</th>
              <th class="p-3">Name</th>
              <th class="p-3">Contract</th>
              <th class="p-3">Hire Date</th>
              <th class="p-3">Days Earned</th>
              <th class="p-3">Daily Wage (KHR)</th>
              <th class="p-3">Seniority Pay (KHR)</th>
              <th class="p-3">TOS</th>
              <th class="p-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in previews"
              :key="p.employeeNo"
              :class="p.isFdcSeverance ? 'border-b bg-amber-50 last:border-0' : 'border-b last:border-0'"
            >
              <td class="p-3 font-medium">{{ p.employeeNo }}</td>
              <td class="p-3">{{ p.employeeNameEn }}</td>
              <td class="p-3">
                <span
                  :class="p.isFdcSeverance
                    ? 'rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800'
                    : 'rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'"
                >
                  {{ p.contractType }}
                </span>
              </td>
              <td class="p-3">{{ p.hireDate?.slice(0, 10) ?? "—" }}</td>
              <td class="p-3">{{ p.daysEarned.toFixed(2) }}</td>
              <td class="p-3">{{ money(p.dailyWageKhr) }}</td>
              <td class="p-3 font-medium">{{ money(p.seniorityPayKhr) }}</td>
              <td class="p-3 text-slate-400">0 — Exempt</td>
              <td class="p-3">
                <span v-if="p.isFdcSeverance" class="text-xs text-amber-700 font-medium">Article 73 Severance — process separately</span>
                <span v-else class="text-xs text-slate-400">Prakas 442 seniority</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Empty state -->
    <div v-else-if="!loading" class="rounded border bg-white p-8 text-center text-slate-500">
      Select a year and semester, then click <strong>Preview</strong> to load seniority entitlements.
    </div>
  </section>
</template>
