export default defineEventHandler(event => deleteCatalogueItem(schema.filaments, getRouterParam(event, 'id')!))
