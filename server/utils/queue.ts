// Print queue: ordered list of what to print next (project + file to print + copies).
// Items enter by hand (project page, bulk action) and leave when a successful print is logged from them.
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

type Db = NodePgDatabase<typeof schema>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const { printQueue, projects, projectFiles, projectImages, fileFilaments, filaments } = schema

/** File queued by default: the final one, else the latest sliced one, else the latest file, else none. */
export async function defaultQueueFile(db: Db | Tx, projectId: string, finalFileId: string | null) {
  if (finalFileId) return finalFileId
  const files = await db.select({ id: projectFiles.id, kind: projectFiles.kind }).from(projectFiles)
    .where(eq(projectFiles.projectId, projectId)).orderBy(desc(projectFiles.createdAt))
  return (files.find(f => f.kind === 'sliced') ?? files[0])?.id ?? null
}

/** Rejects a file that does not belong to the project. */
export async function assertProjectFile(db: Db | Tx, projectId: string, fileId: string) {
  const [file] = await db.select({ id: projectFiles.id }).from(projectFiles)
    .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId)))
  if (!file) throw createError({ statusCode: 400, statusMessage: 'Ese fichero no es de este proyecto' })
}

/** Appends a project to the end of the queue. */
export async function addToQueue(tx: Tx, item: { projectId: string, fileId: string | null, copies: number }) {
  const [last] = await tx.select({ max: sql<number | null>`max(${printQueue.position})` }).from(printQueue)
  const [row] = await tx.insert(printQueue)
    .values({ ...item, position: (last?.max ?? -1) + 1 })
    .returning({ id: printQueue.id })
  return row!.id
}

/** Moves an item to `to` (0 = first) and renumbers the queue without gaps. */
export async function moveQueueItem(tx: Tx, id: string, to: number) {
  const ids = (await tx.select({ id: printQueue.id }).from(printQueue)
    .orderBy(asc(printQueue.position), asc(printQueue.createdAt))).map(r => r.id)
  const from = ids.indexOf(id)
  if (from === -1) throw createError({ statusCode: 404, statusMessage: 'No está en la cola' })
  ids.splice(from, 1)
  ids.splice(Math.max(0, Math.min(to, ids.length)), 0, id)
  for (const [position, itemId] of ids.entries()) {
    await tx.update(printQueue).set({ position }).where(eq(printQueue.id, itemId))
  }
}

/**
 * A print logged from a queue item: a successful one uses up a copy (the item leaves the queue with
 * the last one); failed and partial prints leave it as it is, to try again.
 */
export async function consumeQueueItem(tx: Tx, itemId: string, projectId: string, result: PrintResult) {
  if (result !== 'success') return
  const [item] = await tx.select().from(printQueue)
    .where(and(eq(printQueue.id, itemId), eq(printQueue.projectId, projectId)))
  if (!item) return // already removed: logging the print still counts
  if (item.copies > 1) await tx.update(printQueue).set({ copies: item.copies - 1 }).where(eq(printQueue.id, itemId))
  else await tx.delete(printQueue).where(eq(printQueue.id, itemId))
}

/** How many queue entries a project has (shown on its page). */
export async function countQueued(db: Db, projectId: string) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(printQueue).where(eq(printQueue.projectId, projectId))
  return row?.n ?? 0
}

