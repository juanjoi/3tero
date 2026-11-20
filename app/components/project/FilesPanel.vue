<script setup lang="ts">
const props = defineProps<{ project: ProjectDetail }>()
const emit = defineEmits<{ update: [project: ProjectDetail] }>()
const onError = useApiError()
const toast = useToast()
const { upload, progress, uploading, header } = useUpload()
const input = useTemplateRef<HTMLInputElement>('input')
const { data: limits } = useFetch('/api/settings/storage', { key: 'storage' })

const viewing = ref<ProjectFile | null>(null)
const viewOpen = ref(false)
function view(f: ProjectFile) {
  viewing.value = f
  viewOpen.value = true
}

const editing = ref<ProjectFile | null>(null)
const editOpen = ref(false)
function edit(f: ProjectFile) {
  editing.value = f
  editOpen.value = true
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  if (limits.value && file.size > limits.value.maxModelBytes) {
    onError({ statusMessage: `El fichero supera el máximo de ${formatBytes(limits.value.maxModelBytes)}` })
    return
  }
  if (limits.value && file.size > limits.value.warnModelBytes) {
    toast.add({ title: `Fichero grande (${formatBytes(file.size)}), puede tardar un poco`, icon: 'i-lucide-hourglass' })
  }
  try {
    const updated = await upload<ProjectDetail>(`/api/projects/${props.project.id}/files`, [file])
    emit('update', updated)
    const created = updated.files.find(f => f.id === header('x-file-id'))
    if (!created) return
    afterUpload(created, Number(header('x-new-filaments') ?? 0))
  }
  catch (err) {
    onError(err, 'No se pudo subir el fichero')
  }
}

/** Hints after an upload: new catalogue filaments, status suggestion, fit warning, manual data entry. */
function afterUpload(f: ProjectFile, newFilaments: number) {
  if (newFilaments > 0) {
    toast.add({
      title: `${newFilaments} filamento${newFilaments > 1 ? 's' : ''} añadido${newFilaments > 1 ? 's' : ''} al catálogo`,
      description: `Con precio por defecto. Revisa nombre y precio para afinar el coste.`,
      icon: 'i-lucide-disc-3',
      actions: [{ label: 'Revisar', to: '/materials' }],
    })
  }
  if (f.fitsPrinter === false) {
    toast.add({ title: 'Este modelo no cabe en la A1 mini (180 mm)', icon: 'i-lucide-triangle-alert', color: 'warning' })
  }
  if (f.kind === 'sliced' && props.project.status === 'modeling') {
    toast.add({
      title: 'Fichero laminado subido',
      description: '¿Pasar el proyecto a «Laminado»?',
      icon: 'i-lucide-layers',
      actions: [{ label: 'Pasar a Laminado', onClick: () => { setStatus('sliced') } }],
    })
  }
  if (!f.filaments.length && f.kind === 'model' && !f.estMinutes) edit(f)
}

async function setStatus(status: ProjectStatus) {
  try {
    emit('update', await $fetch(`/api/projects/${props.project.id}/status`, { method: 'POST', body: { status } }))
  }
  catch (err) { onError(err) }
}

async function patch(f: ProjectFile, body: Record<string, unknown>) {
  try {
    emit('update', await $fetch(`/api/projects/${props.project.id}/files/${f.id}`, { method: 'PATCH', body }))
  }
  catch (err) { onError(err) }
}

async function remove(f: ProjectFile) {
  try {
    emit('update', await $fetch(`/api/projects/${props.project.id}/files/${f.id}`, { method: 'DELETE' }))
  }
  catch (err) { onError(err) }
}

function menu(f: ProjectFile) {
  return [[
    ...(f.kind === 'model' ? [{ label: 'Ver en 3D', icon: 'i-lucide-rotate-3d', onSelect: () => view(f) }] : []),
    { label: 'Editar datos', icon: 'i-lucide-pencil', onSelect: () => edit(f) },
    f.final
      ? { label: 'Quitar como final', icon: 'i-lucide-star-off', onSelect: () => patch(f, { final: false }) }
      : { label: 'Marcar como final', icon: 'i-lucide-star', onSelect: () => patch(f, { final: true }) },
    { label: 'Descargar', icon: 'i-lucide-download', to: `/api/projects/${props.project.id}/files/${f.id}/download`, external: true, target: '_blank' },
  ], [
    { label: 'Borrar', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(f) },
  ]]
}

