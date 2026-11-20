<script setup lang="ts">
const props = defineProps<{ project: ProjectDetail }>()
const emit = defineEmits<{ update: [project: ProjectDetail] }>()
const onError = useApiError()

const { data: catalogue } = await useFetch('/api/materials', { key: 'materials' })
const reference = computed(() => props.project.files.find(f => f.final) ?? props.project.files[0])

const adding = ref<string | undefined>()
const items = computed(() => (catalogue.value ?? [])
  .filter(m => !props.project.materials.some(pm => pm.materialId === m.id))
  .map(m => ({ label: `${m.name}${m.spec ? ` · ${m.spec}` : ''}`, value: m.id, description: m.category })))

async function save(list: { materialId: string, quantity: number }[]) {
  try {
    emit('update', await $fetch(`/api/projects/${props.project.id}/materials`, { method: 'PUT', body: list }))
  }
  catch (err) { onError(err) }
}
const current = () => props.project.materials.map(m => ({ materialId: m.materialId, quantity: m.quantity }))

function add(id?: string) {
  if (!id) return
  save([...current(), { materialId: id, quantity: 1 }])
  adding.value = undefined
}
function setQty(id: string, quantity: number | null | undefined) {
  if (!quantity || quantity < 1) return
  save(current().map(m => (m.materialId === id ? { ...m, quantity } : m)))
}
function remove(id: string) {
  save(current().filter(m => m.materialId !== id))
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="flex flex-col gap-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
        Filamentos {{ reference ? `(${reference.label ?? reference.originalName})` : '' }}
      </h3>
      <div v-for="f in reference?.filaments ?? []" :key="`${f.filamentId}-${f.slot}`" class="flex items-center gap-3 text-sm">
        <span class="size-4.5 rounded-full ring-1 ring-accented" :style="{ background: f.colorHex }" />
        <span class="flex-1">{{ f.type }} · {{ f.colorName }}</span>
        <span class="text-muted">{{ Number(f.grams) }} g</span>
      </div>
      <p v-if="!reference?.filaments.length" class="text-sm text-muted">
        Se toman del fichero final. Edita un fichero en la pestaña «Ficheros» para indicar filamentos y gramos.
      </p>
    </section>

    <section class="flex flex-col gap-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
        Otros materiales
      </h3>
      <div v-for="m in project.materials" :key="m.materialId" class="flex items-center gap-2 text-sm">
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate">{{ m.name }}<span v-if="m.spec" class="text-muted"> · {{ m.spec }}</span></span>
          <span class="text-xs text-muted">{{ m.category }}</span>
        </div>
        <UInputNumber :model-value="m.quantity" :min="1" class="w-28" @update:model-value="setQty(m.materialId, $event)" />
        <UButton icon="i-lucide-x" variant="ghost" color="neutral" aria-label="Quitar" @click="remove(m.materialId)" />
      </div>
      <div class="flex gap-2">
        <USelectMenu
          v-model="adding"
          :items="items"
          value-key="value"
          placeholder="Añadir material del catálogo…"
          class="flex-1"
          @update:model-value="add"
        />
        <UButton to="/materials" icon="i-lucide-settings-2" variant="ghost" color="neutral" aria-label="Gestionar catálogo" />
      </div>
    </section>
  </div>
</template>
