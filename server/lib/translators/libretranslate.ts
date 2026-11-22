// LibreTranslate client for translating imported texts to Spanish (ADR 0008).
// Self-hosted next to 3tero: no account, texts never leave home.
// Pure: no Nuxt/Nitro imports, `fetch` injectable so it stays unit-testable.

export class TranslationError extends Error {
  constructor(message: string, readonly code: 'rejected' | 'unavailable') {
    super(message)
    this.name = 'TranslationError'
  }
}

export interface LibreTranslateOptions {
  /** Base URL of the LibreTranslate server, e.g. http://3tero-traductor:5000 */
  url: string
  targetLang?: string
  fetch?: typeof globalThis.fetch
  /** CPU only: the first request after a restart loads the models (~25 s), long texts take a while. */
  timeoutMs?: number
}

/**
 * Translates groups of texts. LibreTranslate detects ONE source language per request, so each group
 * must be in a single language (a title, a description, a set of tags); groups run in parallel.
 * Blank texts are returned as they are.
 */
export async function translateGroups(groups: string[][], opts: LibreTranslateOptions): Promise<string[][]> {
  return Promise.all(groups.map(g => translateGroup(g, opts)))
}

async function translateGroup(texts: string[], opts: LibreTranslateOptions): Promise<string[]> {
  const pending = texts.map((t, i) => ({ t, i })).filter(x => x.t.trim())
  if (!pending.length) return [...texts]

  const doFetch = opts.fetch ?? globalThis.fetch
  let res: Response
  try {
    res = await doFetch(`${opts.url.replace(/\/+$/, '')}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: pending.map(x => x.t), source: 'auto', target: opts.targetLang ?? 'es', format: 'text' }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
    })
  }
  catch (err) {
    throw new TranslationError(`LibreTranslate unreachable: ${(err as Error).message}`, 'unavailable')
  }
  const json = await res.json().catch(() => null) as { translatedText?: unknown, error?: unknown } | null
  if (!res.ok) {
    const detail = typeof json?.error === 'string' ? `: ${json.error}` : ''
    throw new TranslationError(`LibreTranslate error (HTTP ${res.status})${detail}`, res.status === 400 ? 'rejected' : 'unavailable')
  }
  const translated = json?.translatedText
  if (!Array.isArray(translated) || translated.length !== pending.length || translated.some(t => typeof t !== 'string')) {
    throw new TranslationError('Unexpected LibreTranslate response', 'unavailable')
  }
  const out = [...texts]
  pending.forEach((x, k) => { out[x.i] = translated[k] as string })
  return out
}

export interface ImportTexts {
  title: string
  description: string
  tags: string[]
}

const DESCRIPTION_CHUNKS = 4
/** List markers produced by htmlToText ("• ") or typed by hand ("- ", "1. "): the translator drops them. */
const LIST_PREFIX = /^(\s*(?:[•\-*]|\d+[.)])\s+)/

/**
 * Title, tags and description as separate groups (one language each). A long description is translated
 * line by line, so it is split into consecutive chunks that run in parallel (LibreTranslate serves 4
 * requests at once by default); list markers are kept out of the translation and put back.
 */
export async function translateImportTexts(texts: ImportTexts, opts: LibreTranslateOptions): Promise<ImportTexts> {
  const lines = texts.description.split('\n').map((line) => {
    const prefix = line.match(LIST_PREFIX)?.[1] ?? ''
    return { prefix, text: line.slice(prefix.length) }
  })
  const size = Math.max(1, Math.ceil(lines.length / DESCRIPTION_CHUNKS))
  const chunks = Array.from({ length: Math.ceil(lines.length / size) }, (_, i) => lines.slice(i * size, (i + 1) * size))
  const [title, tags, ...description] = await translateGroups([[texts.title], texts.tags, ...chunks.map(c => c.map(l => l.text))], opts)
  return {
    title: title![0]!,
    description: description.flat().map((t, i) => lines[i]!.prefix + t).join('\n'),
    tags: tags!,
  }
}
