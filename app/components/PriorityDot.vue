<script setup lang="ts">
const props = defineProps<{ priority: Priority, label?: boolean }>()
const meta = computed(() => PRIORITY_META[props.priority])
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-xs" :title="`Prioridad ${meta.label.toLowerCase()}`">
    <span class="size-2.5 rounded-full ring-2 ring-default" :style="{ background: meta.color }" />
    <span v-if="label" class="font-medium">Prioridad {{ meta.label.toLowerCase() }}</span>
  </span>
</template>
