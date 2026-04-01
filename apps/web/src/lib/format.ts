/** Format pence as pounds: 12345 → "£123.45" */
export function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)
}

/** Format a percentage */
export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/** Format a date as "12 Apr 2026" */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
}

/** Days until a date */
export function daysUntil(date: string | Date | null | undefined): number {
  if (!date) return Infinity
  const ms = new Date(date).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

/** Utilisation colour class */
export function utilisationColour(pct: number): string {
  if (pct >= 75) return 'text-red-600'
  if (pct >= 30) return 'text-amber-500'
  return 'text-green-600'
}

/** APR badge colour */
export function aprColour(apr: number): { bg: string; text: string } {
  if (apr >= 25) return { bg: 'bg-red-100', text: 'text-red-700' }
  if (apr >= 15) return { bg: 'bg-amber-100', text: 'text-amber-700' }
  return { bg: 'bg-green-100', text: 'text-green-700' }
}
