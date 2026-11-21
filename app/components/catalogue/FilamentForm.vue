<script setup lang="ts">
// Inline create/edit form for a catalogue filament (rendered in place, no popup).
const props = defineProps<{ filament?: Filament | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()
const onError = useApiError()

const TYPES = ['PLA', 'PLA Matte', 'PLA Silk', 'PETG', 'TPU', 'ABS', 'ASA', 'PLA-CF', 'PETG-CF', 'PA', 'PC']
const state = reactive({
  type: props.filament?.type ?? 'PLA',
  brand: props.filament?.brand ?? '',
  colorName: props.filament?.colorName ?? '',
  colorHex: props.filament?.colorHex ?? '#1F2937',
  pricePerKg: props.filament ? Number(props.filament.pricePerKg) : 20,
  bambuPresetId: props.filament?.bambuPresetId ?? '',
  stockGrams: props.filament?.stockGrams == null ? null : Number(props.filament.stockGrams) as number | null,
})
const saving = ref(false)

async function save() {
  saving.value = true
  try {
    const body = { ...state, colorHex: state.colorHex.toUpperCase(), stockGrams: state.stockGrams ?? null }
    if (props.filament) await $fetch(`/api/filaments/${props.filament.id}`, { method: 'PATCH', body })
    else await $fetch('/api/filaments', { method: 'POST', body })
    emit('saved')
  }
  catch (err) { onError(err, 'No se pudo guardar') }
  finally { saving.value = false }
}
</script>

<template>
  <UForm :schema="filamentSchema" :state="state" class="grid grid-cols-2 gap-4 rounded-2xl border border-primary bg-primary/5 p-4" @submit="save">
    <h3 class="col-span-2 text-sm font-semibold">{{ filament ? 'Editar filamento' : 'Nuevo filamento' }}</h3>
    <UFormField label="Tipo" name="type">
      <UInputMenu v-model="state.type" :items="TYPES" class="w-full" />
    </UFormField>
    <UFormField label="Marca" name="brand">
      <UInput v-model="state.brand" placeholder="Bambu, Sunlu…" class="w-full" />
    </UFormField>
    <UFormField label="Color" name="colorName">
      <UInput v-model="state.colorName" placeholder="Negro" class="w-full" />
    </UFormField>
    <UFormField label="Muestra" name="colorHex">
      <div class="flex items-center gap-2">
        <input v-model="state.colorHex" type="color" aria-label="Elegir color" class="size-9 shrink-0 cursor-pointer rounded-lg border border-default bg-transparent">
        <UInput v-model="state.colorHex" class="w-full font-mono" />
      </div>
    </UFormField>
    <UFormField label="Precio por kg (€)" name="pricePerKg">
      <UInputNumber v-model="state.pricePerKg" :min="0" :step="0.5" class="w-full" />
    </UFormField>
    <UFormField label="Preset Bambu" name="bambuPresetId" help="Opcional, p. ej. GFA00">
      <UInput v-model="state.bambuPresetId" class="w-full" />
    </UFormField>
    <UFormField label="En stock (g)" name="stockGrams" help="Vacío = sin control de stock. Cada impresión lo descuenta." class="col-span-2">
      <div class="flex items-center gap-2">
        <UInputNumber v-model="state.stockGrams" :min="0" :step="50" placeholder="Sin control" class="w-40" />
        <UButton label="+1 bobina (1 kg)" size="sm" variant="soft" icon="i-lucide-plus" @click="state.stockGrams = (state.stockGrams ?? 0) + 1000" />
        <UButton v-if="state.stockGrams !== null" label="No controlar" size="sm" variant="ghost" color="neutral" @click="state.stockGrams = null" />
      </div>
    </UFormField>
    <div class="col-span-2 flex justify-end gap-2">
      <UButton label="Cancelar" variant="ghost" color="neutral" @click="emit('cancel')" />
      <UButton type="submit" label="Guardar" :loading="saving" />
    </div>
  </UForm>
</template>
