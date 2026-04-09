import { formatGBP } from '../../lib/format'
import { TrendingDown } from 'lucide-react'
import type { DashboardSummary } from '@clearpath/shared'

export default function DebtSummaryCard({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-brand-100">Total Debt</p>
          <p className="text-4xl font-bold mt-1">{formatGBP(summary.totalDebt)}</p>
          <p className="text-sm text-brand-200 mt-1">
            across {summary.cardsCount} {summary.cardsCount === 1 ? 'card' : 'cards'}
          </p>
        </div>
        <div className="rounded-xl bg-white/10 p-3">
          <TrendingDown className="h-6 w-6 text-white" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/20 flex gap-6">
        <div>
          <p className="text-xs text-brand-200">Monthly interest</p>
          <p className="text-lg font-semibold">{formatGBP(summary.monthlyInterestBurn)}</p>
        </div>
        <div>
          <p className="text-xs text-brand-200">Utilisation</p>
          <p className="text-lg font-semibold">{summary.averageUtilisation.toFixed(0)}%</p>
        </div>
        {summary.projectedPayoffDate && (
          <div>
            <p className="text-xs text-brand-200">Debt-free by</p>
            <p className="text-lg font-semibold">
              {new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(new Date(summary.projectedPayoffDate))}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
