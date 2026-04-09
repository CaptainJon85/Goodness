import { AlertCircle } from 'lucide-react'
import { daysUntil, formatGBP, formatDate } from '../../lib/format'

interface CardDue {
  id: string
  nickname: string
  paymentDueDate: string
  minimumPayment: number
}

export default function PaymentAlert({ cards }: { cards: CardDue[] }) {
  if (cards.length === 0) return null
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-red-800">Payment due soon</p>
      </div>
      <ul className="space-y-1">
        {cards.map((c) => (
          <li key={c.id} className="text-sm text-red-700">
            <strong>{c.nickname}</strong> — {formatGBP(c.minimumPayment)} due{' '}
            {formatDate(c.paymentDueDate)} ({daysUntil(c.paymentDueDate)} days)
          </li>
        ))}
      </ul>
    </div>
  )
}
