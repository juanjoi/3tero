// Measure cost of computing XY/Z extents of extrusion moves by streaming plate_N.gcode out of a .gcode.3mf.
import { Unzip, UnzipInflate } from 'fflate'
import { readFileSync } from 'node:fs'

for (const f of process.argv.slice(2)) {
  const t = performance.now()
  const buf = readFileSync(f)
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  let x = 0, y = 0, z = 0, rest = '', bytes = 0, inWipeTower = true
  const dec = new TextDecoder()
  const uz = new Unzip(); uz.register(UnzipInflate)
  uz.onfile = (file) => {
    if (!/^Metadata\/plate_\d+\.gcode$/.test(file.name)) return
    file.ondata = (err, chunk, final) => {
      bytes += chunk.length
      const lines = (rest + dec.decode(chunk, { stream: !final })).split('\n'); rest = lines.pop() ?? ''
      for (const l of lines) {
        if (l.charCodeAt(0) === 59) { // ';'
          if (l.startsWith('; FEATURE:')) inWipeTower = /Prime tower|Wipe tower|Custom|Skirt|Brim/.test(l)
          continue
        }
        if (!(l.startsWith('G1 ') || l.startsWith('G0 ') || l.startsWith('G2 ') || l.startsWith('G3 '))) continue
        let e = false
        for (const tok of l.split(' ')) {
          const c = tok[0], v = +tok.slice(1)
          if (c === 'X') x = v; else if (c === 'Y') y = v; else if (c === 'Z') z = v; else if (c === 'E' && v > 0) e = true
        }
        if (e && !inWipeTower) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.min(b[2], z); b[3] = Math.max(b[3], x); b[4] = Math.max(b[4], y); b[5] = Math.max(b[5], z) }
      }
    }
    file.start()
  }
  uz.push(buf, true)
  console.log(f, `${(bytes / 1e6).toFixed(1)}MB gcode`, 'extruded extents', b.map((v) => +v.toFixed(2)), 'size', [b[3] - b[0], b[4] - b[1], b[5]].map((v) => +v.toFixed(2)), `${(performance.now() - t).toFixed(0)} ms`)
}
