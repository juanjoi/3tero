// Registry of external importers. Add a module per platform implementing ProjectImporter.
import { makerWorldImporter } from './makerworld'
import type { ProjectImporter } from './types'

export * from './types'
export { MAKERWORLD_IMAGE_HOSTS } from './makerworld'

export const importers: ProjectImporter[] = [makerWorldImporter]

/** Extracts the first http(s) URL of a shared text ("Look at this! https://…"). */
export function extractUrl(text: string): URL | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i)
  if (!m) return null
  try {
    return new URL(m[0].replace(/[),.;!?]+$/, ''))
  }
  catch {
    return null
  }
}

export function findImporter(url: URL) {
  return importers.find(i => i.matches(url)) ?? null
}

/** Short/share links of a known platform (no model id in the path) are resolved by following redirects once. */
export async function resolveShareLink(url: URL, doFetch: typeof fetch = fetch): Promise<URL> {
  if (findImporter(url) || !/(^|\.)makerworld\.com$/i.test(url.hostname)) return url
  try {
    const res = await doFetch(url.href, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000) })
    await res.body?.cancel()
    return new URL(res.url)
  }
  catch {
    return url
  }
}
