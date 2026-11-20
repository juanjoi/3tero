import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { Invalid3mfError, parseBambu3mf, readEntry, summarize3mf } from '../server/lib/bambu3mf'
import { fitsVolume, parseStl } from '../server/lib/stl'

const md = (k: string, v: string) => `<metadata key="${k}" value="${v}"/>`

/** Minimal sliced .gcode.3mf as written by Bambu Studio 2.x (2 plates, 2 filaments). */
function slicedFixture() {
  return zipSync({
    '3D/3dmodel.model': strToU8(`<?xml version="1.0"?><model unit="millimeter">
      <metadata name="Application">BambuStudio-02.09.01.70</metadata>
      <metadata name="Title">Gridfinity bin</metadata>
      <metadata name="DesignModelId">3029073</metadata>
      <resources/><build/></model>`),
    'Metadata/project_settings.config': strToU8(JSON.stringify({
      printer_model: 'Bambu Lab A1 mini',
      printer_settings_id: 'Bambu Lab A1 mini 0.4 nozzle',
      nozzle_diameter: ['0.4'],
      layer_height: '0.2',
      filament_type: ['PLA', 'PLA'],
      filament_colour: ['#161616', '#F97316FF'],
      filament_ids: ['GFA00', 'GFA00'],
    })),
    'Metadata/slice_info.config': strToU8(`<config>
      <header><header_item key="X-BBL-Client-Version" value="02.09.01.70"/></header>
      <plate>${md('index', '1')}${md('printer_model_id', 'N1')}${md('prediction', '3600')}${md('weight', '50.5')}${md('outside', 'false')}
        <object identify_id="1" name="bin.stl" skipped="false"/>
        <filament id="1" tray_info_idx="GFA00" type="PLA" color="#161616" used_m="16.1" used_g="48.2"/>
        <filament id="2" type="PLA" color="#F97316" used_m="0.8" used_g="2.3"/>
      </plate>
      <plate>${md('index', '2')}${md('printer_model_id', 'N1')}${md('prediction', '1800')}${md('weight', '20')}${md('outside', 'false')}
        <filament id="1" type="PLA" color="#161616" used_m="6.7" used_g="20"/>
      </plate>
    </config>`),
    'Metadata/model_settings.config': strToU8(`<config>
      <plate>${md('plater_id', '1')}${md('plater_name', 'Main')}${md('thumbnail_file', 'Metadata/plate_1.png')}${md('gcode_file', 'Metadata/plate_1.gcode')}</plate>
      <plate>${md('plater_id', '2')}</plate>
    </config>`),
    'Metadata/plate_1.json': strToU8(JSON.stringify({ bbox_objects: [{ name: 'bin', bbox: [10, 10, 52, 94] }, { name: 'wipe_tower', bbox: [0, 0, 170, 170] }] })),
    'Metadata/plate_1.gcode': strToU8('; HEADER_BLOCK_START\n; max_z_height: 42.40\n; HEADER_BLOCK_END\nG28\n'),
    'Metadata/plate_1.png': new Uint8Array([0x89, 0x50, 0x4E, 0x47, 1, 2, 3]),
  })
}

