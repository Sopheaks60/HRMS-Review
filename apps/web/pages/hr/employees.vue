<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type Employee = {
  id: string;
  employeeNo: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameKm: string | null;
  lastNameKm: string | null;
  email: string | null;
  phone: string | null;
  hireDate: string;
  status: "PROBATION" | "ACTIVE" | "SUSPENDED" | "TERMINATED" | "RESIGNED";
  branchId: string;
  departmentId: string;
  positionId: string;
  costCenterId: string | null;
  managerId: string | null;
  branch: { nameEn: string; nameKm: string };
  department: { nameEn: string; nameKm: string };
  position: { titleEn: string; titleKm: string };
  manager?: { employeeNo: string; firstNameEn: string; lastNameEn: string } | null;
};
type OrganizationTree = {
  branches: Array<{ id: string; code: string; nameEn: string }>;
  departments: Array<{ id: string; code: string; nameEn: string }>;
  positions: Array<{ id: string; code: string; titleEn: string }>;
  costCenters: Array<{ id: string; code: string; name: string }>;
};
type Contract = { id: string; type: string; startDate: string; endDate: string | null; currency: "KHR" | "USD"; basicSalary: string | number; workingDays: number; hoursPerDay: string | number; allowances: Array<{ code: string; amount: number }>; isCurrent: boolean };
type Dependent = { id: string; relationship: "spouse" | "child" | "other"; fullName: string; dateOfBirth: string | null; qualifiesTos: boolean };

const api = useApi();
const auth = useAuthStore();
const canManage = computed(() => auth.permissions.includes("employee.write"));
const employees = ref<Employee[]>([]);
const organization = ref<OrganizationTree>({ branches: [], departments: [], positions: [], costCenters: [] });
const editingId = ref("");
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const caseFileEmployee = ref<Employee | null>(null);
const contracts = ref<Contract[]>([]);
const dependents = ref<Dependent[]>([]);
const contractForm = reactive({ type: "PERMANENT", startDate: "", endDate: "", currency: "KHR" as "KHR" | "USD", basicSalary: "", workingDays: 26, hoursPerDay: 8, allowanceCode: "", allowanceAmount: "" });
const dependentForm = reactive({ relationship: "child" as Dependent["relationship"], fullName: "", dateOfBirth: "", qualifiesTos: true });
const form = reactive({
  employeeNo: "",
  firstNameEn: "",
  lastNameEn: "",
  firstNameKm: "",
  lastNameKm: "",
  email: "",
  phone: "",
  hireDate: "",
  branchId: "",
  departmentId: "",
  positionId: "",
  costCenterId: "",
  managerId: "",
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [employeeRows, tree] = await Promise.all([
      api<Employee[]>("/employees"),
      api<OrganizationTree>("/organization/tree"),
    ]);
    employees.value = employeeRows;
    organization.value = tree;
    if (!form.branchId) form.branchId = tree.branches[0]?.id ?? "";
    if (!form.departmentId) form.departmentId = tree.departments[0]?.id ?? "";
    if (!form.positionId) form.positionId = tree.positions[0]?.id ?? "";
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load employees and organization data.";
  } finally {
    loading.value = false;
  }
}

async function openCaseFile(employee: Employee) {
  caseFileEmployee.value = employee;
  error.value = "";
  try {
    const [contractRows, dependentRows] = await Promise.all([
      api<Contract[]>(`/employees/${employee.id}/contracts`),
      api<Dependent[]>(`/employees/${employee.id}/dependents`),
    ]);
    contracts.value = contractRows;
    dependents.value = dependentRows;
    Object.assign(contractForm, { type: "PERMANENT", startDate: "", endDate: "", currency: "KHR", basicSalary: "", workingDays: 26, hoursPerDay: 8, allowanceCode: "", allowanceAmount: "" });
    Object.assign(dependentForm, { relationship: "child", fullName: "", dateOfBirth: "", qualifiesTos: true });
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load employee case file.";
  }
}

async function addContract() {
  if (!caseFileEmployee.value) return;
  saving.value = true;
  error.value = "";
  try {
    const allowances = contractForm.allowanceCode.trim() ? [{ code: contractForm.allowanceCode.trim(), amount: Number(contractForm.allowanceAmount || 0) }] : [];
    await api(`/employees/${caseFileEmployee.value.id}/contracts`, { method: "POST", body: {
      type: contractForm.type, startDate: contractForm.startDate, endDate: contractForm.endDate || undefined,
      currency: contractForm.currency, basicSalary: Number(contractForm.basicSalary), workingDays: Number(contractForm.workingDays), hoursPerDay: Number(contractForm.hoursPerDay), allowances,
    } });
    await openCaseFile(caseFileEmployee.value);
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not add the contract.";
  } finally {
    saving.value = false;
  }
}

