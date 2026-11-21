<script setup lang="ts">
import { refDebounced } from '@vueuse/core'

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

const apiQuery = computed(() => ({
  q: route.query.q || undefined,
  tags: route.query.tags || undefined,
  sort: route.query.sort || undefined,
}))
const { data: projects, status: loadStatus } = await useFetch('/api/projects', { query: apiQuery })
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
  for (const k of ['q', 'status', 'tags', 'sort'] as const) if (route.query[k]) out[k] = String(route.query[k])
  return out as SavedFilter['query']
})
const sameQuery = (a: SavedFilter['query'], b: SavedFilter['query']) =>
  (['q', 'status', 'tags', 'sort'] as const).every(k => (a[k] ?? '') === (b[k] ?? ''))
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

    <TransitionGroup v-if="visible.length" name="card" tag="div" class="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <ProjectCard v-for="p in visible" :key="p.id" :project="p" class="h-full" />
    </TransitionGroup>

    <UEmpty
      v-else-if="loadStatus !== 'pending'"
      icon="i-lucide-box"
      :title="route.query.q || route.query.tags || status !== 'all' ? 'Nada coincide con los filtros' : 'Todavía no hay proyectos'"
      description="Crea un proyecto o comparte un enlace de MakerWorld con Layra."
      :actions="[{ label: 'Nuevo proyecto', icon: 'i-lucide-plus', to: '/projects/new' }, { label: 'Importar desde URL', icon: 'i-lucide-link', to: '/import', variant: 'outline' }]"
      class="mt-10"
    />

    <UButton
      to="/projects/new"
      icon="i-lucide-plus"
      size="xl"
      aria-label="Nuevo proyecto"
      class="fixed bottom-24 right-5 size-14 justify-center rounded-2xl shadow-lg md:bottom-8 md:right-8"
    />
  </div>
</template>
