<script setup lang="ts">
const props = defineProps<{ project: ProjectDetail }>()
const emit = defineEmits<{ update: [project: ProjectDetail] }>()
const onError = useApiError()
const { upload, progress, uploading } = useUpload()
const input = useTemplateRef<HTMLInputElement>('input')

const images = computed(() => {
  const list = [...props.project.images]
  const cover = list.findIndex(i => i.id === props.project.coverImageId)
  if (cover > 0) list.unshift(...list.splice(cover, 1))
  return list
})
const current = ref(0)
watch(() => images.value.length, () => (current.value = Math.min(current.value, Math.max(images.value.length - 1, 0))))
const active = computed(() => images.value[current.value])

async function onFiles(e: Event) {
  const files = [...((e.target as HTMLInputElement).files ?? [])]
  ;(e.target as HTMLInputElement).value = ''
  if (!files.length) return
  try {
    emit('update', await upload<ProjectDetail>(`/api/projects/${props.project.id}/images`, files))
    current.value = images.value.length - 1
  }
  catch (err) {
    onError(err, 'No se pudo subir la imagen')
  }
}

async function setCover() {
  if (!active.value) return
  try {
    emit('update', await $fetch(`/api/projects/${props.project.id}`, { method: 'PATCH', body: { coverImageId: active.value.id } }))
    current.value = 0
  }
  catch (err) { onError(err) }
}

async function remove() {
  if (!active.value) return
  try {
    emit('update', await $fetch(`/api/projects/${props.project.id}/images/${active.value.id}`, { method: 'DELETE' }))
  }
  catch (err) { onError(err) }
}

</script>

<template>
  <div class="relative aspect-[4/3] w-full overflow-hidden bg-elevated md:aspect-[16/9] md:rounded-3xl">
    <Transition name="fade" mode="out-in">
      <img
        v-if="active"
        :key="active.id"
        :src="active.url"
        :alt="project.title"
        class="size-full object-cover"
        :style="current === 0 ? { viewTransitionName: `cover-${project.id}` } : undefined"
      >
      <button v-else type="button" class="size-full" @click="input?.click()">
        <div class="flex size-full flex-col items-center justify-center gap-2 text-muted">
          <UIcon name="i-lucide-camera" class="size-10" />
          <span class="text-sm font-medium">Añadir fotos</span>
        </div>
      </button>
    </Transition>

    <div v-if="images.length > 1" class="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
      <button
        v-for="(img, i) in images"
        :key="img.id"
        type="button"
        :aria-label="`Foto ${i + 1}`"
        class="h-1.5 rounded-full bg-white/90 shadow transition-all"
        :class="i === current ? 'w-5 opacity-100' : 'w-1.5 opacity-60'"
        @click="current = i"
      />
    </div>
    <template v-if="images.length > 1">
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="soft" aria-label="Anterior" class="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-default/80" @click="current = (current - 1 + images.length) % images.length" />
      <UButton icon="i-lucide-chevron-right" color="neutral" variant="soft" aria-label="Siguiente" class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-default/80" @click="current = (current + 1) % images.length" />
    </template>

    <div class="absolute right-3 top-3 flex gap-2">
      <!-- Direct photo actions on the hero (no menus) -->
      <UButton v-if="active && current !== 0" icon="i-lucide-star" color="neutral" variant="soft" class="rounded-xl bg-default/90" aria-label="Usar como portada" @click="setCover" />
      <ConfirmButton v-if="active" icon="i-lucide-trash-2" confirm-label="¿Borrar foto?" class="rounded-xl bg-default/90" @confirm="remove" />
      <UButton icon="i-lucide-image-plus" color="neutral" variant="soft" class="rounded-xl bg-default/90" aria-label="Añadir fotos" @click="input?.click()" />
    </div>

    <div v-if="uploading" class="absolute inset-x-0 bottom-0 bg-default/90 p-3">
      <UProgress :model-value="progress" size="sm" />
    </div>
    <input ref="input" type="file" accept="image/*" multiple class="hidden" @change="onFiles">
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
