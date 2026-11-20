import { randomUUID } from 'node:crypto'
import { count, eq } from 'drizzle-orm'

// Multipart upload of one model file (STL / 3MF), optional text fields: label, notes.
// 3MF/STL metadata (time, grams per filament, plates, bbox, thumbnail) is extracted on upload.
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

  const fileId = randomUUID()
  let path: string | undefined
  let thumbnailPath: string | null = null
  try {
    const detected = detectModel(f.originalName, await readHead(f.tmpPath))
    path = await storeFile(f.tmpPath, `projects/${id}/files/${fileId}${detected.ext}`)
    const analysis = await analyzeModel(resolveDataPath(path), detected.format)
    thumbnailPath = await storeThumbnail(analysis.thumbnail, `projects/${id}/files/${fileId}.thumb.webp`)
    const { filaments, created } = await matchFilaments(analysis.filaments)

    await db.transaction(async (tx) => {
      await tx.insert(schema.projectFiles).values({
        id: fileId,
        projectId: id,
        kind: analysis.sliced ? 'sliced' : detected.kind,
        format: detected.format,
        path: path!,
        size: f.size,
        sha256: f.sha256,
        originalName: f.originalName,
        label: fields.label?.trim() || `v${n + 1}`,
        notes: fields.notes?.trim() || null,
        estMinutes: analysis.estMinutes,
        plates: analysis.plates,
        printerModelId: analysis.printerModelId,
        bboxX: analysis.bbox?.x ?? null,
        bboxY: analysis.bbox?.y ?? null,
        bboxZ: analysis.bbox?.z ?? null,
        fitsPrinter: analysis.fitsPrinter,
        thumbnailPath,
        parsed: analysis.parsed,
      })
      if (filaments.length) {
        await tx.insert(schema.fileFilaments).values(filaments.map(x => ({ fileId, ...x, grams: String(x.grams) })))
      }
      await tx.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, id))
    })
    setResponseHeaders(event, { 'x-new-filaments': String(created), 'x-file-id': fileId })
  }
  catch (err) {
    await removeStored(path, thumbnailPath)
    throw err
  }
  finally {
    await discardUploads(files)
  }
  return getProjectDetail(db, id)
})
