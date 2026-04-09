import { ShoppingCart, Coffee, Plane, Fuel, Zap, HelpCircle } from 'lucide-react'
import { formatGBP } from '../../lib/format'
import type { Transaction } from '@clearpath/shared'

const CATEGORY_ICONS: Record<string, typeof ShoppingCart> = {
  grocery: ShoppingCart,
  dining: Coffee,
  travel: Plane,
  petrol: Fuel,
  utilities: Zap,
}

function CategoryIcon({ mcc }: { mcc: string }) {
  // Map MCC codes to rough category
  const cat = mccToCategory(mcc)
  const Icon = CATEGORY_ICONS[cat] ?? HelpCircle
  return (
    <div className="rounded-full bg-gray-100 p-2.5">
      <Icon className="h-4 w-4 text-gray-500" />
    </div>
  )
}

function mccToCategory(mcc: string): string {
  const map: Record<string, string> = {
    '5411': 'grocery', '5412': 'grocery',
    '5812': 'dining', '5813': 'dining', '5814': 'dining',
    '4511': 'travel', '7011': 'travel', '4722': 'travel', '7512': 'travel',
    '5541': 'petrol', '5542': 'petrol',
    '4900': 'utilities', '4911': 'utilities',
  }
  return map[mcc] ?? 'other'
}

type TxItem = Transaction & { allocatedToCardNickname?: string }

interface TransactionFeedProps {
  transactions: TxItem[]
  isLoading?: boolean
}

export default function TransactionFeed({ transactions, isLoading }: TransactionFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="py-10 text-center text-gray-400 text-sm">
        No transactions yet. Make a purchase with your virtual card to see routing in action.
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center gap-4 py-3">
          <CategoryIcon mcc={tx.merchantCategory} />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{tx.merchantName || 'Unknown merchant'}</p>
            <p className="text-xs text-gray-500 truncate">{tx.allocationReason}</p>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-sm font-semibold text-gray-900">{formatGBP(tx.amount)}</p>
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <span className="text-xs text-gray-400">→</span>
              <span className="text-xs font-medium text-brand-700 truncate max-w-[100px]">
                {tx.allocatedToCardNickname ?? 'Card'}
              </span>
              {tx.rewardEarned > 0 && (
                <span className="text-xs text-green-600 font-medium">
                  +{formatGBP(tx.rewardEarned)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
