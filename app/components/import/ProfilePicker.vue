<script setup lang="ts">
// Radio list of the print profiles sliced for our printer (others are not imported).
const props = defineProps<{ profiles: ImportProfile[], printer: string }>()
const selected = defineModel<string | null>({ required: true })

const ordered = computed(() => props.profiles)
const showAll = ref(false)
const visible = computed(() => {
  if (showAll.value) return ordered.value
  const first = ordered.value.slice(0, 4)
  const sel = ordered.value.find(p => p.externalId === selected.value)
  return sel && !first.includes(sel) ? [...first, sel] : first
})

function facts(p: ImportProfile) {
  return [
    p.grams ? `${Math.round(p.grams)} g` : null,
    p.minutes ? formatMinutes(p.minutes) : null,
    p.plates ? `${p.plates} placa${p.plates > 1 ? 's' : ''}` : null,
    p.needAms ? 'AMS' : null,
  ].filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="flex flex-col gap-2" role="radiogroup" aria-label="Perfil de impresión">
    <TransitionGroup name="card" tag="div" class="relative flex flex-col gap-2">
      <button
        v-for="p in visible"
        :key="p.externalId"
        type="button"
        role="radio"
        :aria-checked="selected === p.externalId"
        class="flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors"
        :class="selected === p.externalId ? 'border-primary bg-primary/5' : 'border-default bg-default hover:bg-elevated/50'"
        @click="selected = p.externalId"
      >
        <span
          class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2"
          :class="selected === p.externalId ? 'border-primary' : 'border-accented'"
        >
          <span v-if="selected === p.externalId" class="size-2.5 rounded-full bg-primary" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-sm font-semibold leading-snug">{{ p.name }}</span>
          <span class="flex flex-wrap items-center gap-1.5">
            <UBadge :label="`Tu impresora · ${printer}`" size="sm" variant="soft" icon="i-lucide-check" />
          </span>
          <span class="text-xs text-muted">{{ facts(p) }}</span>
          <ColorSwatches v-if="p.filaments.length" :colors="p.filaments.map(f => f.colorHex)" />
        </span>
      </button>
    </TransitionGroup>
    <UButton
      v-if="ordered.length > visible.length || showAll"
      :label="showAll ? 'Ver menos' : `Ver todos los perfiles (${ordered.length})`"
      variant="link"
      color="neutral"
      class="self-start"
      @click="showAll = !showAll"
    />
  </div>
</template>
