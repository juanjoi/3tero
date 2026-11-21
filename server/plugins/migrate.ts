// Applies pending migrations on startup (ADR 0002).
// An advisory lock makes it safe if two instances start at the same time;
// a failing connection or migration aborts the process so a half-migrated app never
// serves traffic (the container restart policy retries it).
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { PoolClient } from 'pg'

const LOCK_ID = 7_351_001 // arbitrary, unique for this app

export default defineNitroPlugin(async () => {
  const { migrationsDir } = useRuntimeConfig()
  let client: PoolClient | undefined
  try {
    client = await usePool().connect()
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID])
    await migrate(drizzle(client), { migrationsFolder: resolve(migrationsDir) })
    console.info('[db] migrations up to date')
  }
  catch (err) {
    console.error('[db] migration failed, aborting startup', err)
    process.exit(1)
  }
  finally {
    if (client) {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {})
      client.release()
    }
  }
})
