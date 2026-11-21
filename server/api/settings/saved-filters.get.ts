export default defineEventHandler(() => getSetting<SavedFilter[]>('savedFilters', []))
