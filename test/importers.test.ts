import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { extractNextDataDesign, extractOpenGraph, guessCategory, looksBlocked, looksUnavailable, makerWorldImporter, mapDesign, parseMakerWorldUrl } from '../server/lib/importers/makerworld'
import { extractUrl, findImporter, ImportBlockedError, ImportUnavailableError } from '../server/lib/importers'
import { htmlToText } from '../server/lib/importers/text'

const design = JSON.parse(readFileSync(new URL('./fixtures/makerworld-design.json', import.meta.url), 'utf8'))

describe('parseMakerWorldUrl', () => {
  it.each([
    ['https://makerworld.com/es/models/3029073-bambu-scraper-handle-v3', '3029073', null],
    ['https://makerworld.com/en/models/3029073', '3029073', null],
    ['https://makerworld.com/models/3029073-x?from=search#profileId-3404179', '3029073', '3404179'],
    ['https://makerworld.com/zh-cn/models/42#profileId-7', '42', '7'],
  ])('%s', (url, id, profile) => {
    expect(parseMakerWorldUrl(url)).toEqual({ designId: id, instanceId: profile })
  })
  it('rejects other urls', () => {
    expect(parseMakerWorldUrl('https://www.printables.com/model/123')).toBeNull()
    expect(parseMakerWorldUrl('https://makerworld.com/en/@someone')).toBeNull()
  })
})

describe('extractUrl / findImporter', () => {
  it('finds the link inside shared text', () => {
    const url = extractUrl('Mira este modelo: https://makerworld.com/es/models/3029073-scraper. ¡Mola!')
    expect(url?.href).toBe('https://makerworld.com/es/models/3029073-scraper')
    expect(findImporter(url!)?.id).toBe('makerworld')
  })
  it('ignores non matching hosts', () => {
    expect(findImporter(new URL('https://evil.example/makerworld.com/models/1'))).toBeNull()
    expect(makerWorldImporter.matches(new URL('https://makerworld.com.evil.example/models/1'))).toBe(false)
  })
})

