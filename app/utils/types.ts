// API response types, inferred from the server routes (serialized: dates are strings).
import type { InternalApi } from 'nitropack/types'

export type ProjectDetail = InternalApi['/api/projects/:id']['get']
export type ProjectFile = ProjectDetail['files'][number]
export type ProjectImage = ProjectDetail['images'][number]
export type ProjectListItem = InternalApi['/api/projects']['get'][number]
export type Filament = InternalApi['/api/filaments']['get'][number]
export type Material = InternalApi['/api/materials']['get'][number]
export type TagWithCount = { id: string, name: string, color: string | null, count: number }
