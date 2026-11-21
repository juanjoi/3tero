// Small text helpers shared by importers (no dependencies).

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', '#39': '\'' }

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1]?.toLowerCase() === 'x' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/**
 * Converts a rich-text HTML description into plain text with paragraphs and bullet lines.
 * Scripts, styles and images are dropped; the app renders descriptions as plain text.
 */
export function htmlToText(html: string, maxLength = 10_000) {
  const text = html
    .replace(/<(script|style|iframe|svg)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .replace(/[ \t ]+/g, ' ')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength)
}

export function uniqBy<T>(items: T[], key: (t: T) => string) {
  const seen = new Set<string>()
  return items.filter((t) => {
    const k = key(t)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function normalizeHex(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^#?([0-9a-f]{6})/i)
  return m ? `#${m[1]!.toUpperCase()}` : null
}

/** Same printer name regardless of case/spaces: "A1 mini" == "a1mini". */
export function samePrinter(a: string | null | undefined, b: string | null | undefined) {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return !!a && !!b && n(a) === n(b)
}
