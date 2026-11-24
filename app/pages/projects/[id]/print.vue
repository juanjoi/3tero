<script setup lang="ts">
// Full page (not a popup) to log a print attempt of a project.
const route = useRoute()
const id = route.params.id as string
const { data: project, error } = await useFetch(`/api/projects/${id}`)
if (error.value || !project.value) throw createError({ statusCode: 404, statusMessage: 'Proyecto no encontrado', fatal: true })
const props = { project: project.value! }
useHead({ title: () => `Registrar impresión · ${props.project.title}` })
const onError = useApiError()
const toast = useToast()
const { upload } = useUpload()

const { data: filaments } = useFetch('/api/filaments', { key: 'filaments' })
const filamentItems = computed(() => (filaments.value ?? []).map(f => ({ label: `${f.type} · ${f.colorName}`, value: f.id })))

const RESULTS: { value: PrintResult, label: string, icon: string }[] = [
  { value: 'success', label: 'Correcta', icon: 'i-lucide-check' },
  { value: 'partial', label: 'Parcial', icon: 'i-lucide-circle-dashed' },
  { value: 'failed', label: 'Fallida', icon: 'i-lucide-x' },
]

// From the print queue (?queue=<item>&file=<file>): that file, and a successful print uses up a copy
const queueItemId = typeof route.query.queue === 'string' ? route.query.queue : undefined
const defaultFile = props.project.files.find(f => f.id === route.query.file)
  ?? props.project.files.find(f => f.final) ?? props.project.files[0]
const state = reactive({
  fileId: defaultFile?.id as string | undefined,
  result: 'success' as PrintResult,
  hours: undefined as number | undefined,
  minutes: undefined as number | undefined,
  filaments: [] as { filamentId: string, grams: number }[],
  notes: '',
  markPrinted: props.project.status !== 'printed',
  markFinal: !!defaultFile && !defaultFile.final,
})
const photos = ref<File[]>([])
const photoInput = useTemplateRef<HTMLInputElement>('photoInput')

// Pre-fill time and grams from the selected file (editable: a failed print uses less filament)
watch(() => state.fileId, (id) => {
  const f = props.project.files.find(x => x.id === id)
  state.filaments = (f?.filaments ?? []).map(x => ({ filamentId: x.filamentId, grams: Number(x.grams) }))
  state.hours = f?.estMinutes ? Math.floor(f.estMinutes / 60) : undefined
  state.minutes = f?.estMinutes ? f.estMinutes % 60 : undefined
  state.markFinal = !!f && !f.final && state.result === 'success'
}, { immediate: true })
watch(() => state.result, (r) => {
  state.markPrinted = r === 'success' && props.project.status !== 'printed'
  const f = props.project.files.find(x => x.id === state.fileId)
  state.markFinal = r === 'success' && !!f && !f.final
})

