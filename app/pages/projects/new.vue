<script setup lang="ts">
const onError = useApiError()

async function create(data: ProjectCreateInput) {
  try {
    const project = await $fetch('/api/projects', { method: 'POST', body: data })
    await navigateTo(`/projects/${project.id}`, { replace: true })
  }
  catch (err) {
    onError(err, 'No se pudo crear el proyecto')
  }
}
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5">
    <div class="flex items-center gap-2">
      <UButton icon="i-lucide-arrow-left" variant="ghost" color="neutral" aria-label="Volver" @click="$router.back()" />
      <h1 class="font-display text-2xl font-bold">Nuevo proyecto</h1>
    </div>
    <ProjectForm submit-label="Crear proyecto" show-status @submit="create" />
  </div>
</template>
