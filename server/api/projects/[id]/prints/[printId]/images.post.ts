import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

// Photos of a print result (multipart, several files).
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const printId = getRouterParam(event, 'printId')!
  const db = useDb()
  await getProjectOr404(db, id)
  const [log] = await db.select({ id: schema.printLogs.id }).from(schema.printLogs)
    .where(and(eq(schema.printLogs.id, printId), eq(schema.printLogs.projectId, id)))
  if (!log) throw createError({ statusCode: 404, statusMessage: 'Impresión no encontrada' })
  await assertQuota(event)

  const { files } = await receiveUploads(event, {
    maxFileBytes: limits().maxImageBytes,
    maxFiles: 10,
    accept: name => IMAGE_EXTENSIONS.test(name),
  })
  try {
    for (const f of files) {
      const imageId = randomUUID()
      const out = await processImage(f.tmpPath, `projects/${id}/prints/${imageId}`)
      await db.insert(schema.printLogImages).values({ id: imageId, printLogId: printId, ...out })
    }
  }
  finally {
    await discardUploads(files)
  }
  return getProjectDetail(db, id)
})
