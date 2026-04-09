import type { RepaymentPlan } from '@clearpath/shared'
import { formatGBP, formatDate } from '../../lib/format'
import { TrendingDown, Calendar, PiggyBank } from 'lucide-react'

export default function PlanSummary({ plan }: { plan: RepaymentPlan }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
          plan.method === 'avalanche' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {plan.method === 'avalanche' ? '🔥 Avalanche' : '⛄ Snowball'}
        </span>
        <span className="text-sm text-gray-500">Budget: {formatGBP(plan.monthlyBudget)}/mo</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <Calendar className="h-5 w-5 text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500 mb-1">Debt-free by</p>
          <p className="font-semibold text-gray-900">
            {plan.projectedPayoffDate
              ? new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(new Date(plan.projectedPayoffDate))
              : '—'}
          </p>
          <p className="text-xs text-gray-400">{plan.payoffMonths} months</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <TrendingDown className="h-5 w-5 text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500 mb-1">Interest paid</p>
          <p className="font-semibold text-gray-900">{formatGBP(plan.totalInterestPaid)}</p>
        </div>
        <div className="rounded-xl bg-green-50 p-4 text-center">
          <PiggyBank className="h-5 w-5 text-green-500 mx-auto mb-1" />
          <p className="text-xs text-green-700 mb-1">Interest saved</p>
          <p className="font-semibold text-green-700">{formatGBP(plan.totalInterestSaved)}</p>
          <p className="text-xs text-green-500">vs. minimums only</p>
        </div>
      </div>

      {plan.narrative && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 p-4">
          <p className="text-xs font-semibold text-brand-700 mb-1">AI Recommendation</p>
          <p className="text-sm text-brand-900">{plan.narrative}</p>
        </div>
      )}
    </div>
  )
}
