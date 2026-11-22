<script setup lang="ts">
// Import from a link: paste it or share it from Android (PWA share target → /import?url=…&text=…).
// Step 1 previews the page once (server side), step 2 saves the reviewed draft.
// When the platform challenges our server, the data comes from the user's browser (ADR 0007):
// the bookmarklet opens /import#link=…&d=<gzip+base64url JSON> (or ?link=…&error=…), or the user pastes it.
import type { FetchError } from 'ofetch'

const route = useRoute()
const toast = useToast()
const onError = useApiError()
const printer = useRuntimeConfig().public.printerModel

useHead({ title: 'Importar · 3tero' })

// Android may put the link in `url` or inside `text`
const shared = [route.query.url, route.query.text, route.query.title]
  .map(v => String(v ?? '').match(/https?:\/\/\S+/)?.[0])
  .find(Boolean) ?? ''
const link = ref(shared || String(route.query.link ?? ''))
const q = (k: string) => (typeof route.query[k] === 'string' ? route.query[k] as string : '')

type Failure = { code: string, message: string, url?: string, rawDataUrl?: string | null }
const loading = ref(false)
const failure = ref<Failure | null>(q('error') ? { code: 'browser', message: q('error'), url: q('link'), rawDataUrl: q('raw') || null } : null)
const pasted = ref('')
const preview = ref<ImportPreview | null>(null)

const form = reactive({
  title: '',
  description: '',
  priority: 'medium' as Priority,
  tags: [] as string[],
  profileId: null as string | null,
  images: [] as string[],
  materials: [] as number[],
})

function load() {
  if (link.value.trim()) request({ url: link.value })
}
function loadPasted() {
  if (pasted.value.trim()) request({ url: failure.value?.url || link.value, payload: pasted.value.trim() })
}

// Translation of the reviewed texts with the self-hosted LibreTranslate (ADR 0008); the original can be restored
const original = ref<{ title: string, description: string, tags: string[] } | null>(null)
const translating = ref(false)
async function translate() {
  translating.value = true
  try {
    const res = await $fetch('/api/translate', { method: 'POST', body: { title: form.title, description: form.description, tags: form.tags } })
    original.value = { title: form.title, description: form.description, tags: [...form.tags] }
    form.title = res.title || form.title
    form.description = res.description
    form.tags = [...new Set(res.tags.map(t => t.trim().toLowerCase().slice(0, 40)).filter(Boolean))]
  }
  catch (err) {
    onError(err, 'No se pudo traducir')
  }
  finally {
    translating.value = false
  }
}
function restoreOriginal() {
  if (!original.value) return
  Object.assign(form, { ...original.value, tags: [...original.value.tags] })
  original.value = null
}

async function request(body: { url: string, payload?: string }) {
  original.value = null
  loading.value = true
  failure.value = null
  preview.value = null
  try {
    const res = await $fetch('/api/import/preview', { method: 'POST', body })
    pasted.value = ''
    if (res.draft.sourceUrl) link.value = res.draft.sourceUrl
    preview.value = res
    const d = res.draft
    Object.assign(form, {
      title: d.title,
      description: d.description ?? '',
      tags: [...d.tags],
      profileId: d.selectedProfileId,
      images: [...d.images],
      materials: d.materials.map((_, i) => i),
    })
  }
  catch (err) {
    const e = err as FetchError
    failure.value = {
      code: e.data?.data?.code ?? 'network',
      message: e.data?.statusMessage ?? 'No se pudo cargar el enlace',
      url: e.data?.data?.url,
      rawDataUrl: e.data?.data?.rawDataUrl,
    }
  }
  finally {
    loading.value = false
  }
}

onMounted(async () => {
  // Bookmarklet data travels in the fragment: decode it, then drop it from the address bar
  const fragment = new URLSearchParams(location.hash.slice(1))
  const data = fragment.get('d')
  if (data) {
    const from = fragment.get('link') ?? ''
    history.replaceState(history.state, '', location.pathname)
    link.value = from
    try {
      await request({ url: from, payload: await decodeBookmarkletData(data) })
    }
    catch {
      failure.value = { code: 'browser', message: 'Los datos del marcador han llegado incompletos', url: from, rawDataUrl: fragment.get('raw') }
    }
  }
  else if (shared) load()
})

// The server can't read the model: offer the bookmarklet and "pegar datos"
const browserHelp = computed(() => !!failure.value?.rawDataUrl && ['blocked', 'unavailable', 'browser', 'bad-payload'].includes(failure.value.code))

const draft = computed(() => preview.value?.draft ?? null)
const thumb = (url: string) => (url.includes('bblmw.com') ? `${url.split('?')[0]}?x-oss-process=image/resize,w_400/format,webp` : url)
function toggleImage(url: string) {
  const i = form.images.indexOf(url)
  if (i >= 0) form.images.splice(i, 1)
  else form.images.push(url)
}
function toggleMaterial(i: number) {
  const at = form.materials.indexOf(i)
  if (at >= 0) form.materials.splice(at, 1)
  else form.materials.push(i)
}
// Keep the original order of selected images (first selected = cover)
const orderedImages = computed(() => (draft.value?.images ?? []).filter(u => form.images.includes(u)))