const fileItems = computed(() => [
  ...props.project.files.map(f => ({ label: `${f.label ?? f.originalName}${f.final ? ' (final)' : ''}`, value: f.id })),
])
const cost = computed(() => filamentCost(state.filaments.map(f => ({
  grams: f.grams ?? 0,
  pricePerKg: filaments.value?.find(x => x.id === f.filamentId)?.pricePerKg ?? 0,
}))))

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    const minutes = state.hours || state.minutes ? (state.hours ?? 0) * 60 + (state.minutes ?? 0) : null
    const res = await $fetch.raw<ProjectDetail>(`/api/projects/${props.project.id}/prints`, {
      method: 'POST',
      body: {
        fileId: state.fileId ?? null,
        result: state.result,
        minutes,
        notes: state.notes,
        filaments: state.filaments.filter(f => f.filamentId && f.grams > 0),
        markPrinted: state.markPrinted,
        markFinal: state.markFinal && !!state.fileId,
        queueItemId,
      },
    })
    const printId = res.headers.get('x-print-id')
    if (photos.value.length && printId) {
      await upload<ProjectDetail>(`/api/projects/${props.project.id}/prints/${printId}/images`, photos.value)
    }
    toast.add({ title: 'Impresión registrada', icon: 'i-lucide-printer' })
    await navigateTo(queueItemId ? '/queue' : { path: `/projects/${id}`, query: { tab: 'prints' } }, { replace: true })
  }
  catch (err) {
    onError(err, 'No se pudo registrar la impresión')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-5">
    <div class="flex items-center gap-2">
      <UButton :to="`/projects/${id}`" icon="i-lucide-arrow-left" color="neutral" variant="ghost" aria-label="Volver" />
      <div class="flex min-w-0 flex-col">
        <h1 class="font-display text-xl font-bold">Registrar impresión</h1>
        <span class="truncate text-sm text-muted">{{ props.project.title }}</span>
      </div>
    </div>

      <div class="flex flex-col gap-4">
        <UFormField v-if="fileItems.length" label="Fichero impreso">
          <USelect v-model="state.fileId" :items="fileItems" class="w-full" />
        </UFormField>

        <UFormField label="Resultado">
          <div class="grid grid-cols-3 gap-2">
            <UButton
              v-for="r in RESULTS"
              :key="r.value"
              :icon="r.icon"
              :label="r.label"
              :variant="state.result === r.value ? 'soft' : 'outline'"
              :color="state.result === r.value ? (r.value === 'success' ? 'primary' : r.value === 'failed' ? 'error' : 'warning') : 'neutral'"
              class="justify-center"
              block
              @click="state.result = r.value"
            />
          </div>
        </UFormField>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Filamento usado</span>
            <UButton size="xs" variant="soft" icon="i-lucide-plus" label="Añadir" @click="state.filaments.push({ filamentId: '', grams: 0 })" />
          </div>
          <div v-for="(f, i) in state.filaments" :key="i" class="flex items-center gap-2">
            <span class="size-4 shrink-0 rounded-full ring-1 ring-accented" :style="{ background: filaments?.find(x => x.id === f.filamentId)?.colorHex }" />
            <USelect v-model="f.filamentId" :items="filamentItems" placeholder="Filamento" class="min-w-0 flex-1" />
            <UInputNumber v-model="f.grams" :min="0" class="w-28" />
            <span class="text-sm text-muted">g</span>
            <UButton icon="i-lucide-x" variant="ghost" color="neutral" aria-label="Quitar" @click="state.filaments.splice(i, 1)" />
          </div>
          <p v-if="!state.filaments.length" class="text-sm text-muted">Sin filamentos: el coste será 0 €.</p>
        </div>

        <UFormField label="Tiempo real">
          <div class="flex items-center gap-2">
            <UInputNumber v-model="state.hours" :min="0" placeholder="0" class="w-28" />
            <span class="text-sm text-muted">h</span>
            <UInputNumber v-model="state.minutes" :min="0" :max="59" placeholder="0" class="w-28" />
            <span class="text-sm text-muted">min</span>
          </div>
        </UFormField>

        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap gap-2">
            <div v-for="(p, i) in photos" :key="i" class="flex items-center gap-1 rounded-lg bg-elevated px-2 py-1 text-xs">
              <UIcon name="i-lucide-image" /> {{ p.name }}
              <button type="button" aria-label="Quitar foto" @click="photos.splice(i, 1)"><UIcon name="i-lucide-x" /></button>
            </div>
          </div>
          <UButton icon="i-lucide-camera" label="Añadir foto del resultado" variant="outline" color="neutral" class="self-start" @click="photoInput?.click()" />
          <input ref="photoInput" type="file" accept="image/*" multiple class="hidden" @change="e => { photos.push(...((e.target as HTMLInputElement).files ?? [])); (e.target as HTMLInputElement).value = '' }">
        </div>

        <UFormField label="Notas">
          <UTextarea v-model="state.notes" :rows="2" autoresize placeholder="Qué salió bien o mal" class="w-full" />
        </UFormField>

        <div class="flex flex-col gap-2 rounded-xl bg-primary/5 p-3">
          <UCheckbox v-if="props.project.status !== 'printed'" v-model="state.markPrinted" label="Marcar el proyecto como «Impreso»" />
          <UCheckbox v-if="state.fileId" v-model="state.markFinal" label="Marcar este fichero como versión final" />
        </div>
      </div>

    <!-- Sticky bottom bar: live cost + save -->
    <div class="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-default bg-default/95 px-4 py-3 backdrop-blur md:bottom-0">
      <div>
      <div class="flex w-full items-center gap-3">
        <div class="flex flex-col">
          <span class="text-[11px] text-muted">Coste</span>
          <span class="font-display text-xl font-bold">{{ formatEuro(cost) }}</span>
        </div>
        <UButton label="Guardar" size="lg" class="flex-1 justify-center" :loading="saving" @click="save" />
      </div>
      </div>
    </div>
  </div>
</template>
