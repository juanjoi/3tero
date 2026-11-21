<script setup lang="ts">
const props = defineProps<{ project: ProjectDetail }>()
const emit = defineEmits<{ update: [project: ProjectDetail] }>()
const onError = useApiError()
const toast = useToast()
const { upload, progress, uploading, header } = useUpload()
const input = useTemplateRef<HTMLInputElement>('input')
const { data: limits } = useFetch('/api/settings/storage', { key: 'storage' })

// Expanded row (no popups): actions bar + inline 3D viewer or inline editor
const openId = ref<string | null>(null)
const mode = ref<'actions' | 'view' | 'edit'>('actions')
function toggle(f: ProjectFile) {
  if (openId.value === f.id) { openId.value = null; return }
  openId.value = f.id
  mode.value = 'actions'
}
function view(f: ProjectFile) {
  openId.value = f.id
  mode.value = 'view'
}
function edit(f: ProjectFile) {
  openId.value = f.id
  mode.value = 'edit'
}

const viewerBox = useTemplateRef<HTMLElement[]>('viewerBox')
function fullscreen() {
  const el = viewerBox.value?.[0]
  if (!el) return
  if (document.fullscreenElement) document.exitFullscreen()
  else el.requestFullscreen?.().catch(() => {})
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
    openId.value = null
  }
  catch (err) { onError(err) }
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
      class="flex flex-col rounded-2xl border transition-colors"
      :class="f.final ? 'border-primary bg-primary/5' : 'border-default bg-default'"
    >
      <div class="flex items-center gap-3 p-3">
        <button
          type="button"
          class="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-elevated text-xs font-bold uppercase text-toned"
          :aria-label="f.kind === 'model' ? 'Ver en 3D' : f.originalName"
          @click="f.kind === 'model' ? view(f) : toggle(f)"
        >
          <img v-if="f.thumbnailUrl" :src="f.thumbnailUrl" alt="" class="size-full object-contain">
          <span v-else>{{ f.format }}</span>
          <UIcon v-if="f.kind === 'model'" name="i-lucide-rotate-3d" class="absolute bottom-0.5 right-0.5 size-3.5 text-muted" />
        </button>
        <button type="button" class="flex min-w-0 flex-1 flex-col gap-0.5 text-left" @click="toggle(f)">
          <div class="flex items-center gap-1.5">
            <span class="truncate text-sm font-semibold">{{ f.label ?? f.originalName }}</span>
            <UBadge v-if="f.final" label="FINAL" size="sm" class="font-bold" />
            <UIcon
              v-if="f.fitsPrinter !== null"
              :name="f.fitsPrinter ? 'i-lucide-check-circle-2' : 'i-lucide-triangle-alert'"
              class="size-4 shrink-0"
              :class="f.fitsPrinter ? 'text-primary' : 'text-warning'"
              :aria-label="f.fitsPrinter ? 'Cabe en la A1 mini' : 'No cabe en la A1 mini'"
            />
          </div>
          <span class="truncate text-xs text-muted">{{ meta(f) }}</span>
          <div v-if="f.filaments.length" class="mt-0.5 flex">
            <ColorSwatches :colors="f.filaments.map(x => x.colorHex)" />
          </div>
        </button>
        <UButton
          :icon="openId === f.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          variant="ghost"
          color="neutral"
          :aria-label="openId === f.id ? 'Cerrar' : 'Acciones'"
          @click="toggle(f)"
        />
      </div>

      <Transition name="expand">
        <div v-if="openId === f.id" class="flex flex-col gap-3 border-t border-default p-3">
          <p v-if="f.fitsPrinter === false" class="flex items-center gap-1.5 text-xs text-warning">
            <UIcon name="i-lucide-triangle-alert" /> No cabe en la A1 mini (180 × 180 × 180 mm)
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-if="f.kind === 'model'"
              size="sm"
              icon="i-lucide-rotate-3d"
              label="Ver en 3D"
              :variant="mode === 'view' ? 'soft' : 'outline'"
              color="neutral"
              @click="mode = mode === 'view' ? 'actions' : 'view'"
            />
            <UButton size="sm" icon="i-lucide-pencil" label="Editar datos" :variant="mode === 'edit' ? 'soft' : 'outline'" color="neutral" @click="mode = mode === 'edit' ? 'actions' : 'edit'" />
            <UButton
              size="sm"
              :icon="f.final ? 'i-lucide-star-off' : 'i-lucide-star'"
              :label="f.final ? 'Quitar final' : 'Marcar final'"
              variant="outline"
              color="neutral"
              @click="patch(f, { final: !f.final })"
            />
            <UButton
              size="sm"
              icon="i-lucide-download"
              label="Descargar"
              variant="outline"
              color="neutral"
              :to="`/api/projects/${project.id}/files/${f.id}/download`"
              external
              target="_blank"
            />
            <ConfirmButton size="sm" label="Borrar" confirm-label="¿Borrar fichero?" class="ml-auto" @confirm="remove(f)" />
          </div>

          <div v-if="mode === 'view' && f.kind === 'model'" ref="viewerBox" class="viewer-box relative overflow-hidden rounded-xl bg-elevated">
            <ClientOnly>
              <ModelViewer :url="f.url" :format="f.format" :color="f.filaments[0]?.colorHex" class="h-[55dvh] min-h-72" />
            </ClientOnly>
            <div class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
              <span v-if="f.bboxX" class="rounded-lg bg-default/80 px-2 py-1 text-xs">{{ f.bboxX }} × {{ f.bboxY }} × {{ f.bboxZ ?? '?' }} mm</span>
              <span v-else />
              <UButton icon="i-lucide-maximize" size="sm" color="neutral" variant="soft" aria-label="Pantalla completa" class="pointer-events-auto bg-default/80" @click="fullscreen" />
            </div>
          </div>

          <FileEditor v-if="mode === 'edit'" :key="f.id" :project="project" :file="f" @update="emit('update', $event)" @close="mode = 'actions'" />
        </div>
      </Transition>
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
  </div>
</template>
