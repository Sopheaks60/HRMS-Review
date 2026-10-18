<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const api = useApi();
const loading = ref(true);
const health = ref<any>(null);
const pingCount = ref(0);
const pingHistory = ref<{ timestamp: string; latencyMs: number }[]>([]);

async function checkHealth() {
  loading.value = true;
  try {
    const res: any = await api('/health');
    health.value = res;
    if (res?.latencyMs !== undefined) {
      pingCount.value++;
      pingHistory.value.unshift({
        timestamp: new Date().toLocaleTimeString(),
        latencyMs: res.latencyMs,
      });
      if (pingHistory.value.length > 10) pingHistory.value.pop();
    }
  } catch (err: any) {
    health.value = { status: 'DOWN', error: err.message };
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  checkHealth();
});
</script>

<template>
  <div class="space-y-8 pb-12">
    <!-- Header -->
    <header class="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Neon Serverless PostgreSQL Telemetry Center</h1>
        <p class="text-sm text-slate-600 mt-1">
          Real-time connection metrics, query latency monitoring, and server telemetry for KromPay Cambodia.
        </p>
      </div>
      <button
        @click="checkHealth"
        :disabled="loading"
        class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
      >
        <span class="inline-block w-2 h-2 rounded-full" :class="loading ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'"></span>
        {{ loading ? 'Pinging Neon DB...' : 'Test Connection' }}
      </button>
    </header>

    <!-- Telemetry Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Database Status</span>
        <div class="mt-3 flex items-center gap-2">
          <span class="w-3 h-3 rounded-full" :class="health?.status === 'UP' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'"></span>
          <span class="text-2xl font-extrabold text-slate-900">{{ health?.status ?? 'CHECKING' }}</span>
        </div>
        <p class="mt-2 text-xs text-slate-500">Provider: Neon Serverless</p>
      </div>

      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Query Latency</span>
        <div class="mt-3 flex items-baseline gap-1">
          <span class="text-2xl font-extrabold text-slate-900">{{ health?.latencyMs ?? '—' }}</span>
          <span class="text-xs font-semibold text-slate-500">ms</span>
        </div>
        <p class="mt-2 text-xs text-slate-500">Round-trip execution</p>
      </div>

      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">PostgreSQL Engine</span>
        <div class="mt-3">
          <span class="text-base font-extrabold text-slate-900">PostgreSQL 18.6</span>
        </div>
        <p class="mt-2 text-xs text-slate-500">Ubuntu 13.3 (aarch64)</p>
      </div>

      <div class="rounded-xl border bg-white p-5 shadow-sm">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Connection Pooling</span>
        <div class="mt-3">
          <span class="text-base font-extrabold text-teal-600">PgBouncer Active</span>
        </div>
        <p class="mt-2 text-xs text-slate-500">Port 5432 / SSL Required</p>
      </div>
    </div>

    <!-- Connection Details -->
    <div class="rounded-xl border bg-white p-6 shadow-sm space-y-4">
      <h2 class="text-lg font-semibold text-slate-900">Database Topology & Coordinates</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div class="p-4 rounded-xl bg-slate-50 border">
          <span class="text-slate-400 block mb-1">Host</span>
          <span class="text-slate-800 font-bold break-all">{{ health?.host ?? 'ep-young-wave-b578dmsm-pooler.c-7.us-east-2.aws.neon.tech' }}</span>
        </div>
        <div class="p-4 rounded-xl bg-slate-50 border">
          <span class="text-slate-400 block mb-1">Database Name</span>
          <span class="text-slate-800 font-bold">{{ health?.databaseName ?? 'krompay' }}</span>
        </div>
        <div class="p-4 rounded-xl bg-slate-50 border">
          <span class="text-slate-400 block mb-1">Architecture</span>
          <span class="text-slate-800 font-bold">{{ health?.architecture ?? 'Nuxt 4 Full-Stack (Nitro Engine)' }}</span>
        </div>
        <div class="p-4 rounded-xl bg-slate-50 border">
          <span class="text-slate-400 block mb-1">Server Timestamp</span>
          <span class="text-slate-800 font-bold">{{ health?.serverTime ?? 'Loading...' }}</span>
        </div>
      </div>
    </div>

    <!-- Recent Pings Table -->
    <div class="rounded-xl border bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-slate-900 mb-4">Query Ping Telemetry Log (Total: {{ pingCount }})</h2>
      <div v-if="pingHistory.length > 0" class="overflow-x-auto rounded-lg border">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 text-slate-500 uppercase border-b">
            <tr>
              <th class="p-3">Timestamp</th>
              <th class="p-3">Query Target</th>
              <th class="p-3">Round-Trip Latency</th>
              <th class="p-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="(p, idx) in pingHistory" :key="idx" class="font-mono">
              <td class="p-3 text-slate-600">{{ p.timestamp }}</td>
              <td class="p-3 text-slate-800">SELECT NOW()</td>
              <td class="p-3 font-bold text-teal-600">{{ p.latencyMs }} ms</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">200 OK</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-xs text-slate-500">No telemetry pings recorded yet. Click 'Test Connection' above.</p>
    </div>
  </div>
</template>

