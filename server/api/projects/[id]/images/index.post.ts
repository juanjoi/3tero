import { randomUUID } from 'node:crypto'
import { count, eq, max } from 'drizzle-orm'

// Multipart upload of one or more images (field name: any).
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  const project = await getProjectOr404(db, id)
  await assertQuota(event)

  const lim = limits()
  const [{ n }] = await db.select({ n: count() }).from(schema.projectImages).where(eq(schema.projectImages.projectId, id)) as [{ n: number }]
  const room = lim.maxImagesPerProject - n
  if (room <= 0) throw createError({ statusCode: 409, statusMessage: `Máximo ${lim.maxImagesPerProject} imágenes por proyecto` })

  const { files } = await receiveUploads(event, {
    maxFileBytes: lim.maxImageBytes,
    maxFiles: room,
    accept: name => IMAGE_EXTENSIONS.test(name),
  })
  if (!files.length) throw createError({ statusCode: 400, statusMessage: 'No se ha recibido ninguna imagen' })

  const [{ pos }] = await db.select({ pos: max(schema.projectImages.position) }).from(schema.projectImages)
    .where(eq(schema.projectImages.projectId, id)) as [{ pos: number | null }]
  let position = (pos ?? -1) + 1

  const created = []
  try {
    for (const f of files) {
      const imageId = randomUUID()
      const out = await processImage(f.tmpPath, `projects/${id}/images/${imageId}`)
      const [row] = await db.insert(schema.projectImages)
        .values({ id: imageId, projectId: id, ...out, position: position++ })
        .returning()
      created.push(row!)
    }
  }
  finally {
    await discardUploads(files)
  }

  if (!project.coverImageId && created[0]) {
    await db.update(schema.projects).set({ coverImageId: created[0].id }).where(eq(schema.projects.id, id))
  }
  return getProjectDetail(db, id)
})
