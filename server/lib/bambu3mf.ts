// Bambu Studio / OrcaSlicer 3MF metadata parser (projects and sliced .gcode.3mf).
// Pure module (no Nitro globals) so it can be unit tested. Format notes: docs/research/bambu-3mf.md
import { Unzip, UnzipInflate, strFromU8, unzipSync } from 'fflate'
import { XMLParser } from 'fast-xml-parser'

export interface FilamentUse {
  slot: number
  type?: string
  colorHex?: string
  grams?: number
  meters?: number
  trayInfoIdx?: string
  profile?: string
}

export interface Bbox {
  x: number
  y: number
  z: number | null
  source: 'mesh' | 'plate_json+gcode' | 'plate_json'
}

export interface PlateInfo {
  index: number
  name?: string
  sliced: boolean
  minutes?: number
  grams?: number
  outside?: boolean
  filaments: FilamentUse[]
  objects: string[]
  thumbnail?: string
  bbox?: Bbox
}

export interface Bambu3mf {
  slicer: 'BambuStudio' | 'OrcaSlicer' | 'unknown'
  version?: string
  title?: string
  designer?: string
  /** `DesignModelId`: MakerWorld modelId hash (e.g. "US793a…"), not the numeric id of the URL */
  /** `DesignModelId`: MakerWorld modelId hash (e.g. "US793a…"), not the numeric id of the URL */
  makerworldDesignId?: string
  printer: { model?: string, modelId?: string, preset?: string, nozzle?: string }
  layerHeight?: number
  isSliced: boolean
  plates: PlateInfo[]
  projectFilaments: FilamentUse[]
  warnings: string[]
}

/** Zip-bomb / abuse guards */
const MAX_ENTRIES = 5000
const MAX_ENTRY_BYTES = 500 * 1024 * 1024
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: n => ['plate', 'metadata', 'filament', 'object', 'part', 'model_instance', 'item', 'component', 'header_item'].includes(n),
})

const num = (v: unknown) => {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
const kv = (arr: any[] | undefined): Record<string, string> =>
  Object.fromEntries((arr ?? []).filter(m => m && 'key' in m).map(m => [m.key, m.value]))
const hex = (c?: string) => (c && /^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7).toUpperCase() : undefined)

export class Invalid3mfError extends Error {}

/** Lists entries from the central directory, enforcing count and size limits. */
function listEntries(buf: Uint8Array) {
  const entries: { name: string, size: number }[] = []
  let total = 0
  try {
    unzipSync(buf, {
      filter: (f) => {
        entries.push({ name: f.name, size: f.originalSize })
        total += f.originalSize
        return false
      },
    })
  }
  catch {
    throw new Invalid3mfError('El fichero no es un ZIP/3MF válido')
  }
  if (entries.length > MAX_ENTRIES) throw new Invalid3mfError('Demasiadas entradas en el 3MF')
  if (total > MAX_TOTAL_BYTES) throw new Invalid3mfError('El 3MF descomprimido es demasiado grande')
  return entries
}

