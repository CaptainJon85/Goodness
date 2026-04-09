import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CreditCard as CardIcon } from 'lucide-react'
import type { DashboardSummary, CreditCard } from '@clearpath/shared'
import { api } from '../lib/api'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import EmptyState from '../components/shared/EmptyState'
import DebtSummaryCard from '../components/dashboard/DebtSummaryCard'
import PaymentAlert from '../components/dashboard/PaymentAlert'
import CardListItem from '../components/dashboard/CardListItem'

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [cards, setCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.dashboard.summary(), api.cards.list()])
      .then(([s, c]) => {
        setSummary(s)
        setCards(c)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this card? This cannot be undone.')) return
    await api.cards.delete(id)
    setCards((prev) => prev.filter((c) => c.id !== id))
    // Refresh summary
    api.dashboard.summary().then(setSummary).catch(console.error)
  }

  if (loading) return <div className="py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Your debt at a glance</p>
        </div>
        <button onClick={() => navigate('/cards/add')} className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add card
        </button>
      </div>

      {summary && <DebtSummaryCard summary={summary} />}

      {summary?.cardsDueSoon && summary.cardsDueSoon.length > 0 && (
        <PaymentAlert cards={summary.cardsDueSoon as unknown as Array<{ id: string; nickname: string; paymentDueDate: string; minimumPayment: number }>} />
      )}

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Cards <span className="text-gray-400 font-normal">sorted by APR</span>
        </h2>
        {cards.length === 0 ? (
          <EmptyState
            icon={CardIcon}
            title="No cards yet"
            description="Add your first credit card to start tracking your debt and generate a repayment plan."
            action={{ label: 'Add your first card', onClick: () => navigate('/cards/add') }}
          />
        ) : (
          <div className="space-y-3">
            {cards.map((card) => (
              <CardListItem
                key={card.id}
                card={card}
                onDelete={handleDelete}
                onEdit={(c) => navigate(`/cards/${c.id}/edit`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
