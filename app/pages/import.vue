<script setup lang="ts">
// Entry point of the PWA share target (see nuxt.config.ts → pwa.manifest.share_target).
// Android may put the link in `url` or inside `text`, so we look in all of them.
const route = useRoute()
const shared = computed(() => {
  const candidates = [route.query.url, route.query.text, route.query.title].map(v => String(v ?? ''))
  for (const c of candidates) {
    const m = c.match(/https?:\/\/\S+/)
    if (m) return m[0]
  }
  return ''
})
const url = ref(shared.value)
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-5 flex flex-col gap-4">
    <h1 class="font-display text-2xl font-bold">Importar proyecto</h1>
    <UInput v-model="url" icon="i-lucide-link" size="xl" placeholder="https://makerworld.com/es/models/…" class="w-full" />
    <UAlert
      icon="i-lucide-construction"
      color="neutral"
      variant="soft"
      title="En construcción"
      description="La importación desde MakerWorld llegará en la fase 5 (ver docs/PROJECT_PLAN.md)."
    />
  </div>
</template>
