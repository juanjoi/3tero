// Full backup / restore as a single ZIP: `layra-backup.json` (every table) + `media/…` (data volume files).
// Both directions stream, so multi-GB backups never sit in memory. See docs/ops/backup.md.
import { closeSync, createReadStream, mkdirSync, openSync, promises as fs, writeSync } from 'node:fs'
import { dirname, relative, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PassThrough } from 'node:stream'
import { once } from 'node:events'
import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from 'fflate'

export const BACKUP_FORMAT = 1
const JSON_NAME = 'layra-backup.json'

/** Parent tables first (insert order); restore truncates them all at once. */
export const BACKUP_TABLES = [
  'settings', 'tags', 'filaments', 'materials', 'projects', 'project_images', 'project_files',
  'file_filaments', 'project_materials', 'project_tags', 'print_logs', 'print_log_filaments',
  'print_log_images', 'status_history', 'project_sources',
] as const

interface BackupJson {
  format: number
  app: 'layra'
  exportedAt: string
  migrations: number
  tables: Record<string, Record<string, unknown>[]>
}

async function migrationCount() {
  const { rows } = await usePool().query<{ n: number }>('SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations')
  return rows[0]?.n ?? 0
}

async function listMedia(dir: string): Promise<string[]> {
  const out: string[] = []
  const walk = async (d: string) => {
    for (const e of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
      const abs = `${d}${sep}${e.name}`
      if (e.isDirectory()) await walk(abs)
      else if (e.isFile()) out.push(abs)
    }
  }
  await walk(dir)
  return out
}

/** Streams a ZIP with the database dump and every stored file. */
export function exportBackup(): PassThrough {
  const out = new PassThrough()
  const zip = new Zip((err, chunk, final) => {
    if (err) return out.destroy(err)
    out.write(chunk)
    if (final) out.end()
  })

  ;(async () => {
    const pool = usePool()
    const tables: BackupJson['tables'] = {}
    for (const t of BACKUP_TABLES) {
      const { rows } = await pool.query(`SELECT * FROM ${t}`)
      tables[t] = rows
    }
    const json: BackupJson = { format: BACKUP_FORMAT, app: 'layra', exportedAt: new Date().toISOString(), migrations: await migrationCount(), tables }
    const entry = new ZipDeflate(JSON_NAME, { level: 6 })
    zip.add(entry)
    entry.push(new TextEncoder().encode(JSON.stringify(json)), true)

    const root = dataRoot()
    for (const abs of await listMedia(resolveDataPath('projects'))) {
      const name = `media/${relative(root, abs).split(sep).join('/')}`
      const file = new ZipPassThrough(name) // media is already compressed (WebP, 3MF)
      zip.add(file)
      for await (const chunk of createReadStream(abs)) {
        file.push(chunk as Uint8Array)
        if (out.writableNeedDrain) await once(out, 'drain') // backpressure: slow client, slow reads
      }
      file.push(new Uint8Array(0), true)
    }
    zip.end()
  })().catch(err => out.destroy(err))

  return out
}

/**
 * Replaces ALL data with the content of a backup ZIP.
 * Media is unpacked into a staging folder first; the database is replaced in one transaction;
 * only then the media folder is swapped. A failure before the swap leaves everything as it was.
 */
export async function restoreBackup(zipPath: string) {
  const staging = resolveDataPath(`tmp/restore-${randomUUID()}`)
  await fs.mkdir(staging, { recursive: true })
  let json: BackupJson | null = null
  let files = 0

  try {
    // 1. Stream-unzip: JSON in memory, media to the staging folder
    await new Promise<void>((resolveP, reject) => {
      const uz = new Unzip()
      uz.register(UnzipInflate)
      const jsonChunks: Uint8Array[] = []
      uz.onfile = (f) => {
        if (f.name === JSON_NAME) {
          f.ondata = (err, data, final) => {
            if (err) return reject(err)
            jsonChunks.push(data)
            if (final) {
              try { json = JSON.parse(Buffer.concat(jsonChunks).toString('utf8')) }
              catch (e) { reject(e) }
            }
          }
          f.start()
          return
        }
        // Only media/projects/** is accepted; anything else (or escaping paths) is ignored
        if (!/^media\/projects\/[\w./-]+$/.test(f.name) || f.name.includes('..') || f.name.endsWith('/')) return
        const target = resolveDataPath(`${relative(dataRoot(), staging)}/${f.name.slice('media/'.length)}`)
        mkdirSync(dirname(target), { recursive: true })
        const fd = openSync(target, 'w')
        f.ondata = (err, data, final) => {
          if (err) { closeSync(fd); return reject(err) }
          writeSync(fd, data)
          if (final) { closeSync(fd); files++ }
        }
        f.start()
      }
      const stream = createReadStream(zipPath, { highWaterMark: 1024 * 1024 })
      stream.on('data', chunk => uz.push(chunk as Uint8Array))
      stream.on('end', () => { uz.push(new Uint8Array(0), true); resolveP() })
      stream.on('error', reject)
    })

    const backup = json as BackupJson | null
    if (!backup || backup.app !== 'layra' || backup.format !== BACKUP_FORMAT || typeof backup.tables !== 'object') {
      throw createError({ statusCode: 422, statusMessage: 'El fichero no es una copia de seguridad válida' })
    }
    if (backup.migrations > await migrationCount()) {
      throw createError({ statusCode: 422, statusMessage: 'La copia es de una versión más nueva de la aplicación: actualiza primero' })
    }

    // 2. Database: truncate and insert everything in one transaction.
    // Only columns present in the backup are inserted, so older backups get defaults for new columns.
    const client = await usePool().connect()
    try {
      await client.query('BEGIN')
      await client.query(`TRUNCATE ${BACKUP_TABLES.join(', ')} CASCADE`)
      for (const t of BACKUP_TABLES) {
        const rows = backup.tables[t] ?? []
        if (!rows.length) continue
        const { rows: cols } = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [t])
        const present = cols.map(c => c.column_name).filter(c => c in rows[0]!)
        const list = present.map(c => `"${c}"`).join(', ')
        // Batches keep each parameter reasonably small
        for (let i = 0; i < rows.length; i += 500) {
          await client.query(
            `INSERT INTO ${t} (${list}) SELECT ${list} FROM json_populate_recordset(null::${t}, $1::json)`,
            [JSON.stringify(rows.slice(i, i + 500))],
          )
        }
      }
      await client.query('COMMIT')
    }
    catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    }
    finally {
      client.release()
    }

    // 3. Swap media folders
    const current = resolveDataPath('projects')
    const old = resolveDataPath(`tmp/old-${randomUUID()}`)
    await fs.rename(current, old).catch(() => {})
    await fs.rename(`${staging}${sep}projects`, current).catch(async () => fs.mkdir(current, { recursive: true }))
    await fs.rm(old, { recursive: true, force: true })

    const counts = Object.fromEntries(BACKUP_TABLES.map(t => [t, backup.tables[t]?.length ?? 0]))
    return { projects: counts.projects ?? 0, files, exportedAt: backup.exportedAt }
  }
  finally {
    await fs.rm(staging, { recursive: true, force: true })
  }
}
