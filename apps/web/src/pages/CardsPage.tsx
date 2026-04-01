import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CardForm from '../components/cards/CardForm'
import { api } from '../lib/api'

export default function AddCardPage() {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(data: Parameters<typeof api.cards.createManual>[0]) {
    setIsLoading(true)
    try {
      await api.cards.createManual(data)
      navigate('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add a card</h1>
        <p className="text-sm text-gray-500 mt-1">Enter your card details manually</p>
      </div>
      <div className="card">
        <CardForm onSubmit={handleSubmit} onCancel={() => navigate('/dashboard')} isLoading={isLoading} />
      </div>
    </div>
  )
}
