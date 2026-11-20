export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, filamentSchema.parse)
  const [row] = await useDb().insert(schema.filaments).values({ ...data, pricePerKg: String(data.pricePerKg) }).returning()
  setResponseStatus(event, 201)
  return row
})
