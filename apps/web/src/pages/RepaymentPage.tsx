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
  const [budget, setBudget] = useState(50000)  // pence (£500 default)
  const [budgetInput, setBudgetInput] = useState('500')
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
        setBudgetInput((p.monthlyBudget / 100).toFixed(0))
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
    return {
      payoffMonths: r.payoffMonths,
      totalInterestPaid: r.totalInterestPaid,
      totalInterestSaved: r.totalInterestSaved,
      projectedPayoffDate: r.projectedPayoffDate,
    }
  }, [method])

  function handleBudgetInput(val: string) {
    setBudgetInput(val)
    const pence = Math.round(parseFloat(val) * 100)
    if (!isNaN(pence) && pence > 0) setBudget(pence)
  }

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
            {/* Settings card */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Plan settings</h2>

              <div>
                <label className="label">Monthly budget (£)</label>
                <div className="flex items-center gap-2 max-w-[10rem]">
                  <span className="text-gray-400 text-sm">£</span>
                  <input
                    type="number"
                    className="input"
                    value={budgetInput}
                    onChange={(e) => handleBudgetInput(e.target.value)}
                    min={1}
                    step={10}
                  />
                </div>
              </div>

              <div>
                <label className="label">Strategy</label>
                <MethodToggle method={method} onChange={(m) => { setMethod(m); setPlan(null) }} />
                <p className="text-xs text-gray-500 mt-2">
                  {method === 'avalanche'
                    ? 'Avalanche: clear the highest APR card first — minimises total interest paid.'
                    : 'Snowball: clear the smallest balance first — quick wins build momentum.'}
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

                {/* Scenario modeller — Premium gate */}
                <FeatureGate requiredTier="premium">
                  <ScenarioSlider
                    currentBudget={budget}
                    currentResult={{
                      payoffMonths: plan.payoffMonths,
                      totalInterestPaid: plan.totalInterestPaid,
                      totalInterestSaved: plan.totalInterestSaved,
                      projectedPayoffDate: plan.projectedPayoffDate,
                    }}
                    onCalculate={calcScenario}
                  />
                </FeatureGate>
              </>
            )}
          </>
        )}
      </div>
    </FeatureGate>
  )
}
