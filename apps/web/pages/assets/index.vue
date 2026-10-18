<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type Asset = {
  id: string;
  tag: string;
  name: string;
  category: string;
  serialNo?: string | null;
  status: string;
  assignments: Array<{
    id: string;
    employee: { id: string; employeeNo: string; firstNameEn: string; lastNameEn: string };
  }>;
};
type Employee = { id: string; employeeNo: string; firstNameEn: string; lastNameEn: string };

const api = useApi();
const assets = ref<Asset[]>([]);
const employees = ref<Employee[]>([]);
const selectedEmployees = reactive<Record<string, string>>({});
const form = reactive({ tag: "", name: "", category: "", serialNo: "" });
const loading = ref(true);
const saving = ref(false);
const error = ref("");

async function refresh() {
  loading.value = true;
  error.value = "";
  try {
    const [assetRows, employeeRows] = await Promise.all([
      api<Asset[]>("/assets"),
      api<Employee[]>("/employees"),
    ]);
    assets.value = assetRows;
    employees.value = employeeRows;
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load assets. Check your permissions and try again.";
  } finally {
    loading.value = false;
  }
}

async function createAsset() {
  saving.value = true;
  error.value = "";
  try {
    await api("/assets", {
      method: "POST",
      body: {
        tag: form.tag.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        ...(form.serialNo.trim() ? { serialNo: form.serialNo.trim() } : {}),
      },
    });
    Object.assign(form, { tag: "", name: "", category: "", serialNo: "" });
    await refresh();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not create the asset.";
  } finally {
    saving.value = false;
  }
}

async function assign(asset: Asset) {
  const employeeId = selectedEmployees[asset.id];
  if (!employeeId) return;
  saving.value = true;
  error.value = "";
  try {
    await api(`/assets/${asset.id}/assign`, { method: "POST", body: { employeeId } });
    delete selectedEmployees[asset.id];
    await refresh();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not assign this asset.";
  } finally {
    saving.value = false;
  }
}

async function returnAsset(asset: Asset) {
  saving.value = true;
  error.value = "";
  try {
    await api(`/assets/${asset.id}/return`, { method: "POST" });
    await refresh();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not record the asset return.";
  } finally {
    saving.value = false;
  }
}

onMounted(refresh);
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ $t("nav.assets") }}</h1>
        <p class="mt-1 text-sm text-slate-600">Track company equipment and employee assignments.</p>
      </div>
      <button class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="refresh">Refresh</button>
    </header>

    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>

    <form class="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-5" @submit.prevent="createAsset">
      <input v-model="form.tag" required maxlength="64" class="rounded border px-3 py-2" placeholder="Asset tag" />
      <input v-model="form.name" required maxlength="160" class="rounded border px-3 py-2" placeholder="Name" />
      <input v-model="form.category" required maxlength="80" class="rounded border px-3 py-2" placeholder="Category" />
      <input v-model="form.serialNo" maxlength="120" class="rounded border px-3 py-2" placeholder="Serial number (optional)" />
      <button class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="saving">Add asset</button>
    </form>

    <div v-if="loading" class="rounded border bg-white p-6 text-slate-600">Loading assets…</div>
    <div v-else-if="assets.length === 0" class="rounded border bg-white p-6 text-slate-600">No assets have been registered.</div>
    <div v-else class="overflow-x-auto rounded-lg border bg-white">
      <table class="w-full text-left text-sm">
        <thead class="border-b bg-slate-50 text-slate-600">
          <tr><th class="p-3">Tag</th><th class="p-3">Asset</th><th class="p-3">Category</th><th class="p-3">Status / assignee</th><th class="p-3">Action</th></tr>
        </thead>
        <tbody>
          <tr v-for="asset in assets" :key="asset.id" class="border-b last:border-0">
            <td class="p-3 font-medium">{{ asset.tag }}</td>
            <td class="p-3">{{ asset.name }}<div v-if="asset.serialNo" class="text-xs text-slate-500">{{ asset.serialNo }}</div></td>
            <td class="p-3">{{ asset.category }}</td>
            <td class="p-3">
              {{ asset.status }}
              <div v-if="asset.assignments?.[0]" class="text-xs text-slate-600">
                {{ asset.assignments[0].employee.employeeNo }} · {{ asset.assignments[0].employee.firstNameEn }} {{ asset.assignments[0].employee.lastNameEn }}
              </div>
            </td>
            <td class="p-3">
              <div v-if="asset.status === 'available'" class="flex gap-2">
                <select v-model="selectedEmployees[asset.id]" class="min-w-40 rounded border px-2 py-1" aria-label="Choose employee">
                  <option value="">Select employee</option>
                  <option v-for="employee in employees" :key="employee.id" :value="employee.id">
                    {{ employee.employeeNo }} · {{ employee.firstNameEn }} {{ employee.lastNameEn }}
                  </option>
                </select>
                <button class="rounded border px-3 py-1 disabled:opacity-50" :disabled="saving || !selectedEmployees[asset.id]" @click="assign(asset)">Assign</button>
              </div>
              <button v-else class="rounded border px-3 py-1 disabled:opacity-50" :disabled="saving" @click="returnAsset(asset)">Record return</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
