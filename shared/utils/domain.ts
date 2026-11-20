// Domain constants shared by app and server (auto-imported from `shared/utils`).

export const PROJECT_STATUSES = ['modeling', 'sliced', 'printed'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PRIORITIES = ['low', 'medium', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRINT_RESULTS = ['success', 'partial', 'failed'] as const
export type PrintResult = (typeof PRINT_RESULTS)[number]

export const STATUS_META: Record<ProjectStatus, { label: string, color: string, icon: string }> = {
  modeling: { label: 'Modelado', color: '#1D4ED8', icon: 'i-lucide-pencil-ruler' },
  sliced: { label: 'Laminado', color: '#6D28D9', icon: 'i-lucide-layers' },
  printed: { label: 'Impreso', color: '#15803D', icon: 'i-lucide-check-circle-2' },
}

export const PRIORITY_META: Record<Priority, { label: string, color: string }> = {
  high: { label: 'Alta', color: '#EA580C' },
  medium: { label: 'Media', color: '#EAB308' },
  low: { label: 'Baja', color: '#94A3B8' },
}

export const PROJECT_SORTS = ['priority', 'updated', 'created', 'title', 'cost'] as const
export type ProjectSort = (typeof PROJECT_SORTS)[number]

/** Build volume of the Bambu Lab A1 mini, in mm */
export const PRINTER_VOLUME_MM = { x: 180, y: 180, z: 180 } as const