async function addDependent() {
  if (!caseFileEmployee.value) return;
  saving.value = true;
  error.value = "";
  try {
    await api(`/employees/${caseFileEmployee.value.id}/dependents`, { method: "POST", body: {
      ...dependentForm, fullName: dependentForm.fullName.trim(), dateOfBirth: dependentForm.dateOfBirth || undefined,
    } });
    await openCaseFile(caseFileEmployee.value);
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not add the dependent.";
  } finally {
    saving.value = false;
  }
}

async function saveDependent(dependent: Dependent) {
  if (!caseFileEmployee.value) return;
  saving.value = true;
  error.value = "";
  try {
    await api(`/employees/${caseFileEmployee.value.id}/dependents/${dependent.id}`, { method: "PATCH", body: {
      relationship: dependent.relationship, fullName: dependent.fullName, dateOfBirth: dependent.dateOfBirth?.slice(0, 10) || undefined, qualifiesTos: dependent.qualifiesTos,
    } });
    await openCaseFile(caseFileEmployee.value);
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not update dependent.";
  } finally {
    saving.value = false;
  }
}

function clearForm() {
  editingId.value = "";
  Object.assign(form, {
    employeeNo: "", firstNameEn: "", lastNameEn: "", firstNameKm: "", lastNameKm: "",
    email: "", phone: "", hireDate: "", branchId: organization.value.branches[0]?.id ?? "",
    departmentId: organization.value.departments[0]?.id ?? "", positionId: organization.value.positions[0]?.id ?? "",
    costCenterId: "", managerId: "",
  });
}

