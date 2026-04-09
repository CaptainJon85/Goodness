import type { PaymentAllocation, CreditCard } from '@clearpath/shared'
import { formatGBP } from '../../lib/format'
import AprBadge from '../shared/AprBadge'

interface AllocationCardProps {
  allocation: PaymentAllocation
  card?: CreditCard
}

export default function AllocationCard({ allocation, card }: AllocationCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${allocation.isMinimumOnly ? 'border-gray-200 bg-gray-50' : 'border-brand-200 bg-brand-50'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-gray-900">{card?.nickname ?? allocation.cardId}</p>
          {card && <p className="text-xs text-gray-500">••••{card.lastFour}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">{formatGBP(allocation.monthlyAmount)}</p>
          <p className="text-xs text-gray-500">/month</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {card && <AprBadge apr={card.apr} />}
        {!allocation.isMinimumOnly && (
          <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
            Priority
          </span>
        )}
        {allocation.isMinimumOnly && (
          <span className="text-xs text-gray-500">Minimum only</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2">{allocation.reasoning}</p>
    </div>
  )
}
