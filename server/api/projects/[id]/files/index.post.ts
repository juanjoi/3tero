import { randomUUID } from 'node:crypto'
import { count, eq } from 'drizzle-orm'

// Multipart upload of one model file (STL / 3MF), optional text fields: label, notes.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  await getProjectOr404(db, id)
  await assertQuota(event)

  const lim = limits()
  const [{ n }] = await db.select({ n: count() }).from(schema.projectFiles).where(eq(schema.projectFiles.projectId, id)) as [{ n: number }]
  if (n >= lim.maxFilesPerProject) {
    throw createError({ statusCode: 409, statusMessage: `Máximo ${lim.maxFilesPerProject} ficheros por proyecto` })
  }

  const { files, fields } = await receiveUploads(event, {
    maxFileBytes: lim.maxModelBytes,
    maxFiles: 1,
    accept: name => MODEL_EXTENSIONS.test(name),
  })
  const f = files[0]
  if (!f) throw createError({ statusCode: 400, statusMessage: 'No se ha recibido ningún fichero' })

  try {
    const { format, kind, ext } = detectModel(f.originalName, await readHead(f.tmpPath))
    const fileId = randomUUID()
    const path = await storeFile(f.tmpPath, `projects/${id}/files/${fileId}${ext}`)
    await db.insert(schema.projectFiles).values({
      id: fileId,
      projectId: id,
      kind,
      format,
      path,
      size: f.size,
      sha256: f.sha256,
      originalName: f.originalName,
      label: fields.label?.trim() || `v${n + 1}`,
      notes: fields.notes?.trim() || null,
    })
    await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, id))
  }
  finally {
    await discardUploads(files)
  }
  return getProjectDetail(db, id)
})
