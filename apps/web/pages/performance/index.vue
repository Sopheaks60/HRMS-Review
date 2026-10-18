<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type Assignment = {
  id: string;
  employeeId: string;
  title: string;
  target: number | string;
  actual: number | string | null;
  weight: number | string;
  score: number | string | null;
  employee?: { employeeNo: string; firstNameEn: string; lastNameEn: string };
};
type Cycle = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  assignments: Assignment[];
};
type Employee = { id: string; employeeNo: string; firstNameEn: string; lastNameEn: string };

const api = useApi();
const auth = useAuthStore();
const cycles = ref<Cycle[]>([]);
const employees = ref<Employee[]>([]);
const mine = ref<Assignment[]>([]);
const isManager = computed(() => auth.permissions.includes("kpi.write"));
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const cycleForm = reactive({ name: "", startDate: "", endDate: "" });
const assignmentForm = reactive({ cycleId: "", employeeId: "", title: "", target: "", weight: "" });
const actualDraft = reactive<Record<string, string>>({});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    if (isManager.value) {
      const [cycleRows, employeeRows] = await Promise.all([
        api<Cycle[]>("/performance/cycles"),
        api<Employee[]>("/employees"),
      ]);
      cycles.value = cycleRows;
      employees.value = employeeRows;
      if (!assignmentForm.cycleId && cycleRows.length) assignmentForm.cycleId = cycleRows[0].id;
    } else {
      mine.value = await api<Assignment[]>("/performance/me");
    }
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load KPI information.";
  } finally {
    loading.value = false;
  }
}

async function createCycle() {
  busy.value = true;
  error.value = "";
  try {
    const cycle = await api<Cycle>("/performance/cycles", {
      method: "POST",
      body: { ...cycleForm },
    });
    cycles.value.unshift({ ...cycle, assignments: [] });
    assignmentForm.cycleId = cycle.id;
    Object.assign(cycleForm, { name: "", startDate: "", endDate: "" });
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not create the KPI cycle.";
  } finally {
    busy.value = false;
  }
}

async function assignKpi() {
  busy.value = true;
  error.value = "";
  try {
    await api(`/performance/cycles/${assignmentForm.cycleId}/assignments`, {
      method: "POST",
      body: {
        employeeId: assignmentForm.employeeId,
        title: assignmentForm.title,
        target: Number(assignmentForm.target),
        weight: Number(assignmentForm.weight),
      },
    });
    Object.assign(assignmentForm, { employeeId: "", title: "", target: "", weight: "" });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not assign this KPI.";
  } finally {
    busy.value = false;
  }
}

