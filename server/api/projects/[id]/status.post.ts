import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { status } = await readValidatedBody(event, projectStatusSchema.parse)
  const db = useDb()
  const project = await getProjectOr404(db, id)
  if (project.status !== status) {
    await db.transaction(async (tx) => {
      await tx.update(schema.projects).set({ status, updatedAt: new Date() }).where(eq(schema.projects.id, id))
      await recordStatus(tx, id, project.status, status)
    })
  }
  return getProjectDetail(db, id)
})
