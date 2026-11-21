import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import { eq, inArray } from 'drizzle-orm'

// Duplicates a project as a new one in "modeling": fields, tags, materials, photos and model
// files (with their filaments). Print history, status history and import source are not copied.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  const src = await getProjectOr404(db, id)
  const [images, files, tagRows, mats] = await Promise.all([
    db.select().from(schema.projectImages).where(eq(schema.projectImages.projectId, id)),
    db.select().from(schema.projectFiles).where(eq(schema.projectFiles.projectId, id)),
    db.select({ name: schema.tags.name }).from(schema.projectTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.projectTags.tagId)).where(eq(schema.projectTags.projectId, id)),
    db.select().from(schema.projectMaterials).where(eq(schema.projectMaterials.projectId, id)),
  ])
  const fileFils = files.length
    ? await db.select().from(schema.fileFilaments).where(inArray(schema.fileFilaments.fileId, files.map(f => f.id)))
    : []

  const extra = images.reduce((s, i) => s + i.size, 0) + files.reduce((s, f) => s + f.size, 0)
  if ((await storageUsage()) + extra > limits().quotaBytes) {
    throw createError({ statusCode: 507, statusMessage: 'No hay espacio para duplicar el proyecto' })
  }

  const newId = randomUUID()
  const copied: string[] = []
  // Same layout, new project folder: projects/<old>/x → projects/<new>/x (with new item ids)
  const copy = async (rel: string | null, oldItemId: string, newItemId: string) => {
    if (!rel) return null
    const target = rel.replace(`projects/${id}/`, `projects/${newId}/`).replace(oldItemId, newItemId)
    await fs.mkdir(dirname(resolveDataPath(target)), { recursive: true })
    await fs.copyFile(resolveDataPath(rel), resolveDataPath(target))
    copied.push(target)
    return target
  }

  try {
    const imageIds = new Map(images.map(i => [i.id, randomUUID()]))
    const fileIds = new Map(files.map(f => [f.id, randomUUID()]))
    const newImages = await Promise.all(images.map(async i => ({
      ...i, id: imageIds.get(i.id)!, projectId: newId,
      path: (await copy(i.path, i.id, imageIds.get(i.id)!))!,
      thumbPath: await copy(i.thumbPath, i.id, imageIds.get(i.id)!),
    })))
    const newFiles = await Promise.all(files.map(async f => ({
      ...f, id: fileIds.get(f.id)!, projectId: newId,
      path: (await copy(f.path, f.id, fileIds.get(f.id)!))!,
      thumbnailPath: await copy(f.thumbnailPath, f.id, fileIds.get(f.id)!),
    })))

    await db.transaction(async (tx) => {
      await tx.insert(schema.projects).values({
        ...src,
        id: newId,
        title: `${src.title} (copia)`.slice(0, 200),
        status: 'modeling',
        coverImageId: src.coverImageId ? imageIds.get(src.coverImageId) ?? null : null,
        finalFileId: src.finalFileId ? fileIds.get(src.finalFileId) ?? null : null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      if (newImages.length) await tx.insert(schema.projectImages).values(newImages)
      if (newFiles.length) await tx.insert(schema.projectFiles).values(newFiles)
      if (fileFils.length) await tx.insert(schema.fileFilaments).values(fileFils.map(ff => ({ ...ff, fileId: fileIds.get(ff.fileId)! })))
      if (mats.length) await tx.insert(schema.projectMaterials).values(mats.map(m => ({ ...m, projectId: newId })))
      await setProjectTags(tx, newId, tagRows.map(t => t.name))
      await recordStatus(tx, newId, null, 'modeling')
    })
  }
  catch (err) {
    await removeProjectDir(newId).catch(() => {})
    throw err
  }

  setResponseStatus(event, 201)
  return getProjectDetail(db, newId)
})
