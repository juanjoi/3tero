// Runs the 3MF / STL parsers on an uploaded file and maps the result to our data model.
import { promises as fs } from 'node:fs'
import sharp from 'sharp'
import { and, eq, sql } from 'drizzle-orm'
import { Invalid3mfError, parseBambu3mf, readEntry, summarize3mf } from '../lib/bambu3mf'
import type { FilamentUse } from '../lib/bambu3mf'
import { fitsVolume, parseStl } from '../lib/stl'

export interface ModelAnalysis {
  sliced: boolean
  estMinutes: number | null
  plates: number | null
  printerModelId: string | null
  bbox: { x: number, y: number, z: number | null } | null
  fitsPrinter: boolean | null
  filaments: FilamentUse[]
  thumbnail: Uint8Array | null
  parsed: Record<string, unknown>
}

const isA1mini = (modelId?: string, model?: string) => modelId === 'N1' || /a1 mini/i.test(model ?? '')

export async function analyzeModel(absPath: string, format: 'stl' | '3mf'): Promise<ModelAnalysis> {
  const buf = new Uint8Array(await fs.readFile(absPath))

  if (format === 'stl') {
    const stl = parseStl(buf)
    return {
      sliced: false,
      estMinutes: null,
      plates: null,
      printerModelId: null,
      bbox: stl.bbox,
      fitsPrinter: stl.bbox ? fitsVolume(stl.bbox, PRINTER_VOLUME_MM) : null,
      filaments: [],
      thumbnail: null,
      parsed: { type: 'stl', ...stl },
    }
  }

  let r
  try {
    r = parseBambu3mf(buf)
  }
  catch (err) {
    if (err instanceof Invalid3mfError) throw createError({ statusCode: 415, statusMessage: err.message })
    throw err
  }
  const s = summarize3mf(r)
  const a1mini = isA1mini(r.printer.modelId, r.printer.model)
  let fitsPrinter: boolean | null = null
  if (r.isSliced && a1mini) fitsPrinter = !s.anyOutside
  else if (s.bbox && !(r.isSliced && s.bbox.z === null)) fitsPrinter = fitsVolume(s.bbox, PRINTER_VOLUME_MM)

  return {
    sliced: r.isSliced,
    estMinutes: s.minutes ?? null,
    plates: s.plates || null,
    printerModelId: r.printer.modelId ?? null,
    bbox: s.bbox,
    fitsPrinter,
    filaments: s.filaments,
    thumbnail: s.thumbnail ? readEntry(buf, s.thumbnail) ?? null : null,
    parsed: {
      type: '3mf',
      ...r,
      plates: r.plates.map(p => ({ ...p, objects: p.objects.slice(0, 50) })),
      slicedForA1mini: r.isSliced ? a1mini : undefined,
    },
  }
}

/** Saves a plate thumbnail (PNG inside the 3MF) as WebP. Returns its relative path or null. */
export async function storeThumbnail(png: Uint8Array | null, rel: string) {
  if (!png || png[0] !== 0x89 || png[1] !== 0x50) return null
  try {
    await fs.mkdir(resolveDataPath(rel).replace(/\/[^/]+$/, ''), { recursive: true })
    await sharp(png).webp({ quality: 80 }).toFile(resolveDataPath(rel))
    return rel
  }
  catch {
    return null
  }
}

/**
 * Maps filaments found in a 3MF to the catalogue: same type + colour (preferring the same Bambu preset).
 * Missing ones are created with the default price so the cost can be computed; returns how many were created.
 */
export async function matchFilaments(uses: FilamentUse[]) {
  const db = useDb()
  const { defaultFilamentPricePerKg } = useRuntimeConfig()
  const result: { filamentId: string, slot: number, grams: number }[] = []
  let created = 0
  for (const u of uses) {
    if (!u.colorHex || !u.type || !u.grams) continue
    const candidates = await db.select().from(schema.filaments).where(and(
      eq(sql`upper(${schema.filaments.colorHex})`, u.colorHex.toUpperCase()),
      eq(sql`lower(${schema.filaments.type})`, u.type.toLowerCase()),
    ))
    let match = candidates.find(c => u.trayInfoIdx && c.bambuPresetId === u.trayInfoIdx) ?? candidates[0]
    if (!match) {
      ;[match] = await db.insert(schema.filaments).values({
        type: u.type,
        brand: /^bambu/i.test(u.profile ?? '') ? 'Bambu' : null,
        colorName: u.colorHex,
        colorHex: u.colorHex,
        pricePerKg: String(defaultFilamentPricePerKg),
        bambuPresetId: u.trayInfoIdx ?? null,
      }).returning()
      created++
    }
    result.push({ filamentId: match!.id, slot: u.slot, grams: u.grams })
  }
  return { filaments: result, created }
}
