import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, filamentSchema.partial().parse)
  const [row] = await useDb().update(schema.filaments)
    .set({ ...data, pricePerKg: data.pricePerKg === undefined ? undefined : String(data.pricePerKg) })
    .where(eq(schema.filaments.id, getRouterParam(event, 'id')!))
    .returning()
  if (!row) throw createError({ statusCode: 404 })
  return row
})
