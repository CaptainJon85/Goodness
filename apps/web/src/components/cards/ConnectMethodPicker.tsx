import { Building2, Camera, PenLine } from 'lucide-react'

const methods = [
  {
    id: 'open_banking' as const,
    icon: Building2,
    title: 'Open Banking',
    description: 'Connect your bank — balances sync automatically',
    badge: 'Plus',
    badgeColour: 'bg-brand-100 text-brand-700',
  },
  {
    id: 'screenshot' as const,
    icon: Camera,
    title: 'Screenshot',
    description: 'Upload a screenshot — we\'ll read the details with OCR',
    badge: 'Plus',
    badgeColour: 'bg-brand-100 text-brand-700',
  },
  {
    id: 'manual' as const,
    icon: PenLine,
    title: 'Manual entry',
    description: 'Type the details in yourself',
    badge: 'Free',
    badgeColour: 'bg-gray-100 text-gray-600',
  },
]

interface ConnectMethodPickerProps {
  onSelect: (method: 'open_banking' | 'screenshot' | 'manual') => void
  tier: string
}

export default function ConnectMethodPicker({ onSelect, tier }: ConnectMethodPickerProps) {
  const canUsePlus = tier === 'plus' || tier === 'premium'

  return (
    <div className="space-y-3">
      {methods.map(({ id, icon: Icon, title, description, badge, badgeColour }) => {
        const locked = !canUsePlus && id !== 'manual'
        return (
          <button
            key={id}
            onClick={() => !locked && onSelect(id)}
            disabled={locked}
            className={`w-full text-left rounded-2xl border-2 p-4 transition-all flex items-start gap-4 ${
              locked
                ? 'border-gray-100 opacity-50 cursor-not-allowed'
                : 'border-gray-200 hover:border-brand-400 hover:bg-brand-50 cursor-pointer'
            }`}
          >
            <div className="rounded-xl bg-gray-100 p-2.5 flex-shrink-0">
              <Icon className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{title}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColour}`}>
                  {badge}
                </span>
                {locked && <span className="text-xs text-gray-400">— upgrade required</span>}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
