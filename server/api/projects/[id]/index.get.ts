export default defineEventHandler(event => getProjectDetail(useDb(), getRouterParam(event, 'id')!))
