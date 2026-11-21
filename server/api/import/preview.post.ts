import { z } from 'zod'

// Step 1 of an import: fetch the page once and return an editable draft (nothing is stored yet).
const bodySchema = z.object({ url: z.string().trim().min(1).max(4000) })

export default defineEventHandler(async (event) => {
  const { url } = await readValidatedBody(event, bodySchema.parse)
  return previewImport(url)
})
