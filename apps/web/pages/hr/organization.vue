<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type Branch = { id: string; code: string; nameEn: string; nameKm: string; address: string | null; timezone: string; isHq: boolean };
type Department = { id: string; code: string; nameEn: string; nameKm: string; parentId: string | null; managerId: string | null };
type Position = { id: string; code: string; titleEn: string; titleKm: string; grade: string | null };
type CostCenter = { id: string; code: string; name: string };
type Employee = { id: string; employeeNo: string; firstNameEn: string; lastNameEn: string };
type OrganizationTree = { branches: Branch[]; departments: Department[]; positions: Position[]; costCenters: CostCenter[] };

const api = useApi();
const auth = useAuthStore();
const canManage = computed(() => auth.permissions.includes("org.write"));
const tree = ref<OrganizationTree>({ branches: [], departments: [], positions: [], costCenters: [] });
const employees = ref<Employee[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const editing = ref<{ path: string; id: string } | null>(null);
const branchForm = reactive({ code: "", nameEn: "", nameKm: "", address: "", timezone: "Asia/Phnom_Penh", isHq: false });
const departmentForm = reactive({ code: "", nameEn: "", nameKm: "", parentId: "", managerId: "" });
const positionForm = reactive({ code: "", titleEn: "", titleKm: "", grade: "" });
const costCenterForm = reactive({ code: "", name: "" });

async function load() {
  loading.value = true;
  error.value = "";
  try {
    tree.value = await api<OrganizationTree>("/organization/tree");
    if (canManage.value) employees.value = await api<Employee[]>("/employees");
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load organization data.";
  } finally {
    loading.value = false;
  }
}

async function saveStructure(path: string, body: object, reset: () => void) {
  saving.value = true;
  error.value = "";
  const editId = editing.value?.path === path ? editing.value.id : null;
  try {
    await api(`/organization/${path}${editId ? `/${editId}` : ""}`, { method: editId ? "PUT" : "POST", body });
    reset();
    editing.value = null;
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? `Could not ${editId ? "update" : "create"} ${path.replace("-", " ")}.`;
  } finally {
    saving.value = false;
  }
}

function editBranch(branch: Branch) {
  editing.value = { path: "branches", id: branch.id };
  Object.assign(branchForm, { code: branch.code, nameEn: branch.nameEn, nameKm: branch.nameKm, address: branch.address ?? "", timezone: branch.timezone, isHq: branch.isHq });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function editDepartment(department: Department) {
  editing.value = { path: "departments", id: department.id };
  Object.assign(departmentForm, { code: department.code, nameEn: department.nameEn, nameKm: department.nameKm, parentId: department.parentId ?? "", managerId: department.managerId ?? "" });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function editPosition(position: Position) {
  editing.value = { path: "positions", id: position.id };
  Object.assign(positionForm, { code: position.code, titleEn: position.titleEn, titleKm: position.titleKm, grade: position.grade ?? "" });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function editCostCenter(costCenter: CostCenter) {
  editing.value = { path: "cost-centers", id: costCenter.id };
  Object.assign(costCenterForm, { code: costCenter.code, name: costCenter.name });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onMounted(load);
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-center justify-between">
      <div><h1 class="text-2xl font-semibold">Organization structure</h1><p class="mt-1 text-sm text-slate-600">Manage branches, departments, positions, and cost centers.</p></div>
      <button class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>

    <div v-if="canManage" class="grid gap-4 xl:grid-cols-2">
      <form class="space-y-3 rounded-lg border bg-white p-4" @submit.prevent="saveStructure('branches', { ...branchForm }, () => Object.assign(branchForm, { code: '', nameEn: '', nameKm: '', address: '', timezone: 'Asia/Phnom_Penh', isHq: false }))">
        <div class="flex justify-between"><h2 class="font-semibold">{{ editing?.path === 'branches' ? 'Edit branch' : 'Add branch' }}</h2><button v-if="editing?.path === 'branches'" type="button" class="text-sm underline" @click="editing = null; Object.assign(branchForm, { code: '', nameEn: '', nameKm: '', address: '', timezone: 'Asia/Phnom_Penh', isHq: false })">Cancel</button></div>
        <div class="grid gap-3 sm:grid-cols-2"><input v-model="branchForm.code" required maxlength="32" class="rounded border px-3 py-2" placeholder="Branch code" /><input v-model="branchForm.timezone" required maxlength="80" class="rounded border px-3 py-2" placeholder="Timezone" /><input v-model="branchForm.nameEn" required maxlength="160" class="rounded border px-3 py-2" placeholder="Name (English)" /><input v-model="branchForm.nameKm" required maxlength="160" class="rounded border px-3 py-2" placeholder="ឈ្មោះ (ភាសាខ្មែរ)" /></div>
        <input v-model="branchForm.address" maxlength="500" class="w-full rounded border px-3 py-2" placeholder="Address (optional)" />
        <label class="flex items-center gap-2 text-sm"><input v-model="branchForm.isHq" type="checkbox" />Headquarters</label>
        <button class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="saving">{{ editing?.path === 'branches' ? 'Update branch' : 'Save branch' }}</button>
      </form>

      <form class="space-y-3 rounded-lg border bg-white p-4" @submit.prevent="saveStructure('departments', { code: departmentForm.code, nameEn: departmentForm.nameEn, nameKm: departmentForm.nameKm, ...(departmentForm.parentId ? { parentId: departmentForm.parentId } : {}), ...(departmentForm.managerId ? { managerId: departmentForm.managerId } : {}) }, () => Object.assign(departmentForm, { code: '', nameEn: '', nameKm: '', parentId: '', managerId: '' }))">
        <div class="flex justify-between"><h2 class="font-semibold">{{ editing?.path === 'departments' ? 'Edit department' : 'Add department' }}</h2><button v-if="editing?.path === 'departments'" type="button" class="text-sm underline" @click="editing = null; Object.assign(departmentForm, { code: '', nameEn: '', nameKm: '', parentId: '', managerId: '' })">Cancel</button></div>
        <div class="grid gap-3 sm:grid-cols-2"><input v-model="departmentForm.code" required maxlength="32" class="rounded border px-3 py-2" placeholder="Department code" /><input v-model="departmentForm.nameEn" required maxlength="160" class="rounded border px-3 py-2" placeholder="Name (English)" /><input v-model="departmentForm.nameKm" required maxlength="160" class="rounded border px-3 py-2" placeholder="ឈ្មោះ (ភាសាខ្មែរ)" />
          <select v-model="departmentForm.parentId" class="rounded border px-3 py-2" aria-label="Parent department"><option value="">No parent department</option><option v-for="d in tree.departments" :key="d.id" :value="d.id">{{ d.code }} · {{ d.nameEn }}</option></select>
          <select v-model="departmentForm.managerId" class="rounded border px-3 py-2 sm:col-span-2" aria-label="Department manager"><option value="">No manager assigned</option><option v-for="e in employees" :key="e.id" :value="e.id">{{ e.employeeNo }} · {{ e.firstNameEn }} {{ e.lastNameEn }}</option></select>
        </div>
        <button class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="saving">{{ editing?.path === 'departments' ? 'Update department' : 'Save department' }}</button>
      </form>

      <form class="space-y-3 rounded-lg border bg-white p-4" @submit.prevent="saveStructure('positions', { ...positionForm }, () => Object.assign(positionForm, { code: '', titleEn: '', titleKm: '', grade: '' }))">
        <div class="flex justify-between"><h2 class="font-semibold">{{ editing?.path === 'positions' ? 'Edit position' : 'Add position' }}</h2><button v-if="editing?.path === 'positions'" type="button" class="text-sm underline" @click="editing = null; Object.assign(positionForm, { code: '', titleEn: '', titleKm: '', grade: '' })">Cancel</button></div>
        <div class="grid gap-3 sm:grid-cols-2"><input v-model="positionForm.code" required maxlength="32" class="rounded border px-3 py-2" placeholder="Position code" /><input v-model="positionForm.grade" maxlength="40" class="rounded border px-3 py-2" placeholder="Grade (optional)" /><input v-model="positionForm.titleEn" required maxlength="160" class="rounded border px-3 py-2" placeholder="Title (English)" /><input v-model="positionForm.titleKm" required maxlength="160" class="rounded border px-3 py-2" placeholder="មុខតំណែង (ភាសាខ្មែរ)" /></div>
        <button class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="saving">{{ editing?.path === 'positions' ? 'Update position' : 'Save position' }}</button>
      </form>

      <form class="space-y-3 rounded-lg border bg-white p-4" @submit.prevent="saveStructure('cost-centers', { ...costCenterForm }, () => Object.assign(costCenterForm, { code: '', name: '' }))">
        <div class="flex justify-between"><h2 class="font-semibold">{{ editing?.path === 'cost-centers' ? 'Edit cost center' : 'Add cost center' }}</h2><button v-if="editing?.path === 'cost-centers'" type="button" class="text-sm underline" @click="editing = null; Object.assign(costCenterForm, { code: '', name: '' })">Cancel</button></div>
        <div class="grid gap-3 sm:grid-cols-2"><input v-model="costCenterForm.code" required maxlength="32" class="rounded border px-3 py-2" placeholder="Cost center code" /><input v-model="costCenterForm.name" required maxlength="160" class="rounded border px-3 py-2" placeholder="Cost center name" /></div>
        <button class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="saving">{{ editing?.path === 'cost-centers' ? 'Update cost center' : 'Save cost center' }}</button>
      </form>
    </div>

    <div v-if="loading" class="rounded border bg-white p-6 text-slate-600">Loading organization…</div>
    <div v-else class="grid gap-4 xl:grid-cols-2">
      <article class="rounded-lg border bg-white p-4"><h2 class="mb-3 font-semibold">Branches</h2><p v-if="!tree.branches.length" class="text-sm text-slate-500">No branches yet.</p><ul class="divide-y"><li v-for="b in tree.branches" :key="b.id" class="flex justify-between gap-2 py-2"><div><strong>{{ b.code }}</strong> · {{ b.nameEn }} / {{ b.nameKm }} <span v-if="b.isHq" class="text-xs text-slate-500">· HQ</span><div class="text-xs text-slate-500">{{ b.timezone }}<span v-if="b.address"> · {{ b.address }}</span></div></div><button v-if="canManage" class="text-sm text-blue-700 underline" @click="editBranch(b)">Edit</button></li></ul></article>
      <article class="rounded-lg border bg-white p-4"><h2 class="mb-3 font-semibold">Departments</h2><p v-if="!tree.departments.length" class="text-sm text-slate-500">No departments yet.</p><ul class="divide-y"><li v-for="d in tree.departments" :key="d.id" class="flex justify-between gap-2 py-2"><div><strong>{{ d.code }}</strong> · {{ d.nameEn }} / {{ d.nameKm }}<span v-if="d.parentId" class="text-xs text-slate-500"> · Parent: {{ tree.departments.find((parent) => parent.id === d.parentId)?.nameEn }}</span></div><button v-if="canManage" class="text-sm text-blue-700 underline" @click="editDepartment(d)">Edit</button></li></ul></article>
      <article class="rounded-lg border bg-white p-4"><h2 class="mb-3 font-semibold">Positions</h2><p v-if="!tree.positions.length" class="text-sm text-slate-500">No positions yet.</p><ul class="divide-y"><li v-for="p in tree.positions" :key="p.id" class="flex justify-between gap-2 py-2"><div><strong>{{ p.code }}</strong> · {{ p.titleEn }} / {{ p.titleKm }}<span v-if="p.grade" class="text-xs text-slate-500"> · Grade {{ p.grade }}</span></div><button v-if="canManage" class="text-sm text-blue-700 underline" @click="editPosition(p)">Edit</button></li></ul></article>
      <article class="rounded-lg border bg-white p-4"><h2 class="mb-3 font-semibold">Cost centers</h2><p v-if="!tree.costCenters.length" class="text-sm text-slate-500">No cost centers yet.</p><ul class="divide-y"><li v-for="c in tree.costCenters" :key="c.id" class="flex justify-between gap-2 py-2"><div><strong>{{ c.code }}</strong> · {{ c.name }}</div><button v-if="canManage" class="text-sm text-blue-700 underline" @click="editCostCenter(c)">Edit</button></li></ul></article>
    </div>
  </section>
</template>
