import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await getProjectOr404(db, id)
  await db.update(schema.projects).set({ archivedAt: null }).where(eq(schema.projects.id, id))
  return getProjectDetail(db, id)
})
