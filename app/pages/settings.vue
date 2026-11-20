<script setup lang="ts">
const colorMode = useColorMode()
const { data: storage } = await useFetch('/api/settings/storage', { key: 'storage' })
const { data: archived } = await useFetch('/api/projects', { query: { archived: 'true' }, key: 'archived' })
const pct = computed(() => (storage.value ? Math.min(100, (storage.value.usedBytes / storage.value.quotaBytes) * 100) : 0))
const modes = [
  { label: 'Sistema', value: 'system', icon: 'i-lucide-monitor' },
  { label: 'Claro', value: 'light', icon: 'i-lucide-sun' },
  { label: 'Oscuro', value: 'dark', icon: 'i-lucide-moon' },
]
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-5">
    <h1 class="font-display text-2xl font-bold">Ajustes</h1>

    <UCard>
      <template #header><h2 class="font-semibold">Apariencia</h2></template>
      <URadioGroup v-model="colorMode.preference" :items="modes" orientation="horizontal" variant="table" />
    </UCard>

    <UCard v-if="storage">
      <template #header><h2 class="font-semibold">Almacenamiento</h2></template>
      <div class="flex flex-col gap-2">
        <UProgress :model-value="pct" :color="pct > 90 ? 'error' : pct > 75 ? 'warning' : 'primary'" />
        <p class="text-sm text-muted">{{ formatBytes(storage.usedBytes) }} de {{ formatBytes(storage.quotaBytes) }}</p>
        <ul class="mt-2 grid grid-cols-2 gap-1 text-sm text-muted">
          <li>Máx. por modelo: {{ formatBytes(storage.maxModelBytes) }}</li>
          <li>Máx. por imagen: {{ formatBytes(storage.maxImageBytes) }}</li>
          <li>Ficheros por proyecto: {{ storage.maxFilesPerProject }}</li>
          <li>Imágenes por proyecto: {{ storage.maxImagesPerProject }}</li>
        </ul>
      </div>
    </UCard>

    <UCard>
      <template #header><h2 class="font-semibold">Proyectos archivados</h2></template>
      <div v-if="archived?.length" class="flex flex-col divide-y divide-default">
        <NuxtLink v-for="p in archived" :key="p.id" :to="`/projects/${p.id}`" class="flex items-center justify-between py-2 text-sm hover:text-primary">
          {{ p.title }}
          <UIcon name="i-lucide-chevron-right" />
        </NuxtLink>
      </div>
      <p v-else class="text-sm text-muted">No hay proyectos archivados.</p>
    </UCard>
  </div>
</template>
