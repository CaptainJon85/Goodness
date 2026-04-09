import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'
import { formatPct } from '../lib/format'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import FeatureGate from '../components/shared/FeatureGate'
import type { ScoreFactor } from '@clearpath/shared'

interface ScoreRecord {
  score: number
  band: string
  provider: string
  recordedAt: string
  factors?: ScoreFactor[]
}

interface Projection {
  currentScore: number | null
  projectedScore: number | null
  estimatedScoreGain: number
  currentUtilisation: number
  payoffMonths: number | null
}

const BAND_COLOUR: Record<string, string> = {
  excellent: 'text-green-600',
  good: 'text-brand-600',
  fair: 'text-amber-500',
  poor: 'text-red-600',
}

const BAND_RING: Record<string, string> = {
  excellent: 'stroke-green-500',
  good: 'stroke-brand-500',
  fair: 'stroke-amber-400',
  poor: 'stroke-red-500',
}

function ScoreRing({ score, band }: { score: number; band: string }) {
  const pct = Math.min(100, (score / 999) * 100)
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={140} height={140} className="-rotate-90">
        <circle cx={70} cy={70} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
        <circle
          cx={70} cy={70} r={r} fill="none" strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={`transition-all duration-700 ${BAND_RING[band] ?? 'stroke-gray-400'}`}
        />
      </svg>
      <div className="absolute text-center">
        <p className={`text-3xl font-black ${BAND_COLOUR[band] ?? 'text-gray-900'}`}>{score}</p>
        <p className={`text-xs font-semibold capitalize ${BAND_COLOUR[band] ?? ''}`}>{band}</p>
      </div>
    </div>
  )
}

function ScoreFactorList({ factors }: { factors: ScoreFactor[] }) {
  const positive = factors.filter((f) => f.type === 'positive')
  const negative = factors.filter((f) => f.type === 'negative')
  const impactDot = (impact: string) =>
    ({ high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-gray-300' })[impact] ?? 'bg-gray-300'

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold text-green-700 mb-2">Helping your score</p>
        <ul className="space-y-2">
          {positive.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />
              <span className="text-gray-700">{f.description}</span>
              <span className={`ml-auto flex-shrink-0 h-2 w-2 rounded-full mt-1.5 ${impactDot(f.impact)}`} title={`${f.impact} impact`} />
            </li>
          ))}
          {positive.length === 0 && <li className="text-sm text-gray-400">None identified</li>}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold text-red-700 mb-2">Hurting your score</p>
        <ul className="space-y-2">
          {negative.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-red-400 flex-shrink-0" />
              <span className="text-gray-700">{f.description}</span>
              <span className={`ml-auto flex-shrink-0 h-2 w-2 rounded-full mt-1.5 ${impactDot(f.impact)}`} title={`${f.impact} impact`} />
            </li>
          ))}
          {negative.length === 0 && <li className="text-sm text-gray-400">None identified</li>}
        </ul>
      </div>
    </div>
  )
}

// Experian pull form
function ExperianForm({ onFetch, isLoading }: { onFetch: (data: Parameters<typeof api.creditScore.fetch>[0]) => void; isLoading: boolean }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', postcode: '', addressLine1: '' })
  function set(k: keyof typeof form) { return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value })) }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onFetch(form) }} className="space-y-4">
      <p className="text-sm text-gray-500">We need a few details to pull your score from Experian. This is a <strong>soft check</strong> — it won't affect your score.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">First name</label>
          <input className="input" value={form.firstName} onChange={set('firstName')} required />
        </div>
        <div>
          <label className="label">Last name</label>
          <input className="input" value={form.lastName} onChange={set('lastName')} required />
        </div>
        <div>
          <label className="label">Date of birth</label>
          <input className="input" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} required />
        </div>
        <div>
          <label className="label">Postcode</label>
          <input className="input" value={form.postcode} onChange={set('postcode')} placeholder="SW1A 1AA" required />
        </div>
        <div className="col-span-2">
          <label className="label">Address line 1</label>
          <input className="input" value={form.addressLine1} onChange={set('addressLine1')} placeholder="10 Downing Street" required />
        </div>
      </div>
      <button type="submit" disabled={isLoading} className="btn-primary w-full">
        {isLoading ? 'Fetching score…' : 'Get my credit score'}
      </button>
    </form>
  )
}

