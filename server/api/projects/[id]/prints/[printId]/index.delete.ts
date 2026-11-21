import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const printId = getRouterParam(event, 'printId')!
  const db = useDb()
  await getProjectOr404(db, id)
  const images = await db.select().from(schema.printLogImages).where(eq(schema.printLogImages.printLogId, printId))
  const deleted = await db.transaction(async (tx) => {
    const used = await tx.select({ filamentId: schema.printLogFilaments.filamentId, grams: schema.printLogFilaments.grams })
      .from(schema.printLogFilaments).where(eq(schema.printLogFilaments.printLogId, printId))
    const [row] = await tx.delete(schema.printLogs)
      .where(and(eq(schema.printLogs.id, printId), eq(schema.printLogs.projectId, id)))
      .returning({ id: schema.printLogs.id })
    // Deleting a print gives its filament back to the stock
    if (row) await adjustStock(tx, used.map(u => ({ filamentId: u.filamentId, grams: Number(u.grams) })))
    return row
  })
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Impresión no encontrada' })
  await removeStored(...images.flatMap(i => [i.path, i.thumbPath]))
  return getProjectDetail(db, id)
})
