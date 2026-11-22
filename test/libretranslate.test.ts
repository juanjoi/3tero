import { describe, expect, it } from 'vitest'
import { translateGroups, translateImportTexts, TranslationError } from '../server/lib/translators/libretranslate'

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('libretranslate', () => {
  it('sends one request per group (one detected language each) and keeps blanks', async () => {
    const sent: any[] = []
    const out = await translateGroups([['Zahnstocher Spender'], ['Hello', '', 'Print it']], {
      url: 'http://lt:5000/',
      fetch: (async (u: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body))
        sent.push({ url: u, body })
        return reply(200, { translatedText: body.q.map((t: string) => `es:${t}`) })
      }) as typeof fetch,
    })
    expect(out).toEqual([['es:Zahnstocher Spender'], ['es:Hello', '', 'es:Print it']])
    expect(sent).toHaveLength(2)
    expect(sent[0]).toEqual({ url: 'http://lt:5000/translate', body: { q: ['Zahnstocher Spender'], source: 'auto', target: 'es', format: 'text' } })
    expect(sent[1].body.q).toEqual(['Hello', 'Print it'])
  })

  it('does not call the server for blank groups', async () => {
    const out = await translateGroups([[], ['', ' ']], { url: 'http://lt', fetch: (() => { throw new Error('called') }) as unknown as typeof fetch })
    expect(out).toEqual([[], ['', ' ']])
  })

  it('maps errors', async () => {
    const run = (f: typeof fetch) => translateGroups([['hola']], { url: 'http://lt', fetch: f }).catch(e => e)
    const bad = await run((async () => reply(400, { error: 'xx is not supported' })) as unknown as typeof fetch)
    expect(bad).toBeInstanceOf(TranslationError)
    expect(bad.code).toBe('rejected')
    expect(bad.message).toMatch(/not supported/)
    expect((await run((async () => reply(500, {})) as unknown as typeof fetch)).code).toBe('unavailable')
    expect((await run((async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch)).code).toBe('unavailable')
    expect((await run((async () => reply(200, { translatedText: 'not an array' })) as unknown as typeof fetch)).code).toBe('unavailable')
  })

  it('translates title, tags and a chunked description, keeping list markers', async () => {
    const requests: string[][] = []
    const fake = (async (_u: string, init: RequestInit) => {
      const { q } = JSON.parse(String(init.body))
      requests.push(q)
      return reply(200, { translatedText: q.map((t: string) => t.toUpperCase()) })
    }) as typeof fetch
    const description = ['Intro', '', '• first', '- second', '1. third', 'end', 'more', 'last'].join('\n')
    const out = await translateImportTexts({ title: 'Box', description, tags: ['lid', 'box'] }, { url: 'http://lt', fetch: fake })
    expect(out.title).toBe('BOX')
    expect(out.tags).toEqual(['LID', 'BOX'])
    expect(out.description).toBe(['INTRO', '', '• FIRST', '- SECOND', '1. THIRD', 'END', 'MORE', 'LAST'].join('\n'))
    expect(requests.flat()).not.toContain('• first')
    expect(requests).toHaveLength(2 + 4) // title, tags, 4 description chunks
  })
})
