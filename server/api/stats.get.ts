// Family statistics: projects, prints, money and filament usage. Raw SQL (aggregates).
interface Totals {
  projects: number
  archived: number
  modeling: number
  sliced: number
  printed: number
}
interface PrintTotals {
  prints: number
  success: number
  partial: number
  failed: number
  minutes: number
  grams: string
  spent: string
}

export default defineEventHandler(async () => {
  const pool = usePool()
  const [totals, prints, monthly, byFilament, topTags] = await Promise.all([
    pool.query<Totals>(`
      SELECT count(*) FILTER (WHERE archived_at IS NULL)::int AS projects,
             count(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived,
             count(*) FILTER (WHERE archived_at IS NULL AND status = 'modeling')::int AS modeling,
             count(*) FILTER (WHERE archived_at IS NULL AND status = 'sliced')::int AS sliced,
             count(*) FILTER (WHERE archived_at IS NULL AND status = 'printed')::int AS printed
      FROM projects`),
    pool.query<PrintTotals>(`
      SELECT count(*)::int AS prints,
             count(*) FILTER (WHERE result = 'success')::int AS success,
             count(*) FILTER (WHERE result = 'partial')::int AS partial,
             count(*) FILTER (WHERE result = 'failed')::int AS failed,
             COALESCE(sum(minutes), 0)::int AS minutes,
             COALESCE((SELECT sum(grams) FROM print_log_filaments), 0) AS grams,
             COALESCE((SELECT sum(grams * price_per_kg / 1000) FROM print_log_filaments), 0) AS spent
      FROM print_logs`),
    // Last 12 months, including empty ones
    pool.query<{ month: string, prints: number, grams: string, spent: string }>(`
      WITH months AS (
        SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS m
      )
      SELECT to_char(months.m, 'YYYY-MM') AS month,
             count(DISTINCT pl.id)::int AS prints,
             COALESCE(sum(plf.grams), 0) AS grams,
             COALESCE(sum(plf.grams * plf.price_per_kg / 1000), 0) AS spent
      FROM months
      LEFT JOIN print_logs pl ON date_trunc('month', pl.printed_at) = months.m
      LEFT JOIN print_log_filaments plf ON plf.print_log_id = pl.id
      GROUP BY months.m ORDER BY months.m`),
    pool.query<{ id: string, type: string, colorName: string, colorHex: string, grams: string, spent: string }>(`
      SELECT f.id, f.type, f.color_name AS "colorName", f.color_hex AS "colorHex",
             sum(plf.grams) AS grams, sum(plf.grams * plf.price_per_kg / 1000) AS spent
      FROM print_log_filaments plf JOIN filaments f ON f.id = plf.filament_id
      GROUP BY f.id ORDER BY sum(plf.grams) DESC LIMIT 8`),
    pool.query<{ name: string, count: number }>(`
      SELECT t.name, count(*)::int AS count
      FROM project_tags pt JOIN tags t ON t.id = pt.tag_id JOIN projects p ON p.id = pt.project_id
      WHERE p.archived_at IS NULL
      GROUP BY t.name ORDER BY count(*) DESC, t.name LIMIT 10`),
  ])
  const pr = prints.rows[0]!
  const round = (v: string | number) => Math.round(Number(v) * 100) / 100
  return {
    projects: totals.rows[0]!,
    prints: {
      total: pr.prints,
      success: pr.success,
      partial: pr.partial,
      failed: pr.failed,
      successRate: pr.prints ? Math.round((pr.success / pr.prints) * 100) : null,
      minutes: pr.minutes,
      grams: Math.round(Number(pr.grams)),
      spent: round(pr.spent),
    },
    monthly: monthly.rows.map(m => ({ month: m.month, prints: m.prints, grams: Math.round(Number(m.grams)), spent: round(m.spent) })),
    filaments: byFilament.rows.map(f => ({ ...f, grams: Math.round(Number(f.grams)), spent: round(f.spent) })),
    tags: topTags.rows,
  }
})
