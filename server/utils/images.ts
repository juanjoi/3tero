import { promises as fs } from 'node:fs'
import sharp from 'sharp'

export const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif|heic|heif|jfif|bmp|tiff?)$/i

/**
 * Re-encodes an uploaded image to WebP (max 2560 px, EXIF rotation applied, metadata stripped)
 * and generates a 640 px thumbnail. Removes the temporary file.
 */
export async function processImage(tmpPath: string, relBase: string) {
  try {
    const meta = await sharp(tmpPath).metadata().catch(() => null)
    if (!meta?.width) throw createError({ statusCode: 415, statusMessage: 'El fichero no es una imagen válida' })

    const path = `${relBase}.webp`
    const thumbPath = `${relBase}.thumb.webp`
    const absPath = resolveDataPath(path)
    await fs.mkdir(resolveDataPath(relBase.split('/').slice(0, -1).join('/')), { recursive: true })

    const base = sharp(tmpPath).rotate()
    await base.clone()
      .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(absPath)
    await base.clone()
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(resolveDataPath(thumbPath))

    const [{ size: a }, { size: b }] = await Promise.all([fs.stat(absPath), fs.stat(resolveDataPath(thumbPath))])
    return { path, thumbPath, size: a + b }
  }
  finally {
    await fs.rm(tmpPath, { force: true })
  }
}