async function updateActual(assignment: Assignment) {
  busy.value = true;
  error.value = "";
  try {
    await api(`/performance/assignments/${assignment.id}/actual`, {
      method: "PATCH",
      body: { actual: Number(actualDraft[assignment.id]) },
    });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not update KPI progress.";
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">KPI management</h1>
        <p class="mt-1 text-sm text-slate-600">{{ isManager ? "Create review cycles, assign targets, and track progress." : "Review your targets and update your progress." }}</p>
      </div>
      <button class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>

    <template v-if="isManager">
      <form class="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4" @submit.prevent="createCycle">
        <input v-model="cycleForm.name" required maxlength="120" class="rounded border px-3 py-2" placeholder="Review cycle name" />
        <label class="text-sm">Start date<input v-model="cycleForm.startDate" required type="date" class="mt-1 block w-full rounded border px-3 py-2" /></label>
        <label class="text-sm">End date<input v-model="cycleForm.endDate" required type="date" class="mt-1 block w-full rounded border px-3 py-2" /></label>
        <button class="self-end rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="busy">Create cycle</button>
      </form>

      <form class="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-5" @submit.prevent="assignKpi">
        <select v-model="assignmentForm.cycleId" required class="rounded border px-3 py-2" aria-label="KPI cycle">
          <option value="" disabled>Select cycle</option>
          <option v-for="cycle in cycles.filter((row) => row.status === 'active')" :key="cycle.id" :value="cycle.id">{{ cycle.name }}</option>
        </select>
        <select v-model="assignmentForm.employeeId" required class="rounded border px-3 py-2" aria-label="Employee">
          <option value="" disabled>Select employee</option>
          <option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.employeeNo }} · {{ employee.firstNameEn }} {{ employee.lastNameEn }}</option>
        </select>
        <input v-model="assignmentForm.title" required maxlength="160" class="rounded border px-3 py-2" placeholder="KPI title" />
        <input v-model.number="assignmentForm.target" required type="number" min="0.01" step="0.01" class="rounded border px-3 py-2" placeholder="Target" />
        <div class="flex gap-2"><input v-model.number="assignmentForm.weight" required type="number" min="0.01" max="100" step="0.01" class="w-full rounded border px-3 py-2" placeholder="Weight %" /><button class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="busy || !assignmentForm.cycleId">Assign</button></div>
      </form>

      <div v-if="loading" class="rounded border bg-white p-6 text-slate-600">Loading KPI cycles…</div>
      <div v-else-if="!cycles.length" class="rounded border bg-white p-6 text-slate-600">No KPI cycles created yet.</div>
      <article v-for="cycle in cycles" :key="cycle.id" class="overflow-hidden rounded-lg border bg-white">
        <header class="flex justify-between border-b bg-slate-50 p-4"><div><h2 class="font-semibold">{{ cycle.name }}</h2><p class="text-xs text-slate-600">{{ cycle.startDate.slice(0, 10) }} — {{ cycle.endDate.slice(0, 10) }}</p></div><span class="text-sm capitalize">{{ cycle.status }}</span></header>
        <div v-if="!cycle.assignments.length" class="p-4 text-sm text-slate-500">No KPIs assigned in this cycle.</div>
        <div v-else class="overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b text-slate-600"><tr><th class="p-3">Employee</th><th class="p-3">KPI</th><th class="p-3">Target</th><th class="p-3">Actual</th><th class="p-3">Weight</th><th class="p-3">Score</th></tr></thead><tbody><tr v-for="item in cycle.assignments" :key="item.id" class="border-b last:border-0"><td class="p-3">{{ item.employee?.employeeNo }} · {{ item.employee?.firstNameEn }} {{ item.employee?.lastNameEn }}</td><td class="p-3">{{ item.title }}</td><td class="p-3">{{ item.target }}</td><td class="p-3">{{ item.actual ?? "—" }}</td><td class="p-3">{{ item.weight }}%</td><td class="p-3">{{ item.score == null ? "—" : `${Number(item.score).toFixed(1)}%` }}</td></tr></tbody></table></div>
      </article>
    </template>

    <template v-else>
      <div v-if="loading" class="rounded border bg-white p-6 text-slate-600">Loading your KPIs…</div>
      <div v-else-if="!mine.length" class="rounded border bg-white p-6 text-slate-600">No KPI targets have been assigned to you.</div>
      <article v-for="item in mine" :key="item.id" class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-semibold">{{ item.title }}</h2><p class="mt-1 text-sm text-slate-600">{{ item.cycle.name }} · {{ item.cycle.startDate.slice(0, 10) }} — {{ item.cycle.endDate.slice(0, 10) }}</p></div><span class="rounded bg-slate-100 px-2 py-1 text-sm">{{ item.cycle.status }}</span></div>
        <div class="mt-4 grid gap-4 text-sm sm:grid-cols-3"><div>Target: <strong>{{ item.target }}</strong></div><div>Weight: <strong>{{ item.weight }}%</strong></div><div>Score: <strong>{{ item.score == null ? "Not started" : `${Number(item.score).toFixed(1)}%` }}</strong></div></div>
        <form v-if="item.cycle.status === 'active'" class="mt-4 flex max-w-md gap-2" @submit.prevent="updateActual(item)"><input v-model="actualDraft[item.id]" required type="number" min="0" step="0.01" class="min-w-0 flex-1 rounded border px-3 py-2" :placeholder="`Actual (current: ${item.actual ?? 'none'})`" /><button class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="busy">Save progress</button></form>
      </article>
    </template>
  </section>
</template>