function meta(f: ProjectFile) {
  const parts = [f.kind === 'sliced' ? 'Laminado' : 'Modelo']
  if (f.plates && f.plates > 1) parts.push(`${f.plates} placas`)
  if (f.grams) parts.push(`${Math.round(f.grams)} g`)
  if (f.estMinutes) parts.push(formatMinutes(f.estMinutes))
  if (f.filaments.length) parts.push(formatEuro(f.cost))
  parts.push(formatBytes(f.size))
  return parts.join(' · ')
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div
      v-for="f in project.files"
      :key="f.id"
      class="flex items-center gap-3 rounded-2xl border p-3 transition-colors"
      :class="f.final ? 'border-primary bg-primary/5' : 'border-default bg-default'"
    >
      <button
        type="button"
        class="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-elevated text-xs font-bold uppercase text-toned"
        :aria-label="f.kind === 'model' ? 'Ver en 3D' : f.originalName"
        :disabled="f.kind !== 'model'"
        @click="view(f)"
      >
        <img v-if="f.thumbnailUrl" :src="f.thumbnailUrl" alt="" class="size-full object-contain">
        <span v-else>{{ f.format }}</span>
        <UIcon v-if="f.kind === 'model'" name="i-lucide-rotate-3d" class="absolute bottom-0.5 right-0.5 size-3.5 text-muted" />
      </button>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-sm font-semibold">{{ f.label ?? f.originalName }}</span>
          <UBadge v-if="f.final" label="FINAL" size="sm" class="font-bold" />
          <UTooltip v-if="f.fitsPrinter !== null" :text="f.fitsPrinter ? 'Cabe en la A1 mini' : 'No cabe en la A1 mini (180×180×180 mm)'">
            <UIcon
              :name="f.fitsPrinter ? 'i-lucide-check-circle-2' : 'i-lucide-triangle-alert'"
              class="size-4 shrink-0"
              :class="f.fitsPrinter ? 'text-primary' : 'text-warning'"
            />
          </UTooltip>
        </div>
        <span class="truncate text-xs text-muted">{{ meta(f) }}</span>
        <div v-if="f.filaments.length" class="mt-0.5 flex">
          <ColorSwatches :colors="f.filaments.map(x => x.colorHex)" />
        </div>
      </div>
      <UDropdownMenu :items="menu(f)">
        <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" aria-label="Acciones" />
      </UDropdownMenu>
    </div>

    <UEmpty
      v-if="!project.files.length"
      icon="i-lucide-file-box"
      title="Sin ficheros"
      description="Sube un STL o un 3MF. Cada versión queda guardada y puedes marcar la definitiva."
      size="sm"
    />

    <UProgress v-if="uploading" :model-value="progress" size="sm" />
    <UButton
      icon="i-lucide-upload"
      label="Subir STL / 3MF"
      variant="outline"
      block
      :loading="uploading"
      @click="input?.click()"
    />
    <input ref="input" type="file" accept=".stl,.3mf" class="hidden" @change="onFile">

    <UModal v-model:open="viewOpen" :title="viewing?.label ?? viewing?.originalName" :description="viewing?.bboxX ? `${viewing.bboxX} × ${viewing.bboxY} × ${viewing.bboxZ ?? '?'} mm` : undefined" fullscreen>
      <template #body>
        <ClientOnly>
          <ModelViewer
            v-if="viewing && viewOpen"
            :url="viewing.url"
            :format="viewing.format"
            :color="viewing.filaments[0]?.colorHex"
            class="h-full min-h-[60dvh]"
          />
        </ClientOnly>
      </template>
    </UModal>

    <FileEditModal
      v-if="editing"
      :key="editing.id"
      v-model:open="editOpen"
      :project="project"
      :file="editing"
      @update="emit('update', $event)"
    />
  </div>
</template>
