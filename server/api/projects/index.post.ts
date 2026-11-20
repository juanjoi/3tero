export default defineEventHandler(async (event) => {
  const { tags, ...data } = await readValidatedBody(event, projectCreateSchema.parse)
  const db = useDb()
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(schema.projects).values(data).returning({ id: schema.projects.id })
    await setProjectTags(tx, row!.id, tags)
    await recordStatus(tx, row!.id, null, data.status)
    return row!.id
  })
  setResponseStatus(event, 201)
  return getProjectDetail(db, id)
})
