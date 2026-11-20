import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, materialSchema.partial().parse)
  const [row] = await useDb().update(schema.materials).set(data)
    .where(eq(schema.materials.id, getRouterParam(event, 'id')!)).returning()
  if (!row) throw createError({ statusCode: 404 })
  return row
})
