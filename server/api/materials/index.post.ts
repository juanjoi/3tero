export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, materialSchema.parse)
  const [row] = await useDb().insert(schema.materials).values(data).returning()
  setResponseStatus(event, 201)
  return row
})
