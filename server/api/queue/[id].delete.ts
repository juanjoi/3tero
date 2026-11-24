import { eq } from 'drizzle-orm'

// Removes an item from the print queue (without logging a print).
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  const removed = await db.delete(schema.printQueue).where(eq(schema.printQueue.id, id)).returning({ id: schema.printQueue.id })
  if (!removed.length) throw createError({ statusCode: 404, statusMessage: 'No está en la cola' })
  return getQueue(db)
})
