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
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
    <header class="flex items-center justify-between md:hidden">
      <AppLogo />
    </header>

    <div class="flex flex-col gap-3 md:flex-row md:items-center">
      <UInput v-model="q" icon="i-lucide-search" size="xl" placeholder="Buscar proyectos, etiquetas…" class="w-full" :loading="loadStatus === 'pending'" />
      <div class="flex gap-2">
        <USelectMenu
          v-model="selectedTags"
          :items="tagItems"
          multiple
          icon="i-lucide-tag"
          placeholder="Etiquetas"
          size="xl"
          class="min-w-36 flex-1 md:w-48"
        />
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
