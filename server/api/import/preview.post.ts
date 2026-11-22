import { z } from 'zod'

// Step 1 of an import: return an editable draft (nothing is stored yet). Two sources:
// - `url`: the server reads the platform once;
// - `url` + `payload`: raw data the user's browser read on the platform (bookmarklet or
//   "pegar datos", ADR 0007).
const bodySchema = z.object({
  url: z.string().trim().min(1).max(4000),
  payload: z.string().min(1).max(MAX_IMPORT_PAYLOAD_CHARS).optional(),
})

export default defineEventHandler(async (event) => {
  const { url, payload } = await readValidatedBody(event, bodySchema.parse)
  return payload ? previewFromPayload(url, payload) : previewImport(url)
})
