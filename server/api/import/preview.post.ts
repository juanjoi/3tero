import { z } from 'zod'

// Step 1 of an import: return an editable draft (nothing is stored yet). Three sources:
// - `url`: the server reads the platform once;
// - `url` + `payload`: raw data the user's browser read on the platform ("pegar datos", ADR 0007);
// - `draft`: a draft already cached by the bookmarklet route (server/routes/import/browser.post.ts).
const bodySchema = z.union([
  z.object({ draft: z.string().min(3).max(200) }),
  z.object({
    url: z.string().trim().min(1).max(4000),
    payload: z.string().min(1).max(MAX_IMPORT_PAYLOAD_CHARS).optional(),
  }),
])

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  if ('draft' in body) return previewCached(body.draft)
  return body.payload ? previewFromPayload(body.url, body.payload) : previewImport(body.url)
})
