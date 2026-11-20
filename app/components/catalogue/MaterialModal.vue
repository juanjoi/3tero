<script setup lang="ts">
const props = defineProps<{ material?: Material | null, categories: string[] }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })
const onError = useApiError()

const DEFAULT_CATEGORIES = ['Imanes', 'Tornillería', 'Insertos', 'Electrónica', 'Motores', 'Rodamientos', 'Adhesivos', 'Otros']
const categoryItems = computed(() => [...new Set([...props.categories, ...DEFAULT_CATEGORIES])])
const state = reactive({
  category: props.material?.category ?? 'Imanes',
  name: props.material?.name ?? '',
  spec: props.material?.spec ?? '',
  url: props.material?.url ?? '',
})
const saving = ref(false)

async function save() {
  saving.value = true
  try {
    if (props.material) await $fetch(`/api/materials/${props.material.id}`, { method: 'PATCH', body: state })
    else await $fetch('/api/materials', { method: 'POST', body: state })
    emit('saved')
    open.value = false
  }
  catch (err) { onError(err, 'No se pudo guardar') }
  finally { saving.value = false }
}
</script>

<template>
  <UModal v-model:open="open" :title="material ? 'Editar material' : 'Nuevo material'">
    <template #body>
      <UForm :schema="materialSchema" :state="state" class="flex flex-col gap-4" @submit="save">
        <UFormField label="Categoría" name="category">
          <UInputMenu v-model="state.category" :items="categoryItems" class="w-full" />
        </UFormField>
        <UFormField label="Nombre" name="name">
          <UInput v-model="state.name" placeholder="Imán de neodimio" class="w-full" />
        </UFormField>
        <UFormField label="Especificación" name="spec">
          <UInput v-model="state.spec" placeholder="6×3 mm N52" class="w-full" />
        </UFormField>
        <UFormField label="Enlace de compra" name="url">
          <UInput v-model="state.url" type="url" placeholder="https://…" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton label="Cancelar" variant="ghost" color="neutral" @click="open = false" />
          <UButton type="submit" label="Guardar" :loading="saving" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
