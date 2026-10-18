<script setup lang="ts">
definePageMeta({ middleware: "auth" });

type Enrollment = {
  id: string;
  progress: number;
  completedAt: string | null;
  employee?: { employeeNo: string; firstNameEn: string; lastNameEn: string };
};
type Course = {
  id: string;
  titleEn: string;
  titleKm: string;
  description: string | null;
  durationH: number | string;
  enrollments: Enrollment[];
};

const api = useApi();
const auth = useAuthStore();
const isManager = computed(() => auth.permissions.includes("lms.write"));
const courses = ref<Course[]>([]);
const expandedEnrollments = ref<Record<string, Enrollment[]>>({});
const progressDraft = reactive<Record<string, number>>({});
const form = reactive({ titleEn: "", titleKm: "", description: "", durationH: 1 });
const loading = ref(true);
const busy = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    courses.value = await api<Course[]>("/lms/courses");
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load courses.";
  } finally {
    loading.value = false;
  }
}

async function createCourse() {
  busy.value = true;
  error.value = "";
  try {
    await api("/lms/courses", {
      method: "POST",
      body: { ...form, durationH: Number(form.durationH) },
    });
    Object.assign(form, { titleEn: "", titleKm: "", description: "", durationH: 1 });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not create the course.";
  } finally {
    busy.value = false;
  }
}

async function enroll(course: Course) {
  busy.value = true;
  error.value = "";
  try {
    await api(`/lms/courses/${course.id}/enroll`, { method: "POST" });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not enroll in this course.";
  } finally {
    busy.value = false;
  }
}

async function saveProgress(enrollment: Enrollment) {
  busy.value = true;
  error.value = "";
  try {
    await api(`/lms/enrollments/${enrollment.id}/progress`, {
      method: "PATCH",
      body: { progress: Number(progressDraft[enrollment.id]) },
    });
    await load();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not update course progress.";
  } finally {
    busy.value = false;
  }
}

async function loadEnrollments(course: Course) {
  if (expandedEnrollments.value[course.id]) return;
  try {
    expandedEnrollments.value[course.id] = await api<Enrollment[]>(`/lms/courses/${course.id}/enrollments`);
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Could not load enrollment details.";
  }
}

onMounted(load);
</script>

<template>
  <section class="space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Learning and development</h1>
        <p class="mt-1 text-sm text-slate-600">{{ isManager ? "Manage courses and monitor employee completion." : "Enroll in courses and keep your learning progress up to date." }}</p>
      </div>
      <button class="rounded border px-3 py-2 text-sm" :disabled="loading" @click="load">Refresh</button>
    </header>
    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>

    <form v-if="isManager" class="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2" @submit.prevent="createCourse">
      <input v-model="form.titleEn" required maxlength="160" class="rounded border px-3 py-2" placeholder="Course title (English)" />
      <input v-model="form.titleKm" required maxlength="160" class="rounded border px-3 py-2" placeholder="វគ្គសិក្សា (ភាសាខ្មែរ)" />
      <textarea v-model="form.description" maxlength="4000" class="rounded border px-3 py-2 md:col-span-2" placeholder="Course description" />
      <label class="text-sm">Duration in hours<input v-model.number="form.durationH" required type="number" min="0.01" step="0.01" class="mt-1 block w-full rounded border px-3 py-2" /></label>
      <button class="self-end rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" :disabled="busy">Create course</button>
    </form>

    <div v-if="loading" class="rounded border bg-white p-6 text-slate-600">Loading courses…</div>
    <div v-else-if="!courses.length" class="rounded border bg-white p-6 text-slate-600">No courses are available yet.</div>
    <div v-else class="grid gap-4 lg:grid-cols-2">
      <article v-for="course in courses" :key="course.id" class="space-y-3 rounded-lg border bg-white p-4">
        <header class="flex items-start justify-between gap-3">
          <div><h2 class="font-semibold">{{ course.titleEn }}</h2><p class="text-sm text-slate-700">{{ course.titleKm }}</p></div>
          <span class="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs">{{ course.durationH }} h</span>
        </header>
        <p v-if="course.description" class="text-sm text-slate-600">{{ course.description }}</p>

        <template v-if="isManager">
          <button class="text-sm font-medium text-blue-700" @click="loadEnrollments(course)">View employee progress ({{ course.enrollments.length }})</button>
          <ul v-if="expandedEnrollments[course.id]" class="divide-y rounded border">
            <li v-for="item in expandedEnrollments[course.id]" :key="item.id" class="flex items-center justify-between gap-3 p-3 text-sm">
              <span>{{ item.employee?.employeeNo }} · {{ item.employee?.firstNameEn }} {{ item.employee?.lastNameEn }}</span>
              <span>{{ item.progress }}% <span v-if="item.completedAt" class="text-green-700">· Complete</span></span>
            </li>
            <li v-if="!expandedEnrollments[course.id]?.length" class="p-3 text-sm text-slate-500">No employees enrolled.</li>
          </ul>
        </template>

        <template v-else>
          <div v-if="course.enrollments[0]" class="space-y-3">
            <div class="flex justify-between text-sm"><span>Progress</span><strong>{{ course.enrollments[0].progress }}%</strong></div>
            <progress class="h-2 w-full accent-emerald-700" max="100" :value="course.enrollments[0].progress" />
            <p v-if="course.enrollments[0].completedAt" class="text-sm font-medium text-green-700">Course completed</p>
            <form v-else class="flex gap-2" @submit.prevent="saveProgress(course.enrollments[0]!)">
              <input v-model.number="progressDraft[course.enrollments[0].id]" required type="number" :min="course.enrollments[0].progress" max="100" step="1" class="min-w-0 flex-1 rounded border px-3 py-2" placeholder="New progress (0–100%)" />
              <button class="rounded border px-3 py-2 disabled:opacity-50" :disabled="busy">Save</button>
            </form>
          </div>
          <button v-else class="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" :disabled="busy" @click="enroll(course)">Enroll</button>
        </template>
      </article>
    </div>
  </section>
</template>
