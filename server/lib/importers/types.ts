// Contract shared by every external importer (see PROJECT_PLAN §3.8 and ADR 0005).
// Pure types: no Nuxt/Nitro imports so the importers stay unit-testable.

export interface ImportedFilament {
  type: string
  colorHex: string
  grams: number | null
}

export interface ImportedProfile {
  externalId: string
  name: string
  /** Main printer the profile was sliced for (e.g. "A1 mini"). */
  printer: string | null
  /** 'native' = sliced for our printer, 'resliced' = platform provides figures for our printer, 'other' = neither. */
  fit: 'native' | 'resliced' | 'other'
  minutes: number | null
  grams: number | null
  plates: number | null
  needAms: boolean
  filaments: ImportedFilament[]
  coverUrl: string | null
}

export interface ImportedMaterial {
  name: string
  spec: string | null
  url: string | null
  quantity: number
  category: string
}

export interface ImportedProjectDraft {
  importer: string
  externalId: string
  sourceUrl: string
  title: string
  description: string | null
  images: string[]
  tags: string[]
  designer: string | null
  designerUrl: string | null
  license: string | null
  profiles: ImportedProfile[]
  selectedProfileId: string | null
  materials: ImportedMaterial[]
  /** Which extraction path worked: richer sources first. */
  via: 'api' | 'next-data' | 'open-graph' | 'browser'
}

export interface ImportResult {
  draft: ImportedProjectDraft
  /** Raw payload kept in project_sources.raw so the mapping can be redone later. */
  raw: unknown
}

export interface ProjectImporter {
  id: string
  label: string
  matches: (url: URL) => boolean
  fetch: (url: URL, opts: FetchOptions) => Promise<ImportResult>
  /**
   * Builds the draft from raw data the user's own browser read on the platform, for when the platform
   * challenges our server (ADR 0007). Must validate that the data belongs to `url`.
   */
  fromPayload?: (raw: unknown, url: URL, opts: Pick<FetchOptions, 'printer'>) => ImportResult
  /** Address the user can open in their browser to copy that raw data by hand. */
  rawDataUrl?: (url: URL) => string | null
}

export interface FetchOptions {
  /** Printer the family owns, used to preselect a profile (e.g. "A1 mini"). */
  printer: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

/** The platform refused the request (anti-bot, rate limit…). Never bypassed: the UI offers manual entry. */
export class ImportBlockedError extends Error {
  constructor(message = 'blocked') {
    super(message)
    this.name = 'ImportBlockedError'
  }
}

/** The platform is temporarily unavailable (rate limit, outage, API errors): retrying later may work. */
export class ImportUnavailableError extends Error {
  constructor(message = 'unavailable') {
    super(message)
    this.name = 'ImportUnavailableError'
  }
}

/** The page/model does not exist or could not be understood. */
export class ImportNotFoundError extends Error {
  constructor(message = 'not found') {
    super(message)
    this.name = 'ImportNotFoundError'
  }
}
