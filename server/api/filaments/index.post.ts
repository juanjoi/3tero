export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, filamentSchema.parse)
  const [row] = await useDb().insert(schema.filaments).values({ ...data, pricePerKg: String(data.pricePerKg), stockGrams: data.stockGrams == null ? null : String(data.stockGrams) }).returning()
  setResponseStatus(event, 201)
  return row
})
