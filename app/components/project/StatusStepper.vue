<script setup lang="ts">
const props = defineProps<{ status: ProjectStatus, busy?: boolean }>()
const emit = defineEmits<{ change: [status: ProjectStatus] }>()
const index = computed(() => PROJECT_STATUSES.indexOf(props.status))
</script>

<template>
  <div class="flex flex-col gap-2.5 rounded-2xl bg-elevated/60 p-3.5">
    <div class="flex justify-between text-xs font-semibold text-muted">
      <span>Estado</span>
      <span>{{ index + 1 }} de {{ PROJECT_STATUSES.length }}</span>
    </div>
    <div class="grid grid-cols-3 gap-1.5">
      <button
        v-for="(s, i) in PROJECT_STATUSES"
        :key="s"
        type="button"
        class="group flex flex-col gap-2 text-left disabled:cursor-wait"
        :disabled="busy"
        :aria-pressed="s === status"
        @click="s !== status && emit('change', s)"
      >
        <span class="h-1.5 overflow-hidden rounded-full bg-accented">
          <span
            class="block h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out"
            :style="{ transform: `scaleX(${i <= index ? 1 : 0})` }"
          />
        </span>
        <span
          class="text-sm transition-colors"
          :class="s === status ? 'font-bold text-primary' : 'text-muted group-hover:text-default'"
        >{{ STATUS_META[s].label }}</span>
      </button>
    </div>
  </div>
</template>
