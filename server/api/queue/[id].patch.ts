import { eq } from 'drizzle-orm'

// Changes the file to print, the copies or the notes of a queue item.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, queueUpdateSchema.parse)
  const db = useDb()
  const [item] = await db.select().from(schema.printQueue).where(eq(schema.printQueue.id, id))
  if (!item) throw createError({ statusCode: 404, statusMessage: 'No está en la cola' })
  if (body.fileId) await assertProjectFile(db, item.projectId, body.fileId)
  await db.update(schema.printQueue).set(body).where(eq(schema.printQueue.id, id))
  return getQueue(db)
})
