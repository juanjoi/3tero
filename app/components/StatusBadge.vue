<script setup lang="ts">
const props = defineProps<{ status: ProjectStatus }>()
const meta = computed(() => STATUS_META[props.status])
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-0.5 text-xs font-semibold"
    :style="{ color: meta.color }"
  >
    {{ meta.label }}
  </span>
</template>