/** The whole queue in order, with what is needed to print each item and the totals. */
export async function getQueue(db: Db) {
  const rows = await db.select({
    id: printQueue.id,
    position: printQueue.position,
    copies: printQueue.copies,
    notes: printQueue.notes,
    fileId: printQueue.fileId,
    projectId: projects.id,
    title: projects.title,
    status: projects.status,
    priority: projects.priority,
    archived: sql<boolean>`${projects.archivedAt} IS NOT NULL`,
    coverThumb: projectImages.thumbPath,
  }).from(printQueue)
    .innerJoin(projects, eq(projects.id, printQueue.projectId))
    .leftJoin(projectImages, eq(projectImages.id, projects.coverImageId))
    .orderBy(asc(printQueue.position), asc(printQueue.createdAt))

  const projectIds = [...new Set(rows.map(r => r.projectId))]
  const [files, fils] = projectIds.length
    ? await Promise.all([
        db.select({
          id: projectFiles.id, projectId: projectFiles.projectId, label: projectFiles.label, originalName: projectFiles.originalName,
          kind: projectFiles.kind, estMinutes: projectFiles.estMinutes, plates: projectFiles.plates, fitsPrinter: projectFiles.fitsPrinter,
        }).from(projectFiles).where(inArray(projectFiles.projectId, projectIds)).orderBy(desc(projectFiles.createdAt)),
        db.select({
          fileId: fileFilaments.fileId, grams: fileFilaments.grams, type: filaments.type, colorName: filaments.colorName,
          colorHex: filaments.colorHex, pricePerKg: filaments.pricePerKg,
        }).from(fileFilaments)
          .innerJoin(filaments, eq(filaments.id, fileFilaments.filamentId))
          .innerJoin(projectFiles, eq(projectFiles.id, fileFilaments.fileId))
          .where(inArray(projectFiles.projectId, projectIds))
          .orderBy(asc(fileFilaments.slot)),
      ])
    : [[], []]

  // Items without file fall back to the print profile chosen when importing
  const withoutFile = [...new Set(rows.filter(r => !r.fileId).map(r => r.projectId))]
  const imported = new Map(await Promise.all(withoutFile.map(async id => [id, await getImportedProfile(db, id)] as const)))

  const items = rows.map((r) => {
    const projectFilesList = files.filter(f => f.projectId === r.projectId)
    const file = projectFilesList.find(f => f.id === r.fileId)
    let config
    if (file) {
      const used = fils.filter(f => f.fileId === file.id)
      config = {
        kind: 'file' as const,
        name: file.label ?? file.originalName,
        sliced: file.kind === 'sliced',
        fitsPrinter: file.fitsPrinter,
        plates: file.plates,
        minutes: file.estMinutes,
        grams: Math.round(used.reduce((s, f) => s + Number(f.grams), 0) * 100) / 100 || null,
        cost: used.length ? filamentCost(used) : null,
        filaments: used.map(f => ({ type: f.type, colorName: f.colorName, colorHex: f.colorHex, grams: Number(f.grams) })),
        downloadUrl: `/api/projects/${r.projectId}/files/${file.id}/download`,
      }
    }
    else {
      const src = imported.get(r.projectId)
      const profile = src?.profile
      config = profile
        ? {
            kind: 'profile' as const,
            name: profile.name,
            minutes: profile.minutes,
            grams: profile.grams,
            cost: profile.cost,
            filaments: profile.filaments.map(f => ({ type: f.type, colorName: null, colorHex: f.colorHex, grams: f.grams })),
            // MakerWorld opens the model on that profile
            url: `${src!.url}#profileId-${profile.externalId}`,
          }
        : { kind: 'none' as const }
    }
    return {
      id: r.id,
      position: r.position,
      copies: r.copies,
      notes: r.notes,
      project: {
        id: r.projectId, title: r.title, status: r.status, priority: r.priority, archived: r.archived,
        coverUrl: r.coverThumb ? `/media/${r.coverThumb}` : null,
      },
      fileId: file ? file.id : null,
      /** Files of the project the item can switch to. */
      files: projectFilesList.map(f => ({ id: f.id, name: f.label ?? f.originalName, sliced: f.kind === 'sliced' })),
      config,
    }
  })

  const per = (pick: (i: typeof items[number]) => number | null | undefined) =>
    items.reduce((s, i) => s + (pick(i) ?? 0) * i.copies, 0)
  return {
    items,
    totals: {
      copies: items.reduce((s, i) => s + i.copies, 0),
      minutes: per(i => (i.config.kind === 'none' ? null : i.config.minutes)),
      grams: Math.round(per(i => (i.config.kind === 'none' ? null : i.config.grams))),
      cost: Math.round(per(i => (i.config.kind === 'none' ? null : i.config.cost)) * 100) / 100,
      /** Items whose time/grams are unknown, so the totals fall short. */
      unknown: items.filter(i => i.config.kind === 'none' || !i.config.minutes).length,
    },
  }
}

export type PrintQueue = Awaited<ReturnType<typeof getQueue>>
