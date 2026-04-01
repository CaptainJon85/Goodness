import { useEffect, useState, useCallback } from 'react'
import type { RepaymentPlan, CreditCard } from '@clearpath/shared'
import { api } from '../lib/api'
import { formatGBP } from '../lib/format'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import EmptyState from '../components/shared/EmptyState'
import PlanSummary from '../components/repayment/PlanSummary'
import AllocationCard from '../components/repayment/AllocationCard'
import MethodToggle from '../components/repayment/MethodToggle'
import ScenarioSlider from '../components/repayment/ScenarioSlider'
import FeatureGate from '../components/shared/FeatureGate'
import { TrendingDown } from 'lucide-react'

export default function RepaymentPage() {
  const [plan, setPlan] = useState<RepaymentPlan | null>(null)
  const [cards, setCards] = useState<CreditCard[]>([])
  const [method, setMethod] = useState<'avalanche' | 'snowball'>('avalanche')
  const [budget, setBudget] = useState(50000)  // pence default (£500)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.repayment.getPlan().catch(() => null),
      api.cards.list(),
    ]).then(([p, c]) => {
      if (p) {
        setPlan(p)
        setMethod(p.method)
        setBudget(p.monthlyBudget)
      }
      setCards(c)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const p = await api.repayment.generate(budget, method)
      setPlan(p)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const calcScenario = useCallback(async (b: number) => {
    const r = await api.repayment.scenario(b, method)
    return { payoffMonths: r.payoffMonths, totalInterestPaid: r.totalInterestPaid, projectedPayoffDate: r.projectedPayoffDate }
  }, [method])

  if (loading) return <div className="py-20"><LoadingSpinner size="lg" /></div>

  return (
    <FeatureGate requiredTier="plus">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repayment Plan</h1>
          <p className="text-sm text-gray-500">AI-powered debt elimination strategy</p>
        </div>

        {cards.length === 0 ? (
          <EmptyState
            icon={TrendingDown}
            title="No cards added"
            description="Add at least one card before generating a repayment plan."
          />
        ) : (
          <>
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Plan settings</h2>
              <div>
                <label className="label">Monthly budget</label>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">£</span>
                  <input
                    type="number"
                    className="input w-36"
                    value={(budget / 100).toFixed(0)}
                    onChange={(e) => setBudget(Math.round(Number(e.target.value) * 100))}
                    min={1}
                  />
                </div>
              </div>
              <div>
                <label className="label">Strategy</label>
                <MethodToggle method={method} onChange={setMethod} />
                <p className="text-xs text-gray-500 mt-2">
                  {method === 'avalanche'
                    ? 'Avalanche: target highest APR first — minimises total interest paid.'
                    : 'Snowball: target smallest balance first — builds momentum with quick wins.'}
                </p>
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <button onClick={generate} disabled={generating} className="btn-primary">
                {generating ? 'Generating…' : plan ? 'Regenerate plan' : 'Generate plan'}
              </button>
            </div>

            {plan && (
              <>
                <PlanSummary plan={plan} />

                <div>
                  <h2 className="font-semibold text-gray-900 mb-3">Monthly allocations</h2>
                  <div className="space-y-3">
                    {plan.allocations.map((alloc) => (
                      <AllocationCard
                        key={alloc.cardId}
                        allocation={alloc}
                        card={cards.find((c) => c.id === alloc.cardId)}
                      />
                    ))}
                  </div>
                </div>

                <FeatureGate requiredTier="premium">
                  <ScenarioSlider currentBudget={budget} onCalculate={calcScenario} />
                </FeatureGate>
              </>
            )}
          </>
        )}
      </div>
    </FeatureGate>
  )
}
