// Restores a backup ZIP, replacing ALL current data. Requires the multipart field confirm=REPLACE.
export default defineEventHandler(async (event) => {
  const { quotaBytes } = limits()
  const { files, fields } = await receiveUploads(event, {
    maxFileBytes: quotaBytes + 1024 * 1024 * 1024,
    maxFiles: 1,
    accept: name => /\.zip$/i.test(name),
  })
  try {
    if (fields.confirm !== 'REPLACE') throw createError({ statusCode: 400, statusMessage: 'Falta la confirmación' })
    const f = files[0]
    if (!f) throw createError({ statusCode: 400, statusMessage: 'No se ha recibido ningún fichero .zip' })
    return await restoreBackup(f.tmpPath)
  }
  finally {
    await discardUploads(files)
  }
})
