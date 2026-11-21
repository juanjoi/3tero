<script setup lang="ts">
// Two-step destructive button (replaces confirmation popups): the first tap arms it,
// the second tap within a few seconds confirms. Tapping elsewhere is harmless.
const props = withDefaults(defineProps<{
  label?: string
  confirmLabel?: string
  icon?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  block?: boolean
}>(), { icon: 'i-lucide-trash-2', confirmLabel: '¿Seguro? Toca otra vez', size: 'md' })
const emit = defineEmits<{ confirm: [] }>()

const armed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
function onClick() {
  if (armed.value) {
    armed.value = false
    clearTimeout(timer)
    emit('confirm')
    return
  }
  armed.value = true
  timer = setTimeout(() => (armed.value = false), 4000)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <UButton
    :icon="props.icon"
    :label="armed ? props.confirmLabel : props.label"
    :variant="armed ? 'solid' : 'ghost'"
    :color="armed ? 'error' : 'neutral'"
    :size="props.size"
    :block="props.block"
    :aria-label="props.label ?? 'Borrar'"
    class="transition-all"
    @click="onClick"
  />
</template>
