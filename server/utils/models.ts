// Model file detection. 3MF parsing (plates, grams, bbox…) arrives in phase 3 (docs/research/bambu-3mf.md).

export const MODEL_EXTENSIONS = /\.(stl|3mf)$/i

export function detectModel(originalName: string, head: Buffer): { format: 'stl' | '3mf', kind: 'model' | 'sliced', ext: string } {
  const name = originalName.toLowerCase()
  if (name.endsWith('.3mf')) {
    // A 3MF is a ZIP container
    if (head.subarray(0, 4).toString('binary') !== 'PK\x03\x04') {
      throw createError({ statusCode: 415, statusMessage: 'El 3MF no es válido (no es un ZIP)' })
    }
    const sliced = name.endsWith('.gcode.3mf')
    return { format: '3mf', kind: sliced ? 'sliced' : 'model', ext: sliced ? '.gcode.3mf' : '.3mf' }
  }
  if (name.endsWith('.stl')) {
    return { format: 'stl', kind: 'model', ext: '.stl' }
  }
  throw createError({ statusCode: 415, statusMessage: 'Solo se admiten ficheros STL y 3MF' })
}
