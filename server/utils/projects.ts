import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

type Db = NodePgDatabase<typeof schema>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const { projects, tags, projectTags, projectImages, projectFiles, fileFilaments, filaments, projectMaterials, materials, statusHistory, printLogs, printLogFilaments, printLogImages } = schema

export async function getProjectOr404(db: Db | Tx, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'Proyecto no encontrado' })
  const [row] = await db.select().from(projects).where(eq(projects.id, id))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Proyecto no encontrado' })
  return row
}

/** Replaces the tags of a project, creating missing tags (case-insensitive unique). */
export async function setProjectTags(tx: Tx, projectId: string, names: string[]) {
  const unique = [...new Map(names.map(n => [n.trim().toLowerCase(), n.trim()])).values()].filter(Boolean)
  await tx.delete(projectTags).where(eq(projectTags.projectId, projectId))
  if (!unique.length) return
  await tx.insert(tags).values(unique.map(name => ({ name }))).onConflictDoNothing()
  const rows = await tx.select({ id: tags.id }).from(tags)
    .where(inArray(sql`lower(${tags.name})`, unique.map(n => n.toLowerCase())))
  await tx.insert(projectTags).values(rows.map(r => ({ projectId, tagId: r.id }))).onConflictDoNothing()
}

export async function recordStatus(tx: Tx, projectId: string, from: ProjectStatus | null, to: ProjectStatus) {
  await tx.insert(statusHistory).values({ projectId, fromStatus: from, toStatus: to })
}

/** Full project with everything the detail page needs. */
export async function getProjectDetail(db: Db, id: string) {
  const project = await getProjectOr404(db, id)

  const [tagRows, images, files, fileFils, mats, history, prints, printFils, printImgs] = await Promise.all([
    db.select({ id: tags.id, name: tags.name, color: tags.color })
      .from(projectTags).innerJoin(tags, eq(tags.id, projectTags.tagId))
      .where(eq(projectTags.projectId, id)).orderBy(asc(tags.name)),
    db.select().from(projectImages).where(eq(projectImages.projectId, id))
      .orderBy(asc(projectImages.position), asc(projectImages.createdAt)),
    db.select().from(projectFiles).where(eq(projectFiles.projectId, id)).orderBy(desc(projectFiles.createdAt)),
    db.select({
      fileId: fileFilaments.fileId, slot: fileFilaments.slot, grams: fileFilaments.grams,
      filamentId: filaments.id, type: filaments.type, brand: filaments.brand,
      colorName: filaments.colorName, colorHex: filaments.colorHex, pricePerKg: filaments.pricePerKg,
    }).from(fileFilaments)
      .innerJoin(filaments, eq(filaments.id, fileFilaments.filamentId))
      .innerJoin(projectFiles, eq(projectFiles.id, fileFilaments.fileId))
      .where(eq(projectFiles.projectId, id))
      .orderBy(asc(fileFilaments.slot)),
    db.select({ materialId: materials.id, quantity: projectMaterials.quantity, category: materials.category, name: materials.name, spec: materials.spec, url: materials.url })
      .from(projectMaterials).innerJoin(materials, eq(materials.id, projectMaterials.materialId))
      .where(eq(projectMaterials.projectId, id)).orderBy(asc(materials.category), asc(materials.name)),
    db.select().from(statusHistory).where(eq(statusHistory.projectId, id)).orderBy(desc(statusHistory.changedAt)),
    db.select().from(printLogs).where(eq(printLogs.projectId, id)).orderBy(desc(printLogs.printedAt)),
    db.select({
      printLogId: printLogFilaments.printLogId, grams: printLogFilaments.grams, pricePerKg: printLogFilaments.pricePerKg,
      filamentId: filaments.id, type: filaments.type, colorName: filaments.colorName, colorHex: filaments.colorHex,
    }).from(printLogFilaments)
      .innerJoin(filaments, eq(filaments.id, printLogFilaments.filamentId))
      .innerJoin(printLogs, eq(printLogs.id, printLogFilaments.printLogId))
      .where(eq(printLogs.projectId, id)),
    db.select({ id: printLogImages.id, printLogId: printLogImages.printLogId, path: printLogImages.path, thumbPath: printLogImages.thumbPath })
      .from(printLogImages)
      .innerJoin(printLogs, eq(printLogs.id, printLogImages.printLogId))
      .where(eq(printLogs.projectId, id)),
  ])

  const filesOut = files.map((f) => {
    const fils = fileFils.filter(ff => ff.fileId === f.id)
    return {
      ...f,
      url: `/media/${f.path}`,
      thumbnailUrl: f.thumbnailPath ? `/media/${f.thumbnailPath}` : null,
      final: project.finalFileId === f.id,
      filaments: fils,
      grams: Math.round(fils.reduce((s, x) => s + Number(x.grams), 0) * 100) / 100,
      cost: filamentCost(fils),
      parsed: undefined,
    }
  })
  const reference = filesOut.find(f => f.final) ?? filesOut[0] ?? null

  const printsOut = prints.map((p) => {
    const fils = printFils.filter(f => f.printLogId === p.id)
    return {
      ...p,
      fileLabel: filesOut.find(f => f.id === p.fileId)?.label ?? null,
      filaments: fils,
      grams: Math.round(fils.reduce((s, x) => s + Number(x.grams), 0) * 100) / 100,
      cost: filamentCost(fils),
      images: printImgs.filter(i => i.printLogId === p.id).map(i => ({ id: i.id, url: `/media/${i.path}`, thumbUrl: i.thumbPath ? `/media/${i.thumbPath}` : null })),
    }
  })

  return {
    ...project,
    tags: tagRows,
    images: images.map(i => ({ ...i, url: `/media/${i.path}`, thumbUrl: i.thumbPath ? `/media/${i.thumbPath}` : null })),
    files: filesOut,
    materials: mats,
    history,
    prints: printsOut,
    spent: Math.round(printsOut.reduce((s, p) => s + p.cost, 0) * 100) / 100,
    estimate: reference
      ? { fileId: reference.id, cost: reference.filaments.length ? reference.cost : null, grams: reference.grams || null, minutes: reference.estMinutes }
      : null,
  }
}

export type ProjectDetail = Awaited<ReturnType<typeof getProjectDetail>>

export { and, eq }
