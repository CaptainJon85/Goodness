import { useEffect, useState, useCallback } from 'react'
import { Snowflake, Sun, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import type { VirtualCard, Transaction } from '@clearpath/shared'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import FeatureGate from '../components/shared/FeatureGate'
import VirtualCardDisplay from '../components/virtual-card/VirtualCardDisplay'
import RoutingModeSelector from '../components/virtual-card/RoutingModeSelector'
import TransactionFeed from '../components/virtual-card/TransactionFeed'

type RoutingMode = 'maximise_rewards' | 'minimise_cost' | 'protect_score'
type TxItem = Transaction & { allocatedToCardNickname?: string }

export default function VirtualCardPage() {
  const [card, setCard] = useState<VirtualCard | null>(null)
  const [transactions, setTransactions] = useState<TxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(false)
  const [activating, setActivating] = useState(false)
  const [freezeLoading, setFreezeLoading] = useState(false)
  const [routingLoading, setRoutingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      const txs = await api.virtualCard.transactions()
      setTransactions(txs as TxItem[])
    } catch {
      // non-fatal
    } finally {
      setTxLoading(false)
    }
  }, [])

  useEffect(() => {
    api.virtualCard.get()
      .then((c) => {
        setCard(c)
        return loadTransactions()
      })
      .catch(() => setCard(null))
      .finally(() => setLoading(false))
  }, [loadTransactions])

  async function activate() {
    setActivating(true)
    setError(null)
    try {
      const c = await api.virtualCard.activate()
      setCard(c)
    } catch (err) {
      const e = err as Error & { code?: string }
      if (e.code === 'KYC_REQUIRED') {
        setError('Identity verification is required before activating a virtual card. Complete KYC in Settings.')
      } else {
        setError(e.message)
      }
    } finally {
      setActivating(false)
    }
  }

  async function toggleFreeze() {
    if (!card) return
    setFreezeLoading(true)
    try {
      const { isFrozen } = await api.virtualCard.freeze(!card.isFrozen)
      setCard((c) => c ? { ...c, isFrozen } : c)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setFreezeLoading(false)
    }
  }

  async function changeRoutingMode(mode: RoutingMode) {
    if (!card) return
    setRoutingLoading(true)
    try {
      const { routingMode } = await api.virtualCard.setRoutingMode(mode)
      setCard((c) => c ? { ...c, routingMode: routingMode as RoutingMode } : c)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRoutingLoading(false)
    }
  }

  if (loading) return <div className="py-20"><LoadingSpinner size="lg" /></div>

  return (
    <FeatureGate requiredTier="premium">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Virtual Card</h1>
          <p className="text-sm text-gray-500">Smart Mastercard that routes spending automatically</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!card ? (
          <div className="card text-center py-12 space-y-4">
            <div className="inline-flex rounded-full bg-brand-50 p-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center">
                <span className="text-white font-bold text-lg">CP</span>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-xl text-gray-900">Activate your smart card</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Your ClearPath virtual Mastercard automatically routes each purchase to the best card in your wallet.
              </p>
            </div>
            <ul className="text-sm text-gray-600 space-y-1 text-left max-w-xs mx-auto">
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Instant Mastercard — works everywhere</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Earns cashback on your best rewards card</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Protects your credit score automatically</li>
            </ul>
            <button onClick={activate} disabled={activating} className="btn-primary">
              {activating ? 'Activating…' : 'Activate virtual card'}
            </button>
          </div>
        ) : (
          <>
            {/* Card visual */}
            <div className="max-w-sm mx-auto">
              <VirtualCardDisplay modulrCardId={card.modulrCardId} isFrozen={card.isFrozen} />
            </div>

            {/* Freeze toggle */}
            <div className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${card.isFrozen ? 'bg-blue-100' : 'bg-green-100'}`}>
                  {card.isFrozen
                    ? <Snowflake className="h-5 w-5 text-blue-600" />
                    : <Sun className="h-5 w-5 text-green-600" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{card.isFrozen ? 'Card frozen' : 'Card active'}</p>
                  <p className="text-xs text-gray-500">
                    {card.isFrozen ? 'No transactions will be processed' : 'Ready to use'}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleFreeze}
                disabled={freezeLoading}
                className={card.isFrozen ? 'btn-primary' : 'btn-secondary'}
              >
                {freezeLoading ? '…' : card.isFrozen ? 'Unfreeze' : 'Freeze'}
              </button>
            </div>

            {/* Routing mode */}
            <div className="card space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">Routing mode</h2>
                <p className="text-xs text-gray-500 mt-0.5">How should we choose which card to charge?</p>
              </div>
              <RoutingModeSelector
                current={card.routingMode as RoutingMode}
                onChange={changeRoutingMode}
                isLoading={routingLoading}
              />
            </div>

            {/* Transaction feed */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Recent transactions</h2>
                <button
                  onClick={loadTransactions}
                  disabled={txLoading}
                  className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Refresh transactions"
                >
                  <RefreshCw className={`h-4 w-4 ${txLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <TransactionFeed transactions={transactions} isLoading={txLoading} />
            </div>
          </>
        )}
      </div>
    </FeatureGate>
  )
}
