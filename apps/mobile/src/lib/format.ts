/** Format pence as pounds: 12345 → "£123.45" */
export function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
}

export function daysUntil(date: string | Date | null | undefined): number {
  if (!date) return Infinity
  const ms = new Date(date).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function utilisationPct(balance: number, limit: number): number {
  return limit > 0 ? Math.min(100, (balance / limit) * 100) : 0
}

export function aprColour(apr: number): string {
  if (apr >= 25) return '#dc2626'  // red
  if (apr >= 15) return '#d97706'  // amber
  return '#16a34a'                  // green
}

export function utilisationColour(pct: number): string {
  if (pct >= 75) return '#dc2626'
  if (pct >= 30) return '#d97706'
  return '#16a34a'
}
