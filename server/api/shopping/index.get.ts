import { z } from 'zod'

// Shopping list: materials and missing filament needed by projects still to print
// (not printed, not archived), optionally only high priority ones.
const querySchema = z.object({ priority: z.enum(PRIORITIES).optional() })

interface MaterialRow {
  id: string
  category: string
  name: string
  spec: string | null
  url: string | null
  quantity: number
  projects: { id: string, title: string, priority: Priority }[]
}
interface FilamentRow {
  id: string
  type: string
  colorName: string
  colorHex: string
  brand: string | null
  pricePerKg: string
  stock: string
  needed: string
  projects: { id: string, title: string, priority: Priority }[]
}

const PENDING = `p.archived_at IS NULL AND p.status <> 'printed'`
const PRIO_RANK = `array_position(ARRAY['high','medium','low'], p.priority::text)`

export default defineEventHandler(async (event) => {
  const { priority } = await getValidatedQuery(event, querySchema.parse)
  const params = priority ? [priority] : []
  const prioFilter = priority ? `AND p.priority = $1` : ''
  const pool = usePool()

  const { rows: materials } = await pool.query<MaterialRow>(`
    SELECT m.id, m.category, m.name, m.spec, m.url, SUM(pm.quantity)::int AS quantity,
           json_agg(json_build_object('id', p.id, 'title', p.title, 'priority', p.priority) ORDER BY ${PRIO_RANK}) AS projects
    FROM project_materials pm
    JOIN projects p ON p.id = pm.project_id
    JOIN materials m ON m.id = pm.material_id
    WHERE ${PENDING} ${prioFilter}
    GROUP BY m.id
    ORDER BY MIN(${PRIO_RANK}), m.category, m.name`, params)

  // Reference file per project = final file, else the latest one (same rule as the detail page)
  const { rows: filaments } = await pool.query<FilamentRow>(`
    WITH ref AS (
      SELECT p.id AS project_id, p.title, p.priority, f.id AS file_id
      FROM projects p
      JOIN LATERAL (
        SELECT pf.id FROM project_files pf WHERE pf.project_id = p.id
        ORDER BY (pf.id = p.final_file_id) DESC, pf.created_at DESC LIMIT 1
      ) f ON true
      WHERE ${PENDING} ${prioFilter}
    )
    SELECT fi.id, fi.type, fi.color_name AS "colorName", fi.color_hex AS "colorHex", fi.brand,
           fi.price_per_kg AS "pricePerKg", fi.stock_grams AS stock, SUM(ff.grams) AS needed,
           json_agg(DISTINCT jsonb_build_object('id', ref.project_id, 'title', ref.title, 'priority', ref.priority)) AS projects
    FROM ref
    JOIN file_filaments ff ON ff.file_id = ref.file_id
    JOIN filaments fi ON fi.id = ff.filament_id
    WHERE fi.stock_grams IS NOT NULL
    GROUP BY fi.id
    HAVING SUM(ff.grams) > fi.stock_grams
    ORDER BY fi.type, fi.color_name`, params)

  return {
    materials,
    filaments: filaments.map(f => ({
      ...f,
      stock: Number(f.stock),
      needed: Math.round(Number(f.needed)),
      missing: Math.ceil(Number(f.needed) - Number(f.stock)),
    })),
    checked: await getSetting<string[]>('shopping.checked', []),
  }
})