const saving = ref(false)
async function save() {
  if (!draft.value || !form.title.trim()) return
  saving.value = true
  try {
    const res = await $fetch.raw<ProjectDetail>('/api/import', {
      method: 'POST',
      body: {
        importer: draft.value.importer,
        externalId: draft.value.externalId,
        title: form.title,
        description: form.description,
        priority: form.priority,
        tags: form.tags,
        profileId: form.profileId,
        images: orderedImages.value,
        materials: form.materials,
      },
    })
    const failed = Number(res.headers.get('x-failed-images') ?? 0)
    toast.add({
      title: 'Proyecto importado',
      description: failed ? `${failed} foto${failed > 1 ? 's' : ''} no se pudo descargar` : 'Descarga el 3MF desde MakerWorld y súbelo en «Ficheros».',
      icon: 'i-lucide-download',
    })
    await navigateTo(`/projects/${res._data!.id}`, { replace: true })
  }
  catch (err) {
    onError(err, 'No se pudo importar')
  }
  finally {
    saving.value = false
  }
}

const priorityItems = PRIORITIES.map(p => ({ label: PRIORITY_META[p].label, value: p })).reverse()
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-5" :class="draft ? '' : 'pb-8'">
    <div class="flex items-center gap-2">
      <UButton icon="i-lucide-arrow-left" variant="ghost" color="neutral" aria-label="Volver" to="/" />
      <h1 class="font-display text-2xl font-bold">Importar proyecto</h1>
    </div>

    <form class="flex gap-2" @submit.prevent="load">
      <UInput
        v-model="link"
        icon="i-lucide-link"
        size="xl"
        placeholder="Pega el enlace de MakerWorld"
        class="min-w-0 flex-1"
        :disabled="loading"
      />
      <UButton type="submit" label="Cargar" size="xl" :loading="loading" :disabled="!link.trim()" />
    </form>
    <p v-if="!draft && !failure && !loading" class="-mt-2 text-sm text-muted">
      También puedes compartir un modelo desde la app de MakerWorld o desde Chrome y elegir 3tero,
      o usar el marcador «3tero» en la página del modelo.
    </p>

    <!-- Loading skeleton -->
    <div v-if="loading" class="flex flex-col gap-3" aria-busy="true">
      <div class="flex gap-2 overflow-hidden">
        <USkeleton v-for="i in 3" :key="i" class="size-28 shrink-0 rounded-2xl" />
      </div>
      <USkeleton class="h-10 w-full rounded-xl" />
      <USkeleton class="h-24 w-full rounded-xl" />
    </div>

    <!-- Failure: never retry automatically, offer manual entry -->
    <UAlert
      v-if="failure"
      :icon="failure.code === 'unsupported' ? 'i-lucide-globe' : 'i-lucide-circle-alert'"
      :color="failure.code === 'unsupported' ? 'neutral' : 'warning'"
      variant="soft"
      :title="failure.message"
      :description="failure.code === 'blocked' ? 'MakerWorld pide una verificación al servidor y no se intenta saltar. Impórtalo desde tu navegador o créalo a mano.' : failure.code === 'unavailable' ? 'Puede ser algo pasajero. Si sigue pasando, impórtalo desde tu navegador o créalo a mano.' : undefined"
      :actions="[{ label: 'Crear a mano', icon: 'i-lucide-pencil', to: { path: '/projects/new', query: failure.url ? { sourceUrl: failure.url } : {} } }]"
    />

    <!-- Import with the user's browser (ADR 0007): bookmarklet or pasted data -->
    <section v-if="failure && browserHelp" class="flex flex-col gap-3 rounded-2xl border border-default p-4">
      <h2 class="font-semibold">Importar desde tu navegador</h2>
      <p class="text-sm text-muted">
        Abre el modelo en MakerWorld y usa el marcador «3tero»
        (<ULink to="/settings#marcador" class="text-primary">cómo instalarlo</ULink>). O pega los datos a mano:
      </p>
      <ol class="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
        <li>Abre <ULink :to="failure.rawDataUrl!" target="_blank" class="text-primary">los datos del modelo</ULink> (verás mucho texto).</li>
        <li>Selecciona todo el texto y cópialo.</li>
        <li>Pégalo aquí:</li>
      </ol>
      <UTextarea v-model="pasted" :rows="3" placeholder="Pega aquí el texto copiado" class="w-full" :disabled="loading" />
      <UButton label="Usar estos datos" icon="i-lucide-clipboard-paste" class="self-start" :loading="loading" :disabled="!pasted.trim()" @click="loadPasted" />
    </section>

    <Transition name="expand">
      <div v-if="draft" class="flex flex-col gap-6">
        <UAlert
          v-if="preview?.existingProjectIds.length"
          icon="i-lucide-copy"
          color="warning"
          variant="soft"
          title="Ya lo importaste antes"
          description="Puedes abrir el proyecto existente o importarlo otra vez."
          :actions="[{ label: 'Abrir', to: `/projects/${preview.existingProjectIds[0]}`, variant: 'outline' }]"
        />

        <!-- Photos: tap to include / exclude -->
        <section v-if="draft.images.length" class="flex flex-col gap-2">
          <div class="flex items-baseline justify-between">
            <h2 class="text-sm font-semibold">Fotos</h2>
            <span class="text-xs text-muted">{{ form.images.length }} de {{ draft.images.length }} · la primera será la portada</span>
          </div>
          <div class="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            <button
              v-for="url in draft.images"
              :key="url"
              type="button"
              class="relative size-28 shrink-0 snap-start overflow-hidden rounded-2xl ring-2 transition"
              :class="form.images.includes(url) ? 'ring-primary' : 'opacity-40 ring-transparent'"
              :aria-pressed="form.images.includes(url)"
              :aria-label="form.images.includes(url) ? 'Quitar foto' : 'Incluir foto'"
              @click="toggleImage(url)"
            >
              <img :src="thumb(url)" alt="" referrerpolicy="no-referrer" loading="lazy" class="size-full object-cover">
              <span
                class="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full text-xs font-bold"
                :class="form.images.includes(url) ? 'bg-primary text-inverted' : 'bg-default/80 text-muted'"
              >
                <template v-if="form.images.includes(url)">{{ orderedImages.indexOf(url) + 1 }}</template>
                <UIcon v-else name="i-lucide-plus" />
              </span>
            </button>
          </div>
        </section>

        <section class="flex flex-col gap-4">
          <div v-if="preview?.canTranslate" class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="!original"
              label="Traducir al español"
              icon="i-lucide-languages"
              variant="soft"
              :loading="translating"
              @click="translate"
            />
            <UButton v-else label="Ver original" icon="i-lucide-undo-2" variant="outline" color="neutral" @click="restoreOriginal" />
            <span class="text-xs text-muted">{{ original ? 'Traducción automática: revísala antes de guardar' : translating ? 'Traduciendo… puede tardar hasta un minuto' : 'Título, descripción y etiquetas' }}</span>
          </div>
          <UFormField label="Título" required>
            <UInput v-model="form.title" size="xl" class="w-full" />
          </UFormField>
          <p class="-mt-2 text-xs text-muted">
            <span v-if="draft.designer">por {{ draft.designer }}</span>
            <span v-if="draft.license"> · {{ draft.license }}</span>
            · <ULink :to="draft.sourceUrl" target="_blank" class="text-primary">ver en MakerWorld</ULink>
          </p>
          <UFormField label="Prioridad">
            <URadioGroup v-model="form.priority" :items="priorityItems" orientation="horizontal" variant="table" />
          </UFormField>
          <UFormField label="Etiquetas" help="Vienen de MakerWorld: quita las que sobren">
            <UInputTags v-model="form.tags" class="w-full" add-on-blur add-on-paste />
          </UFormField>
        </section>

        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold">Perfil de impresión</h2>
          <template v-if="draft.profiles.length">
            <p class="-mt-1 text-xs text-muted">Sus gramos, tiempo y colores sirven de estimación hasta que subas el 3MF.</p>
            <ProfilePicker v-model="form.profileId" :profiles="draft.profiles" :printer="printer" />
          </template>
          <p v-else class="-mt-1 text-sm text-muted">
            Este modelo no tiene perfil para la {{ printer }}: se importa sin perfil. Cuando lo lamines
            para tu impresora, sube el 3MF en «Ficheros» y de ahí saldrán los gramos y el tiempo.
          </p>
        </section>

        <section v-if="draft.materials.length" class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold">Otros materiales que pide el diseño</h2>
          <button
            v-for="(m, i) in draft.materials"
            :key="i"
            type="button"
            class="flex items-center gap-3 rounded-2xl border border-default p-3 text-left"
            :aria-pressed="form.materials.includes(i)"
            @click="toggleMaterial(i)"
          >
            <UIcon :name="form.materials.includes(i) ? 'i-lucide-square-check' : 'i-lucide-square'" class="size-5 shrink-0" :class="form.materials.includes(i) ? 'text-primary' : 'text-muted'" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-medium">{{ m.name }}</span>
              <span class="truncate text-xs text-muted">{{ [m.category, m.spec].filter(Boolean).join(' · ') }}</span>
            </span>
            <span class="text-sm text-muted">×{{ m.quantity }}</span>
          </button>
        </section>

        <UFormField label="Descripción">
          <UTextarea v-model="form.description" :rows="5" autoresize :maxrows="14" class="w-full" />
        </UFormField>

        <div class="flex items-start gap-2 rounded-2xl bg-elevated/60 p-3 text-xs text-toned">
          <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />
          <span>MakerWorld pide iniciar sesión para descargar los ficheros. Descarga el 3MF desde su web o app y súbelo después en la pestaña «Ficheros».</span>
        </div>

        <!-- Sticky save bar -->
        <div class="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-default bg-default/95 px-4 py-3 backdrop-blur md:bottom-0">
          <UButton
            label="Importar proyecto"
            icon="i-lucide-download"
            size="lg"
            block
            :loading="saving"
            :disabled="!form.title.trim()"
            @click="save"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>
