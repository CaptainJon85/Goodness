import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import FeatureGate from '../components/shared/FeatureGate'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function CreditScorePage() {
  const [latest, setLatest] = useState<{ score: number; band: string; provider: string; recordedAt: string } | null>(null)
  const [history, setHistory] = useState<{ score: number; recordedAt: string }[]>([])
  const [projection, setProjection] = useState<{ currentScore: number; projectedScore: number; estimatedScoreGain: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.creditScore.latest().catch(() => null),
      api.creditScore.history().catch(() => []),
      api.creditScore.projection().catch(() => null),
    ]).then(([l, h, p]) => {
      setLatest(l)
      setHistory(h)
      setProjection(p)
    }).finally(() => setLoading(false))
  }, [])

  const bandColour: Record<string, string> = {
    excellent: 'text-green-600',
    good: 'text-brand-600',
    fair: 'text-amber-500',
    poor: 'text-red-600',
  }

  if (loading) return <div className="py-20"><LoadingSpinner size="lg" /></div>

  return (
    <FeatureGate requiredTier="plus">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Credit Score</h1>

        {latest ? (
          <>
            <div className="card text-center">
              <p className="text-sm text-gray-500 mb-2">Current score ({latest.provider})</p>
              <p className={`text-6xl font-black mb-1 ${bandColour[latest.band] ?? 'text-gray-900'}`}>
                {latest.score}
              </p>
              <p className={`text-sm font-semibold capitalize ${bandColour[latest.band] ?? ''}`}>
                {latest.band}
              </p>
            </div>

            {projection && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-3">Score projection</h2>
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-gray-500">Current</p>
                    <p className="text-2xl font-bold">{projection.currentScore}</p>
                  </div>
                  <div className="text-2xl text-gray-300 self-center">→</div>
                  <div>
                    <p className="text-xs text-green-600">If you follow your plan</p>
                    <p className="text-2xl font-bold text-green-600">+{projection.estimatedScoreGain}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Estimates based on utilisation reduction. Actual scores vary.
                </p>
              </div>
            )}

            {history.length > 1 && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">Score history</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={history.map((h) => ({
                    score: h.score,
                    date: new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(new Date(h.recordedAt)),
                  })).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-500 mb-4">No credit score data yet.</p>
            <p className="text-sm text-gray-400">Connect your Experian account to start tracking your score.</p>
          </div>
        )}
      </div>
    </FeatureGate>
  )
}
