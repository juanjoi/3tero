export default defineEventHandler(event => deleteCatalogueItem(schema.materials, getRouterParam(event, 'id')!))
