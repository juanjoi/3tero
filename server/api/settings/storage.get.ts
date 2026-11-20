export default defineEventHandler(async () => {
  const lim = limits()
  return {
    usedBytes: await storageUsage(),
    quotaBytes: lim.quotaBytes,
    maxModelBytes: lim.maxModelBytes,
    warnModelBytes: lim.warnModelBytes,
    maxImageBytes: lim.maxImageBytes,
    maxFilesPerProject: lim.maxFilesPerProject,
    maxImagesPerProject: lim.maxImagesPerProject,
  }
})
