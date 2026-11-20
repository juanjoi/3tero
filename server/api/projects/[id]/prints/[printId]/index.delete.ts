import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const printId = getRouterParam(event, 'printId')!
  const db = useDb()
  await getProjectOr404(db, id)
  const images = await db.select().from(schema.printLogImages).where(eq(schema.printLogImages.printLogId, printId))
  const [deleted] = await db.delete(schema.printLogs)
    .where(and(eq(schema.printLogs.id, printId), eq(schema.printLogs.projectId, id)))
    .returning({ id: schema.printLogs.id })
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Impresión no encontrada' })
  await removeStored(...images.flatMap(i => [i.path, i.thumbPath]))
  return getProjectDetail(db, id)
})
