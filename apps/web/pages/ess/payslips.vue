<script setup lang="ts">
definePageMeta({ middleware: "auth" });
type Payslip = {
  id: string;
  gross: number | string;
  tosAmount: number | string;
  nssfPensionEe: number | string;
  net: number | string;
  payslipFileId: string | null;
  run: { period: { year: number; month: number }; status: string };
};
const payslips = await useApi()<Payslip[]>("/employees/me/payslips").catch(() => []);
const config = useRuntimeConfig();
const auth = useAuthStore();
async function download(fileId: string) {
  const blob = await $fetch<Blob>(`${config.public.apiUrl}/files/${fileId}/download`, {
    responseType: "blob",
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `payslip-${fileId}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <section>
    <h1 class="text-2xl font-semibold">Payslips / សន្លឹកប្រាក់ខែ</h1>
    <div v-if="payslips.length" class="mt-4 space-y-3">
      <article v-for="p in payslips" :key="p.id" class="flex items-center justify-between rounded bg-white p-4 shadow-sm">
        <div>
          <h2 class="font-medium">{{ p.run.period.year }}-{{ String(p.run.period.month).padStart(2, '0') }}</h2>
          <p class="text-sm text-slate-600">Net / សុទ្ធ: {{ p.net }} KHR · TOS: {{ p.tosAmount }} KHR</p>
        </div>
        <button v-if="p.payslipFileId" class="rounded bg-emerald-700 px-3 py-2 text-sm text-white" @click="download(p.payslipFileId)">
          Download PDF
        </button>
        <span v-else class="text-sm text-slate-500">PDF processing</span>
      </article>
    </div>
    <p v-else class="mt-4 rounded bg-white p-4 text-slate-600">No approved payslips yet.</p>
  </section>
</template>
