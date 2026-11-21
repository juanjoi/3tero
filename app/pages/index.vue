<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { NuxtLink } from '#components'

const NuxtLinkComp = NuxtLink

const route = useRoute()
const router = useRouter()

// Filter state lives in the URL (bookmarkable, back-button friendly)
const q = ref(String(route.query.q ?? ''))
const qDebounced = refDebounced(q, 250)
const status = computed({
  get: () => (route.query.status as ProjectStatus | undefined) ?? 'all',
  set: v => setQuery({ status: v === 'all' ? undefined : v }),
})
const selectedTags = computed<string[]>({
  get: () => String(route.query.tags ?? '').split(',').filter(Boolean),
  set: v => setQuery({ tags: v.length ? v.join(',') : undefined }),
})
const sort = computed({
  get: () => (route.query.sort as ProjectSort | undefined) ?? 'priority',
  set: v => setQuery({ sort: v === 'priority' ? undefined : v }),
})
watch(qDebounced, v => setQuery({ q: v || undefined }))

function setQuery(patch: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...patch } })
}

const priorityFilter = computed({
  get: () => (route.query.priority as Priority | undefined) ?? null,
  set: v => setQuery({ priority: v ?? undefined }),
})
const sourceFilter = computed({
  get: () => (route.query.source as 'makerworld' | undefined) ?? null,
  set: v => setQuery({ source: v ?? undefined }),
})
const view = computed({
  get: () => (route.query.view === 'list' ? 'list' : 'grid'),
  set: v => setQuery({ view: v === 'list' ? 'list' : undefined }),
})

const apiQuery = computed(() => ({
  q: route.query.q || undefined,
  tags: route.query.tags || undefined,
  sort: route.query.sort || undefined,
  priority: route.query.priority || undefined,
  source: route.query.source || undefined,
}))
const { data: projects, status: loadStatus, refresh } = await useFetch('/api/projects', { query: apiQuery })
const { data: allTags } = await useFetch<TagWithCount[]>('/api/tags')

const counts = computed(() => {
  const list = projects.value ?? []
  return {
    all: list.length,
    ...Object.fromEntries(PROJECT_STATUSES.map(s => [s, list.filter(p => p.status === s).length])),
  } as Record<'all' | ProjectStatus, number>
})
const visible = computed(() => (projects.value ?? []).filter(p => status.value === 'all' || p.status === status.value))

const statusChips = [{ id: 'all', label: 'Todos' }, ...PROJECT_STATUSES.map(s => ({ id: s, label: STATUS_META[s].label }))] as const
const sortItems = [
  { label: 'Prioridad', value: 'priority' },
  { label: 'Actualizados', value: 'updated' },
  { label: 'Recientes', value: 'created' },
  { label: 'Título', value: 'title' },
  { label: 'Coste', value: 'cost' },
]
const tagItems = computed(() => (allTags.value ?? []).filter(t => t.count > 0).map(t => t.name))
function toggleTag(name: string) {
  selectedTags.value = selectedTags.value.includes(name) ? selectedTags.value.filter(t => t !== name) : [...selectedTags.value, name]
}

// Saved filters ("smart collections"), shared by the family
const onError = useApiError()
const { data: savedFilters } = await useFetch('/api/settings/saved-filters', { key: 'saved-filters', default: () => [] as SavedFilter[] })
const currentQuery = computed<SavedFilter['query']>(() => {
  const out: Record<string, string> = {}
  for (const k of ['q', 'status', 'tags', 'sort', 'priority', 'source'] as const) if (route.query[k]) out[k] = String(route.query[k])
  return out as SavedFilter['query']
})
const sameQuery = (a: SavedFilter['query'], b: SavedFilter['query']) =>
  (['q', 'status', 'tags', 'sort', 'priority', 'source'] as const).every(k => (a[k] ?? '') === (b[k] ?? ''))
const activeSaved = computed(() => savedFilters.value.find(f => sameQuery(f.query, currentQuery.value)) ?? null)
const hasFilters = computed(() => Object.keys(currentQuery.value).length > 0)

