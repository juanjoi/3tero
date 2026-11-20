import { describe, expect, it } from 'vitest'
import { filamentCost, formatBytes, formatMinutes } from '../shared/utils/cost'

describe('filamentCost', () => {
  it('sums grams × €/kg for every filament', () => {
    expect(filamentCost([{ grams: 88, pricePerKg: 20 }, { grams: 8, pricePerKg: 24 }])).toBe(1.95)
  })

  it('accepts numeric strings as returned by Postgres numeric columns', () => {
    expect(filamentCost([{ grams: '96.00', pricePerKg: '19.99' }])).toBe(1.92)
  })

  it('ignores invalid or negative values', () => {
    expect(filamentCost([{ grams: 'x', pricePerKg: 20 }, { grams: -5, pricePerKg: 20 }, { grams: 10, pricePerKg: 20 }])).toBe(0.2)
  })

  it('is zero for no filaments', () => {
    expect(filamentCost([])).toBe(0)
  })
})

describe('formatMinutes', () => {
  it.each([
    [45, '45m'],
    [60, '1h'],
    [190, '3h 10m'],
    [null, '—'],
  ])('%s → %s', (input, expected) => {
    expect(formatMinutes(input as number | null)).toBe(expected)
  })
})

describe('formatBytes', () => {
  it('uses binary units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('2 KB')
    expect(formatBytes(5 * 1024 ** 3)).toBe('5 GB')
  })
})
