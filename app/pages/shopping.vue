<script setup lang="ts">
// Shopping list: hardware and missing filament for projects still to print.
// Ticked items are stored server side so the whole family sees the same list.
const onError = useApiError()
useHead({ title: 'Compras · 3tero' })

const onlyHigh = ref(false)
const query = computed(() => (onlyHigh.value ? { priority: 'high' } : {}))
const { data, pending } = await useFetch('/api/shopping', { query, key: 'shopping' })

const checked = ref<string[]>([])
watch(() => data.value?.checked, v => (checked.value = [...(v ?? [])]), { immediate: true })

async function toggle(key: string) {
  const next = checked.value.includes(key) ? checked.value.filter(k => k !== key) : [...checked.value, key]
  const previous = checked.value
  checked.value = next // optimistic
  try {
    await $fetch('/api/shopping/checked', { method: 'PUT', body: { keys: next } })
  }
  catch (err) {
    checked.value = previous
    onError(err)
  }
}

const total = computed(() => (data.value?.materials.length ?? 0) + (data.value?.filaments.length ?? 0))
const done = computed(() => [
  ...(data.value?.materials ?? []).map(m => `m:${m.id}`),
  ...(data.value?.filaments ?? []).map(f => `f:${f.id}`),
].filter(k => checked.value.includes(k)).length)
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <h1 class="font-display text-2xl font-bold">Compras</h1>
        <p class="text-sm text-muted">Lo que necesitan los proyectos pendientes de imprimir</p>
      </div>
      <span v-if="total" class="text-sm font-semibold text-toned">{{ done }}/{{ total }}</span>
    </div>

    <div class="flex gap-2">
      <UButton label="Todos" size="sm" :variant="onlyHigh ? 'outline' : 'soft'" :color="onlyHigh ? 'neutral' : 'primary'" @click="onlyHigh = false" />
      <UButton label="Solo prioridad alta" size="sm" :variant="onlyHigh ? 'soft' : 'outline'" :color="onlyHigh ? 'primary' : 'neutral'" @click="onlyHigh = true" />
    </div>

    <div v-if="data" class="flex flex-col gap-6" :class="pending ? 'opacity-60 transition-opacity' : ''">
      <section v-if="data.filaments.length" class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">Filamento que falta</h2>
        <button
          v-for="f in data.filaments"
          :key="f.id"
          type="button"
          class="flex items-center gap-3 rounded-2xl border border-default bg-default p-3 text-left transition-opacity"
          :class="checked.includes(`f:${f.id}`) ? 'opacity-50' : ''"
          :aria-pressed="checked.includes(`f:${f.id}`)"
          @click="toggle(`f:${f.id}`)"
        >
          <UIcon :name="checked.includes(`f:${f.id}`) ? 'i-lucide-square-check' : 'i-lucide-square'" class="size-5 shrink-0" :class="checked.includes(`f:${f.id}`) ? 'text-primary' : 'text-muted'" />
          <span class="size-7 shrink-0 rounded-full ring-1 ring-accented" :style="{ background: f.colorHex }" />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-semibold" :class="checked.includes(`f:${f.id}`) ? 'line-through' : ''">{{ f.type }} · {{ f.colorName }}</span>
            <span class="truncate text-xs text-muted">Faltan {{ f.missing }} g (necesitas {{ f.needed }} g, quedan {{ Math.round(f.stock) }} g) · {{ f.projects.map(p => p.title).join(', ') }}</span>
          </span>
        </button>
      </section>

      <section v-if="data.materials.length" class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">Materiales</h2>
        <div
          v-for="m in data.materials"
          :key="m.id"
          class="flex items-center gap-3 rounded-2xl border border-default bg-default p-3 transition-opacity"
          :class="checked.includes(`m:${m.id}`) ? 'opacity-50' : ''"
        >
          <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" :aria-pressed="checked.includes(`m:${m.id}`)" @click="toggle(`m:${m.id}`)">
            <UIcon :name="checked.includes(`m:${m.id}`) ? 'i-lucide-square-check' : 'i-lucide-square'" class="size-5 shrink-0" :class="checked.includes(`m:${m.id}`) ? 'text-primary' : 'text-muted'" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-semibold" :class="checked.includes(`m:${m.id}`) ? 'line-through' : ''">{{ m.name }} <span class="font-normal text-muted">×{{ m.quantity }}</span></span>
              <span class="truncate text-xs text-muted">{{ [m.category, m.spec].filter(Boolean).join(' · ') }}</span>
              <span class="flex flex-wrap gap-x-2 text-xs text-toned">
                <span v-for="p in m.projects" :key="p.id" class="inline-flex items-center gap-1"><PriorityDot :priority="p.priority" />{{ p.title }}</span>
              </span>
            </span>
          </button>
          <UButton v-if="m.url" :to="m.url" target="_blank" icon="i-lucide-external-link" variant="ghost" color="neutral" aria-label="Dónde comprarlo" />
        </div>
      </section>

      <UEmpty
        v-if="!total"
        icon="i-lucide-shopping-cart"
        title="No hace falta comprar nada"
        description="Aquí aparecen los materiales de los proyectos pendientes y el filamento cuyo stock no llega."
        size="sm"
      />
    </div>
  </div>
</template>
