import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const fileId = getRouterParam(event, 'fileId')!
  const { filaments, final, ...data } = await readValidatedBody(event, fileUpdateSchema.parse)
  const db = useDb()
  const project = await getProjectOr404(db, id)
  const [file] = await db.select({ id: schema.projectFiles.id }).from(schema.projectFiles)
    .where(and(eq(schema.projectFiles.id, fileId), eq(schema.projectFiles.projectId, id)))
  if (!file) throw createError({ statusCode: 404, statusMessage: 'Fichero no encontrado' })

  await db.transaction(async (tx) => {
    if (Object.keys(data).length) {
      await tx.update(schema.projectFiles).set(data).where(eq(schema.projectFiles.id, fileId))
    }
    if (filaments) {
      await tx.delete(schema.fileFilaments).where(eq(schema.fileFilaments.fileId, fileId))
      if (filaments.length) {
        await tx.insert(schema.fileFilaments).values(filaments.map(f => ({ fileId, ...f, grams: String(f.grams) })))
      }
    }
    if (final !== undefined) {
      const finalFileId = final ? fileId : (project.finalFileId === fileId ? null : project.finalFileId)
      await tx.update(schema.projects).set({ finalFileId }).where(eq(schema.projects.id, id))
    }
    await tx.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, id))
  })
  return getProjectDetail(db, id)
})
