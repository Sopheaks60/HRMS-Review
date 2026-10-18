<script setup lang="ts">
defineProps<{ variant?: "primary" | "ghost" }>();
</script>
<template>
  <button
    class="rounded-md px-3 py-2 text-sm"
    :class="variant === 'ghost' ? 'border' : 'bg-emerald-700 text-white'"
  >
    <slot />
  </button>
</template>
