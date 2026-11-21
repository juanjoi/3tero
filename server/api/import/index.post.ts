import { randomUUID } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'

// Step 2 of an import: create the project from the reviewed draft.
// Uses the cached preview (no new request to the platform); images are copied locally.
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, importCommitSchema.parse)
  const cached = getCachedImport(body.importer, body.externalId)
  if (!cached) throw createError({ statusCode: 409, statusMessage: 'La vista previa ha caducado, vuelve a cargar el enlace' })
  const { draft, raw } = cached
  await assertQuota(event)

  const profile = draft.profiles.find(p => p.externalId === body.profileId) ?? null
  const images = body.images.filter(u => draft.images.includes(u)).slice(0, limits().maxImagesPerProject)
  const mats = [...new Set(body.materials)].map(i => draft.materials[i]).filter(m => !!m)

  const db = useDb()
  const projectId = await db.transaction(async (tx) => {
    const [row] = await tx.insert(schema.projects).values({
      title: body.title,
      description: body.description,
      notes: body.notes,
      priority: body.priority,
      status: 'modeling',
      source: draft.importer as 'makerworld',
      sourceUrl: draft.sourceUrl,
      designer: draft.designer,
      designerUrl: draft.designerUrl,
      license: draft.license,
    }).returning({ id: schema.projects.id })
    const id = row!.id
    await setProjectTags(tx, id, body.tags)
    await recordStatus(tx, id, null, 'modeling')
    await tx.insert(schema.projectSources).values({
      projectId: id,
      importer: draft.importer,
      externalId: draft.externalId,
      url: draft.sourceUrl,
      raw: raw as object,
      profile,
    })

    // Bill of materials: reuse catalogue items with the same category + name + spec
    for (const m of mats) {
      const [found] = await tx.select({ id: schema.materials.id }).from(schema.materials).where(and(
        eq(sql`lower(${schema.materials.name})`, m.name.toLowerCase()),
        m.spec ? eq(sql`lower(${schema.materials.spec})`, m.spec.toLowerCase()) : isNull(schema.materials.spec),
      )).limit(1)
      const materialId = found?.id ?? (await tx.insert(schema.materials)
        .values({ category: m.category, name: m.name, spec: m.spec, url: m.url })
        .returning({ id: schema.materials.id }))[0]!.id
      await tx.insert(schema.projectMaterials).values({ projectId: id, materialId, quantity: m.quantity }).onConflictDoNothing()
    }
    return id
  })

  // Images after the transaction: a slow CDN must not hold a DB transaction open.
  let failedImages = 0
  let position = 0
  for (const url of images) {
    try {
      const imageId = randomUUID()
      const out = await downloadImage(url, `projects/${projectId}/images/${imageId}`)
      await db.insert(schema.projectImages).values({ id: imageId, projectId, ...out, position: position++ })
      if (position === 1) await db.update(schema.projects).set({ coverImageId: imageId }).where(eq(schema.projects.id, projectId))
    }
    catch (err) {
      failedImages++
      console.warn('[import] image skipped', url, (err as Error).message)
    }
  }

  setResponseStatus(event, 201)
  setResponseHeader(event, 'x-failed-images', String(failedImages))
  return getProjectDetail(db, projectId)
})
