export interface FilamentUsage {
  grams: number | string
  pricePerKg: number | string
}

/** Cost in € of the filament used, rounded to cents. Only filament counts (PROJECT_PLAN §3.5). */
export function filamentCost(items: FilamentUsage[]): number {
  const total = items.reduce((sum, i) => {
    const grams = Number(i.grams)
    const price = Number(i.pricePerKg)
    if (!Number.isFinite(grams) || !Number.isFinite(price) || grams < 0 || price < 0) return sum
    return sum + (grams * price) / 1000
  }, 0)
  return Math.round(total * 100) / 100
}

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

export function formatEuro(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? euro.format(n) : '—'
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const v = bytes / 1024 ** i
  return `${v.toLocaleString('es-ES', { maximumFractionDigits: i >= 2 ? 1 : 0 })} ${units[i]}`
}
