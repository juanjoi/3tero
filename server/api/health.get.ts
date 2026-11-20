export default defineEventHandler(async (event) => {
  try {
    const { rows } = await usePool().query<{ hash: string, created_at: string }>(
      'SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1',
    )
    return { status: 'ok', db: 'up', schema: rows[0]?.created_at ?? null }
  }
  catch (err) {
    setResponseStatus(event, 503)
    return { status: 'error', db: 'down', message: (err as Error).message }
  }
})
