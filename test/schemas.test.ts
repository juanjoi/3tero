import { describe, expect, it } from 'vitest'
import { projectCreateSchema, projectListQuerySchema } from '../shared/utils/schemas'

describe('projectCreateSchema', () => {
  it('applies defaults and accepts missing optional fields', () => {
    const out = projectCreateSchema.parse({ title: '  Soporte  ' })
    expect(out).toMatchObject({ title: 'Soporte', status: 'modeling', priority: 'medium', tags: [], sourceUrl: null })
  })

  it('normalises empty strings to null', () => {
    const out = projectCreateSchema.parse({ title: 'x', sourceUrl: '', notes: '' })
    expect(out.sourceUrl).toBeNull()
    expect(out.notes).toBeNull()
  })

  it('rejects an empty title and invalid urls', () => {
    expect(projectCreateSchema.safeParse({ title: ' ' }).success).toBe(false)
    expect(projectCreateSchema.safeParse({ title: 'x', sourceUrl: 'not a url' }).success).toBe(false)
  })
})

describe('projectListQuerySchema', () => {
  it('parses comma separated filters', () => {
    const out = projectListQuerySchema.parse({ status: 'modeling,sliced', tags: 'taller', archived: 'true' })
    expect(out).toMatchObject({ status: ['modeling', 'sliced'], tags: ['taller'], archived: true, sort: 'priority' })
  })

  it('rejects unknown statuses', () => {
    expect(projectListQuerySchema.safeParse({ status: 'done' }).success).toBe(false)
  })
})

describe('partial updates', () => {
  it('fileUpdateSchema leaves missing fields undefined (does not null them)', async () => {
    const { fileUpdateSchema } = await import('../shared/utils/schemas')
    const out = fileUpdateSchema.parse({ final: true })
    expect(out).toEqual({ final: true })
  })

  it('projectUpdateSchema leaves missing fields undefined', async () => {
    const { projectUpdateSchema } = await import('../shared/utils/schemas')
    const out = projectUpdateSchema.parse({ priority: 'high' })
    expect(out).toEqual({ priority: 'high' })
  })
})
