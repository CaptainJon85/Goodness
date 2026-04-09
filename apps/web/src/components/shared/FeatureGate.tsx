import { useAuthStore } from '../../store/auth'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'

const TIER_RANK: Record<string, number> = { free: 0, plus: 1, premium: 2 }

interface FeatureGateProps {
  requiredTier: 'plus' | 'premium'
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function FeatureGate({ requiredTier, children, fallback }: FeatureGateProps) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const userRank = TIER_RANK[user?.subscriptionTier ?? 'free']
  const requiredRank = TIER_RANK[requiredTier]

  if (userRank >= requiredRank) return <>{children}</>

  if (fallback) return <>{fallback}</>

  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
      <div className="inline-flex rounded-full bg-gray-100 p-3 mb-3">
        <Lock className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">
        {requiredTier === 'premium' ? 'Premium' : 'Plus'} feature
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Upgrade to {requiredTier === 'premium' ? 'Premium (£9.99/mo)' : 'Plus (£4.99/mo)'} to unlock this feature.
      </p>
      <button onClick={() => navigate('/pricing')} className="btn-primary">
        Upgrade now
      </button>
    </div>
  )
}
