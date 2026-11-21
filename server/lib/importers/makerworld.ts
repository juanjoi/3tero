// MakerWorld importer. Verified behaviour and field map: docs/research/makerworld.md.
// User-triggered only, one design request per import, never bypasses anti-bot protections (ADR 0005).
import type { FetchOptions, ImportedMaterial, ImportedProfile, ImportedProjectDraft, ImportResult, ProjectImporter } from './types'
import { ImportBlockedError, ImportNotFoundError } from './types'
import { decodeEntities, htmlToText, normalizeHex, samePrinter, toNumber, uniqBy } from './text'

const BASE = 'https://makerworld.com'
const URL_RE = /makerworld\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?models\/(\d+)[^#\s]*(?:#profileId-(\d+))?/i
const MAX_TAGS = 12
const MAX_IMAGES = 12
/** Image hosts we accept from MakerWorld payloads (public CDN, see research). */
export const MAKERWORLD_IMAGE_HOSTS = ['makerworld.bblmw.com', 'public-cdn.bblmw.com', 'makerworld.bblmw.cn']

export function parseMakerWorldUrl(input: string): { designId: string, instanceId: string | null } | null {
  const m = input.match(URL_RE)
  return m ? { designId: m[1]!, instanceId: m[2] ?? null } : null
}

/** Maps Bambu store BOM entries to a material category of our catalogue (best effort, editable later). */
export function guessCategory(text: string) {
  const t = text.toLowerCase()
  if (/magnet|imán|iman/.test(t)) return 'Imanes'
  if (/screw|bolt|nut|washer|tornillo|tuerca/.test(t)) return 'Tornillería'
  if (/insert/.test(t)) return 'Insertos'
  if (/adhesive|glue|tape|adhesivo/.test(t)) return 'Adhesivos'
  if (/bearing|rodamiento/.test(t)) return 'Rodamientos'
  if (/motor|servo/.test(t)) return 'Motores'
  if (/led|sensor|cable|switch|battery|pcb|esp32|arduino/.test(t)) return 'Electrónica'
  return 'Otros'
}

/** Pure mapping of the design JSON (API root or __NEXT_DATA__ design) to a draft. */
export function mapDesign(D: any, opts: { printer: string, instanceId?: string | null, via?: ImportedProjectDraft['via'] }): ImportedProjectDraft {
  if (!D || typeof D !== 'object' || D.id == null || !D.title) throw new ImportNotFoundError('Unexpected MakerWorld payload')

  const order: number[] = D.designExtension?.instances_order ?? []
  const rank = (id: number) => {
    const i = order.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const instances: any[] = [...(D.instances ?? [])].sort((a, b) => rank(a.id) - rank(b.id))

  const profiles: ImportedProfile[] = instances.map((P) => {
    const mi = P.extention?.modelInfo ?? {}
    const main: string | null = mi.compatibility?.devProductName ?? null
    // Figures re-sliced by MakerWorld for our printer, when the profile targets another one
    const resliced = (P.extention?.otherCompatibilityModelInfo ?? []).find((o: any) => samePrinter(o.devProductName, opts.printer))
    const native = samePrinter(main, opts.printer)
    const src = !native && resliced ? resliced : P
    const filaments = (src.instanceFilaments ?? P.instanceFilaments ?? [])
      .map((f: any) => ({ type: String(f.type ?? '').trim(), colorHex: normalizeHex(f.color), grams: toNumber(f.usedG) }))
      .filter((f: any) => f.type && f.colorHex)
    const seconds = toNumber(src.prediction)
    return {
      externalId: String(P.id),
      name: String(P.title ?? `Perfil ${P.id}`).trim(),
      printer: main,
      fit: native ? 'native' : resliced ? 'resliced' : 'other',
      minutes: seconds !== null ? Math.round(seconds / 60) : null,
      grams: toNumber(src.weight),
      plates: Array.isArray(mi.plates) ? mi.plates.length : null,
      needAms: !!P.needAms,
      filaments,
      coverUrl: typeof P.cover === 'string' ? P.cover : null,
    }
  })

  // Preselection: profile in the URL > first one sliced for our printer > re-sliced for it > platform default
  const selected = profiles.find(p => p.externalId === opts.instanceId)
    ?? profiles.find(p => p.fit === 'native')
    ?? profiles.find(p => p.externalId === String(D.defaultInstanceId) && p.fit === 'resliced')
    ?? profiles.find(p => p.fit === 'resliced')
    ?? profiles.find(p => p.externalId === String(D.defaultInstanceId))
    ?? profiles[0]

  const images = uniqBy(
    [D.coverUrl, ...(D.designExtension?.design_pictures ?? []).map((p: any) => p?.url)]
      .filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u)),
    u => u.split('?')[0]!,
  ).slice(0, MAX_IMAGES)

  const tags = uniqBy(
    (D.tags ?? []).map((t: unknown) => String(t).trim().toLowerCase()).filter((t: string) => t && t.length <= 40),
    (t: string) => t.replace(/[^a-z0-9áéíóúñü]/g, ''),
  ).slice(0, MAX_TAGS) as string[]

  const materials: ImportedMaterial[] = (D.designExtension?.boms ?? [])
    .filter((b: any) => b?.displayParentTitle || b?.parentTitle)
    .map((b: any) => {
      const name = String(b.displayParentTitle ?? b.parentTitle).trim()
      const spec = String(b.displayTitle ?? b.title ?? '').trim() || null
      return {
        name: name.slice(0, 200),
        spec: spec && spec !== name ? spec.slice(0, 200) : null,
        url: typeof b.url === 'string' && /^https:\/\//.test(b.url) ? b.url : null,
        quantity: Math.max(1, Math.round(toNumber(b.quantity) ?? 1)),
        category: guessCategory(`${name} ${spec ?? ''}`),
      }
    })

  const creator = D.designCreator
  return {
    importer: 'makerworld',
    externalId: String(D.id),
    sourceUrl: `${BASE}/en/models/${D.id}${D.slug ? `-${D.slug}` : ''}`,
    title: String(D.title).trim().slice(0, 200),
    description: D.summary ? htmlToText(String(D.summary)) || null : null,
    images,
    tags,
    designer: creator?.name ? String(creator.name) : null,
    designerUrl: creator?.handle ? `${BASE}/en/@${encodeURIComponent(creator.handle)}` : null,
    license: D.license ? String(D.license) : null,
    profiles,
    selectedProfileId: selected?.externalId ?? null,
    materials,
    via: opts.via ?? 'api',
  }
}

