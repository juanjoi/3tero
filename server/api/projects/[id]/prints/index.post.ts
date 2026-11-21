import { and, eq, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, printLogSchema.parse)
  const db = useDb()
  const project = await getProjectOr404(db, id)

  if (body.fileId) {
    const [file] = await db.select({ id: schema.projectFiles.id }).from(schema.projectFiles)
      .where(and(eq(schema.projectFiles.id, body.fileId), eq(schema.projectFiles.projectId, id)))
    if (!file) throw createError({ statusCode: 400, statusMessage: 'Fichero no válido' })
  }

  // Merge repeated filaments and snapshot their current price (history must not change with later prices)
  const grams = new Map<string, number>()
  for (const f of body.filaments) if (f.grams > 0) grams.set(f.filamentId, (grams.get(f.filamentId) ?? 0) + f.grams)
  const prices = grams.size
    ? await db.select({ id: schema.filaments.id, price: schema.filaments.pricePerKg }).from(schema.filaments)
      .where(inArray(schema.filaments.id, [...grams.keys()]))
    : []
  if (prices.length !== grams.size) throw createError({ statusCode: 400, statusMessage: 'Filamento no válido' })

  const printId = await db.transaction(async (tx) => {
    const [log] = await tx.insert(schema.printLogs).values({
      projectId: id,
      fileId: body.fileId ?? null,
      printedAt: body.printedAt ?? new Date(),
      result: body.result,
      minutes: body.minutes ?? null,
      notes: body.notes ?? null,
    }).returning({ id: schema.printLogs.id })
    if (prices.length) {
      await tx.insert(schema.printLogFilaments).values(prices.map(p => ({
        printLogId: log!.id, filamentId: p.id, grams: String(grams.get(p.id)), pricePerKg: p.price,
      })))
      await adjustStock(tx, [...grams].map(([filamentId, g]) => ({ filamentId, grams: -g })))
    }
    const patch: Partial<typeof schema.projects.$inferInsert> = { updatedAt: new Date() }
    if (body.markFinal && body.fileId) patch.finalFileId = body.fileId
    if (body.markPrinted && project.status !== 'printed') {
      patch.status = 'printed'
      await recordStatus(tx, id, project.status, 'printed')
    }
    await tx.update(schema.projects).set(patch).where(eq(schema.projects.id, id))
    return log!.id
  })

  setResponseStatus(event, 201)
  setResponseHeader(event, 'x-print-id', printId)
  return getProjectDetail(db, id)
})
