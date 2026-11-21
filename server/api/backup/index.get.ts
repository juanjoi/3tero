// Downloads a full backup (database + files) as a streamed ZIP.
export default defineEventHandler((event) => {
  const date = new Date().toISOString().slice(0, 10)
  setResponseHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="layra-backup-${date}.zip"`,
    'Cache-Control': 'no-store',
  })
  return sendStream(event, exportBackup())
})
