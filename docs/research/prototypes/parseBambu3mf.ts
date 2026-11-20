// Prototype: parse Bambu Studio / OrcaSlicer 3MF (project or .gcode.3mf) in Node.
// Run: node parseBambu3mf.ts <file.3mf> [...]   (Node >= 23.6 strips types natively)
import { unzipSync, Unzip, UnzipInflate, strFromU8 } from 'fflate'
import { XMLParser } from 'fast-xml-parser'
import { readFileSync } from 'node:fs'

export interface FilamentUse { slot: number; type?: string; colorHex?: string; grams?: number; meters?: number; trayInfoIdx?: string; profile?: string }
export interface Bbox { x: number; y: number; z: number; source: 'mesh' | 'plate_json+gcode' | 'plate_json' }
export interface PlateInfo {
  index: number; name?: string; minutes?: number; grams?: number
  filaments: FilamentUse[]; thumbnail?: string; thumbnailSmall?: string; bbox?: Bbox; objects: string[]
  sliced: boolean; gcodePath?: string
}
export interface Bambu3mf {
  slicer: 'BambuStudio' | 'OrcaSlicer' | 'unknown'; version?: string; bambuCompatVersion?: string
  printer?: { model?: string; modelId?: string; preset?: string; nozzle?: string; bedSize?: [number, number, number] }
  layerHeight?: number; plates: PlateInfo[]; isSliced: boolean; title?: string; projectFilaments: FilamentUse[]
  warnings: string[]
}

const MAX_ENTRY = 200 * 1024 * 1024 // refuse to inflate any single XML entry above this (zip-bomb guard)
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (n) => ['plate', 'metadata', 'filament', 'object', 'part', 'model_instance', 'item', 'component', 'header_item'].includes(n) })

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : undefined }
const kv = (arr: any[] | undefined) => Object.fromEntries((arr ?? []).filter((m) => m && 'key' in m).map((m) => [m.key, m.value]))

