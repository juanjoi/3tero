// Replaces the list of saved filters (small list, edited from the home page).
export default defineEventHandler(async (event) => {
  const filters = await readValidatedBody(event, savedFiltersSchema.parse)
  await setSetting('savedFilters', filters)
  return filters
})