/** Minimal un-sliced project with the production-extension split and transforms. */
function projectFixture() {
  const cube = (sx: number, sy: number, sz: number) => [
    [0, 0, 0], [sx, 0, 0], [sx, sy, 0], [0, sy, 0], [0, 0, sz], [sx, 0, sz], [sx, sy, sz], [0, sy, sz],
  ].map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`).join('')
  return zipSync({
    '3D/3dmodel.model': strToU8(`<model xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
      <metadata name="Application">BambuStudio-02.01.01.52</metadata>
      <resources><object id="1" type="model"><components>
        <component p:path="/3D/Objects/object_1.model" objectid="2" transform="1 0 0 0 1 0 0 0 1 5 5 0"/>
      </components></object></resources>
      <build><item objectid="1" transform="0 1 0 -1 0 0 0 0 1 90 90 0" printable="1"/></build></model>`),
    '3D/Objects/object_1.model': strToU8(`<model><resources><object id="2" type="model"><mesh><vertices>${cube(120, 40, 15)}</vertices></mesh></object></resources></model>`),
    'Metadata/project_settings.config': strToU8(JSON.stringify({ filament_type: ['PETG'], filament_colour: ['#FFFFFF'] })),
    'Metadata/slice_info.config': strToU8('<config><header><header_item key="X-BBL-Client-Version" value="02.01.01.52"/></header></config>'),
    'Metadata/model_settings.config': strToU8(`<config><plate>${md('plater_id', '1')}<model_instance>${md('object_id', '1')}</model_instance></plate></config>`),
  })
}

describe('parseBambu3mf — sliced file', () => {
  const r = parseBambu3mf(slicedFixture())

  it('reads slicer, printer and MakerWorld metadata', () => {
    expect(r).toMatchObject({
      slicer: 'BambuStudio',
      version: '02.09.01.70',
      title: 'Gridfinity bin',
      makerworldDesignId: '3029073',
      isSliced: true,
      printer: { model: 'Bambu Lab A1 mini', modelId: 'N1', nozzle: '0.4' },
      layerHeight: 0.2,
    })
  })

  it('reads per-plate time, weight and filaments', () => {
    expect(r.plates).toHaveLength(2)
    expect(r.plates[0]).toMatchObject({ index: 1, name: 'Main', sliced: true, minutes: 60, grams: 50.5, outside: false, thumbnail: 'Metadata/plate_1.png' })
    expect(r.plates[0]!.filaments).toEqual([
      expect.objectContaining({ slot: 1, type: 'PLA', colorHex: '#161616', grams: 48.2, trayInfoIdx: 'GFA00' }),
      expect.objectContaining({ slot: 2, colorHex: '#F97316', grams: 2.3 }),
    ])
  })

  it('takes XY from plate_N.json (ignoring the wipe tower) and Z from the G-code header', () => {
    expect(r.plates[0]!.bbox).toEqual({ x: 42, y: 84, z: 42.4, source: 'plate_json+gcode' })
  })

  it('summarizes totals across plates', () => {
    const s = summarize3mf(r)
    expect(s.minutes).toBe(90)
    expect(s.plates).toBe(2)
    expect(s.filaments.map(f => [f.slot, f.grams])).toEqual([[1, 68.2], [2, 2.3]])
    expect(s.anyOutside).toBe(false)
    expect(readEntry(slicedFixture(), s.thumbnail!)?.[0]).toBe(0x89)
  })
})

describe('parseBambu3mf — project file', () => {
  const r = parseBambu3mf(projectFixture())

  it('is not sliced and lists project filaments', () => {
    expect(r.isSliced).toBe(false)
    expect(r.projectFilaments).toEqual([expect.objectContaining({ slot: 1, type: 'PETG', colorHex: '#FFFFFF' })])
  })

  it('computes the mesh bbox through components and rotated build transforms', () => {
    // 120×40×15 cube rotated 90° around Z → 40×120×15
    expect(r.plates[0]!.bbox).toEqual({ x: 40, y: 120, z: 15, source: 'mesh' })
  })
})

describe('parseBambu3mf — invalid input', () => {
  it('rejects non-zip data', () => {
    expect(() => parseBambu3mf(strToU8('solid not a zip'))).toThrow(Invalid3mfError)
  })

  it('rejects a zip without a 3D model', () => {
    expect(() => parseBambu3mf(zipSync({ 'readme.txt': strToU8('hi') }))).toThrow(Invalid3mfError)
  })
})

describe('parseStl', () => {
  it('reads a binary STL', () => {
    const buf = new Uint8Array(84 + 50)
    const v = new DataView(buf.buffer)
    v.setUint32(80, 1, true)
    const pts = [[0, 0, 0], [30, 0, 0], [0, 20, 10]]
    pts.forEach((p, i) => p.forEach((c, k) => v.setFloat32(84 + 12 + i * 12 + k * 4, c, true)))
    expect(parseStl(buf)).toEqual({ binary: true, triangles: 1, bbox: { x: 30, y: 20, z: 10 } })
  })

  it('reads an ASCII STL', () => {
    const txt = 'solid t\nfacet normal 0 0 1\nouter loop\nvertex -5 0 0\nvertex 5 0 0\nvertex 0 200 1.5\nendloop\nendfacet\nendsolid t\n'
    expect(parseStl(new TextEncoder().encode(txt))).toEqual({ binary: false, triangles: 1, bbox: { x: 10, y: 200, z: 1.5 } })
  })
})

describe('fitsVolume', () => {
  const a1mini = { x: 180, y: 180, z: 180 }
  it.each([
    [{ x: 179, y: 179, z: 40 }, true],
    [{ x: 200, y: 100, z: 10 }, false],
    [{ x: 100, y: 100, z: 181 }, false],
    [{ x: 100, y: 100, z: null }, true],
  ])('%o → %s', (bbox, expected) => {
    expect(fitsVolume(bbox, a1mini)).toBe(expected)
  })
})
