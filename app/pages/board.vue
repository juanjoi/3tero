<script setup lang="ts">
const onError = useApiError()
const { data: projects, refresh } = await useFetch('/api/projects', { key: 'board' })

const columns = computed(() => PROJECT_STATUSES.map(s => ({
  status: s,
  ...STATUS_META[s],
  items: (projects.value ?? []).filter(p => p.status === s),
})))

const dragging = ref<string | null>(null)
const over = ref<ProjectStatus | null>(null)

async function move(id: string, status: ProjectStatus) {
  const item = projects.value?.find(p => p.id === id)
  if (!item || item.status === status) return
  const previous = item.status
  item.status = status // optimistic
  try {
    await $fetch(`/api/projects/${id}/status`, { method: 'POST', body: { status } })
  }
  catch (err) {
    item.status = previous
    onError(err, 'No se pudo cambiar el estado')
    await refresh()
  }
}

function onDrop(status: ProjectStatus) {
  if (dragging.value) move(dragging.value, status)
  dragging.value = null
  over.value = null
}

// Touch-friendly move: arrows to the previous / next status (drag & drop stays for mouse)
function shift(p: ProjectListItem, delta: -1 | 1) {
  const next = PROJECT_STATUSES[PROJECT_STATUSES.indexOf(p.status) + delta]
  if (next) move(p.id, next)
}
</script>

<template>
  <div class="flex flex-col gap-4 px-4 py-5">
    <h1 class="font-display text-2xl font-bold">Tablero</h1>

    <div class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:grid md:grid-cols-3 md:overflow-visible">
      <section
        v-for="col in columns"
        :key="col.status"
        class="flex w-[85vw] max-w-sm shrink-0 snap-center flex-col gap-2.5 rounded-3xl bg-elevated/70 p-3.5 transition md:w-auto md:max-w-none"
        :class="over === col.status ? 'ring-2 ring-primary' : ''"
        @dragover.prevent="over = col.status"
        @dragleave="over = over === col.status ? null : over"
        @drop.prevent="onDrop(col.status)"
      >
        <div class="flex items-center gap-2 px-1 pb-1">
          <span class="size-2.5 rounded-full" :style="{ background: col.color }" />
          <h2 class="flex-1 text-sm font-bold">{{ col.label }}</h2>
          <span class="rounded-full bg-default px-2 py-0.5 text-xs font-semibold text-muted">{{ col.items.length }}</span>
        </div>

        <TransitionGroup name="card" tag="div" class="relative flex flex-col gap-2.5">
          <div
            v-for="p in col.items"
            :key="p.id"
            draggable="true"
            class="group flex cursor-grab gap-3 rounded-2xl border border-default bg-default p-2.5 shadow-xs active:cursor-grabbing"
            :class="dragging === p.id ? 'opacity-50' : ''"
            @dragstart="dragging = p.id"
            @dragend="dragging = null; over = null"
          >
            <NuxtLink :to="`/projects/${p.id}`" class="size-16 shrink-0 overflow-hidden rounded-xl">
              <img v-if="p.coverUrl" :src="p.coverUrl" :alt="p.title" class="size-full object-cover" draggable="false">
              <CoverPlaceholder v-else />
            </NuxtLink>
            <NuxtLink :to="`/projects/${p.id}`" class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="line-clamp-2 text-sm font-semibold leading-snug">{{ p.title }}</span>
              <span v-if="p.tags.length" class="truncate text-xs text-muted">{{ p.tags.map(t => t.name).join(' · ') }}</span>
              <span class="flex items-center gap-2 text-xs text-toned">
                <PriorityDot :priority="p.priority" />
                {{ p.estCost !== null ? formatEuro(p.estCost) : `${p.fileCount} fichero${p.fileCount === 1 ? '' : 's'}` }}
              </span>
            </NuxtLink>
            <div class="flex flex-col justify-between">
              <UButton
                v-if="p.status !== PROJECT_STATUSES[PROJECT_STATUSES.length - 1]"
                icon="i-lucide-chevron-right"
                size="xs"
                variant="ghost"
                color="neutral"
                :aria-label="`Mover a ${STATUS_META[PROJECT_STATUSES[PROJECT_STATUSES.indexOf(p.status) + 1]!].label}`"
                @click="shift(p, 1)"
              />
              <UButton
                v-if="p.status !== PROJECT_STATUSES[0]"
                icon="i-lucide-chevron-left"
                size="xs"
                variant="ghost"
                color="neutral"
                :aria-label="`Mover a ${STATUS_META[PROJECT_STATUSES[PROJECT_STATUSES.indexOf(p.status) - 1]!].label}`"
                class="mt-auto"
                @click="shift(p, -1)"
              />
            </div>
          </div>
        </TransitionGroup>

        <div
          v-if="dragging && over === col.status"
          class="flex h-14 items-center justify-center rounded-2xl border-2 border-dashed border-primary text-sm font-semibold text-primary"
        >
          Soltar aquí → {{ col.label }}
        </div>
        <p v-if="!col.items.length && !dragging" class="px-1 py-6 text-center text-sm text-muted">Vacío</p>
      </section>
    </div>
  </div>
</template>
