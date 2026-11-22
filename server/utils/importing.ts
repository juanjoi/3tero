// Server side of external imports: short-lived cache of fetched drafts and remote image download.
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { extractUrl, findImporter, ImportBlockedError, ImportNotFoundError, ImportUnavailableError, MAKERWORLD_IMAGE_HOSTS, resolveShareLink } from '../lib/importers'
import type { ImportedProjectDraft, ImportResult } from '../lib/importers'

const TTL_MS = 30 * 60 * 1000
const MAX_ENTRIES = 30
/** Raw design JSON sent by the user's browser (MakerWorld designs are ~0.5 MB). */
export const MAX_IMPORT_PAYLOAD_CHARS = 5_000_000
const cache = new Map<string, ImportResult & { at: number }>()

const cacheKey = (importer: string, externalId: string) => `${importer}:${externalId}`

/** Draft fetched by a preview, required to commit (so commit never hits the platform again). */
export function getCachedImport(importer: string, externalId: string) {
  const hit = cache.get(cacheKey(importer, externalId))
  if (!hit || Date.now() - hit.at > TTL_MS) return null
  return hit
}

function remember(result: ImportResult) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!)
  cache.set(cacheKey(result.draft.importer, result.draft.externalId), { ...result, at: Date.now() })
}

async function withDuplicates(draft: ImportedProjectDraft) {
  const existing = await useDb().select({ id: schema.projectSources.projectId }).from(schema.projectSources)
    .where(and(eq(schema.projectSources.importer, draft.importer), eq(schema.projectSources.externalId, draft.externalId)))
  return { draft, existingProjectIds: existing.map(e => e.id), canTranslate: !!useRuntimeConfig().translateUrl }
}

async function importerFor(text: string) {
  const parsed = extractUrl(text)
  if (!parsed) throw createError({ statusCode: 422, statusMessage: 'No se ha encontrado ningún enlace', data: { code: 'no-url' } })
  const url = await resolveShareLink(parsed)
  const importer = findImporter(url)
  if (!importer) {
    throw createError({ statusCode: 422, statusMessage: 'Esta web todavía no se puede importar', data: { code: 'unsupported', url: url.href } })
  }
  return { url, importer }
}

/** Fetches (or reuses) the draft for a pasted/shared text containing a link. */
export async function previewImport(text: string) {
  const { url, importer } = await importerFor(text)
  const data = { url: url.href, rawDataUrl: importer.rawDataUrl?.(url) ?? null }

  let result: ImportResult
  try {
    result = await importer.fetch(url, { printer: useRuntimeConfig().public.printerModel })
  }
  catch (err) {
    console.warn(`[import] ${importer.id} failed`, url.href, `${(err as Error).name}: ${(err as Error).message}`)
    if (err instanceof ImportBlockedError) {
      throw createError({ statusCode: 502, statusMessage: `${importer.label} no deja que el servidor lea el modelo`, data: { code: 'blocked', ...data } })
    }
    if (err instanceof ImportUnavailableError) {
      throw createError({ statusCode: 503, statusMessage: `${importer.label} no responde ahora. Inténtalo más tarde.`, data: { code: 'unavailable', ...data } })
    }
    if (err instanceof ImportNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: 'No se ha encontrado el modelo', data: { code: 'not-found', ...data } })
    }
    throw createError({ statusCode: 502, statusMessage: `No se pudo contactar con ${importer.label}`, data: { code: 'network', ...data } })
  }

  remember(result)
  return withDuplicates(result.draft)
}

/**
 * Draft from data the user's browser read on the platform (bookmarklet or pasted), for when the
 * platform challenges our server. The browser passed the check as a person; we bypass nothing (ADR 0007).
 */
export async function previewFromPayload(text: string, payload: string) {
  const { url, importer } = await importerFor(text)
  const data = { code: 'bad-payload', url: url.href, rawDataUrl: importer.rawDataUrl?.(url) ?? null }
  if (!importer.fromPayload) {
    throw createError({ statusCode: 422, statusMessage: `${importer.label} no se puede importar desde el navegador`, data })
  }
  if (payload.length > MAX_IMPORT_PAYLOAD_CHARS) {
    throw createError({ statusCode: 413, statusMessage: 'Los datos son demasiado grandes', data })
  }
  let result: ImportResult
  try {
    result = importer.fromPayload(JSON.parse(payload), url, { printer: useRuntimeConfig().public.printerModel })
  }
  catch (err) {
    console.warn(`[import] ${importer.id} browser data rejected`, url.href, `${(err as Error).name}: ${(err as Error).message}`)
    throw createError({ statusCode: 422, statusMessage: `Los datos no son de este modelo de ${importer.label}. Cópialos otra vez, enteros.`, data })
  }
  remember(result)
  return withDuplicates(result.draft)
}

const IMAGE_HOSTS = new Set(MAKERWORLD_IMAGE_HOSTS)

/**
 * Downloads a remote image from an allow-listed CDN host to the data volume (WebP + thumbnail).
 * Size-capped while streaming; the server never fetches arbitrary user-supplied hosts (SSRF).
 */
export async function downloadImage(rawUrl: string, relBase: string) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' || !IMAGE_HOSTS.has(url.hostname)) throw new Error(`Host not allowed: ${url.hostname}`)
  // MakerWorld CDN resizes on the fly: ask for a WebP no larger than what we store
  if (url.hostname.endsWith('bblmw.com') && !url.searchParams.has('x-oss-process')) {
    url.searchParams.set('x-oss-process', 'image/resize,w_2560/format,webp')
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error' })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

  const { maxImageBytes } = limits()
  const tmpDir = resolveDataPath('tmp')
  await fs.mkdir(tmpDir, { recursive: true })
  const tmpPath = resolveDataPath(`tmp/${randomUUID()}`)
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength
    if (size > maxImageBytes) throw new Error('Image too large')
    chunks.push(chunk)
  }
  await fs.writeFile(tmpPath, Buffer.concat(chunks))
  return processImage(tmpPath, relBase) // validates it really is an image and removes tmp
}