export function parseBambu3mf(buf: Uint8Array, opts: { computeMeshBbox?: boolean } = {}): Bambu3mf {
  const warnings: string[] = []
  // 1) Inflate only small metadata entries; skip G-code and (optionally) meshes.
  const files = unzipSync(buf, {
    filter: (f) => {
      if (/\.gcode$/i.test(f.name) || /\.(png|jpe?g|webp)$/i.test(f.name)) return false
      if (f.name.startsWith('3D/Objects/') && !opts.computeMeshBbox) return false
      if (f.originalSize > MAX_ENTRY) { warnings.push(`skipped huge entry ${f.name}`); return false }
      return true
    },
  })
  const allNames = listEntries(buf)
  const text = (n: string) => (files[n] ? strFromU8(files[n]) : undefined)

  // 2) Root model metadata -> slicer + version
  const rootXml = text('3D/3dmodel.model') ?? ''
  const meta: Record<string, string> = {}
  for (const m of rootXml.matchAll(/<metadata name="([^"]+)">([^<]*)<\/metadata>/g)) meta[m[1]] = m[2]
  const app = meta['Application'] ?? ''
  const orca = meta['OrcaSlicer']
  const bambuVer = /BambuStudio-([\d.]+)/.exec(app)?.[1]

  // 3) project_settings.config (JSON in BS/Orca; may be absent or "{}"-ish in templates)
  let ps: Record<string, any> = {}
  try { ps = JSON.parse(text('Metadata/project_settings.config') ?? '{}') } catch { warnings.push('project_settings.config not JSON') }
  const arr = (k: string): string[] => (Array.isArray(ps[k]) ? ps[k] : typeof ps[k] === 'string' ? ps[k].split(';') : [])
  const fType = arr('filament_type'), fColor = arr('filament_colour'), fProfile = arr('filament_settings_id')
  const projectFilaments: FilamentUse[] = fType.map((t, i) => ({ slot: i + 1, type: t, colorHex: fColor[i], profile: fProfile[i] }))

  // 4) slice_info.config (only filled with <plate> after slicing)
  const si = xml.parse(text('Metadata/slice_info.config') ?? '<config/>')?.config ?? {}
  const header = Object.fromEntries((si.header?.header_item ?? []).map((h: any) => [h.key, h.value]))
  const slicedPlates = new Map<number, any>()
  for (const p of si.plate ?? []) slicedPlates.set(Number(kv(p.metadata).index), p)

  // 5) model_settings.config -> plate list, names, thumbnails, which objects per plate
  const ms = xml.parse(text('Metadata/model_settings.config') ?? '<config/>')?.config ?? {}
  const objName = new Map<string, string>()
  for (const o of ms.object ?? []) objName.set(String(o.id), kv(o.metadata).name)
  const plateDefs: any[] = ms.plate ?? []
  const indices = new Set<number>([...plateDefs.map((p) => Number(kv(p.metadata).plater_id)), ...slicedPlates.keys()])

  // 6) bbox: mesh (projects) or plate_N.json XY + G-code max_z_height (sliced)
  const meshBboxByObject = opts.computeMeshBbox ? meshBboxes(files, rootXml) : new Map<string, Bbox>()

  const plates: PlateInfo[] = [...indices].filter((i) => i > 0).sort((a, b) => a - b).map((index) => {
    const def = plateDefs.find((p) => Number(kv(p.metadata).plater_id) === index)
    const dm = def ? kv(def.metadata) : {}
    const sp = slicedPlates.get(index)
    const sm = sp ? kv(sp.metadata) : {}
    const gcodePath = dm.gcode_file || (allNames.includes(`Metadata/plate_${index}.gcode`) ? `Metadata/plate_${index}.gcode` : undefined)
    const filaments: FilamentUse[] = (sp?.filament ?? []).map((f: any) => {
      const slot = Number(f.id) // 1-based index into project filament list (NOT the AMS tray)
      return { slot, type: f.type ?? fType[slot - 1], colorHex: (f.color ?? fColor[slot - 1])?.toUpperCase(), grams: num(f.used_g), meters: num(f.used_m), trayInfoIdx: f.tray_info_idx || undefined, profile: fProfile[slot - 1] }
    })
    const objectIds = (def?.model_instance ?? []).map((mi: any) => String(kv(mi.metadata).object_id))
    const objects = sp?.object?.map((o: any) => o.name) ?? objectIds.map((id: string) => objName.get(id) ?? id)
    // bbox
    let bbox: Bbox | undefined
    const meshB = objectIds.map((id: string) => meshBboxByObject.get(id)).filter(Boolean) as Bbox[]
    if (meshB.length) bbox = { x: Math.max(...meshB.map((b) => b.x)), y: Math.max(...meshB.map((b) => b.y)), z: Math.max(...meshB.map((b) => b.z)), source: 'mesh' } // largest single object
    const pj = text(dm.pattern_bbox_file || `Metadata/plate_${index}.json`)
    if (!bbox && pj) {
      try {
        const j = JSON.parse(pj)
        const objs = (j.bbox_objects ?? []).filter((o: any) => o.name !== 'wipe_tower')
        if (objs.length) {
          const x = Math.max(...objs.map((o: any) => o.bbox[2] - o.bbox[0])), y = Math.max(...objs.map((o: any) => o.bbox[3] - o.bbox[1]))
          const z = gcodePath && allNames.includes(gcodePath) ? gcodeMaxZ(buf, gcodePath) : undefined
          bbox = { x: +x.toFixed(2), y: +y.toFixed(2), z: z ?? NaN, source: z ? 'plate_json+gcode' : 'plate_json' }
        }
      } catch { warnings.push(`bad ${pj}`) }
    }
    const pred = num(sm.prediction)
    return {
      index, name: dm.plater_name || undefined, sliced: !!sp, gcodePath: sp ? gcodePath : undefined,
      minutes: pred !== undefined ? Math.round(pred / 60) : undefined, grams: num(sm.weight), filaments, objects,
      thumbnail: pick(allNames, dm.thumbnail_file, `Metadata/plate_${index}.png`),
      thumbnailSmall: pick(allNames, undefined, `Metadata/plate_${index}_small.png`),
      bbox,
    }
  })

  // Generic 3MF (Fusion, PrusaSlicer, SuperSlicer...): no Bambu plate metadata -> one pseudo-plate with mesh bbox
  if (plates.length === 0 && meshBboxByObject.size) {
    const all = [...meshBboxByObject.values()]
    plates.push({ index: 1, sliced: false, filaments: [], objects: [], bbox: { x: Math.max(...all.map((b) => b.x)), y: Math.max(...all.map((b) => b.y)), z: Math.max(...all.map((b) => b.z)), source: 'mesh' } })
  }

  const bedW = arr('printable_area')
  const xs = bedW.map((p) => Number(p.split('x')[0])), ys = bedW.map((p) => Number(p.split('x')[1]))
  return {
    slicer: orca || header['OrcaSlicer-Version'] ? 'OrcaSlicer' : app.startsWith('BambuStudio') ? 'BambuStudio' : 'unknown',
    version: orca ?? header['OrcaSlicer-Version'] ?? bambuVer ?? header['X-BBL-Client-Version'] ?? ps.version,
    bambuCompatVersion: bambuVer,
    printer: {
      model: ps.printer_model, preset: ps.printer_settings_id, nozzle: arr('nozzle_diameter')[0],
      modelId: slicedPlates.size ? kv([...slicedPlates.values()][0].metadata).printer_model_id : undefined,
      bedSize: xs.length ? [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), num(ps.printable_height) ?? 0] : undefined,
    },
    layerHeight: num(ps.layer_height), title: meta['Title'] || undefined,
    plates, isSliced: slicedPlates.size > 0, projectFilaments, warnings,
  }
}

