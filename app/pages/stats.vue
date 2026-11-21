<script setup lang="ts">
// Family statistics. Charts are plain HTML/CSS bars: single series in the primary hue,
// identity of filaments carried by their own colour swatch next to the label.
useHead({ title: 'Estadísticas · 3tero' })
const { data: s } = await useFetch('/api/stats')

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthLabel = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1]!
const maxSpent = computed(() => Math.max(...(s.value?.monthly ?? []).map(m => m.spent), 0))
const maxGrams = computed(() => Math.max(...(s.value?.filaments ?? []).map(f => f.grams), 0))
const hovered = ref<string | null>(null)
const showTable = ref(false)
</script>

<template>
  <div v-if="s" class="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-5">
    <h1 class="font-display text-2xl font-bold">Estadísticas</h1>

    <!-- Headline numbers -->
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div class="flex flex-col rounded-2xl border border-default p-3">
        <span class="text-[11px] font-medium text-muted">Gastado en filamento</span>
        <span class="font-display text-2xl font-bold">{{ formatEuro(s.prints.spent) }}</span>
      </div>
      <div class="flex flex-col rounded-2xl border border-default p-3">
        <span class="text-[11px] font-medium text-muted">Impresiones</span>
        <span class="font-display text-2xl font-bold">{{ s.prints.total }}</span>
        <span v-if="s.prints.successRate !== null" class="text-xs text-muted">{{ s.prints.successRate }} % correctas</span>
      </div>
      <div class="flex flex-col rounded-2xl border border-default p-3">
        <span class="text-[11px] font-medium text-muted">Filamento usado</span>
        <span class="font-display text-2xl font-bold">{{ s.prints.grams >= 1000 ? `${(s.prints.grams / 1000).toFixed(2)} kg` : `${s.prints.grams} g` }}</span>
      </div>
      <div class="flex flex-col rounded-2xl border border-default p-3">
        <span class="text-[11px] font-medium text-muted">Horas de impresora</span>
        <span class="font-display text-2xl font-bold">{{ formatMinutes(s.prints.minutes) }}</span>
      </div>
    </div>

    <!-- Projects by status -->
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold">Proyectos <span class="font-normal text-muted">({{ s.projects.projects }} activos, {{ s.projects.archived }} archivados)</span></h2>
      <div class="grid grid-cols-3 gap-2">
        <NuxtLink
          v-for="st in PROJECT_STATUSES"
          :key="st"
          :to="{ path: '/', query: { status: st } }"
          class="flex items-center gap-2 rounded-2xl border border-default p-3 transition-colors hover:bg-elevated/50"
        >
          <UIcon :name="STATUS_META[st].icon" class="size-5 shrink-0 text-muted" />
          <span class="flex flex-col">
            <span class="font-display text-xl font-bold">{{ s.projects[st] }}</span>
            <span class="text-xs text-muted">{{ STATUS_META[st].label }}</span>
          </span>
        </NuxtLink>
      </div>
    </section>

    <!-- Monthly spend: single series, one hue -->
    <section class="flex flex-col gap-2">
      <div class="flex items-baseline justify-between">
        <h2 class="text-sm font-semibold">Gasto por mes <span class="font-normal text-muted">· últimos 12 meses</span></h2>
        <UButton :label="showTable ? 'Ver gráfico' : 'Ver tabla'" variant="link" color="neutral" size="xs" @click="showTable = !showTable" />
      </div>
      <div v-if="!showTable" class="relative flex h-44 items-end gap-0.5 rounded-2xl border border-default px-2 pb-6 pt-6" role="img" :aria-label="`Gasto mensual, máximo ${formatEuro(maxSpent)}`">
        <div
          v-for="m in s.monthly"
          :key="m.month"
          class="group relative flex h-full flex-1 flex-col items-center justify-end"
          @mouseenter="hovered = m.month"
          @mouseleave="hovered = null"
          @focus="hovered = m.month"
          @blur="hovered = null"
          tabindex="0"
        >
          <div
            class="w-full max-w-8 rounded-t-[4px] transition-[height,opacity] duration-500"
            :class="hovered && hovered !== m.month ? 'bg-primary/50' : 'bg-primary'"
            :style="{ height: maxSpent ? `${Math.max((m.spent / maxSpent) * 100, m.spent ? 3 : 0)}%` : '0%' }"
          />
          <span class="absolute -bottom-5 text-[10px] text-muted">{{ monthLabel(m.month) }}</span>
          <div
            v-if="hovered === m.month"
            class="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg border border-default bg-default px-2 py-1 text-xs shadow-sm"
          >
            <b>{{ monthLabel(m.month) }} {{ m.month.slice(0, 4) }}</b> · {{ formatEuro(m.spent) }} · {{ m.grams }} g · {{ m.prints }} impr.
          </div>
        </div>
        <div class="pointer-events-none absolute inset-x-2 bottom-6 border-t border-default" />
        <span v-if="maxSpent" class="absolute left-3 top-1.5 text-[10px] text-muted">máx. {{ formatEuro(maxSpent) }}</span>
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-muted"><th class="py-1 font-medium">Mes</th><th class="font-medium">Impresiones</th><th class="font-medium">Gramos</th><th class="text-right font-medium">Gasto</th></tr>
        </thead>
        <tbody>
          <tr v-for="m in s.monthly" :key="m.month" class="border-t border-default">
            <td class="py-1.5">{{ monthLabel(m.month) }} {{ m.month.slice(0, 4) }}</td><td>{{ m.prints }}</td><td>{{ m.grams }} g</td><td class="text-right">{{ formatEuro(m.spent) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Filament usage: horizontal bars, identity = swatch + name -->
    <section v-if="s.filaments.length" class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold">Filamento más usado</h2>
      <div class="flex flex-col gap-2.5 rounded-2xl border border-default p-3">
        <div v-for="f in s.filaments" :key="f.id" class="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" :title="`${f.type} ${f.colorName}: ${f.grams} g · ${formatEuro(f.spent)}`">
          <span class="flex min-w-0 items-center gap-2">
            <span class="size-3 shrink-0 rounded-full ring-1 ring-accented" :style="{ background: f.colorHex }" />
            <span class="truncate">{{ f.type }} · {{ f.colorName }}</span>
          </span>
          <div class="h-2.5 overflow-hidden rounded-full bg-elevated">
            <div class="h-full rounded-full bg-primary transition-[width] duration-500" :style="{ width: `${maxGrams ? (f.grams / maxGrams) * 100 : 0}%` }" />
          </div>
          <span class="text-xs tabular-nums text-toned">{{ f.grams }} g</span>
        </div>
      </div>
    </section>

    <!-- Print results -->
    <section v-if="s.prints.total" class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold">Resultado de las impresiones</h2>
      <div class="grid grid-cols-3 gap-2 text-sm">
        <div class="flex items-center gap-2 rounded-2xl border border-default p-3"><UIcon name="i-lucide-check" class="size-5 text-primary" />{{ s.prints.success }} correctas</div>
        <div class="flex items-center gap-2 rounded-2xl border border-default p-3"><UIcon name="i-lucide-circle-dashed" class="size-5 text-warning" />{{ s.prints.partial }} parciales</div>
        <div class="flex items-center gap-2 rounded-2xl border border-default p-3"><UIcon name="i-lucide-x" class="size-5 text-error" />{{ s.prints.failed }} fallidas</div>
      </div>
    </section>

    <section v-if="s.tags.length" class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold">Etiquetas más usadas</h2>
      <div class="flex flex-wrap gap-1.5">
        <NuxtLink v-for="t in s.tags" :key="t.name" :to="{ path: '/', query: { tags: t.name } }">
          <UBadge :label="`#${t.name} · ${t.count}`" variant="soft" color="neutral" class="rounded-full" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
