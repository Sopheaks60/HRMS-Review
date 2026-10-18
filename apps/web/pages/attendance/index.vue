<script setup lang="ts">
definePageMeta({ middleware: "auth" });
const api = useApi();
const punching = ref(false);
async function punch(source: "WEB" | "GPS") {
  punching.value = true;
  try {
    const body: Record<string, unknown> = { type: "CLOCK_IN", source };
    if (source === "GPS" && navigator.geolocation) {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej),
      );
      body.latitude = pos.coords.latitude;
      body.longitude = pos.coords.longitude;
      body.accuracyM = pos.coords.accuracy;
    }
    await api("/attendance/punch", { method: "POST", body });
  } finally {
    punching.value = false;
  }
}
</script>
<template>
  <section>
    <h1 class="text-2xl font-semibold">{{ $t("nav.attendance") }}</h1>
    <div class="mt-4 flex gap-3">
      <button class="rounded bg-emerald-700 px-4 py-2 text-white" :disabled="punching" @click="punch('WEB')">Web clock-in</button>
      <button class="rounded border px-4 py-2" :disabled="punching" @click="punch('GPS')">GPS clock-in</button>
      <NuxtLink class="rounded border px-4 py-2" to="/attendance/face">Face selfie</NuxtLink>
    </div>
  </section>
</template>