export function parseBambu3mf(buf: Uint8Array): Bambu3mf {
  const warnings: string[] = []
  const entries = listEntries(buf)
  const names = new Set(entries.map(e => e.name))
  if (!names.has('3D/3dmodel.model')) throw new Invalid3mfError('Falta 3D/3dmodel.model: no parece un 3MF')

  // Inflate only small text entries (never G-code or images). Meshes only when needed for the bbox.
  const files = unzipSync(buf, {
    filter: (f) => {
      if (/\.(gcode|png|jpe?g|webp|md5)$/i.test(f.name)) return false
      if (f.originalSize > MAX_ENTRY_BYTES) {
        warnings.push(`Entrada demasiado grande ignorada: ${f.name}`)
        return false
      }
      return true
    },
  })
  const text = (n?: string) => {
    const key = n?.replace(/^\//, '')
    return key && files[key] ? strFromU8(files[key]) : undefined
  }

  // Root model metadata
  const rootXml = text('3D/3dmodel.model') ?? ''
  const meta: Record<string, string> = {}
  for (const m of rootXml.matchAll(/<metadata name="([^"]+)"\s*>([^<]*)<\/metadata>/g)) meta[m[1]!] = m[2]!
  const app = meta.Application ?? ''
  const bambuVer = /BambuStudio-([\d.]+)/.exec(app)?.[1]

  // project_settings.config (JSON)
  let ps: Record<string, any> = {}
  const psText = text('Metadata/project_settings.config')
  if (psText) {
    try { ps = JSON.parse(psText) }
    catch { warnings.push('project_settings.config no es JSON') }
  }
  const arr = (k: string): string[] =>
    Array.isArray(ps[k]) ? ps[k].map(String) : typeof ps[k] === 'string' ? ps[k].split(/[;,]/).filter(Boolean) : []
  const fType = arr('filament_type')
  const fColor = arr('filament_colour')
  const fProfile = arr('filament_settings_id')
  const fIds = arr('filament_ids')
  const projectFilaments: FilamentUse[] = fType.map((t, i) => ({
    slot: i + 1, type: t, colorHex: hex(fColor[i]), profile: fProfile[i], trayInfoIdx: fIds[i] || undefined,
  }))

  // slice_info.config: <plate> blocks only after slicing
  const si = xml.parse(text('Metadata/slice_info.config') ?? '<config/>')?.config ?? {}
  const header = Object.fromEntries((si.header?.header_item ?? []).map((h: any) => [h.key, h.value]))
  const sliced = new Map<number, any>()
  for (const p of si.plate ?? []) sliced.set(Number(kv(p.metadata).index), p)

  // model_settings.config: plates, names, thumbnails, objects
  const ms = xml.parse(text('Metadata/model_settings.config') ?? '<config/>')?.config ?? {}
  const objName = new Map<string, string>()
  for (const o of ms.object ?? []) objName.set(String(o.id), kv(o.metadata).name ?? String(o.id))
  const plateDefs: any[] = ms.plate ?? []
  const indices = new Set<number>([...plateDefs.map(p => Number(kv(p.metadata).plater_id)), ...sliced.keys()])

  const meshBoxes = sliced.size ? new Map<string, Bbox>() : meshBboxes(files, rootXml)

  const plates: PlateInfo[] = [...indices].filter(i => i > 0).sort((a, b) => a - b).map((index) => {
    const def = plateDefs.find(p => Number(kv(p.metadata).plater_id) === index)
    const dm = def ? kv(def.metadata) : {}
    const sp = sliced.get(index)
    const sm = sp ? kv(sp.metadata) : {}

    const filaments: FilamentUse[] = (sp?.filament ?? []).map((f: any) => {
      const slot = Number(f.id) // 1-based index into the project filament list, NOT the AMS tray
      return {
        slot,
        type: f.type ?? fType[slot - 1],
        colorHex: hex(f.color ?? fColor[slot - 1]),
        grams: num(f.used_g),
        meters: num(f.used_m),
        trayInfoIdx: f.tray_info_idx || fIds[slot - 1] || undefined,
        profile: fProfile[slot - 1],
      }
    })
    const objectIds: string[] = (def?.model_instance ?? []).map((mi: any) => String(kv(mi.metadata).object_id))
    const objects: string[] = sp?.object?.map((o: any) => o.name) ?? objectIds.map(id => objName.get(id) ?? id)

    // Bounding box: largest single object of the plate (plates are laid out side by side, never union them)
    let bbox: Bbox | undefined
    const meshB = objectIds.map(id => meshBoxes.get(id)).filter((b): b is Bbox => !!b)
    if (meshB.length) {
      bbox = { x: Math.max(...meshB.map(b => b.x)), y: Math.max(...meshB.map(b => b.y)), z: Math.max(...meshB.map(b => b.z ?? 0)), source: 'mesh' }
    }
    const pj = text(dm.pattern_bbox_file || `Metadata/plate_${index}.json`)
    if (!bbox && pj) {
      try {
        const j = JSON.parse(pj)
        const objs = (j.bbox_objects ?? []).filter((o: any) => o.name !== 'wipe_tower' && Array.isArray(o.bbox))
        if (objs.length) {
          const gcodePath = (dm.gcode_file || `Metadata/plate_${index}.gcode`).replace(/^\//, '')
          const z = names.has(gcodePath) ? gcodeMaxZ(buf, gcodePath) : undefined
          bbox = {
            x: round(Math.max(...objs.map((o: any) => o.bbox[2] - o.bbox[0]))),
            y: round(Math.max(...objs.map((o: any) => o.bbox[3] - o.bbox[1]))),
            z: z ?? null,
            source: z ? 'plate_json+gcode' : 'plate_json',
          }
        }
      }
      catch { warnings.push(`plate_${index}.json no válido`) }
    }

    const prediction = num(sm.prediction)
    const thumb = [dm.thumbnail_file?.replace(/^\//, ''), `Metadata/plate_${index}.png`].find(n => n && names.has(n))
    return {
      index,
      name: dm.plater_name || undefined,
      sliced: !!sp,
      minutes: prediction !== undefined ? Math.round(prediction / 60) : undefined,
      grams: num(sm.weight),
      outside: sm.outside === undefined ? undefined : sm.outside === 'true',
      filaments,
      objects,
      thumbnail: thumb,
      bbox,
    }
  })

  // Generic 3MF (Fusion, PrusaSlicer…): no Bambu plates → one pseudo-plate with the overall mesh bbox
  if (!plates.length && meshBoxes.size) {
    const all = [...meshBoxes.values()]
    plates.push({
      index: 1, sliced: false, filaments: [], objects: [],
      bbox: { x: Math.max(...all.map(b => b.x)), y: Math.max(...all.map(b => b.y)), z: Math.max(...all.map(b => b.z ?? 0)), source: 'mesh' },
    })
  }

  const orca = meta.OrcaSlicer ?? header['OrcaSlicer-Version']
  const firstSliced = [...sliced.values()][0]
  return {
    slicer: orca ? 'OrcaSlicer' : app.startsWith('BambuStudio') ? 'BambuStudio' : 'unknown',
    version: orca ?? bambuVer ?? header['X-BBL-Client-Version'] ?? ps.version,
    title: meta.Title || undefined,
    designer: meta.Designer || undefined,
    makerworldDesignId: meta.DesignModelId || undefined,
    printer: {
      model: ps.printer_model,
      preset: ps.printer_settings_id,
      nozzle: arr('nozzle_diameter')[0],
      modelId: firstSliced ? kv(firstSliced.metadata).printer_model_id || undefined : undefined,
    },
    layerHeight: num(ps.layer_height),
    isSliced: sliced.size > 0,
    plates,
    projectFilaments,
    warnings,
  }
}

/** Reads one entry (e.g. a plate thumbnail). Returns undefined if missing or too large. */
export function readEntry(buf: Uint8Array, name: string, maxBytes = 10 * 1024 * 1024): Uint8Array | undefined {
  const out = unzipSync(buf, { filter: f => f.name === name && f.originalSize <= maxBytes })
  return out[name]
}

/** Totals for the whole file: sliced plates summed, filaments merged by slot. */
export function summarize3mf(r: Bambu3mf) {
  const slicedPlates = r.plates.filter(p => p.sliced)
  const bySlot = new Map<number, FilamentUse>()
  for (const p of slicedPlates) {
    for (const f of p.filaments) {
      const prev = bySlot.get(f.slot)
      bySlot.set(f.slot, prev ? { ...prev, grams: round((prev.grams ?? 0) + (f.grams ?? 0)), meters: round((prev.meters ?? 0) + (f.meters ?? 0)) } : { ...f })
    }
  }
  const boxes = r.plates.map(p => p.bbox).filter((b): b is Bbox => !!b)
  return {
    minutes: slicedPlates.length ? slicedPlates.reduce((s, p) => s + (p.minutes ?? 0), 0) : undefined,
    filaments: [...bySlot.values()].sort((a, b) => a.slot - b.slot),
    plates: r.plates.length,
    bbox: boxes.length
      ? { x: Math.max(...boxes.map(b => b.x)), y: Math.max(...boxes.map(b => b.y)), z: boxes.some(b => b.z !== null) ? Math.max(...boxes.map(b => b.z ?? 0)) : null }
      : null,
    anyOutside: slicedPlates.some(p => p.outside === true),
    thumbnail: r.plates.find(p => p.thumbnail)?.thumbnail,
  }
}

const round = (n: number) => Math.round(n * 100) / 100

// Inflates only the start of plate_N.gcode to read "; max_z_height: 199.00" from the header block.
function gcodeMaxZ(buf: Uint8Array, name: string): number | undefined {
  let head = ''
  let done = false
  const uz = new Unzip()
  uz.register(UnzipInflate)
  uz.onfile = (f) => {
    if (f.name !== name) return
    f.ondata = (err, chunk, final) => {
      if (err || done) return
      head += strFromU8(chunk)
      if (head.length > 64 * 1024 || final || head.includes('HEADER_BLOCK_END')) {
        done = true
        f.terminate()
      }
    }
    f.start()
  }
  const step = 1 << 20
  for (let i = 0; i < buf.length && !done; i += step) uz.push(buf.subarray(i, i + step), i + step >= buf.length)
  return num(/; max_z_height: ([\d.]+)/.exec(head)?.[1])
}

// ── Mesh bbox (3MF production extension aware) ───────────────────────────────
type M = number[] // 3x4 row-major affine
const I: M = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
const parseM = (s?: string): M => (s ? s.trim().split(/\s+/).map(Number) : I)
const mul = (a: M, b: M): M => {
  const r: M = []
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0
      for (let k = 0; k < 3; k++) s += a[i * 3 + k]! * b[k * 3 + j]!
      r.push(i === 3 ? s + b[9 + j]! : s)
    }
  }
  return r
}

function meshBboxes(files: Record<string, Uint8Array>, rootXml: string): Map<string, Bbox> {
  const parts = new Map<string, Map<string, string>>()
  const getPart = (path: string) => {
    const key = path.replace(/^\//, '')
    if (!parts.has(key)) {
      const s = key === '3D/3dmodel.model' ? rootXml : files[key] ? strFromU8(files[key]) : ''
      const m = new Map<string, string>()
      for (const o of s.matchAll(/<object\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/object>/g)) m.set(o[1]!, o[2]!)
      parts.set(key, m)
    }
    return parts.get(key)!
  }
  const out = new Map<string, Bbox>()
  for (const it of rootXml.matchAll(/<item\b([^>]*)\/?>/g)) {
    const oid = /objectid="([^"]+)"/.exec(it[1]!)?.[1]
    if (!oid) continue
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    const walk = (part: string, id: string, m: M, depth: number) => {
      if (depth > 16) return
      const body = getPart(part).get(id)
      if (!body) return
      for (const v of body.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)) {
        const x = +v[1]!, y = +v[2]!, z = +v[3]!
        const p = [x * m[0]! + y * m[3]! + z * m[6]! + m[9]!, x * m[1]! + y * m[4]! + z * m[7]! + m[10]!, x * m[2]! + y * m[5]! + z * m[8]! + m[11]!]
        for (let k = 0; k < 3; k++) {
          b[k] = Math.min(b[k]!, p[k]!)
          b[k + 3] = Math.max(b[k + 3]!, p[k]!)
        }
      }
      for (const c of body.matchAll(/<component\b([^>]*)\/>/g)) {
        const path = /p:path="([^"]+)"/.exec(c[1]!)?.[1] ?? part
        const cid = /objectid="([^"]+)"/.exec(c[1]!)?.[1]
        if (cid) walk(path, cid, mul(parseM(/transform="([^"]+)"/.exec(c[1]!)?.[1]), m), depth + 1)
      }
    }
    walk('3D/3dmodel.model', oid, parseM(/transform="([^"]+)"/.exec(it[1]!)?.[1]), 0)
    if (b[0] !== Infinity) {
      const bb: Bbox = { x: round(b[3]! - b[0]!), y: round(b[4]! - b[1]!), z: round(b[5]! - b[2]!), source: 'mesh' }
      const prev = out.get(oid)
      if (!prev || bb.x * bb.y * (bb.z ?? 0) > prev.x * prev.y * (prev.z ?? 0)) out.set(oid, bb)
    }
  }
  return out
}
