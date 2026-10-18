<script setup lang="ts">
definePageMeta({ middleware: "auth" });
const api = useApi();
const data = await api("/analytics/dashboard").catch(() => ({
  headcount: 0,
  pendingLeave: 0,
  lastPayroll: null,
}));
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold">{{ $t("nav.dashboard") }}</h1>
    <div class="mt-6 grid grid-cols-3 gap-4">
      <div class="rounded-lg bg-white p-4 shadow-sm">
        <p class="text-sm text-slate-500">Headcount</p>
        <p class="text-3xl font-semibold">{{ data.headcount }}</p>
      </div>
      <div class="rounded-lg bg-white p-4 shadow-sm">
        <p class="text-sm text-slate-500">Pending leave</p>
        <p class="text-3xl font-semibold">{{ data.pendingLeave }}</p>
      </div>
      <div class="rounded-lg bg-white p-4 shadow-sm">
        <p class="text-sm text-slate-500">Last payroll net</p>
        <p class="text-3xl font-semibold">{{ data.lastPayroll?.totalNet ?? 0 }} KHR</p>
      </div>
    </div>
  </div>
</template>
