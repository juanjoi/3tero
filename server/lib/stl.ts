// STL bounding box (binary or ASCII). STL has no units: assume millimetres.

export interface StlInfo {
  binary: boolean
  triangles: number
  bbox: { x: number, y: number, z: number } | null
}

export function parseStl(buf: Uint8Array): StlInfo {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  // Binary detection by size (header "solid" is not reliable: many binary files start with it)
  if (buf.byteLength >= 84) {
    const n = view.getUint32(80, true)
    if (84 + n * 50 === buf.byteLength) {
      const min = [Infinity, Infinity, Infinity]
      const max = [-Infinity, -Infinity, -Infinity]
      for (let t = 0; t < n; t++) {
        const base = 84 + t * 50 + 12 // skip normal
        for (let v = 0; v < 3; v++) {
          for (let k = 0; k < 3; k++) {
            const c = view.getFloat32(base + v * 12 + k * 4, true)
            if (c < min[k]!) min[k] = c
            if (c > max[k]!) max[k] = c
          }
        }
      }
      return { binary: true, triangles: n, bbox: n ? toBox(min, max) : null }
    }
  }
  const text = new TextDecoder().decode(buf)
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  let vertices = 0
  for (const m of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) {
    vertices++
    for (let k = 0; k < 3; k++) {
      const c = Number(m[k + 1])
      if (c < min[k]!) min[k] = c
      if (c > max[k]!) max[k] = c
    }
  }
  return { binary: false, triangles: Math.floor(vertices / 3), bbox: vertices ? toBox(min, max) : null }
}

function toBox(min: number[], max: number[]) {
  const r = (n: number) => Math.round(n * 100) / 100
  return { x: r(max[0]! - min[0]!), y: r(max[1]! - min[1]!), z: r(max[2]! - min[2]!) }
}

/** Does a bbox fit the build volume? Allows rotating the part on the bed (swap X/Y). */
export function fitsVolume(b: { x: number, y: number, z: number | null }, v: { x: number, y: number, z: number }) {
  const zOk = b.z === null || b.z <= v.z + 0.01
  const xyOk = (b.x <= v.x + 0.01 && b.y <= v.y + 0.01) || (b.y <= v.x + 0.01 && b.x <= v.y + 0.01)
  return zOk && xyOk
}
