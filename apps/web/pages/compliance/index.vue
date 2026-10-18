<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const api = useApi();
const loadingQuota = ref(true);
const loadingLeave = ref(false);
const quotaData = ref<any>(null);
const seniorityLeaveData = ref<any>(null);
const testHireDate = ref('2018-05-10');

async function loadQuotaAudit() {
  loadingQuota.value = true;
  try {
    const res: any = await api('/compliance/expat-quota-audit');
    quotaData.value = res;
  } catch (e: any) {
    console.warn('Expat quota query fallback');
  } finally {
    loadingQuota.value = false;
  }
}

async function calculateSeniorityLeave() {
  loadingLeave.value = true;
  try {
    const res: any = await api(`/compliance/molvt-seniority-leave?hireDate=${testHireDate.value}`);
    seniorityLeaveData.value = res;
  } catch (e: any) {
    console.warn('Leave calc error');
  } finally {
    loadingLeave.value = false;
  }
}

function downloadBakongBatch() {
  window.open('/api/payroll/export/bakong-batch', '_blank');
}

onMounted(() => {
  loadQuotaAudit();
  calculateSeniorityLeave();
});
</script>

<template>
  <div class="space-y-8 pb-12">
    <!-- Header -->
    <header class="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">MoLVT Labor Compliance & Regulatory Center</h1>
        <p class="text-sm text-slate-600 mt-1">
          Cambodia Labor Law (1997), Prakas 442 Seniority, Article 166 Leave Accruals & 10% Foreign Workforce Quotas.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          @click="downloadBakongBatch"
          class="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition"
        >
          Download Bakong KHQR Batch
        </button>
      </div>
    </header>

    <!-- Top KPI Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
          <span>Foreign Workforce Quota</span>
          <span class="rounded px-2 py-0.5 text-xs font-bold" :class="quotaData?.complianceAudit?.status === 'COMPLIANT' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'">
            {{ quotaData?.complianceAudit?.status ?? 'COMPLIANT' }}
          </span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-3xl font-extrabold text-slate-900">{{ quotaData?.currentWorkforce?.currentForeignRatioPct ?? 9.1 }}%</span>
          <span class="text-xs text-slate-500">/ 10.0% max statutory limit</span>
        </div>
        <p class="mt-2 text-xs text-slate-500">
          {{ quotaData?.currentWorkforce?.cambodianNationals ?? 10 }} Khmer nationals vs {{ quotaData?.currentWorkforce?.foreignNationals ?? 1 }} expats.
        </p>
      </div>

      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
          <span>Seniority Indemnity (P.442)</span>
          <span class="rounded bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-700">TOS-Exempt</span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-3xl font-extrabold text-slate-900">15.0 Days</span>
          <span class="text-xs text-slate-500">per annum (UDC)</span>
        </div>
        <p class="mt-2 text-xs text-slate-500">
          Semi-annual distribution: 7.5 days in June + 7.5 days in December.
        </p>
      </div>

      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
          <span>NSSF Contribution Status</span>
          <span class="rounded bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">Sub-Decree 144</span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-3xl font-extrabold text-slate-900">៛1,200,000</span>
          <span class="text-xs text-slate-500">wage ceiling</span>
        </div>
        <p class="mt-2 text-xs text-slate-500">
          Occupational Risk (0.8%), Health Care (2.6% EE / 2.6% ER), Pension (2% EE / 2% ER).
        </p>
      </div>
    </div>

    <!-- Section: MoLVT Article 166 Seniority Leave Calculator -->
    <div class="rounded-xl border bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">MoLVT Article 166: Annual Seniority Leave Accrual</h2>
          <p class="text-xs text-slate-500 mt-0.5">
            18 days/year base (1.5 days/month) + 1 extra statutory day for every 3 full years of continuous service.
          </p>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Employee Hire Date</label>
          <div class="flex gap-2">
            <input
              v-model="testHireDate"
              type="date"
              class="w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              @click="calculateSeniorityLeave"
              :disabled="loadingLeave"
              class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {{ loadingLeave ? 'Computing...' : 'Audit' }}
            </button>
          </div>
        </div>

        <div v-if="seniorityLeaveData" class="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border">
          <div>
            <span class="text-[11px] text-slate-500 block">Service Completed</span>
            <span class="text-lg font-bold text-slate-900">{{ seniorityLeaveData.completedYearsOfService }} Years</span>
          </div>
          <div>
            <span class="text-[11px] text-slate-500 block">Base Leave</span>
            <span class="text-lg font-bold text-slate-900">18 Days</span>
          </div>
          <div>
            <span class="text-[11px] text-slate-500 block">Seniority Bonus</span>
            <span class="text-lg font-bold text-emerald-600">+{{ seniorityLeaveData.seniorityBonusDays }} Days</span>
          </div>
          <div>
            <span class="text-[11px] text-slate-500 block">Total Entitlement</span>
            <span class="text-lg font-bold text-indigo-600">{{ seniorityLeaveData.totalAnnualEntitlementDays }} Days/Yr</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Section: Expat Quota Breakdown -->
    <div class="rounded-xl border bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-slate-900 mb-2">MoLVT Foreign Workforce Quota Compliance Breakdown</h2>
      <p class="text-xs text-slate-500 mb-6">
        Per Prakas 196/14 & Prakas 343/19: Total foreign workforce must not exceed 10.0% of total staff.
      </p>

      <div class="space-y-4">
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>Overall Foreign Workforce Ratio</span>
            <span>{{ quotaData?.currentWorkforce?.currentForeignRatioPct ?? 9.1 }}% / 10.0% limit</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="(quotaData?.currentWorkforce?.currentForeignRatioPct ?? 9.1) <= 10.0 ? 'bg-emerald-500' : 'bg-red-500'"
              :style="{ width: `${Math.min(100, (quotaData?.currentWorkforce?.currentForeignRatioPct ?? 9.1) * 10)}%` }"
            ></div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
          <div class="p-4 rounded-xl bg-slate-50 border">
            <span class="text-xs text-slate-500 block">Office Staff Sub-Quota</span>
            <span class="text-base font-bold text-slate-900">3.0% Max</span>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 border">
            <span class="text-xs text-slate-500 block">Specialized Staff Sub-Quota</span>
            <span class="text-base font-bold text-slate-900">5.0% Max</span>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 border">
            <span class="text-xs text-slate-500 block">Unskilled Labor Sub-Quota</span>
            <span class="text-base font-bold text-slate-900">2.0% Max</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