function edit(employee: Employee) {
  editingId.value = employee.id;
  Object.assign(form, {
    employeeNo: employee.employeeNo,
    firstNameEn: employee.firstNameEn,
    lastNameEn: employee.lastNameEn,
    firstNameKm: employee.firstNameKm ?? "",
    lastNameKm: employee.lastNameKm ?? "",
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    hireDate: employee.hireDate.slice(0, 10),
    branchId: employee.branchId,
    departmentId: employee.departmentId,
    positionId: employee.positionId,
    costCenterId: employee.costCenterId ?? "",
    managerId: employee.managerId ?? "",
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function save() {
  saving.value = true;
  error.value = "";
  const body = {
    employeeNo: form.employeeNo.trim(),
    firstNameEn: form.firstNameEn.trim(),
    lastNameEn: form.lastNameEn.trim(),
    firstNameKm: form.firstNameKm.trim() || null,
    lastNameKm: form.lastNameKm.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    hireDate: form.hireDate,
    branchId: form.branchId,
    departmentId: form.departmentId,
    positionId: form.positionId,
    costCenterId: form.costCenterId || null,
    managerId: form.managerId || null,
  };
  try {
    if (editingId.value) {
      await api(`/employees/${editingId.value}`, { method: "PATCH", body });
    } else {
      await api("/employees", { method: "POST", body });
    }
    clearForm();
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not save the employee record.";
  } finally {
    saving.value = false;
  }
}

async function updateStatus(employee: Employee, status: string) {
  saving.value = true;
  error.value = "";
  try {
    await api(`/employees/${employee.id}/status`, { method: "PATCH", body: { status } });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not update employee status.";
  } finally {
    saving.value = false;
  }
}

async function terminate(employee: Employee) {
  if (!window.confirm(`Terminate ${employee.employeeNo} · ${employee.firstNameEn} ${employee.lastNameEn}? Their linked login will be disabled.`)) return;
  saving.value = true;
  error.value = "";
  try {
    await api(`/employees/${employee.id}`, { method: "DELETE" });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not terminate the employee.";
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-center justify-between"><div><h1 class="text-2xl font-semibold">{{ $t("nav.employees") }}</h1><p class="mt-1 text-sm text-slate-600">Manage employee profiles, organization assignment, and employment status.</p></div><button class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="load">Refresh</button></header>
    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>

    <form v-if="canManage" class="space-y-4 rounded-lg border bg-white p-4" @submit.prevent="save">
      <div class="flex items-center justify-between"><h2 class="font-semibold">{{ editingId ? "Edit employee" : "Add employee" }}</h2><button v-if="editingId" type="button" class="text-sm text-slate-600 underline" @click="clearForm">Cancel edit</button></div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input v-model="form.employeeNo" required maxlength="32" class="rounded border px-3 py-2" placeholder="Employee number" />
        <input v-model="form.firstNameEn" required maxlength="100" class="rounded border px-3 py-2" placeholder="First name (English)" />
        <input v-model="form.lastNameEn" required maxlength="100" class="rounded border px-3 py-2" placeholder="Last name (English)" />
        <label class="text-sm">Hire date<input v-model="form.hireDate" required type="date" class="mt-1 block w-full rounded border px-3 py-2" /></label>
        <input v-model="form.firstNameKm" maxlength="100" class="rounded border px-3 py-2" placeholder="នាមខ្លួន" />
        <input v-model="form.lastNameKm" maxlength="100" class="rounded border px-3 py-2" placeholder="នាមត្រកូល" />
        <input v-model="form.email" type="email" maxlength="254" class="rounded border px-3 py-2" placeholder="Work email" />
        <input v-model="form.phone" maxlength="40" class="rounded border px-3 py-2" placeholder="Phone" />
        <select v-model="form.branchId" required class="rounded border px-3 py-2" aria-label="Branch"><option value="" disabled>Choose branch</option><option v-for="b in organization.branches" :key="b.id" :value="b.id">{{ b.code }} · {{ b.nameEn }}</option></select>
        <select v-model="form.departmentId" required class="rounded border px-3 py-2" aria-label="Department"><option value="" disabled>Choose department</option><option v-for="d in organization.departments" :key="d.id" :value="d.id">{{ d.code }} · {{ d.nameEn }}</option></select>
        <select v-model="form.positionId" required class="rounded border px-3 py-2" aria-label="Position"><option value="" disabled>Choose position</option><option v-for="p in organization.positions" :key="p.id" :value="p.id">{{ p.code }} · {{ p.titleEn }}</option></select>
        <select v-model="form.costCenterId" class="rounded border px-3 py-2" aria-label="Cost center"><option value="">No cost center</option><option v-for="c in organization.costCenters" :key="c.id" :value="c.id">{{ c.code }} · {{ c.name }}</option></select>
        <select v-model="form.managerId" class="rounded border px-3 py-2" aria-label="Manager"><option value="">No manager</option><option v-for="e in employees.filter((row) => row.id !== editingId)" :key="e.id" :value="e.id">{{ e.employeeNo }} · {{ e.firstNameEn }} {{ e.lastNameEn }}</option></select>
      </div>
      <button class="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" :disabled="saving || !organization.branches.length || !organization.departments.length || !organization.positions.length">{{ saving ? "Saving…" : editingId ? "Save changes" : "Create employee" }}</button>
    </form>

    <div v-if="loading" class="rounded border bg-white p-6 text-slate-600">Loading employees…</div>
    <div v-else-if="!employees.length" class="rounded border bg-white p-6 text-slate-600">No active employee records.</div>
    <div v-else class="overflow-x-auto rounded-lg border bg-white"><table class="w-full text-left text-sm"><thead class="border-b bg-slate-50 text-slate-600"><tr><th class="p-3">Employee</th><th class="p-3">Organization</th><th class="p-3">Contact</th><th class="p-3">Hire date</th><th class="p-3">Status</th><th v-if="canManage" class="p-3">Actions</th></tr></thead><tbody>
      <tr v-for="employee in employees" :key="employee.id" class="border-b last:border-0"><td class="p-3"><strong>{{ employee.employeeNo }}</strong><div>{{ employee.lastNameEn }} {{ employee.firstNameEn }}</div><div v-if="employee.firstNameKm || employee.lastNameKm" class="text-xs text-slate-500">{{ employee.lastNameKm }} {{ employee.firstNameKm }}</div></td><td class="p-3">{{ employee.department.nameEn }}<div class="text-xs text-slate-500">{{ employee.position.titleEn }} · {{ employee.branch.nameEn }}</div></td><td class="p-3">{{ employee.email ?? "—" }}<div v-if="employee.phone" class="text-xs text-slate-500">{{ employee.phone }}</div></td><td class="p-3">{{ new Date(employee.hireDate).toLocaleDateString() }}</td><td class="p-3"><select v-if="canManage" :value="employee.status" class="rounded border px-2 py-1" :disabled="saving" aria-label="Employment status" @change="updateStatus(employee, ($event.target as HTMLSelectElement).value)"><option v-for="status in ['PROBATION', 'ACTIVE', 'SUSPENDED', 'RESIGNED']" :key="status" :value="status">{{ status }}</option></select><span v-else>{{ employee.status }}</span></td><td v-if="canManage" class="p-3"><div class="flex flex-wrap gap-3"><button class="text-blue-700 underline" @click="edit(employee)">Edit</button><button class="text-indigo-700 underline" @click="openCaseFile(employee)">Case file</button><button class="text-red-700 underline disabled:opacity-50" :disabled="saving" @click="terminate(employee)">Terminate</button></div></td></tr>
    </tbody></table></div>

    <section v-if="caseFileEmployee && canManage" class="space-y-5 rounded-lg border bg-white p-4">
      <header class="flex items-center justify-between"><div><h2 class="font-semibold">HR case file · {{ caseFileEmployee.employeeNo }}</h2><p class="text-sm text-slate-600">{{ caseFileEmployee.firstNameEn }} {{ caseFileEmployee.lastNameEn }}</p></div><button class="rounded border px-3 py-1.5 text-sm" @click="caseFileEmployee = null">Close</button></header>
      <div><h3 class="mb-3 font-medium">Contract history</h3>
        <div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b text-slate-600"><tr><th class="p-2">Type</th><th class="p-2">Dates</th><th class="p-2">Salary</th><th class="p-2">Allowance total</th><th class="p-2">Status</th></tr></thead><tbody><tr v-for="contract in contracts" :key="contract.id" class="border-b"><td class="p-2">{{ contract.type }}</td><td class="p-2">{{ contract.startDate.slice(0, 10) }} – {{ contract.endDate?.slice(0, 10) ?? "Ongoing" }}</td><td class="p-2">{{ Number(contract.basicSalary).toLocaleString() }} {{ contract.currency }}</td><td class="p-2">{{ contract.allowances.reduce((sum, item) => sum + Number(item.amount), 0).toLocaleString() }} {{ contract.currency }}</td><td class="p-2">{{ contract.isCurrent ? "Current" : "Past" }}</td></tr><tr v-if="!contracts.length"><td colspan="5" class="p-2 text-slate-500">No contracts recorded.</td></tr></tbody></table></div>
        <form class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="addContract"><select v-model="contractForm.type" class="rounded border px-3 py-2"><option>PERMANENT</option><option>FIXED_TERM</option><option>PROBATION</option><option>INTERN</option><option>CONSULTANT</option></select><label class="text-sm">Effective from<input v-model="contractForm.startDate" required type="date" class="mt-1 block w-full rounded border px-3 py-2" /></label><label class="text-sm">End date<input v-model="contractForm.endDate" type="date" class="mt-1 block w-full rounded border px-3 py-2" /></label><select v-model="contractForm.currency" class="rounded border px-3 py-2"><option value="KHR">KHR</option><option value="USD">USD</option></select><label class="text-sm">Monthly base salary<input v-model="contractForm.basicSalary" required type="number" min="0.01" step="0.01" class="mt-1 block w-full rounded border px-3 py-2" /></label><label class="text-sm">Working days/month<input v-model.number="contractForm.workingDays" required type="number" min="1" max="31" class="mt-1 block w-full rounded border px-3 py-2" /></label><label class="text-sm">Hours/day<input v-model.number="contractForm.hoursPerDay" required type="number" min="0.25" max="24" step="0.25" class="mt-1 block w-full rounded border px-3 py-2" /></label><input v-model="contractForm.allowanceCode" class="rounded border px-3 py-2" placeholder="Allowance code (optional)" /><input v-model="contractForm.allowanceAmount" type="number" min="0" step="0.01" class="rounded border px-3 py-2" placeholder="Allowance amount" /><div class="sm:col-span-2 lg:col-span-4"><button class="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" :disabled="saving">{{ saving ? "Saving…" : "Add contract" }}</button></div></form>
      </div>
      <div><h3 class="mb-3 font-medium">Dependents and tax relief eligibility</h3><div class="space-y-2"><div v-for="dependent in dependents" :key="dependent.id" class="grid gap-2 rounded border p-3 sm:grid-cols-2 lg:grid-cols-5"><input v-model="dependent.fullName" class="rounded border px-2 py-1" aria-label="Dependent name" /><select v-model="dependent.relationship" class="rounded border px-2 py-1" aria-label="Relationship"><option value="spouse">Spouse</option><option value="child">Child</option><option value="other">Other</option></select><input v-model="dependent.dateOfBirth" type="date" class="rounded border px-2 py-1" aria-label="Date of birth" /><label class="flex items-center gap-2 text-sm"><input v-model="dependent.qualifiesTos" type="checkbox" />Qualifies for TOS</label><button class="text-left text-sm text-blue-700 underline" :disabled="saving" @click="saveDependent(dependent)">Save</button></div><p v-if="!dependents.length" class="text-sm text-slate-500">No dependents recorded.</p></div>
        <form class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" @submit.prevent="addDependent"><input v-model="dependentForm.fullName" required maxlength="150" class="rounded border px-3 py-2" placeholder="Full name" /><select v-model="dependentForm.relationship" class="rounded border px-3 py-2"><option value="child">Child</option><option value="spouse">Spouse</option><option value="other">Other</option></select><input v-model="dependentForm.dateOfBirth" type="date" class="rounded border px-3 py-2" aria-label="Date of birth" /><label class="flex items-center gap-2 text-sm"><input v-model="dependentForm.qualifiesTos" type="checkbox" />Qualifies for TOS</label><button class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="saving">Add dependent</button></form>
      </div>
    </section>
  </section>
</template>
