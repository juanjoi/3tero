// The print queue in order, with each item's configuration (file or imported profile) and totals.
export default defineEventHandler(() => getQueue(useDb()))
