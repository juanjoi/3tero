// Moves a queue item to another position (0 = next to print); the rest shift.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { position } = await readValidatedBody(event, queueMoveSchema.parse)
  const db = useDb()
  await db.transaction(tx => moveQueueItem(tx, id, position))
  return getQueue(db)
})
