// Small key/value store (settings table) for family-wide preferences and UI state.
import { eq } from 'drizzle-orm'

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await useDb().select().from(schema.settings).where(eq(schema.settings.key, key))
  return (row?.value as T | undefined) ?? fallback
}

export async function setSetting(key: string, value: unknown) {
  await useDb().insert(schema.settings).values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
}
