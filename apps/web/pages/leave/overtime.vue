<script setup lang="ts">
definePageMeta({ middleware: "auth" });
const rows = await useApi()("/overtime").catch(() => []);
</script>
<template>
  <section>
    <h1 class="text-2xl font-semibold">Overtime</h1>
    <p v-for="r in rows" :key="r.id" class="mt-2 rounded bg-white p-3">{{ r.workDate }} · {{ r.hours }}h · {{ r.otType }} · {{ r.status }}</p>
  </section>
</template>
