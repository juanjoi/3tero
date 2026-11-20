import { createReadStream, promises as fs } from 'node:fs'
import { and, eq } from 'drizzle-orm'

// Download with the original file name (to open it in Bambu Studio).
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const fileId = getRouterParam(event, 'fileId')!
  const [file] = await useDb().select().from(schema.projectFiles)
    .where(and(eq(schema.projectFiles.id, fileId), eq(schema.projectFiles.projectId, id)))
  if (!file) throw createError({ statusCode: 404 })
  const abs = resolveDataPath(file.path)
  const stat = await fs.stat(abs)
  setResponseHeaders(event, {
    'content-type': 'application/octet-stream',
    'content-length': stat.size,
    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
  })
  return sendStream(event, createReadStream(abs))
})
