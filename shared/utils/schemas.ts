import { z } from 'zod'
import { PRIORITIES, PROJECT_STATUSES, PROJECT_SORTS } from './domain'

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
