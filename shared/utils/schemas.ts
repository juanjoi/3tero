import { z } from 'zod'
import { PRINT_RESULTS, PRIORITIES, PROJECT_STATUSES, PROJECT_SORTS } from './domain'

const optionalText = z.string().trim().max(10_000).nullish().transform(v => (v ? v : null))
const optionalUrl = z.union([z.url().max(2000), z.literal('')]).nullish().transform(v => (v ? v : null))
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal #RRGGBB')

export const tagNamesSchema = z.array(z.string().trim().min(1).max(40)).max(30)

// Base fields without defaults, shared by create and update.
const projectFields = {
  title: z.string().trim().min(1, 'Obligatorio').max(200),
  description: optionalText,
  priority: z.enum(PRIORITIES),
  sourceUrl: optionalUrl,
  designer: optionalText,
  designerUrl: optionalUrl,
  license: optionalText,
  notes: optionalText,
  tags: tagNamesSchema,
}

export const projectCreateSchema = z.object({
  ...projectFields,
  status: z.enum(PROJECT_STATUSES).default('modeling'),
  priority: projectFields.priority.default('medium'),
  tags: projectFields.tags.default([]),
})
export type ProjectCreateInput = z.input<typeof projectCreateSchema>

/** PATCH semantics: keys that are not sent stay undefined (never defaulted or nulled). */
export const projectUpdateSchema = z.object({
  ...Object.fromEntries(Object.entries(projectFields).map(([k, v]) => [k, v.optional()])) as {
    [K in keyof typeof projectFields]: z.ZodOptional<(typeof projectFields)[K]>
  },
  coverImageId: z.uuid().nullable().optional(),
  finalFileId: z.uuid().nullable().optional(),
})

export const projectStatusSchema = z.object({ status: z.enum(PROJECT_STATUSES) })

const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess(v => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(item)).optional()

export const projectListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: csv(z.enum(PROJECT_STATUSES)),
  priority: csv(z.enum(PRIORITIES)),
  tags: csv(z.string().trim().min(1)),
  source: z.enum(['manual', 'makerworld']).optional(),
  sort: z.enum(PROJECT_SORTS).default('priority'),
  archived: z.preprocess(v => v === 'true' || v === true, z.boolean()).default(false),
})

export const filamentSchema = z.object({
  type: z.string().trim().min(1).max(40),
  brand: optionalText,
  colorName: z.string().trim().min(1).max(60),
  colorHex: hexColor,
  pricePerKg: z.coerce.number().min(0).max(10_000),
  bambuPresetId: optionalText,
  /** Grams in stock; null stops tracking. */
  stockGrams: z.number().min(0).max(1_000_000).nullable().optional(),
})

export const materialSchema = z.object({
  category: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  spec: optionalText,
  url: optionalUrl,
})

export const projectMaterialsSchema = z.array(z.object({
  materialId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(100_000),
})).max(100)

export const fileUpdateSchema = z.object({
  label: optionalText.optional(),
  notes: optionalText.optional(),
  estMinutes: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  final: z.boolean().optional(),
  filaments: z.array(z.object({
    filamentId: z.uuid(),
    slot: z.coerce.number().int().min(1).max(16).default(1),
    grams: z.coerce.number().min(0).max(100_000),
  })).max(16).optional(),
})

export const printLogSchema = z.object({
  fileId: z.uuid().nullable().optional(),
  printedAt: z.coerce.date().optional(),
  result: z.enum(PRINT_RESULTS),
  minutes: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  notes: optionalText.optional(),
  filaments: z.array(z.object({
    filamentId: z.uuid(),
    grams: z.coerce.number().min(0).max(100_000),
  })).max(16).default([]),
  /** Also move the project to "printed" */
  markPrinted: z.boolean().default(false),
  /** Also mark the printed file as the final iteration */
  markFinal: z.boolean().default(false),
  /** Logged from this print queue item: a successful print uses up one copy */
  queueItemId: z.uuid().optional(),
})
export type PrintLogInput = z.input<typeof printLogSchema>

/** Step 2 of an import: the reviewed draft. Images/materials must come from the cached preview. */
export const importCommitSchema = z.object({
  importer: z.string().min(1).max(40),
  externalId: z.string().min(1).max(100),
  title: projectFields.title,
  description: optionalText,
  notes: optionalText,
  priority: projectFields.priority.default('medium'),
  tags: tagNamesSchema.default([]),
  profileId: z.string().max(100).nullish(),
  images: z.array(z.url()).max(30).default([]),
  /** Indexes of draft.materials to add to the project (and to the catalogue when missing). */
  materials: z.array(z.number().int().min(0)).max(50).default([]),
})
export type ImportCommitInput = z.input<typeof importCommitSchema>

/** Saved home filters ("smart collections"): a name plus the URL query of the project list. */
export const savedFilterSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(40),
  query: z.object({
    q: z.string().max(200).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    tags: z.string().max(500).optional(),
    sort: z.enum(PROJECT_SORTS).optional(),
    priority: z.enum(PRIORITIES).optional(),
    source: z.enum(['manual', 'makerworld']).optional(),
  }),
})
export const savedFiltersSchema = z.array(savedFilterSchema).max(30)
export type SavedFilter = z.infer<typeof savedFilterSchema>

/** Bulk actions from the project list (one action per request). */
export const projectBulkSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  addTags: tagNamesSchema.optional(),
  archive: z.boolean().optional(),
  /** Add the projects to the end of the print queue (default file, one copy each) */
  queue: z.literal(true).optional(),
}).refine(b => [b.status, b.priority, b.addTags, b.archive, b.queue].filter(v => v !== undefined).length === 1, 'Una acción por petición')

/** Print queue: add a project (file defaults to the final / latest sliced one). */
export const queueAddSchema = z.object({
  projectId: z.uuid(),
  fileId: z.uuid().nullable().optional(),
  copies: z.coerce.number().int().min(1).max(99).default(1),
})
/** PATCH: only the keys sent change (no defaults). fileId null = use the imported profile. */
export const queueUpdateSchema = z.object({
  fileId: z.uuid().nullable().optional(),
  copies: z.coerce.number().int().min(1).max(99).optional(),
  notes: optionalText.optional(),
})
export const queueMoveSchema = z.object({ position: z.number().int().min(0).max(10_000) })
