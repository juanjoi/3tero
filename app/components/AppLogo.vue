<script setup lang="ts">
// 3tero logo: the shelf symbol is the "3" of the name (docs/design/logo/README.md).
withDefaults(defineProps<{ tagline?: boolean }>(), { tagline: false })
</script>

<template>
  <div class="flex flex-col" role="img" aria-label="3tero">
    <div class="flex items-end font-display text-2xl font-bold leading-none tracking-tight" aria-hidden="true">
      <svg viewBox="10 4 84 90" class="mr-0.5 h-[1.85rem] w-auto shrink-0" style="margin-bottom: -1px">
        <path
          d="M18 30 H66 Q84 30 84 44 Q84 58 66 58 H40 M66 58 Q84 58 84 72 Q84 88 66 88 H18"
          fill="none"
          class="stroke-primary"
          stroke-width="8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <rect x="24" y="14.5" width="13" height="12" rx="2" class="fill-green-500 dark:fill-green-300" />
        <path
          d="M47 40.5 H53 A7 7 0 0 1 53 54.5 H47 Z M50.5 44 V51 H53 A3.5 3.5 0 0 0 53 44 Z"
          class="fill-orange-500 dark:fill-orange-400"
          fill-rule="evenodd"
        />
        <polygon points="30,84.5 44,84.5 37,70" class="fill-green-500 dark:fill-green-300" />
      </svg>
      <span>tero</span>
    </div>
    <span v-if="tagline" class="mt-1 text-[9px] font-semibold tracking-[0.32em] text-muted" aria-hidden="true">PROYECTOS 3D</span>
  </div>
</template>