/** `__NEXT_DATA__` of the model page holds the same design object as the API. */
export function extractNextDataDesign(html: string): unknown | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  try {
    return JSON.parse(m[1]!)?.props?.pageProps?.design ?? null
  }
  catch {
    return null
  }
}

/** Last resort: Open Graph tags give title, plain description and cover. */
export function extractOpenGraph(html: string, designId: string): ImportedProjectDraft | null {
  const meta = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i')
    const re2 = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, 'i')
    const v = html.match(re)?.[1] ?? html.match(re2)?.[1]
    return v ? decodeEntities(v).trim() : null
  }
  const title = meta('og:title')
  if (!title) return null
  const image = meta('og:image')
  return {
    importer: 'makerworld',
    externalId: designId,
    sourceUrl: `${BASE}/en/models/${designId}`,
    title: title.replace(/\s*[-|]\s*(Free 3D Print Model|MakerWorld).*$/i, '').slice(0, 200),
    description: meta('og:description'),
    images: image && /^https:\/\//.test(image) ? [image] : [],
    tags: [],
    designer: null,
    designerUrl: null,
    license: null,
    profiles: [],
    selectedProfileId: null,
    materials: [],
    via: 'open-graph',
  }
}

export function looksBlocked(status: number, headers: Headers, body: string) {
  if (headers.get('cf-mitigated')) return true
  if (status === 429 || status === 503) return true
  if (status === 403 && /cf_chl_opt|Just a moment|challenge-platform/i.test(body)) return true
  return /cf_chl_opt|<title>Just a moment/i.test(body)
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
  'Accept-Language': 'en,es;q=0.8',
}

async function get(url: string, accept: string, opts: FetchOptions) {
  const doFetch = opts.fetch ?? globalThis.fetch
  const res = await doFetch(url, { headers: { ...HEADERS, Accept: accept }, redirect: 'follow', signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000) })
  const body = await res.text()
  if (looksBlocked(res.status, res.headers, body)) throw new ImportBlockedError(`MakerWorld blocked the request (${res.status})`)
  return { status: res.status, body }
}

async function fetchMakerWorld(url: URL, opts: FetchOptions): Promise<ImportResult> {
  const parsed = parseMakerWorldUrl(url.href)
  if (!parsed) throw new ImportNotFoundError('Not a MakerWorld model URL')
  const { designId, instanceId } = parsed

  // 1. Design API (richest: all profiles)
  try {
    const api = await get(`${BASE}/api/v1/design-service/design/${designId}`, 'application/json', opts)
    if (api.status === 200) {
      const raw = JSON.parse(api.body)
      return { draft: mapDesign(raw, { printer: opts.printer, instanceId, via: 'api' }), raw }
    }
    if (api.status === 404) throw new ImportNotFoundError('Model not found')
  }
  catch (err) {
    if (err instanceof ImportBlockedError || err instanceof ImportNotFoundError) throw err
    // network/JSON errors → try the HTML page
  }

  // 2. Model page: __NEXT_DATA__, then Open Graph
  const page = await get(`${BASE}/en/models/${designId}`, 'text/html', opts)
  if (page.status === 404) throw new ImportNotFoundError('Model not found')
  if (page.status !== 200) throw new ImportNotFoundError(`Unexpected status ${page.status}`)
  const design = extractNextDataDesign(page.body)
  if (design) {
    try {
      return { draft: mapDesign(design, { printer: opts.printer, instanceId, via: 'next-data' }), raw: design }
    }
    catch { /* fall through to Open Graph */ }
  }
  const og = extractOpenGraph(page.body, designId)
  if (og) return { draft: og, raw: { openGraph: true, designId } }
  throw new ImportNotFoundError('Could not read the model page')
}

export const makerWorldImporter: ProjectImporter = {
  id: 'makerworld',
  label: 'MakerWorld',
  matches: url => /(^|\.)makerworld\.com$/i.test(url.hostname) && !!parseMakerWorldUrl(url.href),
  fetch: fetchMakerWorld,
}
