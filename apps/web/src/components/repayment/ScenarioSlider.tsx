import { useState, useEffect, useRef, useCallback } from 'react'
import { formatGBP } from '../../lib/format'
import { TrendingDown, Calendar, PiggyBank } from 'lucide-react'

interface ScenarioResult {
  payoffMonths: number
  totalInterestPaid: number
  totalInterestSaved: number
  projectedPayoffDate: Date | null
  insufficientBudget?: boolean
}

interface ScenarioSliderProps {
  currentBudget: number          // pence — the baseline
  currentResult: ScenarioResult  // pre-calculated result for currentBudget
  onCalculate: (budget: number) => Promise<ScenarioResult>
}

export default function ScenarioSlider({ currentBudget, currentResult, onCalculate }: ScenarioSliderProps) {
  const [budget, setBudget] = useState(currentBudget)
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const min = Math.max(100, Math.round(currentBudget * 0.5 / 100) * 100)  // round to nearest £1
  const max = Math.round(currentBudget * 3 / 100) * 100

  const runCalc = useCallback(async (b: number) => {
    setLoading(true)
    try {
      const r = await onCalculate(b)
      setResult(r)
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [onCalculate])

  useEffect(() => {
    if (budget === currentBudget) { setResult(null); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runCalc(budget), 350)
    return () => clearTimeout(debounceRef.current)
  }, [budget, currentBudget, runCalc])

  const compare = result ?? currentResult
  const monthsSaved = currentResult.payoffMonths - compare.payoffMonths
  const interestSaved = currentResult.totalInterestPaid - compare.totalInterestPaid
  const isImproved = budget > currentBudget

  return (
    <div className="card space-y-5">
      <div>
        <h3 className="font-semibold text-gray-900">What if I paid more?</h3>
        <p className="text-xs text-gray-500 mt-0.5">Drag the slider to see how extra payments shorten your payoff date.</p>
      </div>

      {/* Slider */}
      <div>
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-sm text-gray-600">Monthly budget</span>
          <span className="text-lg font-bold text-gray-900">{formatGBP(budget)}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={100}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full accent-brand-600 h-2"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{formatGBP(min)}</span>
          <span className="text-brand-600 font-medium">{formatGBP(currentBudget)} current</span>
          <span>{formatGBP(max)}</span>
        </div>
      </div>

      {/* Comparison grid */}
      <div className={`grid grid-cols-3 gap-3 transition-opacity ${loading ? 'opacity-40' : 'opacity-100'}`}>
        <div className={`rounded-xl p-3 text-center ${isImproved && result ? 'bg-green-50' : 'bg-gray-50'}`}>
          <Calendar className={`h-4 w-4 mx-auto mb-1 ${isImproved && result ? 'text-green-500' : 'text-gray-400'}`} />
          <p className="text-xs text-gray-500">Paid off in</p>
          <p className="font-bold text-gray-900">{compare.payoffMonths}mo</p>
          {isImproved && result && monthsSaved > 0 && (
            <p className="text-xs text-green-600 font-medium">{monthsSaved}mo sooner</p>
          )}
        </div>

        <div className={`rounded-xl p-3 text-center ${isImproved && result ? 'bg-green-50' : 'bg-gray-50'}`}>
          <TrendingDown className={`h-4 w-4 mx-auto mb-1 ${isImproved && result ? 'text-green-500' : 'text-gray-400'}`} />
          <p className="text-xs text-gray-500">Total interest</p>
          <p className="font-bold text-gray-900">{formatGBP(compare.totalInterestPaid)}</p>
          {isImproved && result && interestSaved > 0 && (
            <p className="text-xs text-green-600 font-medium">save {formatGBP(interestSaved)}</p>
          )}
        </div>

        <div className={`rounded-xl p-3 text-center ${isImproved && result ? 'bg-green-50' : 'bg-gray-50'}`}>
          <PiggyBank className={`h-4 w-4 mx-auto mb-1 ${isImproved && result ? 'text-green-500' : 'text-gray-400'}`} />
          <p className="text-xs text-gray-500">Interest saved</p>
          <p className={`font-bold ${isImproved && result ? 'text-green-700' : 'text-gray-900'}`}>
            {formatGBP(compare.totalInterestSaved)}
          </p>
        </div>
      </div>

      {compare.insufficientBudget && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          This budget is below the sum of your minimum payments. Increase to at least cover all minimums.
        </p>
      )}
    </div>
  )
}