function applySaved(f: SavedFilter) {
  if (activeSaved.value?.id === f.id) {
    q.value = ''
    router.replace({ query: {} })
    return
  }
  q.value = f.query.q ?? ''
  router.replace({ query: { ...f.query } })
}
const naming = ref(false)
const newName = ref('')
async function persist(next: SavedFilter[]) {
  try {
    savedFilters.value = await $fetch('/api/settings/saved-filters', { method: 'PUT', body: next })
  }
  catch (err) { onError(err, 'No se pudo guardar el filtro') }
}
async function saveCurrent() {
  if (!newName.value.trim()) return
  await persist([...savedFilters.value, { id: Date.now().toString(36), name: newName.value.trim(), query: currentQuery.value }])
  naming.value = false
  newName.value = ''
}
const removeSaved = (f: SavedFilter) => persist(savedFilters.value.filter(x => x.id !== f.id))

// Bulk actions: selection mode with an inline action bar (no popups)
const selecting = ref(false)
const selected = ref<string[]>([])
const bulkTag = ref('')
const bulkBusy = ref(false)
function toggleSelect(id: string) {
  selected.value = selected.value.includes(id) ? selected.value.filter(x => x !== id) : [...selected.value, id]
}
function stopSelecting() {
  selecting.value = false
  selected.value = []
}
async function bulk(action: { status?: ProjectStatus, priority?: Priority, addTags?: string[], archive?: boolean }) {
  if (!selected.value.length) return
  bulkBusy.value = true
  try {
    const { updated } = await $fetch('/api/bulk/projects', { method: 'POST', body: { ids: selected.value, ...action } })
    toast.add({ title: `${updated} proyecto${updated === 1 ? '' : 's'} actualizado${updated === 1 ? '' : 's'}`, icon: 'i-lucide-check' })
    bulkTag.value = ''
    if (action.archive) stopSelecting()
    await refresh()
  }
  catch (err) { onError(err) }
  finally { bulkBusy.value = false }
}
const toast = useToast()
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
    <header class="flex items-center justify-between md:hidden">
      <AppLogo />
    </header>

    <div class="flex flex-col gap-3 md:flex-row md:items-center">
      <UInput v-model="q" icon="i-lucide-search" size="xl" placeholder="Buscar proyectos, etiquetas…" class="w-full" :loading="loadStatus === 'pending'" />
      <div class="flex gap-2">
        <USelect v-model="sort" :items="sortItems" icon="i-lucide-arrow-down-wide-narrow" size="xl" class="w-40" />
        <UButton
          :icon="view === 'list' ? 'i-lucide-layout-grid' : 'i-lucide-list'"
          size="xl"
          variant="outline"
          color="neutral"
          :aria-label="view === 'list' ? 'Ver como tarjetas' : 'Ver como lista'"
          @click="view = view === 'list' ? 'grid' : 'list'"
        />
        <UButton
          icon="i-lucide-list-checks"
          size="xl"
          :variant="selecting ? 'soft' : 'outline'"
          :color="selecting ? 'primary' : 'neutral'"
          :aria-label="selecting ? 'Terminar selección' : 'Seleccionar varios'"
          @click="selecting ? stopSelecting() : (selecting = true)"
        />
      </div>
    </div>

    <div class="-mx-4 flex gap-2 overflow-x-auto px-4">
      <UButton
        v-for="c in statusChips"
        :key="c.id"
        :variant="status === c.id ? 'solid' : 'outline'"
        color="neutral"
        class="shrink-0 rounded-full"
        @click="status = c.id"
      >
        {{ c.label }} <span class="opacity-60">{{ counts[c.id] ?? 0 }}</span>
      </UButton>
      <span class="mx-1 w-px shrink-0 self-stretch bg-accented" />
      <UButton
        v-for="pr in PRIORITIES.slice().reverse()"
        :key="pr"
        :variant="priorityFilter === pr ? 'soft' : 'ghost'"
        :color="priorityFilter === pr ? 'primary' : 'neutral'"
        class="shrink-0 rounded-full"
        @click="priorityFilter = priorityFilter === pr ? null : pr"
      >
        <span class="size-2 rounded-full" :style="{ background: PRIORITY_META[pr].color }" /> {{ PRIORITY_META[pr].label }}
      </UButton>
      <UButton
        label="MakerWorld"
        icon="i-lucide-globe"
        :variant="sourceFilter ? 'soft' : 'ghost'"
        :color="sourceFilter ? 'primary' : 'neutral'"
        class="shrink-0 rounded-full"
        @click="sourceFilter = sourceFilter ? null : 'makerworld'"
      />
    </div>

    <!-- Tags as inline toggle chips (no popups) -->
    <div v-if="tagItems.length" class="-mx-4 flex gap-1.5 overflow-x-auto px-4">
      <UButton
        v-for="t in tagItems"
        :key="t"
        :label="`#${t}`"
        size="xs"
        :variant="selectedTags.includes(t) ? 'soft' : 'ghost'"
        :color="selectedTags.includes(t) ? 'primary' : 'neutral'"
        class="shrink-0 rounded-full"
        @click="toggleTag(t)"
      />
    </div>

    <!-- Saved filters -->
    <div v-if="savedFilters.length || hasFilters" class="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4">
      <template v-for="f in savedFilters" :key="f.id">
        <UButton
          :label="f.name"
          icon="i-lucide-bookmark"
          size="sm"
          :variant="activeSaved?.id === f.id ? 'solid' : 'soft'"
          :color="activeSaved?.id === f.id ? 'primary' : 'neutral'"
          class="shrink-0 rounded-full"
          @click="applySaved(f)"
        />
        <ConfirmButton v-if="activeSaved?.id === f.id" size="xs" icon="i-lucide-x" confirm-label="¿Quitar?" class="shrink-0" @confirm="removeSaved(f)" />
      </template>
      <template v-if="hasFilters && !activeSaved">
        <form v-if="naming" class="flex shrink-0 items-center gap-1" @submit.prevent="saveCurrent">
          <UInput v-model="newName" size="sm" placeholder="Nombre del filtro" autofocus class="w-40" />
          <UButton type="submit" size="sm" icon="i-lucide-check" aria-label="Guardar" :disabled="!newName.trim()" />
          <UButton size="sm" icon="i-lucide-x" variant="ghost" color="neutral" aria-label="Cancelar" @click="naming = false" />
        </form>
        <UButton v-else label="Guardar filtro" icon="i-lucide-bookmark-plus" size="sm" variant="ghost" color="neutral" class="shrink-0" @click="naming = true" />
      </template>
    </div>

    <TransitionGroup v-if="visible.length && view === 'grid'" name="card" tag="div" class="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="p in visible" :key="p.id" class="relative h-full">
        <ProjectCard :project="p" class="h-full" />
        <button
          v-if="selecting"
          type="button"
          class="absolute inset-0 rounded-2xl ring-2 transition"
          :class="selected.includes(p.id) ? 'bg-primary/15 ring-primary' : 'ring-transparent'"
          :aria-pressed="selected.includes(p.id)"
          :aria-label="`Seleccionar ${p.title}`"
          @click="toggleSelect(p.id)"
        >
          <UIcon :name="selected.includes(p.id) ? 'i-lucide-square-check' : 'i-lucide-square'" class="absolute bottom-3 right-3 size-6 rounded bg-default text-primary" />
        </button>
      </div>
    </TransitionGroup>

    <!-- Compact list view -->
    <TransitionGroup v-else-if="visible.length" name="card" tag="div" class="relative flex flex-col divide-y divide-default rounded-2xl border border-default bg-default">
      <component
        :is="selecting ? 'button' : NuxtLinkComp"
        v-for="p in visible"
        :key="p.id"
        v-bind="selecting ? { type: 'button', 'aria-pressed': selected.includes(p.id) } : { to: `/projects/${p.id}` }"
        class="flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-elevated/50"
        :class="selecting && selected.includes(p.id) ? 'bg-primary/10' : ''"
        @click="selecting && toggleSelect(p.id)"
      >
        <UIcon v-if="selecting" :name="selected.includes(p.id) ? 'i-lucide-square-check' : 'i-lucide-square'" class="size-5 shrink-0 text-primary" />
        <span class="size-11 shrink-0 overflow-hidden rounded-lg">
          <img v-if="p.coverUrl" :src="p.coverUrl" alt="" loading="lazy" class="size-full object-cover">
          <CoverPlaceholder v-else />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-sm font-semibold">{{ p.title }}</span>
          <span class="truncate text-xs text-muted">{{ STATUS_META[p.status].label }}<template v-if="p.tags.length"> · {{ p.tags.map(t => t.name).join(' · ') }}</template></span>
        </span>
        <ColorSwatches :colors="p.colors" class="hidden sm:flex" />
        <PriorityDot :priority="p.priority" />
        <span class="w-14 shrink-0 text-right text-xs font-semibold">{{ formatEuro(p.estCost) }}</span>
      </component>
    </TransitionGroup>

    <!-- Bulk action bar -->
    <Transition name="expand">
      <div v-if="selecting" class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 rounded-2xl border border-default bg-default/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="font-semibold">{{ selected.length }} seleccionado{{ selected.length === 1 ? '' : 's' }}</span>
          <div class="flex gap-1">
            <UButton label="Todos" size="xs" variant="ghost" color="neutral" @click="selected = visible.map(p => p.id)" />
            <UButton label="Ninguno" size="xs" variant="ghost" color="neutral" @click="selected = []" />
            <UButton icon="i-lucide-x" size="xs" variant="ghost" color="neutral" aria-label="Terminar selección" @click="stopSelecting" />
          </div>
        </div>
        <div v-if="selected.length" class="flex flex-wrap items-center gap-1.5">
          <UButton v-for="st in PROJECT_STATUSES" :key="st" :label="STATUS_META[st].label" :icon="STATUS_META[st].icon" size="xs" variant="outline" color="neutral" :disabled="bulkBusy" @click="bulk({ status: st })" />
          <span class="mx-0.5 h-5 w-px bg-accented" />
          <UButton v-for="pr in PRIORITIES.slice().reverse()" :key="pr" size="xs" variant="outline" color="neutral" :disabled="bulkBusy" @click="bulk({ priority: pr })">
            <span class="size-2 rounded-full" :style="{ background: PRIORITY_META[pr].color }" /> {{ PRIORITY_META[pr].label }}
          </UButton>
          <span class="mx-0.5 h-5 w-px bg-accented" />
          <form class="flex items-center gap-1" @submit.prevent="bulkTag.trim() && bulk({ addTags: [bulkTag.trim()] })">
            <UInput v-model="bulkTag" size="xs" icon="i-lucide-tag" placeholder="Añadir etiqueta" class="w-36" />
            <UButton type="submit" size="xs" icon="i-lucide-plus" aria-label="Añadir etiqueta" :disabled="!bulkTag.trim() || bulkBusy" />
          </form>
          <ConfirmButton size="xs" icon="i-lucide-archive" label="Archivar" confirm-label="¿Archivar?" class="ml-auto" @confirm="bulk({ archive: true })" />
        </div>
      </div>
    </Transition>

    <UEmpty
      v-if="!visible.length && loadStatus !== 'pending'"
      icon="i-lucide-box"
      :title="route.query.q || route.query.tags || route.query.priority || route.query.source || status !== 'all' ? 'Nada coincide con los filtros' : 'Todavía no hay proyectos'"
      description="Crea un proyecto o comparte un enlace de MakerWorld con Layra."
      :actions="[{ label: 'Nuevo proyecto', icon: 'i-lucide-plus', to: '/projects/new' }, { label: 'Importar desde URL', icon: 'i-lucide-link', to: '/import', variant: 'outline' }]"
      class="mt-10"
    />

    <UButton
      v-if="!selecting"
      to="/projects/new"
      icon="i-lucide-plus"
      size="xl"
      aria-label="Nuevo proyecto"
      class="fixed bottom-24 right-5 size-14 justify-center rounded-2xl shadow-lg md:bottom-8 md:right-8"
    />
  </div>
</template>