describe('mapDesign', () => {
  const draft = mapDesign(design, { printer: 'A1 mini' })

  it('maps metadata', () => {
    expect(draft.externalId).toBe('3029073')
    expect(draft.title).toMatch(/scraper/i)
    expect(draft.sourceUrl).toBe('https://makerworld.com/en/models/3029073-bambu-scraper-handle-v3')
    expect(draft.designer).toBeTruthy()
    expect(draft.designerUrl).toMatch(/^https:\/\/makerworld\.com\/en\/@/)
    expect(draft.license).toBe('Standard Digital File License')
  })

  it('sanitizes the description to plain text', () => {
    expect(draft.description).not.toMatch(/<|alert\(/)
    expect(draft.description).toMatch(/Spatule Bambu Lab/)
  })

  it('dedupes images and tags, capped', () => {
    expect(new Set(draft.images).size).toBe(draft.images.length)
    expect(draft.images[0]).toBe(design.coverUrl)
    expect(draft.tags.length).toBeLessThanOrEqual(12)
    expect(draft.tags).toContain('scraper')
    expect(draft.tags.filter(t => t === 'bambu lab' || t === 'bambulab')).toHaveLength(1)
    expect(draft.tags.every(t => t === t.toLowerCase())).toBe(true)
  })

  it('orders profiles and preselects the one sliced for the A1 mini', () => {
    expect(draft.profiles.map(p => p.externalId)).toEqual(['3404179', '3911900', '3911936'])
    const selected = draft.profiles.find(p => p.externalId === draft.selectedProfileId)!
    expect(selected.fit).toBe('native')
    expect(selected.printer).toBe('A1 mini')
    expect(selected.minutes).toBe(Math.round(4298 / 60))
    expect(selected.filaments).toEqual([
      { type: 'PETG', colorHex: '#161616', grams: 2 },
      { type: 'PETG', colorHex: '#057748', grams: 13 },
    ])
  })

  it('uses figures re-sliced for our printer on other profiles', () => {
    const p = draft.profiles[0]!
    expect(p.printer).toBe('P2S')
    expect(p.fit).toBe('resliced')
    expect(p.minutes).toBe(Math.round(4346 / 60))
    expect(p.grams).toBe(18)
  })

  it('honours the profile in the URL', () => {
    expect(mapDesign(design, { printer: 'A1 mini', instanceId: '3404179' }).selectedProfileId).toBe('3404179')
  })

  it('falls back to the default profile for printers nobody targets', () => {
    expect(mapDesign(design, { printer: 'Ender 3' }).selectedProfileId).toBe('3404179')
  })

  it('maps BOM entries to materials', () => {
    expect(draft.materials.length).toBe(4)
    expect(draft.materials.find(m => /magnet/i.test(m.name))?.category).toBe('Imanes')
    expect(draft.materials.find(m => /screw/i.test(m.name))?.category).toBe('Tornillería')
  })

  it('rejects unexpected payloads', () => {
    expect(() => mapDesign({ foo: 1 }, { printer: 'A1 mini' })).toThrow()
  })
})

describe('html fallbacks', () => {
  it('reads __NEXT_DATA__', () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { design } } }).replace(/</g, "\\u003c")}</script></html>`
    expect((extractNextDataDesign(html) as any).id).toBe(3029073)
  })
  it('reads Open Graph', () => {
    const html = '<meta property="og:title" content="Cool box &amp; lid - MakerWorld"><meta property="og:image" content="https://makerworld.bblmw.com/a.jpg"><meta name="og:description" content="A box">'
    const og = extractOpenGraph(html, '5')!
    expect(og.title).toBe('Cool box & lid')
    expect(og.images).toEqual(['https://makerworld.bblmw.com/a.jpg'])
    expect(og.via).toBe('open-graph')
  })
  it('detects anti-bot challenges', () => {
    expect(looksBlocked(403, new Headers(), '<title>Just a moment...</title>')).toBe(true)
    expect(looksBlocked(200, new Headers({ 'cf-mitigated': 'challenge' }), '')).toBe(true)
    expect(looksBlocked(200, new Headers(), '{"id":1}')).toBe(false)
    expect(looksBlocked(429, new Headers(), 'Too many requests')).toBe(false)
  })
  it('detects temporary unavailability', () => {
    expect(looksUnavailable(429)).toBe(true)
    expect(looksUnavailable(503)).toBe(true)
    expect(looksUnavailable(500)).toBe(false)
  })
})

describe('fetch with fallbacks (mocked network)', () => {
  const url = new URL('https://makerworld.com/es/models/3029073-x')
  const respond = (status: number, body: string, headers: Record<string, string> = {}) =>
    new Response(body, { status, headers })

  it('uses the API first', async () => {
    const calls: string[] = []
    const res = await makerWorldImporter.fetch(url, {
      printer: 'A1 mini',
      fetch: (async (u: string) => { calls.push(u); return respond(200, JSON.stringify(design)) }) as typeof fetch,
    })
    expect(calls).toEqual(['https://makerworld.com/api/v1/design-service/design/3029073'])
    expect(res.draft.via).toBe('api')
    expect(res.draft.profiles).toHaveLength(3)
  })

  it('falls back to the page when the API fails', async () => {
    const page = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { design } } }).replace(/</g, "\\u003c")}</script>`
    const res = await makerWorldImporter.fetch(url, {
      printer: 'A1 mini',
      fetch: (async (u: string) => (u.includes('/api/') ? respond(500, 'oops') : respond(200, page))) as typeof fetch,
    })
    expect(res.draft.via).toBe('next-data')
  })

  it('never bypasses a challenge', async () => {
    await expect(makerWorldImporter.fetch(url, {
      printer: 'A1 mini',
      fetch: (async () => respond(403, '<title>Just a moment...</title>')) as unknown as typeof fetch,
    })).rejects.toBeInstanceOf(ImportBlockedError)
  })

  it('reports rate limits as temporary', async () => {
    await expect(makerWorldImporter.fetch(url, {
      printer: 'A1 mini',
      fetch: (async () => respond(429, 'slow down')) as unknown as typeof fetch,
    })).rejects.toBeInstanceOf(ImportUnavailableError)
  })

  it('reports the API failure instead of the page challenge', async () => {
    const challenge = () => respond(403, '<title>Just a moment...</title>', { 'cf-mitigated': 'challenge' })
    await expect(makerWorldImporter.fetch(url, {
      printer: 'A1 mini',
      fetch: (async (u: string) => (u.includes('/api/') ? respond(500, 'oops') : challenge())) as typeof fetch,
    })).rejects.toThrow(/API failed \(HTTP 500\)/)
    await expect(makerWorldImporter.fetch(url, {
      printer: 'A1 mini',
      fetch: (async (u: string) => {
        if (u.includes('/api/')) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
        return challenge()
      }) as typeof fetch,
    })).rejects.toThrow(/API failed \(TimeoutError/)
  })
})

describe('helpers', () => {
  it('htmlToText keeps structure', () => {
    expect(htmlToText('<h3>Title</h3><p>One<br>Two</p><ul><li>a</li><li>b</li></ul><p>&nbsp;</p>')).toBe('Title\nOne\nTwo\n\n• a\n• b')
  })
  it('guessCategory', () => {
    expect(guessCategory('M3 heat set insert')).toBe('Insertos')
    expect(guessCategory('Something else')).toBe('Otros')
  })
})
