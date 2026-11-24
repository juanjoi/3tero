<script setup lang="ts">
// Print queue: what to print next, in order, each with the file (configuration) to print.
// Reordering with arrows (touch friendly, no drag & drop); "Imprimir" opens the print log page
// pre-filled, and a successful print uses up a copy (ADR 0006: no popups).
useHead({ title: 'Cola de impresión · 3tero' })
const onError = useApiError()

const { data: queue } = await useFetch('/api/queue', { key: 'queue' })
const items = computed(() => queue.value?.items ?? [])
type Item = PrintQueueItem

const busy = ref<string | null>(null)
async function run(item: Item, request: () => Promise<PrintQueueData>) {
  busy.value = item.id
  try {
    queue.value = await request()
  }
  catch (err) { onError(err) }
  finally { busy.value = null }
}
const move = (item: Item, position: number) =>
  run(item, () => $fetch(`/api/queue/${item.id}/move`, { method: 'POST', body: { position } }))
const patch = (item: Item, body: { fileId?: string | null, copies?: number }) =>
  run(item, () => $fetch(`/api/queue/${item.id}`, { method: 'PATCH', body }))
const remove = (item: Item) =>
  run(item, () => $fetch(`/api/queue/${item.id}`, { method: 'DELETE' }))

// Form selects can't hold null: NO_FILE stands for "no file, use the imported profile"
const NO_FILE = 'none'
function fileItems(item: Item) {
  return [
    ...item.files.map(f => ({ label: f.sliced ? f.name : `${f.name} (sin laminar)`, value: f.id })),
    { label: 'Sin fichero (perfil importado)', value: NO_FILE },
  ]
}

function facts(item: Item) {
  const c = item.config
  if (c.kind === 'none') return ''
  return [
    c.kind === 'file' && c.plates ? `${c.plates} placa${c.plates > 1 ? 's' : ''}` : null,
    c.minutes ? formatMinutes(c.minutes) : null,
    c.grams ? `${Math.round(c.grams)} g` : null,
    c.cost ? formatEuro(c.cost) : null,
  ].filter(Boolean).join(' · ')
}

