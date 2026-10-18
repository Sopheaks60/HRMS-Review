<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const api = useApi();
const video = ref<HTMLVideoElement | null>(null);
const cameraReady = ref(false);
const busy = ref(false);
const error = ref("");
const success = ref("");
const nextType = ref<"CLOCK_IN" | "CLOCK_OUT">("CLOCK_IN");
let stream: MediaStream | null = null;

async function loadNextType() {
  const state = await api<{ type: "CLOCK_IN" | "CLOCK_OUT" }>("/attendance/me/next");
  nextType.value = state.type;
}

onMounted(async () => {
  try {
    await loadNextType();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    });
    if (video.value) {
      video.value.srcObject = stream;
      await video.value.play();
      cameraReady.value = true;
    }
  } catch (cause: any) {
    error.value = cause?.data?.message ?? "Camera access is unavailable. Allow camera access and use a secure connection.";
  }
});

onUnmounted(() => stream?.getTracks().forEach((track) => track.stop()));

async function captureAndPunch() {
  if (!video.value || !cameraReady.value || busy.value) return;
  busy.value = true;
  error.value = "";
  success.value = "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.value.videoWidth;
    canvas.height = video.value.videoHeight;
    const context = canvas.getContext("2d");
    if (!context || canvas.width === 0 || canvas.height === 0) throw new Error("Camera image is not ready. Try again.");
    context.drawImage(video.value, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.82);
    const proof = await api<{ id: string }>("/attendance/face/verify", { method: "POST", body: { imageDataUrl } });
    await api("/attendance/punch", { method: "POST", body: { type: nextType.value, source: "FACE", selfieId: proof.id } });
    success.value = nextType.value === "CLOCK_IN" ? "Face verified. You are clocked in." : "Face verified. You are clocked out.";
    await loadNextType();
  } catch (cause: any) {
    error.value = cause?.data?.message ?? cause?.message ?? "Face verification or attendance punch failed.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="mx-auto max-w-2xl space-y-5">
    <header><h1 class="text-2xl font-semibold">Face selfie attendance</h1><p class="mt-1 text-sm text-slate-600">The server verifies face match and liveness before recording a punch.</p></header>
    <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>
    <p v-if="success" role="status" class="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{{ success }}</p>
    <div class="overflow-hidden rounded-xl bg-black"><video ref="video" autoplay muted playsinline class="aspect-video w-full object-cover" /></div>
    <div class="flex items-center justify-between gap-4"><p class="text-sm text-slate-600">Next action: <strong>{{ nextType === "CLOCK_IN" ? "Clock in" : "Clock out" }}</strong></p><button class="rounded bg-slate-900 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" :disabled="busy || !cameraReady" @click="captureAndPunch">{{ busy ? "Verifying…" : nextType === "CLOCK_IN" ? "Verify & clock in" : "Verify & clock out" }}</button></div>
    <p class="text-xs text-slate-500">A selfie is sent securely to the configured face-verification service and stored for attendance audit. If no verification service is configured, face attendance remains unavailable.</p>
  </section>
</template>
