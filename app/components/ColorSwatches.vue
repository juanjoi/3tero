<script setup lang="ts">
defineProps<{ colors: string[] }>()
</script>

<template>
  <div class="flex">
    <span
      v-for="c in colors"
      :key="c"
      class="-mr-1 size-3.5 rounded-full border-2 border-default shadow-[0_0_0_1px_var(--ui-border-accented)]"
      :style="{ background: c }"
    />
  </div>
</template>
