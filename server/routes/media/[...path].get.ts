// Serves stored files (images, thumbnails, models). Names are random UUIDs, so they can be cached forever.
import { createReadStream, promises as fs } from 'node:fs'

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  stl: 'model/stl',
  '3mf': 'model/3mf',
}

export default defineEventHandler(async (event) => {
  const rel = getRouterParam(event, 'path') ?? ''
  if (!rel.startsWith('projects/')) throw createError({ statusCode: 404 })
  const abs = resolveDataPath(rel)
  const stat = await fs.stat(abs).catch(() => null)
  if (!stat?.isFile()) throw createError({ statusCode: 404 })

  const ext = rel.split('.').pop()?.toLowerCase() ?? ''
  setResponseHeaders(event, {
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  })
  return sendStream(event, createReadStream(abs))
})
