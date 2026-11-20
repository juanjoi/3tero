import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const imageId = getRouterParam(event, 'imageId')!
  const db = useDb()
  const project = await getProjectOr404(db, id)
  const [img] = await db.delete(schema.projectImages)
    .where(and(eq(schema.projectImages.id, imageId), eq(schema.projectImages.projectId, id)))
    .returning()
  if (!img) throw createError({ statusCode: 404, statusMessage: 'Imagen no encontrada' })
  if (project.coverImageId === imageId) {
    await db.update(schema.projects).set({ coverImageId: null }).where(eq(schema.projects.id, id))
  }
  await removeStored(img.path, img.thumbPath)
  return getProjectDetail(db, id)
})
