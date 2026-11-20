import { eq } from 'drizzle-orm'

// Archive by default (soft delete); `?hard=true` deletes the project and its files permanently.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await getProjectOr404(db, id)
  if (getQuery(event).hard === 'true') {
    await db.delete(schema.projects).where(eq(schema.projects.id, id))
    await removeProjectDir(id)
    return { deleted: true }
  }
  await db.update(schema.projects).set({ archivedAt: new Date() }).where(eq(schema.projects.id, id))
  return { archived: true }
})
