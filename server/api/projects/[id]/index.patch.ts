import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { tags, ...data } = await readValidatedBody(event, projectUpdateSchema.parse)
  const db = useDb()
  await getProjectOr404(db, id)

  // Referenced image / file must belong to this project
  if (data.coverImageId) {
    const [img] = await db.select({ id: schema.projectImages.id }).from(schema.projectImages)
      .where(and(eq(schema.projectImages.id, data.coverImageId), eq(schema.projectImages.projectId, id)))
    if (!img) throw createError({ statusCode: 400, statusMessage: 'Imagen no válida' })
  }
  if (data.finalFileId) {
    const [file] = await db.select({ id: schema.projectFiles.id }).from(schema.projectFiles)
      .where(and(eq(schema.projectFiles.id, data.finalFileId), eq(schema.projectFiles.projectId, id)))
    if (!file) throw createError({ statusCode: 400, statusMessage: 'Fichero no válido' })
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.projects).set({ ...data, updatedAt: new Date() }).where(eq(schema.projects.id, id))
    if (tags) await setProjectTags(tx, id, tags)
  })
  return getProjectDetail(db, id)
})
