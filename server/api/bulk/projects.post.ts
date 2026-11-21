import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'

// Applies one action to many projects: status (with history), priority, add tags, archive/restore.
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, projectBulkSchema.parse)
  const db = useDb()
  const { projects, tags, projectTags } = schema
  const now = new Date()

  const updated = await db.transaction(async (tx) => {
    if (body.status) {
      const changing = await tx.select({ id: projects.id, status: projects.status }).from(projects)
        .where(and(inArray(projects.id, body.ids), ne(projects.status, body.status)))
      for (const p of changing) await recordStatus(tx, p.id, p.status, body.status)
      if (changing.length) {
        await tx.update(projects).set({ status: body.status, updatedAt: now }).where(inArray(projects.id, changing.map(p => p.id)))
      }
      return changing.length
    }
    if (body.priority) {
      return (await tx.update(projects).set({ priority: body.priority, updatedAt: now })
        .where(inArray(projects.id, body.ids)).returning({ id: projects.id })).length
    }
    if (body.addTags?.length) {
      const names = [...new Map(body.addTags.map(n => [n.toLowerCase(), n])).values()]
      await tx.insert(tags).values(names.map(name => ({ name }))).onConflictDoNothing()
      const rows = await tx.select({ id: tags.id }).from(tags).where(inArray(sql`lower(${tags.name})`, names.map(n => n.toLowerCase())))
      await tx.insert(projectTags).values(body.ids.flatMap(projectId => rows.map(r => ({ projectId, tagId: r.id })))).onConflictDoNothing()
      await tx.update(projects).set({ updatedAt: now }).where(inArray(projects.id, body.ids))
      return body.ids.length
    }
    if (body.archive !== undefined) {
      return (await tx.update(projects).set({ archivedAt: body.archive ? now : null, updatedAt: now })
        .where(and(inArray(projects.id, body.ids), body.archive ? isNull(projects.archivedAt) : sql`${projects.archivedAt} IS NOT NULL`))
        .returning({ id: projects.id })).length
    }
    return 0
  })
  return { updated }
})
