import { describe, expect, it } from 'vitest'
import { projectBulkSchema, projectCreateSchema, projectListQuerySchema, queueAddSchema, queueMoveSchema, queueUpdateSchema } from '../shared/utils/schemas'

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

describe('projectBulkSchema', () => {
  const ids = ['3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b']
  it('accepts exactly one action', () => {
    expect(projectBulkSchema.parse({ ids, priority: 'high' }).priority).toBe('high')
    expect(projectBulkSchema.parse({ ids, archive: false }).archive).toBe(false)
  })
  it('rejects zero or several actions', () => {
    expect(() => projectBulkSchema.parse({ ids })).toThrow()
    expect(() => projectBulkSchema.parse({ ids, priority: 'high', status: 'printed' })).toThrow()
  })
})

describe('print queue schemas', () => {
  const id = '3f2c1e0a-1b2c-4d5e-8f90-123456789abc'

  it('adds one copy by default and leaves the file to the server', () => {
    expect(queueAddSchema.parse({ projectId: id })).toEqual({ projectId: id, copies: 1 })
    expect(queueAddSchema.parse({ projectId: id, fileId: null, copies: '3' })).toEqual({ projectId: id, fileId: null, copies: 3 })
  })

  it('PATCH changes only the keys sent', () => {
    expect(queueUpdateSchema.parse({ copies: 2 })).toEqual({ copies: 2 })
    expect(queueUpdateSchema.parse({ fileId: null })).toEqual({ fileId: null })
  })

  it('rejects silly copies and positions', () => {
    expect(() => queueAddSchema.parse({ projectId: id, copies: 0 })).toThrow()
    expect(() => queueUpdateSchema.parse({ copies: 100 })).toThrow()
    expect(() => queueMoveSchema.parse({ position: -1 })).toThrow()
  })

  it('bulk add to the queue is one action', () => {
    expect(projectBulkSchema.parse({ ids: [id], queue: true }).queue).toBe(true)
    expect(() => projectBulkSchema.parse({ ids: [id], queue: true, archive: true })).toThrow()
  })
})