export default function CreditScorePage() {
  const [latest, setLatest] = useState<ScoreRecord | null>(null)
  const [history, setHistory] = useState<{ score: number; recordedAt: string }[]>([])
  const [projection, setProjection] = useState<Projection | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showFetchForm, setShowFetchForm] = useState(false)

  function loadData() {
    return Promise.all([
      api.creditScore.latest().catch(() => null),
      api.creditScore.history().catch(() => []),
      api.creditScore.projection().catch(() => null),
    ]).then(([l, h, p]) => {
      setLatest(l)
      setHistory(h)
      setProjection(p)
    })
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  async function handleFetch(data: Parameters<typeof api.creditScore.fetch>[0]) {
    setFetching(true)
    setFetchError(null)
    try {
      await api.creditScore.fetch(data)
      setShowFetchForm(false)
      await loadData()
    } catch (err) {
      setFetchError((err as Error).message)
    } finally {
      setFetching(false)
    }
  }

  if (loading) return <div className="py-20"><LoadingSpinner size="lg" /></div>

  return (
    <FeatureGate requiredTier="plus">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Credit Score</h1>
            <p className="text-sm text-gray-500">Powered by Experian</p>
          </div>
          <button onClick={() => setShowFetchForm(!showFetchForm)} className="btn-secondary text-sm">
            {latest ? 'Refresh score' : 'Get score'}
          </button>
        </div>

        {showFetchForm && (
          <div className="card">
            {fetchError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{fetchError}</p>
              </div>
            )}
            <ExperianForm onFetch={handleFetch} isLoading={fetching} />
          </div>
        )}

        {latest ? (
          <>
            {/* Score ring + band */}
            <div className="card flex flex-col sm:flex-row items-center gap-6">
              <ScoreRing score={latest.score} band={latest.band} />
              <div>
                <p className={`text-2xl font-bold capitalize ${BAND_COLOUR[latest.band] ?? 'text-gray-900'}`}>{latest.band}</p>
                <p className="text-sm text-gray-500">Experian score of {latest.score} out of 999</p>
                <p className="text-xs text-gray-400 mt-1">
                  Last updated {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(latest.recordedAt))}
                </p>
              </div>
            </div>

            {/* Projection */}
            {projection && projection.currentScore != null && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <h2 className="font-semibold text-gray-900">Score projection</h2>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Today</p>
                    <p className="text-2xl font-bold text-gray-900">{projection.currentScore}</p>
                  </div>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-300 to-green-400 rounded" />
                  <div className="text-center">
                    <p className="text-xs text-green-600">After your plan</p>
                    <p className="text-2xl font-bold text-green-600">
                      {projection.projectedScore ?? '—'}
                      {projection.estimatedScoreGain > 0 && (
                        <span className="text-sm ml-1">+{projection.estimatedScoreGain}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Current utilisation</p>
                    <p className="font-semibold">{formatPct(projection.currentUtilisation)}</p>
                  </div>
                  {projection.payoffMonths && (
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Debt-free in</p>
                      <p className="font-semibold">{projection.payoffMonths} months</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">{projection && 'Estimated based on utilisation reduction. Actual scores vary.'}</p>
              </div>
            )}

            {/* Factors */}
            {latest.factors && latest.factors.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">Score factors</h2>
                <ScoreFactorList factors={latest.factors} />
              </div>
            )}

            {/* History chart */}
            {history.length > 1 && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">Score history</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={[...history].reverse().map((h) => ({
                    score: h.score,
                    date: new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(new Date(h.recordedAt)),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={36} />
                    <Tooltip formatter={(v) => [v, 'Score']} />
                    <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : !showFetchForm ? (
          <div className="card text-center py-12">
            <p className="text-gray-500 mb-2">No credit score data yet.</p>
            <p className="text-sm text-gray-400 mb-4">Pull your score from Experian — it's a soft check and won't affect your score.</p>
            <button onClick={() => setShowFetchForm(true)} className="btn-primary">Get my credit score</button>
          </div>
        ) : null}
      </div>
    </FeatureGate>
  )
}
