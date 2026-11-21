<script setup lang="ts">
const nav = [
  { label: 'Proyectos', icon: 'i-lucide-box', to: '/' },
  { label: 'Tablero', icon: 'i-lucide-kanban', to: '/board' },
  { label: 'Compras', icon: 'i-lucide-shopping-cart', to: '/shopping' },
  { label: 'Materiales', icon: 'i-lucide-disc-3', to: '/materials' },
  { label: 'Ajustes', icon: 'i-lucide-sliders-horizontal', to: '/settings' },
]
</script>

<template>
  <div class="min-h-dvh bg-(--ui-bg) text-default md:flex">
    <!-- Side navigation (tablet / desktop) -->
    <aside class="hidden md:flex w-56 shrink-0 flex-col gap-1 border-r border-default bg-default p-4">
      <AppLogo class="mb-6 px-2" />
      <UButton
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        :icon="item.icon"
        :label="item.label"
        variant="ghost"
        color="neutral"
        active-variant="soft"
        active-color="primary"
        class="justify-start"
      />
    </aside>

    <main class="flex-1 min-w-0 pb-24 md:pb-0">
      <slot />
    </main>

    <!-- Bottom navigation (phone) -->
    <nav class="md:hidden fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-default bg-default/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <NuxtLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted"
        active-class="text-primary font-semibold"
      >
        <UIcon :name="item.icon" class="size-6" />
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
