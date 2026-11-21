<script setup lang="ts">
const props = defineProps<{ project: ProjectDetail }>()
const emit = defineEmits<{ update: [project: ProjectDetail] }>()
const onError = useApiError()
const { upload } = useUpload()

const RESULT_META: Record<PrintResult, { label: string, color: string }> = {
  success: { label: 'Correcta', color: '#15803D' },
  partial: { label: 'Parcial', color: '#EAB308' },
  failed: { label: 'Fallida', color: '#DC2626' },
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
function meta(p: ProjectDetail['prints'][number]) {
  return [fmtDate(p.printedAt), p.grams ? `${Math.round(p.grams)} g` : null, p.minutes ? formatMinutes(p.minutes) : null].filter(Boolean).join(' · ')
}

async function remove(id: string) {
  try {
    emit('update', await $fetch(`/api/projects/${props.project.id}/prints/${id}`, { method: 'DELETE' }))
  }
  catch (err) { onError(err) }
}

const photoInput = useTemplateRef<HTMLInputElement>('photoInput')
const photoTarget = ref<string | null>(null)
function addPhotos(id: string) {
  photoTarget.value = id
  photoInput.value?.click()
}
async function onPhotos(e: Event) {
  const files = [...((e.target as HTMLInputElement).files ?? [])]
  ;(e.target as HTMLInputElement).value = ''
  if (!files.length || !photoTarget.value) return
  try {
    emit('update', await upload<ProjectDetail>(`/api/projects/${props.project.id}/prints/${photoTarget.value}/images`, files))
  }
  catch (err) { onError(err, 'No se pudo subir la foto') }
}
</script>

<template>
  <div class="flex flex-col">
    <div v-for="(p, i) in project.prints" :key="p.id" class="flex gap-3">
      <div class="flex flex-col items-center">
        <span class="mt-1 size-3 shrink-0 rounded-full" :style="{ background: RESULT_META[p.result].color }" />
        <span v-if="i < project.prints.length - 1" class="w-0.5 flex-1 bg-accented" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-1 pb-5">
        <div class="flex items-start justify-between gap-2">
          <span class="text-sm font-semibold">{{ p.fileLabel ?? 'Sin fichero' }} · {{ RESULT_META[p.result].label }}</span>
          <div class="flex items-center gap-1">
            <span class="text-sm font-semibold">{{ formatEuro(p.cost) }}</span>
            <UButton icon="i-lucide-camera" size="xs" variant="ghost" color="neutral" aria-label="Añadir fotos" @click="addPhotos(p.id)" />
            <ConfirmButton size="xs" confirm-label="¿Borrar?" @confirm="remove(p.id)" />
          </div>
        </div>
        <span class="text-xs text-muted">{{ meta(p) }}</span>
        <ColorSwatches v-if="p.filaments.length" :colors="p.filaments.map(f => f.colorHex)" />
        <p v-if="p.notes" class="text-sm text-toned">{{ p.notes }}</p>
        <div v-if="p.images.length" class="mt-1 flex gap-2 overflow-x-auto">
          <a v-for="img in p.images" :key="img.id" :href="img.url" target="_blank" class="size-16 shrink-0 overflow-hidden rounded-lg">
            <img :src="img.thumbUrl ?? img.url" alt="Foto de la impresión" class="size-full object-cover">
          </a>
        </div>
      </div>
    </div>

    <UEmpty
      v-if="!project.prints.length"
      icon="i-lucide-printer"
      title="Sin impresiones"
      description="Registra cada intento: resultado, gramos reales, tiempo y una foto."
      size="sm"
      :actions="[{ label: 'Registrar impresión', icon: 'i-lucide-plus', to: `/projects/${project.id}/print` }]"
    />
    <div v-else class="flex justify-between border-t border-default pt-3 text-sm">
      <span class="text-muted">Total gastado ({{ project.prints.length }} impresión{{ project.prints.length === 1 ? '' : 'es' }})</span>
      <span class="font-bold">{{ formatEuro(project.spent) }}</span>
    </div>
    <input ref="photoInput" type="file" accept="image/*" multiple class="hidden" @change="onPhotos">
  </div>
</template>
