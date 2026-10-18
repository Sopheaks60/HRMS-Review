<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const api = useApi();
const activeTab = ref<'forward' | 'reverse' | 'rules'>('forward');

// Forward Calculation State
const form = ref({
  baseSalaryUsd: 1200,
  fxUsdKhr: 4100,
  currencyPreference: 'USD' as 'USD' | 'KHR',
  hybridSplitUsdPct: 70, // 70% USD / 30% KHR
  workingDays: 26,
  hoursPerDay: 8,
  otNormalHours: 12,
  otNightHours: 4,
  otRestDayHours: 8,
  otHolidayHours: 0,
  taxableAllowancesUsd: 150,
  nonTaxableAllowancesUsd: 50,
  fringeBenefitsUsd: 0,
  unpaidLeaveDays: 0,
  advanceLoanDeductionsUsd: 100,
  qualifyingChildren: 1,
  qualifyingSpouse: true,
  taxResidency: 'RESIDENT' as 'RESIDENT' | 'NON_RESIDENT',
  contractType: 'UDC' as 'UDC' | 'FDC',
  previousMonthGrossUsd: 1350,
});

const forwardResult = ref<any>(null);
const calculatingForward = ref(false);

async function runForwardWorkflow() {
  calculatingForward.value = true;
  try {
    const res: any = await api('/workflow/calculate', {
      method: 'POST',
      body: {
        baseSalaryUsd: form.value.baseSalaryUsd,
        fxUsdKhr: form.value.fxUsdKhr,
        currencyPreference: form.value.currencyPreference,
        hybridSplitUsdPct: form.value.hybridSplitUsdPct,
        workingDays: form.value.workingDays,
        hoursPerDay: form.value.hoursPerDay,
        overtime: {
          normalHours: form.value.otNormalHours,
          nightHours: form.value.otNightHours,
          restDayHours: form.value.otRestDayHours,
          holidayHours: form.value.otHolidayHours,
        },
        taxableAllowancesUsd: form.value.taxableAllowancesUsd,
        nonTaxableAllowancesUsd: form.value.nonTaxableAllowancesUsd,
        fringeBenefitsUsd: form.value.fringeBenefitsUsd,
        unpaidLeaveDays: form.value.unpaidLeaveDays,
        advanceLoanDeductionsUsd: form.value.advanceLoanDeductionsUsd,
        qualifyingChildren: form.value.qualifyingChildren,
        qualifyingSpouse: form.value.qualifyingSpouse,
        taxResidency: form.value.taxResidency,
        contractType: form.value.contractType,
        hireDate: '2024-01-15',
        periodEndDate: '2026-06-30',
        previousMonthGrossUsd: form.value.previousMonthGrossUsd,
      },
    });
    if (res?.data) {
      forwardResult.value = res.data;
    }
  } catch (err: any) {
    console.error('Calculation error:', err);
  } finally {
    calculatingForward.value = false;
  }
}

// Reverse Net-to-Gross State
const reverseNetTarget = ref(1500);
const reverseChildren = ref(1);
const reverseSpouse = ref(true);
const reverseResult = ref<any>(null);
const calculatingReverse = ref(false);

async function runReverseWorkflow() {
  calculatingReverse.value = true;
  try {
    const res: any = await api('/workflow/reverse-grossup', {
      method: 'POST',
      body: {
        targetNetUsd: reverseNetTarget.value,
        fxUsdKhr: form.value.fxUsdKhr,
        qualifyingChildren: reverseChildren.value,
        qualifyingSpouse: reverseSpouse.value,
      },
    });
    reverseResult.value = res;
  } catch (err: any) {
    console.error('Reverse calculation error:', err);
  } finally {
    calculatingReverse.value = false;
  }
}

// Rules State
const rules = ref<any[]>([]);
const loadingRules = ref(false);

async function loadWorkflowRules() {
  loadingRules.value = true;
  try {
    const res: any = await api('/workflow/rules');
    if (res?.rules) rules.value = res.rules;
  } catch (err: any) {
    console.error('Rules load error:', err);
  } finally {
    loadingRules.value = false;
  }
}

onMounted(() => {
  runForwardWorkflow();
  runReverseWorkflow();
  loadWorkflowRules();
});
</script>

