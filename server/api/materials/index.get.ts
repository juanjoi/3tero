import { asc } from 'drizzle-orm'

export default defineEventHandler(() =>
  useDb().select().from(schema.materials).orderBy(asc(schema.materials.category), asc(schema.materials.name)))
