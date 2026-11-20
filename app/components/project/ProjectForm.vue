<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'

type Output = z.output<typeof projectCreateSchema>

const props = defineProps<{
  initial?: Partial<ProjectCreateInput>
  submitLabel: string
  showStatus?: boolean
}>()
const emit = defineEmits<{ submit: [value: Output] }>()

interface FormState {
  title: string
  description: string
  status: ProjectStatus
  priority: Priority
  tags: string[]
  sourceUrl: string
  designer: string
  license: string
  notes: string
}

const state = reactive<FormState>({
  title: '',
  description: '',
  status: 'modeling',
  priority: 'medium',
  tags: [],
  sourceUrl: '',
  designer: '',
  license: '',
  notes: '',
  ...(props.initial as Partial<FormState>),
})

const { data: allTags } = await useFetch<TagWithCount[]>('/api/tags')
const loading = ref(false)

const priorityItems = PRIORITIES.map(p => ({ label: PRIORITY_META[p].label, value: p })).reverse()
const statusItems = PROJECT_STATUSES.map(s => ({ label: STATUS_META[s].label, value: s }))

async function onSubmit(e: FormSubmitEvent<Output>) {
  loading.value = true
  try {
    emit('submit', e.data)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UForm :schema="projectCreateSchema" :state="state" class="flex flex-col gap-5" @submit="onSubmit">
    <UFormField label="Título" name="title" required>
      <UInput v-model="state.title" size="xl" class="w-full" autofocus />
    </UFormField>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UFormField label="Prioridad" name="priority">
        <URadioGroup v-model="state.priority" :items="priorityItems" orientation="horizontal" variant="table" />
      </UFormField>
      <UFormField v-if="showStatus" label="Estado" name="status">
        <USelect v-model="state.status" :items="statusItems" class="w-full" />
      </UFormField>
    </div>

    <UFormField label="Etiquetas" name="tags" :help="allTags?.length ? `Existentes: ${allTags.slice(0, 8).map(t => t.name).join(', ')}` : 'Escribe y pulsa Enter'">
      <UInputTags v-model="state.tags" placeholder="taller, regalos…" class="w-full" add-on-blur add-on-paste />
    </UFormField>

    <UFormField label="Descripción" name="description">
      <UTextarea v-model="state.description" :rows="4" autoresize class="w-full" />
    </UFormField>

    <UFormField label="Notas" name="notes">
      <UTextarea v-model="state.notes" :rows="3" autoresize placeholder="Ajustes de impresión, trucos…" class="w-full" />
    </UFormField>

    <UCollapsible class="flex flex-col gap-4">
      <UButton label="Origen y autoría" variant="link" color="neutral" trailing-icon="i-lucide-chevron-down" class="self-start p-0" />
      <template #content>
        <div class="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
          <UFormField label="Enlace original" name="sourceUrl" class="sm:col-span-2">
            <UInput v-model="state.sourceUrl" type="url" icon="i-lucide-link" placeholder="https://makerworld.com/…" class="w-full" />
          </UFormField>
          <UFormField label="Diseñador" name="designer">
            <UInput v-model="state.designer" class="w-full" />
          </UFormField>
          <UFormField label="Licencia" name="license">
            <UInput v-model="state.license" placeholder="CC BY-NC-SA…" class="w-full" />
          </UFormField>
        </div>
      </template>
    </UCollapsible>

    <div class="flex justify-end gap-2">
      <UButton label="Cancelar" variant="ghost" color="neutral" @click="$router.back()" />
      <UButton type="submit" :label="submitLabel" :loading="loading" size="lg" />
    </div>
  </UForm>
</template>
