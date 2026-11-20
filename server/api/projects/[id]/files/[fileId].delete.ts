import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const fileId = getRouterParam(event, 'fileId')!
  const db = useDb()
  const project = await getProjectOr404(db, id)
  const [file] = await db.delete(schema.projectFiles)
    .where(and(eq(schema.projectFiles.id, fileId), eq(schema.projectFiles.projectId, id)))
    .returning()
  if (!file) throw createError({ statusCode: 404, statusMessage: 'Fichero no encontrado' })
  if (project.finalFileId === fileId) {
    await db.update(schema.projects).set({ finalFileId: null }).where(eq(schema.projects.id, id))
  }
  await removeStored(file.path, file.thumbnailPath)
  return getProjectDetail(db, id)
})
