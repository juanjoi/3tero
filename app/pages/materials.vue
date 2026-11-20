<script setup lang="ts">
const onError = useApiError()
const { data: filaments, refresh: refreshFilaments } = await useFetch('/api/filaments', { key: 'filaments' })
const { data: materials, refresh: refreshMaterials } = await useFetch('/api/materials', { key: 'materials' })

const filamentOpen = ref(false)
const editingFilament = ref<Filament | null>(null)
function openFilament(f: Filament | null = null) {
  editingFilament.value = f
  filamentOpen.value = true
}

const materialOpen = ref(false)
const editingMaterial = ref<Material | null>(null)
function openMaterial(m: Material | null = null) {
  editingMaterial.value = m
  materialOpen.value = true
}

const categories = computed(() => [...new Set((materials.value ?? []).map(m => m.category))])
const grouped = computed(() => categories.value.map(c => ({ category: c, items: (materials.value ?? []).filter(m => m.category === c) })))

async function removeFilament(f: Filament) {
  try {
    await $fetch(`/api/filaments/${f.id}`, { method: 'DELETE' })
    await refreshFilaments()
  }
  catch (err) { onError(err) }
}
async function removeMaterial(m: Material) {
  try {
    await $fetch(`/api/materials/${m.id}`, { method: 'DELETE' })
    await refreshMaterials()
  }
  catch (err) { onError(err) }
}
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-5">
    <h1 class="font-display text-2xl font-bold">Materiales</h1>

    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Filamentos</h2>
        <UButton icon="i-lucide-plus" label="Nuevo" size="sm" @click="openFilament()" />
      </div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div v-for="f in filaments" :key="f.id" class="flex items-center gap-3 rounded-2xl border border-default bg-default p-3">
          <span class="size-9 shrink-0 rounded-full ring-1 ring-accented" :style="{ background: f.colorHex }" />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-semibold">{{ f.type }} · {{ f.colorName }}</span>
            <span class="text-xs text-muted">{{ f.brand ?? 'Sin marca' }} · {{ formatEuro(f.pricePerKg) }}/kg</span>
          </div>
          <UDropdownMenu :items="[[{ label: 'Editar', icon: 'i-lucide-pencil', onSelect: () => openFilament(f) }, { label: 'Borrar', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => removeFilament(f) }]]">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" aria-label="Acciones" />
          </UDropdownMenu>
        </div>
      </div>
      <UEmpty v-if="!filaments?.length" icon="i-lucide-disc-3" title="Sin filamentos" description="Añade los filamentos que usas con su precio por kg para calcular el coste de cada impresión." size="sm" />
    </section>

    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Otros materiales</h2>
        <UButton icon="i-lucide-plus" label="Nuevo" size="sm" @click="openMaterial()" />
      </div>
      <div v-for="g in grouped" :key="g.category" class="flex flex-col gap-2">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ g.category }}</h3>
        <div v-for="m in g.items" :key="m.id" class="flex items-center gap-3 rounded-2xl border border-default bg-default p-3">
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-semibold">{{ m.name }}</span>
            <span v-if="m.spec" class="text-xs text-muted">{{ m.spec }}</span>
          </div>
          <UButton v-if="m.url" :to="m.url" target="_blank" icon="i-lucide-external-link" variant="ghost" color="neutral" aria-label="Enlace de compra" />
          <UDropdownMenu :items="[[{ label: 'Editar', icon: 'i-lucide-pencil', onSelect: () => openMaterial(m) }, { label: 'Borrar', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => removeMaterial(m) }]]">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" aria-label="Acciones" />
          </UDropdownMenu>
        </div>
      </div>
      <UEmpty v-if="!materials?.length" icon="i-lucide-magnet" title="Sin materiales" description="Imanes, tornillos, electrónica… para indicar qué necesita cada proyecto." size="sm" />
    </section>

    <FilamentModal v-if="filamentOpen" :key="editingFilament?.id ?? 'new-f'" v-model:open="filamentOpen" :filament="editingFilament" @saved="refreshFilaments()" />
    <MaterialModal v-if="materialOpen" :key="editingMaterial?.id ?? 'new-m'" v-model:open="materialOpen" :material="editingMaterial" :categories="categories" @saved="refreshMaterials()" />
  </div>
</template>