function printLink(item: Item) {
  return { path: `/projects/${item.project.id}/print`, query: { queue: item.id, ...(item.fileId ? { file: item.fileId } : {}) } }
}
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5">
    <div class="flex flex-col gap-1">
      <h1 class="font-display text-2xl font-bold">Cola de impresión</h1>
      <p v-if="items.length && queue" class="text-sm text-muted">
        {{ queue.totals.copies }} impresi{{ queue.totals.copies === 1 ? 'ón' : 'ones' }}
        <template v-if="queue.totals.minutes"> · {{ formatMinutes(queue.totals.minutes) }}</template>
        <template v-if="queue.totals.grams"> · {{ queue.totals.grams }} g</template>
        <template v-if="queue.totals.cost"> · {{ formatEuro(queue.totals.cost) }}</template>
        <template v-if="queue.totals.unknown"> (sin contar {{ queue.totals.unknown }} sin datos)</template>
      </p>
    </div>

    <div v-if="!items.length" class="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-default px-6 py-12 text-center">
      <UIcon name="i-lucide-list-ordered" class="size-10 text-muted" />
      <p class="font-semibold">La cola está vacía</p>
      <p class="max-w-sm text-sm text-muted">
        Añade lo que esté listo para imprimir con «Añadir a la cola» en la ficha de un proyecto,
        o seleccionando varios en Proyectos.
      </p>
      <UButton to="/" label="Ir a Proyectos" icon="i-lucide-box" variant="outline" color="neutral" />
    </div>

    <TransitionGroup v-else name="card" tag="ol" class="relative flex flex-col gap-3">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        class="flex flex-col gap-3 rounded-3xl border border-default bg-default p-3 shadow-xs transition-opacity"
        :class="busy === item.id ? 'opacity-60' : ''"
      >
        <div class="flex gap-3">
          <div class="flex flex-col items-center gap-1">
            <span
              class="flex size-7 items-center justify-center rounded-full text-sm font-bold"
              :class="index === 0 ? 'bg-primary text-inverted' : 'bg-elevated text-toned'"
              :aria-label="`Posición ${index + 1}`"
            >{{ index + 1 }}</span>
            <UButton
              icon="i-lucide-chevron-up" size="xs" variant="ghost" color="neutral" aria-label="Subir"
              :disabled="index === 0 || !!busy" @click="move(item, index - 1)"
            />
            <UButton
              icon="i-lucide-chevron-down" size="xs" variant="ghost" color="neutral" aria-label="Bajar"
              :disabled="index === items.length - 1 || !!busy" @click="move(item, index + 1)"
            />
          </div>

          <NuxtLink :to="`/projects/${item.project.id}`" class="size-20 shrink-0 overflow-hidden rounded-2xl">
            <img v-if="item.project.coverUrl" :src="item.project.coverUrl" :alt="item.project.title" class="size-full object-cover">
            <CoverPlaceholder v-else />
          </NuxtLink>

          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <NuxtLink :to="`/projects/${item.project.id}`" class="line-clamp-2 font-semibold leading-snug hover:underline">
              {{ item.project.title }}
            </NuxtLink>
            <span class="flex flex-wrap items-center gap-2 text-xs text-muted">
              <PriorityDot :priority="item.project.priority" />
              <StatusBadge :status="item.project.status" />
              <span v-if="item.project.archived">Archivado</span>
            </span>

            <!-- Configuration to print -->
            <template v-if="item.config.kind === 'file'">
              <span class="flex items-center gap-1.5 text-sm">
                <UIcon name="i-lucide-file-box" class="size-4 shrink-0 text-muted" />
                <span class="truncate">{{ item.config.name }}</span>
              </span>
            </template>
            <template v-else-if="item.config.kind === 'profile'">
              <span class="flex items-center gap-1.5 text-sm">
                <UIcon name="i-lucide-globe" class="size-4 shrink-0 text-muted" />
                <span class="truncate">Perfil de MakerWorld: {{ item.config.name }}</span>
              </span>
            </template>
            <span v-if="facts(item)" class="text-xs text-toned">{{ facts(item) }}</span>
            <ColorSwatches v-if="item.config.kind !== 'none' && item.config.filaments.length" :colors="item.config.filaments.map(f => f.colorHex)" />

            <p v-if="item.config.kind === 'none'" class="text-xs text-warning">
              Sin fichero ni perfil: sube el 3MF laminado en el proyecto.
            </p>
            <p v-else-if="item.config.kind === 'file' && !item.config.sliced" class="text-xs text-warning">
              Este fichero no está laminado: elige el 3MF laminado o lamínalo antes.
            </p>
            <p v-if="item.config.kind === 'file' && item.config.fitsPrinter === false" class="text-xs text-warning">
              No cabe en la impresora.
            </p>
          </div>
        </div>

        <USelect
          v-if="item.files.length"
          :model-value="item.fileId ?? NO_FILE"
          :items="fileItems(item)"
          size="sm"
          icon="i-lucide-file-box"
          class="w-full"
          aria-label="Fichero que se imprime"
          :disabled="!!busy"
          @update:model-value="(v: string) => patch(item, { fileId: v === NO_FILE ? null : v })"
        />

        <div class="flex flex-wrap items-center gap-2">
          <UButton :to="printLink(item)" icon="i-lucide-printer" label="Imprimir" size="sm" />
          <UButton
            v-if="item.config.kind === 'file'"
            :to="item.config.downloadUrl" external download
            icon="i-lucide-download" label="3MF" size="sm" variant="outline" color="neutral"
          />
          <UButton
            v-else-if="item.config.kind === 'profile'"
            :to="item.config.url" target="_blank"
            icon="i-lucide-external-link" label="MakerWorld" size="sm" variant="outline" color="neutral"
          />

          <div class="flex items-center rounded-full border border-default" role="group" aria-label="Copias">
            <UButton
              icon="i-lucide-minus" size="xs" variant="ghost" color="neutral" aria-label="Una copia menos"
              :disabled="item.copies <= 1 || !!busy" @click="patch(item, { copies: item.copies - 1 })"
            />
            <span class="min-w-14 text-center text-sm font-semibold">× {{ item.copies }}</span>
            <UButton
              icon="i-lucide-plus" size="xs" variant="ghost" color="neutral" aria-label="Una copia más"
              :disabled="item.copies >= 99 || !!busy" @click="patch(item, { copies: item.copies + 1 })"
            />
          </div>

          <UButton
            v-if="index > 0"
            icon="i-lucide-arrow-up-to-line" size="sm" variant="ghost" color="neutral" aria-label="Pasar a la primera"
            :disabled="!!busy" @click="move(item, 0)"
          />
          <ConfirmButton class="ml-auto" size="sm" icon="i-lucide-x" label="Quitar" confirm-label="¿Quitar?" @confirm="remove(item)" />
        </div>
      </li>
    </TransitionGroup>
  </div>
</template>
