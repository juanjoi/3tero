<script setup lang="ts">
const onError = useApiError()
const { data: filaments, refresh: refreshFilaments } = await useFetch('/api/filaments', { key: 'filaments' })
const { data: materials, refresh: refreshMaterials } = await useFetch('/api/materials', { key: 'materials' })

// Inline editing: 'new', an item id, or null (no popups)
const editingFilament = ref<string | null>(null)
const editingMaterial = ref<string | null>(null)

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
async function addSpool(f: Filament) {
  try {
    await $fetch(`/api/filaments/${f.id}`, { method: 'PATCH', body: { stockGrams: Number(f.stockGrams ?? 0) + 1000 } })
    await refreshFilaments()
  }
  catch (err) { onError(err) }
}
const LOW_STOCK_G = 150

async function filamentSaved() {
  editingFilament.value = null
  await refreshFilaments()
}
async function materialSaved() {
  editingMaterial.value = null
  await refreshMaterials()
}
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-5">
    <h1 class="font-display text-2xl font-bold">Materiales</h1>

    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Filamentos</h2>
        <UButton v-if="editingFilament !== 'new'" icon="i-lucide-plus" label="Nuevo" size="sm" @click="editingFilament = 'new'" />
      </div>
      <Transition name="expand">
        <FilamentForm v-if="editingFilament === 'new'" @saved="filamentSaved" @cancel="editingFilament = null" />
      </Transition>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <template v-for="f in filaments" :key="f.id">
          <FilamentForm v-if="editingFilament === f.id" :filament="f" class="sm:col-span-2" @saved="filamentSaved" @cancel="editingFilament = null" />
          <div v-else class="flex items-center gap-3 rounded-2xl border border-default bg-default p-3">
            <span class="size-9 shrink-0 rounded-full ring-1 ring-accented" :style="{ background: f.colorHex }" />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-semibold">{{ f.type }} · {{ f.colorName }}</span>
              <span class="text-xs text-muted">{{ f.brand ?? 'Sin marca' }} · {{ formatEuro(f.pricePerKg) }}/kg</span>
              <div v-if="f.stockGrams !== null" class="mt-1 flex items-center gap-2">
                <div class="h-1.5 w-20 overflow-hidden rounded-full bg-elevated">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="Number(f.stockGrams) < LOW_STOCK_G ? 'bg-warning' : 'bg-primary'"
                    :style="{ width: `${Math.min(100, Number(f.stockGrams) / 10)}%` }"
                  />
                </div>
                <span class="text-xs" :class="Number(f.stockGrams) < LOW_STOCK_G ? 'font-semibold text-warning' : 'text-toned'">{{ Math.round(Number(f.stockGrams)) }} g</span>
              </div>
            </div>
            <UButton icon="i-lucide-package-plus" variant="ghost" color="neutral" aria-label="Añadir una bobina de 1 kg" title="+1 bobina (1 kg)" @click="addSpool(f)" />
            <UButton icon="i-lucide-pencil" variant="ghost" color="neutral" aria-label="Editar" @click="editingFilament = f.id" />
            <ConfirmButton confirm-label="¿Borrar?" @confirm="removeFilament(f)" />
          </div>
        </template>
      </div>
      <UEmpty v-if="!filaments?.length && editingFilament !== 'new'" icon="i-lucide-disc-3" title="Sin filamentos" description="Añade los filamentos que usas con su precio por kg para calcular el coste de cada impresión." size="sm" />
    </section>

    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Otros materiales</h2>
        <UButton v-if="editingMaterial !== 'new'" icon="i-lucide-plus" label="Nuevo" size="sm" @click="editingMaterial = 'new'" />
      </div>
      <Transition name="expand">
        <MaterialForm v-if="editingMaterial === 'new'" :categories="categories" @saved="materialSaved" @cancel="editingMaterial = null" />
      </Transition>
      <div v-for="g in grouped" :key="g.category" class="flex flex-col gap-2">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ g.category }}</h3>
        <template v-for="m in g.items" :key="m.id">
          <MaterialForm v-if="editingMaterial === m.id" :material="m" :categories="categories" @saved="materialSaved" @cancel="editingMaterial = null" />
          <div v-else class="flex items-center gap-3 rounded-2xl border border-default bg-default p-3">
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-semibold">{{ m.name }}</span>
              <span v-if="m.spec" class="text-xs text-muted">{{ m.spec }}</span>
            </div>
            <UButton v-if="m.url" :to="m.url" target="_blank" icon="i-lucide-external-link" variant="ghost" color="neutral" aria-label="Enlace de compra" />
            <UButton icon="i-lucide-pencil" variant="ghost" color="neutral" aria-label="Editar" @click="editingMaterial = m.id" />
            <ConfirmButton confirm-label="¿Borrar?" @confirm="removeMaterial(m)" />
          </div>
        </template>
      </div>
      <UEmpty v-if="!materials?.length && editingMaterial !== 'new'" icon="i-lucide-magnet" title="Sin materiales" description="Imanes, tornillos, electrónica… para indicar qué necesita cada proyecto." size="sm" />
    </section>
  </div>
</template>
