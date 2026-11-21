// Database schema — the single source of truth.
// After changing it: `npm run db:generate` and commit the new SQL migration (see ADR 0002).
import { sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, uuid, text, integer, numeric, boolean, timestamp, jsonb, primaryKey, index, uniqueIndex, bigint, real,
} from 'drizzle-orm/pg-core'

export const projectStatus = pgEnum('project_status', ['modeling', 'sliced', 'printed'])
export const priority = pgEnum('priority', ['low', 'medium', 'high'])
export const projectSource = pgEnum('project_source', ['manual', 'makerworld'])
export const fileKind = pgEnum('file_kind', ['model', 'sliced'])
export const fileFormat = pgEnum('file_format', ['stl', '3mf'])
export const printResult = pgEnum('print_result', ['success', 'partial', 'failed'])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}

// ── Projects ────────────────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  description: text(),
  status: projectStatus().notNull().default('modeling'),
  priority: priority().notNull().default('medium'),
  source: projectSource().notNull().default('manual'),
  sourceUrl: text('source_url'),
  designer: text(),
  designerUrl: text('designer_url'),
  license: text(),
  notes: text(),
  coverImageId: uuid('cover_image_id'),
  finalFileId: uuid('final_file_id'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
}, t => [
  index('projects_status_idx').on(t.status),
  index('projects_priority_idx').on(t.priority),
  index('projects_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
])

export const projectImages = pgTable('project_images', {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  path: text().notNull(),
  thumbPath: text('thumb_path'),
  size: bigint({ mode: 'number' }).notNull(),
  position: integer().notNull().default(0),
  caption: text(),
  createdAt: timestamps.createdAt,
}, t => [index('project_images_project_idx').on(t.projectId)])

/** Model file iterations (STL / 3MF). Parsed 3MF metadata lives in `parsed`. */
export const projectFiles = pgTable('project_files', {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  kind: fileKind().notNull().default('model'),
  format: fileFormat().notNull(),
  path: text().notNull(),
  size: bigint({ mode: 'number' }).notNull(),
  sha256: text().notNull(),
  originalName: text('original_name').notNull(),
  label: text(),
  notes: text(),
  estMinutes: integer('est_minutes'),
  plates: integer(),
  printerModelId: text('printer_model_id'),
  bboxX: real('bbox_x'),
  bboxY: real('bbox_y'),
  bboxZ: real('bbox_z'),
  fitsPrinter: boolean('fits_printer'),
  thumbnailPath: text('thumbnail_path'),
  parsed: jsonb(),
  createdAt: timestamps.createdAt,
}, t => [index('project_files_project_idx').on(t.projectId)])

// ── Catalogue ───────────────────────────────────────────────────────────────

export const filaments = pgTable('filaments', {
  id: uuid().primaryKey().defaultRandom(),
  type: text().notNull(), // PLA, PETG, TPU…
  brand: text(),
  colorName: text('color_name').notNull(),
  colorHex: text('color_hex').notNull(),
  pricePerKg: numeric('price_per_kg', { precision: 8, scale: 2 }).notNull(),
  bambuPresetId: text('bambu_preset_id'), // e.g. GFA00, matches 3MF tray_info_idx
  /** Grams left in stock (all spools of this filament). NULL = stock not tracked. Prints deduct from it. */
  stockGrams: numeric('stock_grams', { precision: 10, scale: 2 }),
  ...timestamps,
})

export const materials = pgTable('materials', {
  id: uuid().primaryKey().defaultRandom(),
  category: text().notNull(), // magnets, screws, electronics…
  name: text().notNull(),
  spec: text(),
  url: text(),
  ...timestamps,
})

export const fileFilaments = pgTable('file_filaments', {
  fileId: uuid('file_id').notNull().references(() => projectFiles.id, { onDelete: 'cascade' }),
  filamentId: uuid('filament_id').notNull().references(() => filaments.id, { onDelete: 'restrict' }),
  slot: integer().notNull().default(1),
  grams: numeric({ precision: 8, scale: 2 }).notNull(),
}, t => [primaryKey({ columns: [t.fileId, t.filamentId, t.slot] })])

export const projectMaterials = pgTable('project_materials', {
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  materialId: uuid('material_id').notNull().references(() => materials.id, { onDelete: 'restrict' }),
  quantity: integer().notNull().default(1),
}, t => [primaryKey({ columns: [t.projectId, t.materialId] })])

// ── Tags ────────────────────────────────────────────────────────────────────

export const tags = pgTable('tags', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  color: text(),
}, t => [uniqueIndex('tags_name_uq').on(sql`lower(${t.name})`)])

export const projectTags = pgTable('project_tags', {
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, t => [primaryKey({ columns: [t.projectId, t.tagId] })])

// ── Prints ──────────────────────────────────────────────────────────────────

export const printLogs = pgTable('print_logs', {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  fileId: uuid('file_id').references(() => projectFiles.id, { onDelete: 'set null' }),
  printedAt: timestamp('printed_at', { withTimezone: true }).notNull().defaultNow(),
  result: printResult().notNull(),
  minutes: integer(),
  notes: text(),
  createdAt: timestamps.createdAt,
}, t => [index('print_logs_project_idx').on(t.projectId)])

export const printLogFilaments = pgTable('print_log_filaments', {
  printLogId: uuid('print_log_id').notNull().references(() => printLogs.id, { onDelete: 'cascade' }),
  filamentId: uuid('filament_id').notNull().references(() => filaments.id, { onDelete: 'restrict' }),
  grams: numeric({ precision: 8, scale: 2 }).notNull(),
  /** Price per kg at the time of printing, so later price changes don't rewrite history */
  pricePerKg: numeric('price_per_kg', { precision: 8, scale: 2 }).notNull(),
}, t => [primaryKey({ columns: [t.printLogId, t.filamentId] })])

export const printLogImages = pgTable('print_log_images', {
  id: uuid().primaryKey().defaultRandom(),
  printLogId: uuid('print_log_id').notNull().references(() => printLogs.id, { onDelete: 'cascade' }),
  path: text().notNull(),
  thumbPath: text('thumb_path'),
  size: bigint({ mode: 'number' }).notNull(),
})

// ── History, sources, settings ──────────────────────────────────────────────

export const statusHistory = pgTable('status_history', {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  fromStatus: projectStatus('from_status'),
  toStatus: projectStatus('to_status').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('status_history_project_idx').on(t.projectId)])

/** Raw payload of an import, kept so the mapping can be redone if the source format changes. */
export const projectSources = pgTable('project_sources', {
  projectId: uuid('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  importer: text().notNull(),
  externalId: text('external_id').notNull(),
  url: text().notNull(),
  raw: jsonb().notNull(),
  /** Print profile chosen at import time (ImportedProfile): estimate until a real file is uploaded. */
  profile: jsonb(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('project_sources_external_idx').on(t.importer, t.externalId)])

export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
})
