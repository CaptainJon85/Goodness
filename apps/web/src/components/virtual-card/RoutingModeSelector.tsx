import { Gift, TrendingDown, Shield } from 'lucide-react'

type RoutingMode = 'maximise_rewards' | 'minimise_cost' | 'protect_score'

const modes: { id: RoutingMode; icon: typeof Gift; label: string; description: string }[] = [
  {
    id: 'maximise_rewards',
    icon: Gift,
    label: 'Maximise rewards',
    description: 'Routes spend to the card earning the most cashback or points for each merchant category.',
  },
  {
    id: 'minimise_cost',
    icon: TrendingDown,
    label: 'Minimise cost',
    description: 'Always charges the card with the lowest APR to reduce interest if you carry a balance.',
  },
  {
    id: 'protect_score',
    icon: Shield,
    label: 'Protect credit score',
    description: 'Keeps each card's utilisation below 30% — the key threshold for credit score health.',
  },
]

interface RoutingModeSelectorProps {
  current: RoutingMode
  onChange: (mode: RoutingMode) => void
  isLoading?: boolean
}

export default function RoutingModeSelector({ current, onChange, isLoading }: RoutingModeSelectorProps) {
  return (
    <div className="space-y-2">
      {modes.map(({ id, icon: Icon, label, description }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          disabled={isLoading}
          className={`w-full text-left rounded-xl border-2 p-4 transition-all flex items-start gap-3 ${
            current === id
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
          }`}
        >
          <div className={`rounded-lg p-2 flex-shrink-0 ${current === id ? 'bg-brand-100' : 'bg-gray-100'}`}>
            <Icon className={`h-5 w-5 ${current === id ? 'text-brand-700' : 'text-gray-500'}`} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${current === id ? 'text-brand-900' : 'text-gray-900'}`}>{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
          {current === id && (
            <div className="ml-auto flex-shrink-0 h-5 w-5 rounded-full bg-brand-600 flex items-center justify-center">
              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
