import { eq } from 'drizzle-orm'

/** Turns a FK violation (catalogue item still in use) into a friendly 409. */
export async function deleteCatalogueItem(table: typeof schema.filaments | typeof schema.materials, id: string) {
  try {
    const rows = await useDb().delete(table).where(eq(table.id, id)).returning({ id: table.id })
    if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })
    return { deleted: true }
  }
  catch (err) {
    if (isForeignKeyViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'Está en uso en algún proyecto; no se puede borrar' })
    }
    throw err
  }
}

/** Walks the `cause` chain (Drizzle wraps pg errors) looking for SQLSTATE 23503 (FK) or 23001 (RESTRICT). */
function isForeignKeyViolation(err: unknown): boolean {
  for (let e = err as { code?: string, cause?: unknown } | undefined, i = 0; e && i < 5; e = e.cause as typeof e, i++) {
    if (e.code === '23503' || e.code === '23001') return true
  }
  return false
}
