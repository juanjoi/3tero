<script setup lang="ts">
const props = defineProps<{ project: ProjectDetail, file: ProjectFile }>()
const emit = defineEmits<{ update: [project: ProjectDetail], close: [] }>()
const open = defineModel<boolean>('open', { default: false })
const onError = useApiError()

const { data: filaments } = useFetch('/api/filaments', { key: 'filaments' })
const filamentItems = computed(() => (filaments.value ?? []).map(f => ({
  label: `${f.type} · ${f.colorName}${f.brand ? ` (${f.brand})` : ''}`,
  value: f.id,
})))

const state = reactive({
  label: props.file.label ?? '',
  notes: props.file.notes ?? '',
  hours: props.file.estMinutes ? Math.floor(props.file.estMinutes / 60) : undefined as number | undefined,
  minutes: props.file.estMinutes ? props.file.estMinutes % 60 : undefined as number | undefined,
  filaments: props.file.filaments.map(f => ({ filamentId: f.filamentId, grams: Number(f.grams) })),
})

const cost = computed(() => filamentCost(state.filaments.map((f) => {
  const fil = filaments.value?.find(x => x.id === f.filamentId)
  return { grams: f.grams ?? 0, pricePerKg: fil?.pricePerKg ?? 0 }
})))

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    const estMinutes = state.hours || state.minutes ? (state.hours ?? 0) * 60 + (state.minutes ?? 0) : null
    const updated = await $fetch(`/api/projects/${props.project.id}/files/${props.file.id}`, {
      method: 'PATCH',
      body: {
        label: state.label,
        notes: state.notes,
        estMinutes,
        filaments: state.filaments.filter(f => f.filamentId).map((f, i) => ({ ...f, slot: i + 1 })),
      },
    })
    emit('update', updated)
    open.value = false
  }
  catch (err) {
    onError(err, 'No se pudo guardar')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="`Editar ${file.label ?? file.originalName}`" :description="file.originalName">
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField label="Etiqueta">
          <UInput v-model="state.label" placeholder="v2 · paredes más gruesas" class="w-full" />
        </UFormField>

        <UFormField label="Tiempo estimado">
          <div class="flex items-center gap-2">
            <UInputNumber v-model="state.hours" :min="0" placeholder="0" class="w-28" />
            <span class="text-sm text-muted">h</span>
            <UInputNumber v-model="state.minutes" :min="0" :max="59" placeholder="0" class="w-28" />
            <span class="text-sm text-muted">min</span>
          </div>
        </UFormField>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Filamentos</span>
            <UButton
              size="xs"
              variant="soft"
              icon="i-lucide-plus"
              label="Añadir"
              :disabled="state.filaments.length >= 4"
              @click="state.filaments.push({ filamentId: '', grams: 0 })"
            />
          </div>
          <p v-if="!filaments?.length" class="text-sm text-muted">
            No hay filamentos en el catálogo. <NuxtLink to="/materials" class="text-primary underline">Añádelos aquí</NuxtLink>.
          </p>
          <div v-for="(f, i) in state.filaments" :key="i" class="flex items-center gap-2">
            <USelect v-model="f.filamentId" :items="filamentItems" placeholder="Filamento" class="min-w-0 flex-1" />
            <UInputNumber v-model="f.grams" :min="0" :step="1" class="w-28" />
            <span class="text-sm text-muted">g</span>
            <UButton icon="i-lucide-x" variant="ghost" color="neutral" aria-label="Quitar" @click="state.filaments.splice(i, 1)" />
          </div>
          <div class="flex justify-end text-sm">
            Coste: <span class="ml-1 font-semibold">{{ formatEuro(cost) }}</span>
          </div>
        </div>

        <UFormField label="Notas">
          <UTextarea v-model="state.notes" :rows="2" autoresize placeholder="Qué cambia en esta versión" class="w-full" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Cancelar" variant="ghost" color="neutral" @click="open = false" />
        <UButton label="Guardar" :loading="saving" @click="save" />
      </div>
    </template>
  </UModal>
</template>