function pick(names: string[], preferred: string | undefined, fallback: string) {
  const p = preferred?.replace(/^\//, '')
  if (p && names.includes(p)) return p
  return names.includes(fallback) ? fallback : undefined
}

// List ZIP entry names from the central directory without inflating anything.
function listEntries(buf: Uint8Array): string[] {
  const names: string[] = []
  unzipSync(buf, { filter: (f) => { names.push(f.name); return false } })
  return names
}

// Inflate only the first chunk of plate_N.gcode and read "; max_z_height: 199.00" from HEADER_BLOCK.
function gcodeMaxZ(buf: Uint8Array, name: string): number | undefined {
  let head = ''
  const uz = new Unzip()
  uz.register(UnzipInflate)
  uz.onfile = (f) => {
    if (f.name !== name) return
    f.ondata = (err, chunk, final) => {
      if (err) return
      head += strFromU8(chunk)
      if (head.length > 64 * 1024 || final) f.terminate()
    }
    f.start()
  }
  // push in slices so we can stop early once header is read
  const step = 1 << 20
  for (let i = 0; i < buf.length && !/HEADER_BLOCK_END/.test(head); i += step) uz.push(buf.subarray(i, i + step), i + step >= buf.length)
  return num(/; max_z_height: ([\d.]+)/.exec(head)?.[1])
}

// ---- mesh bbox (production extension aware) -------------------------------------------
type M = number[] // 3MF 3x4 row-major affine: [m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32]
const I: M = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
const parseM = (s?: string): M => (s ? s.trim().split(/\s+/).map(Number) : I)
const mul = (a: M, b: M): M => { // apply a, then b
  const r: M = []
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += a[i * 3 + k] * b[k * 3 + j]
    r.push(i === 3 ? s + b[9 + j] : s)
  }
  return r
}

function meshBboxes(files: Record<string, Uint8Array>, rootXml: string): Map<string, Bbox> {
  // Index objects per part: id -> {verticesSlice | components}
  const parts = new Map<string, Map<string, { body: string }>>()
  const getPart = (path: string) => {
    const key = path.replace(/^\//, '')
    if (!parts.has(key)) {
      const s = key === '3D/3dmodel.model' ? rootXml : files[key] ? strFromU8(files[key]) : ''
      const m = new Map<string, { body: string }>()
      for (const o of s.matchAll(/<object\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/object>/g)) m.set(o[1], { body: o[2] })
      parts.set(key, m)
    }
    return parts.get(key)!
  }
  const out = new Map<string, Bbox>()
  for (const it of rootXml.matchAll(/<item\b([^>]*)\/?>/g)) {
    const oid = /objectid="([^"]+)"/.exec(it[1])![1]
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    const walk = (part: string, id: string, m: M) => {
      const o = getPart(part).get(id); if (!o) return
      for (const v of o.body.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)) {
        const x = +v[1], y = +v[2], z = +v[3]
        const p = [x * m[0] + y * m[3] + z * m[6] + m[9], x * m[1] + y * m[4] + z * m[7] + m[10], x * m[2] + y * m[5] + z * m[8] + m[11]]
        for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], p[k]); b[k + 3] = Math.max(b[k + 3], p[k]) }
      }
      for (const c of o.body.matchAll(/<component\b([^>]*)\/>/g)) {
        const path = /p:path="([^"]+)"/.exec(c[1])?.[1] ?? part
        walk(path, /objectid="([^"]+)"/.exec(c[1])![1], mul(parseM(/transform="([^"]+)"/.exec(c[1])?.[1]), m))
      }
    }
    walk('3D/3dmodel.model', oid, parseM(/transform="([^"]+)"/.exec(it[1])?.[1]))
    if (b[0] !== Infinity) {
      const prev = out.get(oid) // multiple instances of same object: keep largest
      const bb: Bbox = { x: +(b[3] - b[0]).toFixed(2), y: +(b[4] - b[1]).toFixed(2), z: +(b[5] - b[2]).toFixed(2), source: 'mesh' }
      if (!prev || bb.x * bb.y * bb.z > prev.x * prev.y * prev.z) out.set(oid, bb)
    }
  }
  return out
}

// CLI
if (process.argv[1]?.endsWith('parseBambu3mf.ts')) {
  for (const f of process.argv.slice(2)) {
    const t = performance.now()
    const r = parseBambu3mf(readFileSync(f), { computeMeshBbox: true })
    console.log(`##### ${f} (${(performance.now() - t).toFixed(0)} ms)`)
    console.log(JSON.stringify(r, (k, v) => (k === 'objects' && v.length > 4 ? [...v.slice(0, 4), `…+${v.length - 4}`] : v), 1).replace(/\n\s*/g, ' ').slice(0, 2500))
  }
}
