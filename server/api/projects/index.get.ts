// List with search, filters and sorting. Raw SQL: aggregates are clearer this way.
interface Row {
  id: string
  title: string
  status: ProjectStatus
  priority: Priority
  source: 'manual' | 'makerworld'
  createdAt: Date
  updatedAt: Date
  coverThumb: string | null
  tags: { id: string, name: string, color: string | null }[]
  est_cost: string | null
  colors: string[]
  fileCount: number
}

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, projectListQuerySchema.parse)
  const params: unknown[] = []
  const p = (v: unknown) => {
    params.push(v)
    return `$${params.length}`
  }

  const where: string[] = [query.archived ? 'p.archived_at IS NOT NULL' : 'p.archived_at IS NULL']
  if (query.status?.length) where.push(`p.status::text = ANY(${p(query.status)})`)
  if (query.source) where.push(`p.source::text = ${p(query.source)}`)
  if (query.priority?.length) where.push(`p.priority::text = ANY(${p(query.priority)})`)
  if (query.tags?.length) {
    const lowered = [...new Set(query.tags.map(t => t.toLowerCase()))]
    where.push(`(SELECT count(DISTINCT lower(t.name)) FROM project_tags pt JOIN tags t ON t.id = pt.tag_id
                 WHERE pt.project_id = p.id AND lower(t.name) = ANY(${p(lowered)})) = ${p(lowered.length)}`)
  }
  if (query.q) {
    const like = p(`%${query.q.replace(/[\\%_]/g, m => `\\${m}`)}%`)
    where.push(`(unaccent(concat_ws(' ', p.title, p.description, p.notes, p.designer)) ILIKE unaccent(${like})
                 OR EXISTS (SELECT 1 FROM project_tags pt JOIN tags t ON t.id = pt.tag_id
                            WHERE pt.project_id = p.id AND unaccent(t.name) ILIKE unaccent(${like})))`)
  }

  const orderBy = {
    priority: `array_position(ARRAY['high','medium','low'], p.priority::text), p.updated_at DESC`,
    updated: 'p.updated_at DESC',
    created: 'p.created_at DESC',
    title: 'lower(p.title) ASC',
    cost: 'est_cost DESC NULLS LAST, p.updated_at DESC',
  }[query.sort]

  const { rows } = await usePool().query<Row>(`
    SELECT p.id, p.title, p.status, p.priority, p.source, p.created_at AS "createdAt", p.updated_at AS "updatedAt",
           img.thumb_path AS "coverThumb",
           COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
                     FROM project_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.project_id = p.id), '[]') AS tags,
           ref.cost AS est_cost,
           COALESCE(ref.colors, '[]') AS colors,
           (SELECT count(*)::int FROM project_files f WHERE f.project_id = p.id) AS "fileCount"
    FROM projects p
    LEFT JOIN LATERAL (
      SELECT i.thumb_path FROM project_images i WHERE i.project_id = p.id
      ORDER BY (i.id = p.cover_image_id) DESC, i.position, i.created_at LIMIT 1
    ) img ON true
    LEFT JOIN LATERAL (
      SELECT SUM(ff.grams * fi.price_per_kg / 1000) AS cost,
             json_agg(DISTINCT fi.color_hex) AS colors
      FROM file_filaments ff JOIN filaments fi ON fi.id = ff.filament_id
      WHERE ff.file_id = COALESCE(p.final_file_id,
        (SELECT f.id FROM project_files f WHERE f.project_id = p.id ORDER BY f.created_at DESC LIMIT 1))
    ) ref ON true
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT 500`, params)

  return rows.map(({ est_cost, coverThumb, ...r }) => ({
    ...r,
    estCost: est_cost === null ? null : Math.round(Number(est_cost) * 100) / 100,
    coverUrl: coverThumb ? `/media/${coverThumb}` : null,
  }))
})
