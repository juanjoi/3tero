// Adds a project to the end of the print queue. Without fileId, the final / latest sliced file.
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, queueAddSchema.parse)
  const db = useDb()
  const project = await getProjectOr404(db, body.projectId)
  if (body.fileId) await assertProjectFile(db, project.id, body.fileId)
  const fileId = body.fileId === undefined ? await defaultQueueFile(db, project.id, project.finalFileId) : body.fileId
  const id = await db.transaction(tx => addToQueue(tx, { projectId: project.id, fileId, copies: body.copies }))
  setResponseStatus(event, 201)
  return { id, queued: await countQueued(db, project.id) }
})
