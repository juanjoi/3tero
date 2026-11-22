// Receives the bookmarklet form: a POST from a MakerWorld tab with the design JSON that the user's
// browser read there (app/utils/bookmarklet.ts, ADR 0007). Caches the draft and redirects to the
// review page; nothing else is stored until the user saves.
export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event).catch(() => null)
  const field = (k: string) => (typeof body?.[k] === 'string' ? body[k] as string : '')
  const link = field('url').slice(0, 4000)
  const back = (query: Record<string, string>) => sendRedirect(event, `/import?${new URLSearchParams(query)}`, 303)
  const fail = (message: string) => back({ link, error: message.slice(0, 300), raw: rawDataUrlFor(link) ?? '' })

  if (field('error') || !field('payload')) {
    console.warn('[import] bookmarklet could not read the model', link, field('error'))
    return fail(`El navegador no pudo leer el modelo (${field('error').slice(0, 100) || 'sin datos'})`)
  }
  try {
    const { draft } = await previewFromPayload(link, field('payload'))
    return back({ draft: `${draft.importer}:${draft.externalId}` })
  }
  catch (err) {
    return fail((err as { statusMessage?: string }).statusMessage ?? 'No se pudieron leer los datos del modelo')
  }
})
