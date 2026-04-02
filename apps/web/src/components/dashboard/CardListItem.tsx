import { CreditCard as CardIcon, Trash2, Pencil } from 'lucide-react'
import type { CreditCard } from '@clearpath/shared'
import AprBadge from '../shared/AprBadge'
import UtilisationBar from '../shared/UtilisationBar'
import { formatGBP, formatDate, daysUntil } from '../../lib/format'

interface CardListItemProps {
  card: CreditCard
  onDelete: (id: string) => void
  onEdit: (card: CreditCard) => void
}

export default function CardListItem({ card, onDelete, onEdit }: CardListItemProps) {
  const days = daysUntil(card.paymentDueDate as string)
  const dueSoon = days !== Infinity && days <= 5

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gray-100 p-2">
            <CardIcon className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{card.nickname}</p>
            <p className="text-xs text-gray-500">
              {card.provider ? `${card.provider} • ` : ''}••••{card.lastFour}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AprBadge apr={card.apr} />
          <button
            onClick={() => onEdit(card)}
            className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Edit card"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(card.id)}
            className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label="Delete card"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-2xl font-bold text-gray-900">{formatGBP(card.balance)}</span>
          <span className="text-sm text-gray-500 self-end">of {formatGBP(card.creditLimit)}</span>
        </div>
        <UtilisationBar balance={card.balance} creditLimit={card.creditLimit} />
      </div>

      {card.paymentDueDate && (
        <div className={`text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 ${
          dueSoon ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
        }`}>
          {dueSoon ? '⚠ ' : ''}
          Payment due {formatDate(card.paymentDueDate as string)} · Min {formatGBP(card.minimumPayment)}
        </div>
      )}
    </div>
  )
}
