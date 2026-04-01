import { useState, useEffect, useRef } from 'react'
import { formatGBP } from '../../lib/format'

interface ScenarioResult {
  payoffMonths: number
  totalInterestPaid: number
  projectedPayoffDate: Date | null
}

interface ScenarioSliderProps {
  currentBudget: number
  onCalculate: (budget: number) => Promise<ScenarioResult>
}

export default function ScenarioSlider({ currentBudget, onCalculate }: ScenarioSliderProps) {
  const [budget, setBudget] = useState(currentBudget)
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await onCalculate(budget)
        setResult(r)
      } catch {
        // ignore
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [budget, onCalculate])

  const min = Math.round(currentBudget * 0.5)
  const max = Math.round(currentBudget * 3)

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold text-gray-900">What if I paid more?</h3>
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Monthly budget</span>
          <span className="font-bold text-gray-900">{formatGBP(budget)}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={100}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full accent-brand-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{formatGBP(min)}</span>
          <span>{formatGBP(max)}</span>
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">Paid off in</p>
            <p className="text-lg font-bold text-gray-900">{result.payoffMonths} months</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">Total interest</p>
            <p className="text-lg font-bold text-gray-900">{formatGBP(result.totalInterestPaid)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
