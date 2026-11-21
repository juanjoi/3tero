<script setup lang="ts">
// Inline create/edit form for a catalogue material (rendered in place, no popup).
const props = defineProps<{ material?: Material | null, categories: string[] }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()
const onError = useApiError()

const DEFAULT_CATEGORIES = ['Imanes', 'Tornillería', 'Insertos', 'Electrónica', 'Motores', 'Rodamientos', 'Adhesivos', 'Otros']
const categoryItems = computed(() => [...new Set([...props.categories, ...DEFAULT_CATEGORIES])])
const form = reactive({
  category: props.material?.category ?? 'Imanes',
  name: props.material?.name ?? '',
  spec: props.material?.spec ?? '',
  url: props.material?.url ?? '',
})
const saving = ref(false)

async function save() {
  saving.value = true
  try {
    if (props.material) await $fetch(`/api/materials/${props.material.id}`, { method: 'PATCH', body: form })
    else await $fetch('/api/materials', { method: 'POST', body: form })
    emit('saved')
  }
  catch (err) { onError(err, 'No se pudo guardar') }
  finally { saving.value = false }
}
</script>

<template>
  <UForm :schema="materialSchema" :state="form" class="grid grid-cols-1 gap-4 rounded-2xl border border-primary bg-primary/5 p-4 sm:grid-cols-2" @submit="save">
    <h3 class="text-sm font-semibold sm:col-span-2">{{ material ? 'Editar material' : 'Nuevo material' }}</h3>
    <UFormField label="Categoría" name="category">
      <UInputMenu v-model="form.category" :items="categoryItems" class="w-full" />
    </UFormField>
    <UFormField label="Nombre" name="name">
      <UInput v-model="form.name" placeholder="Imán de neodimio" class="w-full" />
    </UFormField>
    <UFormField label="Especificación" name="spec">
      <UInput v-model="form.spec" placeholder="6×3 mm N52" class="w-full" />
    </UFormField>
    <UFormField label="Enlace de compra" name="url">
      <UInput v-model="form.url" type="url" placeholder="Enlace a la tienda" class="w-full" />
    </UFormField>
    <div class="flex justify-end gap-2 sm:col-span-2">
      <UButton label="Cancelar" variant="ghost" color="neutral" @click="emit('cancel')" />
      <UButton type="submit" label="Guardar" :loading="saving" />
    </div>
  </UForm>
</template>
