// Tags with the number of (non-archived) projects using them, for filters and autocomplete.
export default defineEventHandler(async () => {
  const { rows } = await usePool().query(`
    SELECT t.id, t.name, t.color, count(p.id)::int AS count
    FROM tags t
    LEFT JOIN project_tags pt ON pt.tag_id = t.id
    LEFT JOIN projects p ON p.id = pt.project_id AND p.archived_at IS NULL
    GROUP BY t.id
    ORDER BY count(p.id) DESC, lower(t.name)`)
  return rows
})
