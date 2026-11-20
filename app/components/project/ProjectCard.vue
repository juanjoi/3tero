<script setup lang="ts">
defineProps<{ project: ProjectListItem }>()
</script>

<template>
  <NuxtLink
    :to="`/projects/${project.id}`"
    class="group flex flex-col overflow-hidden rounded-2xl border border-default bg-default shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <div class="relative aspect-[4/3] overflow-hidden">
      <img
        v-if="project.coverUrl"
        :src="project.coverUrl"
        :alt="project.title"
        loading="lazy"
        class="size-full object-cover transition duration-300 group-hover:scale-105"
        :style="{ viewTransitionName: `cover-${project.id}` }"
      >
      <CoverPlaceholder v-else />
      <StatusBadge :status="project.status" class="absolute left-2.5 top-2.5" />
      <PriorityDot :priority="project.priority" class="absolute right-3 top-3" />
    </div>
    <div class="flex flex-1 flex-col gap-1.5 p-3">
      <span class="line-clamp-2 text-sm font-semibold leading-snug">{{ project.title }}</span>
      <span v-if="project.tags.length" class="truncate text-xs text-muted">
        {{ project.tags.map(t => t.name).join(' · ') }}
      </span>
      <div class="mt-auto flex items-center justify-between pt-1">
        <ColorSwatches :colors="project.colors" />
        <span class="text-xs font-semibold">{{ formatEuro(project.estCost) }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
