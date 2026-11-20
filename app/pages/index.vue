<script setup lang="ts">
const filters = [
  { id: 'all', label: 'Todos' },
  { id: 'modeling', label: 'Modelado' },
  { id: 'sliced', label: 'Laminado' },
  { id: 'printed', label: 'Impreso' },
] as const
const active = ref<(typeof filters)[number]['id']>('all')
const q = ref('')
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-5 flex flex-col gap-4">
    <header class="flex items-center justify-between md:hidden">
      <AppLogo />
    </header>

    <UInput v-model="q" icon="i-lucide-search" size="xl" placeholder="Buscar proyectos, etiquetas…" class="w-full" />

    <div class="flex gap-2 overflow-x-auto">
      <UButton
        v-for="f in filters"
        :key="f.id"
        :label="f.label"
        :variant="active === f.id ? 'solid' : 'outline'"
        :color="active === f.id ? 'neutral' : 'neutral'"
        class="rounded-full shrink-0"
        @click="active = f.id"
      />
    </div>

    <UEmpty
      icon="i-lucide-box"
      title="Todavía no hay proyectos"
      description="Crea tu primer proyecto o comparte un enlace de MakerWorld con Layra."
      :actions="[{ label: 'Importar desde URL', icon: 'i-lucide-link', to: '/import' }, { label: 'Nuevo proyecto', icon: 'i-lucide-plus', variant: 'outline' }]"
      class="mt-10"
    />

    <UButton
      to="/import"
      icon="i-lucide-plus"
      size="xl"
      aria-label="Nuevo proyecto"
      class="md:hidden fixed right-5 bottom-24 rounded-2xl shadow-lg size-14 justify-center"
    />
  </div>
</template>
