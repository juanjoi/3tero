import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../db/schema'

let pool: pg.Pool | undefined

export function usePool() {
  if (!pool) {
    const { databaseUrl } = useRuntimeConfig()
    if (!databaseUrl) throw new Error('NUXT_DATABASE_URL is not set')
    pool = new pg.Pool({ connectionString: databaseUrl, max: 10 })
  }
  return pool
}

export function useDb() {
  return drizzle(usePool(), { schema, casing: 'snake_case' })
}

export { schema }
