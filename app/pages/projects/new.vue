<script setup lang="ts">
const onError = useApiError()
const route = useRoute()
// Pre-filled when coming from a failed import (?sourceUrl=…)
const initial = computed(() => (route.query.sourceUrl ? { sourceUrl: String(route.query.sourceUrl) } : undefined))

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
    <NuxtLink v-if="!initial" to="/import" class="flex items-center gap-3 rounded-2xl border border-dashed border-primary/60 bg-primary/5 p-3 text-sm transition-colors hover:bg-primary/10">
      <UIcon name="i-lucide-link" class="size-5 shrink-0 text-primary" />
      <span class="flex-1"><b>¿Es de MakerWorld?</b> Pega el enlace y se rellena solo.</span>
      <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
    </NuxtLink>
    <ProjectForm :initial="initial" submit-label="Crear proyecto" show-status @submit="create" />
  </div>
</template>
