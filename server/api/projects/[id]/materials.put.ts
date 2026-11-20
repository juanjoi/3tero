import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const items = await readValidatedBody(event, projectMaterialsSchema.parse)
  const db = useDb()
  await getProjectOr404(db, id)
  await db.transaction(async (tx) => {
    await tx.delete(schema.projectMaterials).where(eq(schema.projectMaterials.projectId, id))
    const unique = [...new Map(items.map(i => [i.materialId, i])).values()]
    if (unique.length) await tx.insert(schema.projectMaterials).values(unique.map(i => ({ projectId: id, ...i })))
  })
  return getProjectDetail(db, id)
})
