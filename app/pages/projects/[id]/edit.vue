<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
const onError = useApiError()
const { data: project, error } = await useFetch(`/api/projects/${id}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: 'Proyecto no encontrado', fatal: true })

const initial = computed<Partial<ProjectCreateInput>>(() => ({
  title: project.value!.title,
  description: project.value!.description ?? '',
  priority: project.value!.priority,
  status: project.value!.status,
  tags: project.value!.tags.map(t => t.name),
  sourceUrl: project.value!.sourceUrl ?? '',
  designer: project.value!.designer ?? '',
  license: project.value!.license ?? '',
  notes: project.value!.notes ?? '',
}))

async function save({ status: _status, ...data }: ProjectCreateInput) {
  try {
    await $fetch(`/api/projects/${id}`, { method: 'PATCH', body: data })
    await navigateTo(`/projects/${id}`, { replace: true })
  }
  catch (err) {
    onError(err, 'No se pudo guardar')
  }
}
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5">
    <div class="flex items-center gap-2">
      <UButton icon="i-lucide-arrow-left" variant="ghost" color="neutral" aria-label="Volver" @click="$router.back()" />
      <h1 class="font-display text-2xl font-bold">Editar proyecto</h1>
    </div>
    <ProjectForm v-if="project" :initial="initial" submit-label="Guardar" @submit="save" />
  </div>
</template>
