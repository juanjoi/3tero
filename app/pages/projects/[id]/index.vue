<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const route = useRoute()
const id = route.params.id as string
const onError = useApiError()
const toast = useToast()

const { data: project, error } = await useFetch(`/api/projects/${id}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: 'Proyecto no encontrado', fatal: true })
const p = computed(() => project.value!)
const update = (next: ProjectDetail) => (project.value = next)

useHead({ title: () => `${p.value.title} · Layra` })

const tab = ref('files')
const tabs = computed(() => [
  { label: 'Ficheros', value: 'files', slot: 'files' as const, badge: p.value.files.length || undefined },
  { label: 'Materiales', value: 'materials', slot: 'materials' as const },
  { label: 'Notas', value: 'notes', slot: 'notes' as const },
  { label: 'Info', value: 'info', slot: 'info' as const },
])

const changingStatus = ref(false)
async function changeStatus(status: ProjectStatus) {
  changingStatus.value = true
  try {
    update(await $fetch(`/api/projects/${id}/status`, { method: 'POST', body: { status } }))
  }
  catch (err) { onError(err) }
  finally { changingStatus.value = false }
}

async function setPriority(priority: Priority) {
  try {
    update(await $fetch(`/api/projects/${id}`, { method: 'PATCH', body: { priority } }))
  }
  catch (err) { onError(err) }
}

async function archive() {
  try {
    await $fetch(`/api/projects/${id}`, { method: 'DELETE' })
    toast.add({
      title: 'Proyecto archivado',
      icon: 'i-lucide-archive',
      actions: [{ label: 'Deshacer', onClick: undoArchive }],
    })
    await navigateTo('/')
  }
  catch (err) { onError(err) }
}

async function undoArchive() {
  try {
    await $fetch(`/api/projects/${id}/restore`, { method: 'POST' })
    await navigateTo(`/projects/${id}`)
  }
  catch (err) { onError(err) }
}

async function restore() {
  try {
    update(await $fetch(`/api/projects/${id}/restore`, { method: 'POST' }))
  }
  catch (err) { onError(err) }
}

const confirmDelete = ref(false)
async function hardDelete() {
  try {
    await $fetch(`/api/projects/${id}`, { method: 'DELETE', query: { hard: 'true' } })
    toast.add({ title: 'Proyecto borrado', icon: 'i-lucide-trash-2' })
    await navigateTo('/')
  }
  catch (err) { onError(err) }
}

const menu = computed<DropdownMenuItem[][]>(() => [
  [{ label: 'Editar', icon: 'i-lucide-pencil', to: `/projects/${id}/edit` }],
  [{ type: 'label' as const, label: 'Prioridad' }, ...PRIORITIES.slice().reverse().map(pr => ({
    label: PRIORITY_META[pr].label,
    type: 'checkbox' as const,
    checked: p.value.priority === pr,
    onSelect: () => setPriority(pr),
  }))],
  [
    p.value.archivedAt
      ? { label: 'Restaurar', icon: 'i-lucide-archive-restore', onSelect: restore }
      : { label: 'Archivar', icon: 'i-lucide-archive', onSelect: archive },
    { label: 'Borrar definitivamente', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => (confirmDelete.value = true) },
  ],
])
</script>

<template>
  <div v-if="project" class="mx-auto max-w-6xl md:px-4 md:py-5">
    <div class="md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-8">
      <!-- Hero -->
      <div class="relative">
        <ProjectGallery :project="p" @update="update" />
        <UButton
          to="/"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="soft"
          aria-label="Volver"
          class="absolute left-3 top-3 rounded-xl bg-default/90 md:hidden"
        />
      </div>

      <section class="relative -mt-5 flex flex-col gap-4 rounded-t-3xl bg-default px-4 pb-8 pt-5 md:mt-0 md:rounded-none md:bg-transparent md:p-0">
        <UAlert v-if="p.archivedAt" icon="i-lucide-archive" color="warning" variant="soft" title="Proyecto archivado" :actions="[{ label: 'Restaurar', onClick: restore }]" />

        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            <UBadge :label="`Prioridad ${PRIORITY_META[p.priority].label.toLowerCase()}`" variant="soft" color="neutral" class="rounded-full">
              <template #leading>
                <span class="size-2 rounded-full" :style="{ background: PRIORITY_META[p.priority].color }" />
              </template>
            </UBadge>
            <NuxtLink v-for="t in p.tags" :key="t.id" :to="{ path: '/', query: { tags: t.name } }">
              <UBadge :label="`#${t.name}`" variant="soft" color="neutral" class="rounded-full" />
            </NuxtLink>
          </div>
          <div class="flex items-start gap-2">
            <h1 class="flex-1 font-display text-2xl font-bold leading-tight tracking-tight md:text-3xl">
              {{ p.title }}
            </h1>
            <UDropdownMenu :items="menu">
              <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" aria-label="Más opciones" />
            </UDropdownMenu>
          </div>
          <p v-if="p.designer || p.license" class="text-sm text-muted">
            <span v-if="p.source === 'makerworld'">MakerWorld · </span>
            <span v-if="p.designer">por {{ p.designer }}</span>
            <span v-if="p.license"> · {{ p.license }}</span>
          </p>
        </div>

        <StatusStepper :status="p.status" :busy="changingStatus" @change="changeStatus" />

        <div class="grid grid-cols-3 gap-2">
          <div class="flex flex-col rounded-2xl border border-default p-3">
            <span class="text-[11px] font-medium text-muted">Coste est.</span>
            <span class="font-display text-xl font-bold">{{ formatEuro(p.estimate?.cost) }}</span>
          </div>
          <div class="flex flex-col rounded-2xl border border-default p-3">
            <span class="text-[11px] font-medium text-muted">Filamento</span>
            <span class="font-display text-xl font-bold">{{ p.estimate?.grams ? `${Math.round(p.estimate.grams)} g` : '—' }}</span>
          </div>
          <div class="flex flex-col rounded-2xl border border-default p-3">
            <span class="text-[11px] font-medium text-muted">Tiempo</span>
            <span class="font-display text-xl font-bold">{{ formatMinutes(p.estimate?.minutes) }}</span>
          </div>
        </div>

        <UTabs v-model="tab" :items="tabs" class="w-full">
          <template #files>
            <FilesPanel :project="p" class="pt-3" @update="update" />
          </template>
          <template #materials>
            <MaterialsPanel :project="p" class="pt-3" @update="update" />
          </template>
          <template #notes>
            <div class="pt-3">
              <p v-if="p.description" class="whitespace-pre-line text-sm leading-relaxed">{{ p.description }}</p>
              <p v-if="p.notes" class="mt-3 whitespace-pre-line text-sm leading-relaxed text-toned">{{ p.notes }}</p>
              <UEmpty v-if="!p.description && !p.notes" icon="i-lucide-notebook-pen" title="Sin notas" size="sm" :actions="[{ label: 'Editar', to: `/projects/${id}/edit`, variant: 'outline' }]" />
            </div>
          </template>
          <template #info>
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 pt-3 text-sm">
              <dt class="text-muted">Origen</dt>
              <dd>
                <ULink v-if="p.sourceUrl" :to="p.sourceUrl" target="_blank" class="break-all text-primary">{{ p.sourceUrl }}</ULink>
                <span v-else>Manual</span>
              </dd>
              <dt class="text-muted">Creado</dt>
              <dd>{{ new Date(p.createdAt).toLocaleDateString('es-ES') }}</dd>
              <dt class="text-muted">Actualizado</dt>
              <dd>{{ new Date(p.updatedAt).toLocaleString('es-ES') }}</dd>
              <dt class="text-muted">Historial</dt>
              <dd class="flex flex-col gap-1">
                <span v-for="h in p.history" :key="h.id">
                  {{ new Date(h.changedAt).toLocaleDateString('es-ES') }} —
                  <template v-if="h.fromStatus">{{ STATUS_META[h.fromStatus].label }} → </template>{{ STATUS_META[h.toStatus].label }}
                </span>
              </dd>
            </dl>
          </template>
        </UTabs>
      </section>
    </div>

    <UModal v-model:open="confirmDelete" title="¿Borrar definitivamente?" description="Se borrarán el proyecto, sus fotos y ficheros. No se puede deshacer.">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancelar" variant="ghost" color="neutral" @click="confirmDelete = false" />
          <UButton label="Borrar" color="error" icon="i-lucide-trash-2" @click="hardDelete" />
        </div>
      </template>
    </UModal>
  </div>
</template>
