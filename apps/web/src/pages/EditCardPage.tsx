import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CardForm from '../components/cards/CardForm'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { api } from '../lib/api'
import type { CreditCard } from '@clearpath/shared'

export default function EditCardPage() {
  const { id } = useParams<{ id: string }>()
  const [card, setCard] = useState<CreditCard | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.cards.list().then((cards) => {
      const found = cards.find((c) => c.id === id)
      if (found) setCard(found)
      else navigate('/dashboard')
    })
  }, [id, navigate])

  async function handleSubmit(data: Parameters<typeof api.cards.createManual>[0]) {
    if (!id) return
    setIsLoading(true)
    try {
      await api.cards.update(id, data)
      navigate('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  if (!card) return <div className="py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit card</h1>
        <p className="text-sm text-gray-500 mt-1">{card.nickname}</p>
      </div>
      <div className="card">
        <CardForm initial={card} onSubmit={handleSubmit} onCancel={() => navigate('/dashboard')} isLoading={isLoading} submitLabel="Update card" />
      </div>
    </div>
  )
}
