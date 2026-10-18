<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const stages = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
type Application = {
  id: string;
  stage: (typeof stages)[number];
  createdAt: string;
  candidate: { fullName: string; email: string; phone: string | null; source: string | null };
};
type Job = {
  id: string;
  titleEn: string;
  titleKm: string;
  description: string;
  status: "open" | "closed";
  headcount: number;
  applications: Application[];
};

const api = useApi();
const jobs = ref<Job[]>([]);
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const jobForm = reactive({ titleEn: "", titleKm: "", description: "" });
const applicationForm = reactive({
  jobId: "",
  fullName: "",
  email: "",
  phone: "",
  source: "",
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    jobs.value = await api<Job[]>("/recruitment/jobs");
    if (!applicationForm.jobId) {
      applicationForm.jobId = jobs.value.find((job) => job.status === "open")?.id ?? "";
    }
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load recruitment data. Recruiter permission is required.";
  } finally {
    loading.value = false;
  }
}

async function createJob() {
  busy.value = true;
  error.value = "";
  try {
    const job = await api<Job>("/recruitment/jobs", { method: "POST", body: { ...jobForm } });
    jobs.value.unshift({ ...job, applications: [] });
    applicationForm.jobId = job.id;
    Object.assign(jobForm, { titleEn: "", titleKm: "", description: "" });
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not create the job.";
  } finally {
    busy.value = false;
  }
}

async function createApplication() {
  busy.value = true;
  error.value = "";
  try {
    await api(`/recruitment/jobs/${applicationForm.jobId}/applications`, {
      method: "POST",
      body: {
        fullName: applicationForm.fullName,
        email: applicationForm.email,
        ...(applicationForm.phone ? { phone: applicationForm.phone } : {}),
        ...(applicationForm.source ? { source: applicationForm.source } : {}),
      },
    });
    Object.assign(applicationForm, { fullName: "", email: "", phone: "", source: "" });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not add the candidate.";
  } finally {
    busy.value = false;
  }
}

async function setStage(application: Application, stage: string) {
  busy.value = true;
  error.value = "";
  try {
    await api(`/recruitment/applications/${application.id}/stage`, { method: "PATCH", body: { stage } });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not update the candidate stage.";
  } finally {
    busy.value = false;
  }
}

async function setJobStatus(job: Job) {
  busy.value = true;
  error.value = "";
  try {
    const updated = await api<Job>(`/recruitment/jobs/${job.id}/status`, {
      method: "PATCH",
      body: { status: job.status === "open" ? "closed" : "open" },
    });
    job.status = updated.status;
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not update the requisition status.";
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-center justify-between">
      <div><h1 class="text-2xl font-semibold">Recruitment ATS</h1><p class="mt-1 text-sm text-slate-600">Manage open roles and move candidates through your hiring pipeline.</p></div>
      <button class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>

    <form class="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2" @submit.prevent="createJob">
      <input v-model="jobForm.titleEn" required maxlength="160" class="rounded border px-3 py-2" placeholder="Job title (English)" />
      <input v-model="jobForm.titleKm" required maxlength="160" class="rounded border px-3 py-2" placeholder="មុខតំណែង (ភាសាខ្មែរ)" />
      <textarea v-model="jobForm.description" required maxlength="10000" class="rounded border px-3 py-2 md:col-span-2" placeholder="Job description" />
      <button class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50 md:col-span-2" :disabled="busy">Create open requisition</button>
    </form>

    <form v-if="jobs.some((job) => job.status === 'open')" class="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3" @submit.prevent="createApplication">
      <select v-model="applicationForm.jobId" required class="rounded border px-3 py-2" aria-label="Job requisition"><option value="" disabled>Select open role</option><option v-for="job in jobs.filter((row) => row.status === 'open')" :key="job.id" :value="job.id">{{ job.titleEn }}</option></select>
      <input v-model="applicationForm.fullName" required maxlength="200" class="rounded border px-3 py-2" placeholder="Candidate name" />
      <input v-model="applicationForm.email" required type="email" maxlength="254" class="rounded border px-3 py-2" placeholder="Candidate email" />
      <input v-model="applicationForm.phone" maxlength="40" class="rounded border px-3 py-2" placeholder="Phone (optional)" />
      <input v-model="applicationForm.source" maxlength="80" class="rounded border px-3 py-2" placeholder="Source (optional)" />
      <button class="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="busy">Add candidate</button>
    </form>

    <div v-if="loading" class="rounded border bg-white p-6 text-slate-600">Loading requisitions…</div>
    <div v-else-if="!jobs.length" class="rounded border bg-white p-6 text-slate-600">No job requisitions yet.</div>
    <article v-for="job in jobs" :key="job.id" class="overflow-hidden rounded-lg border bg-white">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 p-4">
        <div><h2 class="font-semibold">{{ job.titleEn }} <span class="font-normal text-slate-600">/ {{ job.titleKm }}</span></h2><p class="mt-1 text-sm text-slate-600">{{ job.applications.length }} applicants · {{ job.status }}</p></div>
        <button class="rounded border px-3 py-2 text-sm disabled:opacity-50" :disabled="busy" @click="setJobStatus(job)">{{ job.status === "open" ? "Close role" : "Reopen role" }}</button>
      </header>
      <p v-if="job.description" class="whitespace-pre-wrap p-4 text-sm text-slate-600">{{ job.description }}</p>
      <div v-if="job.applications.length" class="overflow-x-auto border-t"><table class="w-full text-left text-sm"><thead class="border-b text-slate-600"><tr><th class="p-3">Candidate</th><th class="p-3">Contact</th><th class="p-3">Source</th><th class="p-3">Stage</th></tr></thead><tbody><tr v-for="application in job.applications" :key="application.id" class="border-b last:border-0"><td class="p-3 font-medium">{{ application.candidate.fullName }}</td><td class="p-3">{{ application.candidate.email }}<div v-if="application.candidate.phone" class="text-xs text-slate-500">{{ application.candidate.phone }}</div></td><td class="p-3">{{ application.candidate.source ?? "—" }}</td><td class="p-3"><select :value="application.stage" class="rounded border px-2 py-1" :disabled="busy" aria-label="Candidate stage" @change="setStage(application, ($event.target as HTMLSelectElement).value)"><option v-for="stage in stages" :key="stage" :value="stage">{{ stage }}</option></select></td></tr></tbody></table></div>
      <p v-else class="border-t p-4 text-sm text-slate-500">No candidates have been added.</p>
    </article>
  </section>
</template>
