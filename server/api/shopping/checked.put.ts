import { z } from 'zod'

// Items ticked off in the shopping list ("m:<materialId>", "f:<filamentId>"), shared by the family.
const bodySchema = z.object({ keys: z.array(z.string().regex(/^[mf]:[0-9a-f-]{36}$/)).max(500) })

export default defineEventHandler(async (event) => {
  const { keys } = await readValidatedBody(event, bodySchema.parse)
  await setSetting('shopping.checked', [...new Set(keys)])
  return { keys }
})
