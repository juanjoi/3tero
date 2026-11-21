<script setup lang="ts">
const colorMode = useColorMode()
const { data: storage } = await useFetch('/api/settings/storage', { key: 'storage' })
const { data: archived } = await useFetch('/api/projects', { query: { archived: 'true' }, key: 'archived' })
const pct = computed(() => (storage.value ? Math.min(100, (storage.value.usedBytes / storage.value.quotaBytes) * 100) : 0))
// Backup / restore
const toast = useToast()
const onError = useApiError()
const { upload, progress, uploading } = useUpload()
const backupInput = useTemplateRef<HTMLInputElement>('backupInput')
const backupFile = ref<File | null>(null)
async function restore() {
  if (!backupFile.value) return
  try {
    const res = await upload<{ projects: number, files: number, exportedAt: string }>('/api/backup/restore', [backupFile.value], { confirm: 'REPLACE' })
    toast.add({
      title: 'Copia restaurada',
      description: `${res.projects} proyectos y ${res.files} ficheros (copia del ${new Date(res.exportedAt).toLocaleDateString('es-ES')})`,
      icon: 'i-lucide-archive-restore',
    })
    backupFile.value = null
    await refreshNuxtData()
  }
  catch (err) { onError(err, 'No se pudo restaurar la copia') }
}

const modes = [
  { label: 'Sistema', value: 'system', icon: 'i-lucide-monitor' },
  { label: 'Claro', value: 'light', icon: 'i-lucide-sun' },
  { label: 'Oscuro', value: 'dark', icon: 'i-lucide-moon' },
]
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-5">
    <h1 class="font-display text-2xl font-bold">Ajustes</h1>

    <NuxtLink to="/stats" class="flex items-center gap-3 rounded-2xl border border-default p-4 transition-colors hover:bg-elevated/50 md:hidden">
      <UIcon name="i-lucide-chart-column" class="size-6 text-primary" />
      <span class="flex flex-1 flex-col">
        <span class="font-semibold">Estadísticas</span>
        <span class="text-sm text-muted">Gasto, filamento usado e impresiones</span>
      </span>
      <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
    </NuxtLink>

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
      <template #header><h2 class="font-semibold">Copia de seguridad</h2></template>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted">
          Un único ZIP con todos los proyectos, fotos, ficheros, impresiones y catálogo.
          Sirve para guardarlo fuera del mini PC o para llevar Layra a otra máquina.
        </p>
        <UButton to="/api/backup" external download icon="i-lucide-download" label="Descargar copia" class="self-start" />

        <div class="flex flex-col gap-2 border-t border-default pt-4">
          <span class="text-sm font-medium">Restaurar una copia</span>
          <p class="text-xs text-muted">Reemplaza <b>todos</b> los datos actuales por los de la copia.</p>
          <div class="flex flex-wrap items-center gap-2">
            <UButton icon="i-lucide-file-archive" :label="backupFile ? backupFile.name : 'Elegir fichero .zip'" variant="outline" color="neutral" :disabled="uploading" @click="backupInput?.click()" />
            <ConfirmButton
              v-if="backupFile && !uploading"
              icon="i-lucide-archive-restore"
              label="Restaurar"
              confirm-label="Se borrará todo lo actual. ¿Seguro?"
              @confirm="restore"
            />
          </div>
          <UProgress v-if="uploading" :model-value="progress" size="sm" />
          <input ref="backupInput" type="file" accept=".zip,application/zip" class="hidden" @change="e => { backupFile = (e.target as HTMLInputElement).files?.[0] ?? null; (e.target as HTMLInputElement).value = '' }">
        </div>
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
