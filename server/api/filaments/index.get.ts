import { asc } from 'drizzle-orm'

export default defineEventHandler(() =>
  useDb().select().from(schema.filaments).orderBy(asc(schema.filaments.type), asc(schema.filaments.colorName)))
