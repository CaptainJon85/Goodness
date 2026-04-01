import { useState } from 'react'
import { Check } from 'lucide-react'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'

const tiers = [
  {
    name: 'Free',
    price: '£0',
    description: 'Get started with basic debt tracking',
    features: ['Up to 2 cards', 'Manual card entry', 'Basic dashboard', 'APR sorting'],
    cta: 'Current plan',
    tier: 'free' as const,
    highlight: false,
  },
  {
    name: 'Plus',
    price: '£4.99',
    description: 'Full repayment planning and Open Banking',
    features: ['Unlimited cards', 'Open Banking sync', 'Full repayment engine', 'Credit score tracking', 'AI repayment narrative'],
    cta: 'Upgrade to Plus',
    tier: 'plus' as const,
    highlight: false,
  },
  {
    name: 'Premium',
    price: '£9.99',
    description: 'Everything Plus + smart virtual card',
    features: ['Everything in Plus', 'Smart virtual card', 'Scenario modeller', 'Transaction routing', 'Priority support'],
    cta: 'Upgrade to Premium',
    tier: 'premium' as const,
    highlight: true,
  },
]

export default function PricingPage() {
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(tier: 'plus' | 'premium') {
    setLoading(tier)
    try {
      const { checkoutUrl } = await api.subscription.checkout(tier)
      if (checkoutUrl) window.location.href = checkoutUrl
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Choose your plan</h1>
        <p className="text-gray-500 mt-2">All plans include a 14-day free trial</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((t) => {
          const isCurrent = user?.subscriptionTier === t.tier
          return (
            <div
              key={t.tier}
              className={`rounded-2xl border-2 p-6 flex flex-col ${
                t.highlight ? 'border-brand-600 shadow-lg' : 'border-gray-200'
              }`}
            >
              {t.highlight && (
                <div className="inline-flex rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white mb-3 self-start">
                  Most popular
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900">{t.name}</h2>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-bold text-gray-900">{t.price}</span>
                {t.tier !== 'free' && <span className="text-gray-500 text-sm">/mo</span>}
              </div>
              <p className="text-sm text-gray-500 mb-4">{t.description}</p>

              <ul className="space-y-2 flex-1 mb-6">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="btn-secondary text-center cursor-default opacity-70">Current plan</div>
              ) : t.tier === 'free' ? (
                <div className="btn-secondary text-center cursor-default opacity-70">Free</div>
              ) : (
                <button
                  onClick={() => handleUpgrade(t.tier)}
                  disabled={loading === t.tier}
                  className={t.highlight ? 'btn-primary' : 'btn-secondary'}
                >
                  {loading === t.tier ? 'Redirecting…' : t.cta}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