<template>
  <div class="space-y-8 pb-16">
    <!-- Header -->
    <header class="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Centralized Calculation & Workflow Engine</h1>
        <p class="text-sm text-slate-600 mt-1">
          Autonomous Gross-to-Net pipeline, Article 139 Overtime solver, Prakas 442 Seniority, and MoM Variance gates.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-mono font-medium text-teal-800">
          <span class="h-2 w-2 rounded-full bg-teal-500 animate-pulse"></span>
          Autonomous Solver: Active
        </span>
      </div>
    </header>

    <!-- Tab Navigation -->
    <div class="flex gap-2 border-b">
      <button
        @click="activeTab = 'forward'"
        class="border-b-2 px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'forward' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'"
      >
        Gross-to-Net Calculation Pipeline
      </button>
      <button
        @click="activeTab = 'reverse'"
        class="border-b-2 px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'reverse' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'"
      >
        Reverse Net-to-Gross Solver
      </button>
      <button
        @click="activeTab = 'rules'"
        class="border-b-2 px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === 'rules' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'"
      >
        Governance Rules & Approval Gates (5)
      </button>
    </div>

    <!-- TAB 1: Forward Gross-to-Net Calculation -->
    <div v-if="activeTab === 'forward'" class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Left Configuration Form (5 cols) -->
      <div class="lg:col-span-5 space-y-6">
        <!-- 1. Compensation & Dual-Currency -->
        <section class="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
            <span>1. Base Salary & Currency</span>
            <span class="text-xs text-teal-600 font-mono">៛{{ (form.baseSalaryUsd * form.fxUsdKhr).toLocaleString() }}</span>
          </h2>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Base Salary (USD)</label>
              <input
                v-model.number="form.baseSalaryUsd"
                @input="runForwardWorkflow"
                type="number"
                step="50"
                class="w-full rounded-lg border px-3 py-1.5 text-sm font-mono focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">GDT Exchange Peg</label>
              <input
                v-model.number="form.fxUsdKhr"
                @input="runForwardWorkflow"
                type="number"
                class="w-full rounded-lg border px-3 py-1.5 text-sm font-mono focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div class="flex justify-between text-xs font-semibold mb-1 text-slate-600">
              <span>Hybrid Payout Currency Split</span>
              <span class="font-mono text-slate-900">{{ form.hybridSplitUsdPct }}% USD / {{ 100 - form.hybridSplitUsdPct }}% KHR</span>
            </div>
            <input
              v-model.number="form.hybridSplitUsdPct"
              @input="runForwardWorkflow"
              type="range"
              min="0"
              max="100"
              step="5"
              class="w-full accent-slate-900"
            />
          </div>
        </section>

        <!-- 2. Article 139 Overtime Multipliers -->
        <section class="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold uppercase tracking-wider text-slate-700">2. Article 139 Overtime</h2>
            <span class="text-xs font-mono rounded bg-purple-50 text-purple-700 px-2 py-0.5 border border-purple-200">
              Hourly: ${{ (forwardResult?.overtime?.hourlyRateUsd ?? 5.77).toFixed(2) }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Normal Day (1.5x)</label>
              <div class="relative">
                <input
                  v-model.number="form.otNormalHours"
                  @input="runForwardWorkflow"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border px-3 py-1.5 text-sm font-mono"
                />
                <span class="absolute right-3 top-1.5 text-xs text-slate-400">hrs</span>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Night 22-06 (2.0x)</label>
              <div class="relative">
                <input
                  v-model.number="form.otNightHours"
                  @input="runForwardWorkflow"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border px-3 py-1.5 text-sm font-mono"
                />
                <span class="absolute right-3 top-1.5 text-xs text-slate-400">hrs</span>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Rest Day / Sun (2.0x)</label>
              <div class="relative">
                <input
                  v-model.number="form.otRestDayHours"
                  @input="runForwardWorkflow"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border px-3 py-1.5 text-sm font-mono"
                />
                <span class="absolute right-3 top-1.5 text-xs text-slate-400">hrs</span>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Public Holiday (2.0x)</label>
              <div class="relative">
                <input
                  v-model.number="form.otHolidayHours"
                  @input="runForwardWorkflow"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border px-3 py-1.5 text-sm font-mono"
                />
                <span class="absolute right-3 top-1.5 text-xs text-slate-400">hrs</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. Family Relief & Allowances -->
        <section class="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-700">3. Deductions & Family Relief</h2>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Dependent Children</label>
              <input
                v-model.number="form.qualifyingChildren"
                @input="runForwardWorkflow"
                type="number"
                min="0"
                class="w-full rounded-lg border px-3 py-1.5 text-sm font-mono"
              />
              <span class="text-[10px] text-slate-400 mt-0.5 block">៛150,000/child relief</span>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Non-Working Spouse</label>
              <select
                v-model="form.qualifyingSpouse"
                @change="runForwardWorkflow"
                class="w-full rounded-lg border px-3 py-1.5 text-sm"
              >
                <option :value="true">Yes (៛150,000 relief)</option>
                <option :value="false">No</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Taxable Allowances ($)</label>
              <input
                v-model.number="form.taxableAllowancesUsd"
                @input="runForwardWorkflow"
                type="number"
                class="w-full rounded-lg border px-3 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Salary Advance Debt ($)</label>
              <input
                v-model.number="form.advanceLoanDeductionsUsd"
                @input="runForwardWorkflow"
                type="number"
                class="w-full rounded-lg border px-3 py-1.5 text-sm font-mono"
              />
              <span class="text-[10px] text-slate-400 mt-0.5 block">Max 20% Net cap</span>
            </div>
          </div>
        </section>
      </div>

      <!-- Right Exploded Result Cards (7 cols) -->
      <div v-if="forwardResult" class="lg:col-span-7 space-y-6">
        <!-- Variance Alert Banner if Triggered -->
        <div
          v-if="forwardResult.isVarianceAlertTriggered"
          class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 flex items-start gap-3"
        >
          <span class="text-xl">⚠️</span>
          <div>
            <h3 class="font-bold text-sm">Month-over-Month 10% Variance Alert Triggered (+{{ forwardResult.momVariancePct }}%)</h3>
            <p class="text-xs text-amber-800 mt-1">
              Current cycle gross (${{ forwardResult.grossSalaryUsd.toFixed(2) }}) exceeds previous baseline (${{ form.previousMonthGrossUsd.toFixed(2) }}).
              Approval requires supervisor justification sign-off.
            </p>
            <div class="mt-2 text-xs font-mono text-amber-900">
              Primary cost drivers: {{ forwardResult.varianceCostDrivers.join(', ') }}
            </div>
          </div>
        </div>

        <!-- Grand Total Net Pay Card -->
        <div class="rounded-2xl border bg-slate-900 text-white p-6 shadow-xl">
          <div class="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span class="text-xs font-semibold text-teal-400 uppercase tracking-widest block">Autonomous Net Payout</span>
              <div class="mt-1 flex items-baseline gap-3">
                <span class="text-3xl font-extrabold">${{ forwardResult.netSalaryUsd.toFixed(2) }}</span>
                <span class="text-lg text-slate-400 font-mono">៛{{ forwardResult.netSalaryKhr.toLocaleString() }}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-xs text-slate-400 block">Total Gross</span>
              <span class="text-lg font-bold text-slate-200">${{ forwardResult.grossSalaryUsd.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Dual Currency Split Row -->
          <div class="grid grid-cols-2 gap-4 pt-4 border-b border-slate-800 pb-4">
            <div class="rounded-xl bg-slate-950 p-3 border border-slate-800">
              <span class="text-xs text-slate-400 block">USD Payout ({{ form.hybridSplitUsdPct }}%)</span>
              <span class="text-base font-bold text-emerald-400 font-mono">${{ forwardResult.payoutSplitUsd.toFixed(2) }}</span>
            </div>
            <div class="rounded-xl bg-slate-950 p-3 border border-slate-800">
              <span class="text-xs text-slate-400 block">KHR Payout ({{ 100 - form.hybridSplitUsdPct }}%)</span>
              <span class="text-base font-bold text-teal-400 font-mono">៛{{ forwardResult.payoutSplitKhr.toLocaleString() }}</span>
            </div>
          </div>

          <!-- Key Line Items -->
          <div class="grid grid-cols-3 gap-3 pt-4 text-xs">
            <div>
              <span class="text-slate-400 block">OT Earnings</span>
              <span class="font-bold text-purple-300 font-mono">+${{ forwardResult.overtime.totalOtPayUsd.toFixed(2) }}</span>
            </div>
            <div>
              <span class="text-slate-400 block">NSSF Deduction (EE)</span>
              <span class="font-bold text-sky-300 font-mono">-៛{{ forwardResult.nssfEmployeeTotalKhr.toLocaleString() }}</span>
            </div>
            <div>
              <span class="text-slate-400 block">GDT Tax on Salary</span>
              <span class="font-bold text-rose-300 font-mono">-៛{{ forwardResult.tosAmountKhr.toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <!-- Exploded Audit Trace -->
        <div class="rounded-xl border bg-white p-6 shadow-sm">
          <h3 class="text-base font-bold text-slate-900 mb-4">Step-by-Step Mathematical Audit Trace</h3>
          <div class="space-y-3 font-mono text-xs">
            <div
              v-for="s in forwardResult.auditTrace"
              :key="s.step"
              class="rounded-lg border p-3 hover:bg-slate-50 transition"
            >
              <div class="flex items-center justify-between font-bold text-slate-800 mb-1">
                <span>Step {{ s.step }}: {{ s.name }}</span>
                <span class="text-teal-700">${{ s.resultUsd.toFixed(2) }} (៛{{ s.resultKhr.toLocaleString() }})</span>
              </div>
              <p class="text-slate-500 text-[11px] font-sans">{{ s.basis }}</p>
              <div class="mt-1 text-[11px] text-slate-600 bg-slate-100 rounded px-2 py-1">
                Formula: {{ s.formula }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: Reverse Net-to-Gross Solver -->
    <div v-if="activeTab === 'reverse'" class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div class="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <h2 class="text-lg font-bold text-slate-900">Target Net Salary Requirements</h2>
        <p class="text-xs text-slate-500">
          The autonomous solver executes closed-form algebraic binary search iterations until the guaranteed Net matches within $0.01 precision.
        </p>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Guaranteed Take-Home Net (USD)</label>
          <div class="relative">
            <input
              v-model.number="reverseNetTarget"
              @input="runReverseWorkflow"
              type="number"
              step="50"
              class="w-full rounded-lg border px-3 py-2 text-base font-mono font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <span class="absolute right-3 top-2.5 text-xs text-slate-400">USD</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Children Relief</label>
            <input
              v-model.number="reverseChildren"
              @input="runReverseWorkflow"
              type="number"
              min="0"
              class="w-full rounded-lg border px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Non-Working Spouse</label>
            <select
              v-model="reverseSpouse"
              @change="runReverseWorkflow"
              class="w-full rounded-lg border px-3 py-1.5 text-sm"
            >
              <option :value="true">Yes</option>
              <option :value="false">No</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="reverseResult" class="rounded-xl border bg-slate-900 text-white p-6 shadow-xl space-y-4">
        <div class="border-b border-slate-800 pb-3">
          <span class="text-xs font-semibold text-teal-400 uppercase tracking-widest block">Gross-Up Solution Result</span>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold text-emerald-400">${{ reverseResult.requiredGrossUsd.toFixed(2) }}</span>
            <span class="text-sm text-slate-400 font-mono">Gross Required</span>
          </div>
          <p class="text-xs text-slate-400 mt-1 font-mono">
            ៛{{ reverseResult.requiredGrossKhr.toLocaleString() }} KHR (Solved in {{ reverseResult.iterationsToConvergence }} iterations)
          </p>
        </div>

        <div class="space-y-2 text-xs font-mono">
          <div class="flex justify-between py-1 border-b border-slate-800">
            <span class="text-slate-400">Target Take-Home Net:</span>
            <span class="font-bold text-white">${{ reverseResult.targetNetUsd.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-800">
            <span class="text-slate-400">Tax on Salary (GDT):</span>
            <span class="text-rose-400">-៛{{ reverseResult.convergedPayrollBreakdown.tosAmountKhr.toLocaleString() }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-800">
            <span class="text-slate-400">NSSF Employee Pension:</span>
            <span class="text-sky-400">-៛{{ reverseResult.convergedPayrollBreakdown.nssfPensionEeKhr.toLocaleString() }}</span>
          </div>
          <div class="flex justify-between py-1">
            <span class="text-slate-400">Employer Total Cost (TCOE):</span>
            <span class="font-bold text-teal-300">${{ reverseResult.convergedPayrollBreakdown.totalEmployerCostUsd.toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: Workflow Rules & Governance -->
    <div v-if="activeTab === 'rules'" class="space-y-4">
      <div
        v-for="r in rules"
        :key="r.id"
        class="rounded-xl border bg-white p-5 shadow-sm space-y-2"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <div class="flex items-center gap-2">
            <span class="rounded bg-slate-900 text-white font-mono text-[10px] px-2 py-0.5 font-bold">{{ r.code }}</span>
            <h3 class="font-bold text-sm text-slate-900">{{ r.name }}</h3>
          </div>
          <span class="rounded bg-emerald-50 text-emerald-800 text-xs font-bold px-2 py-0.5 border border-emerald-200">
            {{ r.activeStatus ? 'ACTIVE POLICY' : 'INACTIVE' }}
          </span>
        </div>

        <p class="text-xs text-slate-600">{{ r.description }}</p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
          <div class="rounded bg-slate-50 p-2 border">
            <span class="text-slate-400 text-[10px] block">Trigger Threshold</span>
            <span class="font-bold text-slate-800">{{ r.parameterThreshold }} {{ r.thresholdUnit }}</span>
          </div>
          <div class="rounded bg-slate-50 p-2 border">
            <span class="text-slate-400 text-[10px] block">Statutory Basis</span>
            <span class="font-bold text-slate-800">{{ r.statutoryBasis }}</span>
          </div>
          <div class="rounded bg-slate-50 p-2 border">
            <span class="text-slate-400 text-[10px] block">Approval Hierarchy</span>
            <span class="font-bold text-slate-800">{{ r.approvalLevels.join(' → ') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

