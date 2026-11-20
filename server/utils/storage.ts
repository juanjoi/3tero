// File storage on the data volume (ADR 0004).
// Layout: projects/<projectId>/images/<id>.webp|.thumb.webp, projects/<projectId>/files/<id>.<ext>, tmp/
import { createWriteStream, promises as fs } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { dirname, resolve, sep } from 'node:path'
import busboy from 'busboy'
import type { H3Event } from 'h3'

const MB = 1024 * 1024

export function dataRoot() {
  return resolve(useRuntimeConfig().dataDir)
}

/** Resolves a path relative to the data root, refusing anything that escapes it. */
export function resolveDataPath(rel: string) {
  const root = dataRoot()
  const abs = resolve(root, rel)
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }
  return abs
}

export function limits() {
  const l = useRuntimeConfig().limits
  return {
    maxModelBytes: Number(l.maxModelMb) * MB,
    warnModelBytes: Number(l.warnModelMb) * MB,
    maxImageBytes: Number(l.maxImageMb) * MB,
    maxFilesPerProject: Number(l.maxFilesPerProject),
    maxImagesPerProject: Number(l.maxImagesPerProject),
    quotaBytes: Number(l.storageQuotaGb) * 1024 * MB,
  }
}

/** Bytes used by stored files, according to the database. */
export async function storageUsage(): Promise<number> {
  const { rows } = await usePool().query<{ used: string }>(`
    SELECT COALESCE((SELECT SUM(size) FROM project_images), 0)
         + COALESCE((SELECT SUM(size) FROM project_files), 0)
         + COALESCE((SELECT SUM(size) FROM print_log_images), 0) AS used`)
  return Number(rows[0]?.used ?? 0)
}

/** Rejects early (before reading the body) when the request would exceed the quota. */
export async function assertQuota(event: H3Event) {
  const incoming = Number(getRequestHeader(event, 'content-length') ?? 0)
  const { quotaBytes } = limits()
  if ((await storageUsage()) + incoming > quotaBytes) {
    throw createError({ statusCode: 507, statusMessage: 'Se ha alcanzado el límite de almacenamiento' })
  }
}

export interface UploadedFile {
  field: string
  tmpPath: string
  size: number
  sha256: string
  originalName: string
  mimeType: string
}

export interface ReceiveOptions {
  maxFileBytes: number
  maxFiles: number
  accept: (originalName: string) => boolean
}

/**
 * Streams a multipart request to temporary files (never buffered in memory),
 * enforcing size, count and extension limits.
 */
export async function receiveUploads(event: H3Event, opts: ReceiveOptions) {
  const tmpDir = resolveDataPath('tmp')
  await fs.mkdir(tmpDir, { recursive: true })

  const files: UploadedFile[] = []
  const fields: Record<string, string> = {}
  const pending: Promise<void>[] = []
  let failure: Error | undefined

  const fail = (statusCode: number, statusMessage: string) => {
    failure ??= createError({ statusCode, statusMessage })
  }

  await new Promise<void>((done, reject) => {
    let bb: busboy.Busboy
    try {
      bb = busboy({
        headers: event.node.req.headers,
        limits: { fileSize: opts.maxFileBytes, files: opts.maxFiles, fields: 20, fieldSize: 10_000 },
      })
    }
    catch {
      reject(createError({ statusCode: 400, statusMessage: 'Se esperaba multipart/form-data' }))
      return
    }

    bb.on('field', (name, value) => {
      fields[name] = value
    })

    bb.on('file', (field, stream, info) => {
      const originalName = Buffer.from(info.filename ?? '', 'latin1').toString('utf8') || 'file'
      if (failure || !opts.accept(originalName)) {
        if (!failure) fail(415, `Tipo de fichero no permitido: ${originalName}`)
        stream.resume()
        return
      }
      const tmpPath = resolve(tmpDir, randomUUID())
      const hash = createHash('sha256')
      let size = 0
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length
        hash.update(chunk)
      })
      stream.on('limit', () => fail(413, `Fichero demasiado grande: ${originalName}`))
      pending.push(new Promise<void>((ok, ko) => {
        const out = createWriteStream(tmpPath)
        stream.pipe(out)
        out.on('finish', () => {
          files.push({ field, tmpPath, size, sha256: hash.digest('hex'), originalName, mimeType: info.mimeType })
          ok()
        })
        out.on('error', ko)
      }))
    })

    bb.on('filesLimit', () => fail(413, 'Demasiados ficheros en una sola subida'))
    bb.on('error', reject)
    bb.on('close', () => done())
    event.node.req.pipe(bb)
  })

  await Promise.all(pending)

  if (failure) {
    await discardUploads(files)
    throw failure
  }
  return { files, fields }
}

export async function discardUploads(files: UploadedFile[]) {
  await Promise.all(files.map(f => fs.rm(f.tmpPath, { force: true })))
}

/** Moves a temporary upload to its final relative path. */
export async function storeFile(tmpPath: string, rel: string) {
  const abs = resolveDataPath(rel)
  await fs.mkdir(dirname(abs), { recursive: true })
  await fs.rename(tmpPath, abs)
  return rel
}

export async function removeStored(...rels: (string | null | undefined)[]) {
  await Promise.all(rels.filter(Boolean).map(r => fs.rm(resolveDataPath(r!), { force: true })))
}

export async function removeProjectDir(projectId: string) {
  await fs.rm(resolveDataPath(`projects/${projectId}`), { recursive: true, force: true })
}

export async function readHead(path: string, bytes = 512): Promise<Buffer> {
  const fh = await fs.open(path, 'r')
  try {
    const buf = Buffer.alloc(bytes)
    const { bytesRead } = await fh.read(buf, 0, bytes, 0)
    return buf.subarray(0, bytesRead)
  }
  finally {
    await fh.close()
  }
}
