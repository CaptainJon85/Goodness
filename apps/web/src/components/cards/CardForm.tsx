import { useState } from 'react'
import type { CreditCard } from '@clearpath/shared'

interface CardFormData {
  nickname: string
  lastFour: string
  provider: string
  balance: string
  creditLimit: string
  apr: string
  minimumPayment: string
  paymentDueDate: string
}

interface CardFormProps {
  initial?: CreditCard
  onSubmit: (data: {
    nickname: string; lastFour: string; provider: string
    balance: number; creditLimit: number; apr: number
    minimumPayment: number; paymentDueDate: string | null
  }) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
  isLoading?: boolean
}

export default function CardForm({ initial, onSubmit, onCancel, submitLabel = 'Save card', isLoading }: CardFormProps) {
  const [form, setForm] = useState<CardFormData>({
    nickname: initial?.nickname ?? '',
    lastFour: initial?.lastFour ?? '',
    provider: initial?.provider ?? '',
    balance: initial ? (initial.balance / 100).toFixed(2) : '',
    creditLimit: initial ? (initial.creditLimit / 100).toFixed(2) : '',
    apr: initial ? initial.apr.toFixed(2) : '',
    minimumPayment: initial ? (initial.minimumPayment / 100).toFixed(2) : '',
    paymentDueDate: initial?.paymentDueDate
      ? new Date(initial.paymentDueDate as unknown as string).toISOString().split('T')[0]
      : '',
  })

  const [error, setError] = useState<string | null>(null)

  function set(key: keyof CardFormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const balance = Math.round(parseFloat(form.balance) * 100)
    const creditLimit = Math.round(parseFloat(form.creditLimit) * 100)
    const apr = parseFloat(form.apr)
    const minimumPayment = Math.round(parseFloat(form.minimumPayment) * 100)

    if (isNaN(balance) || isNaN(creditLimit) || isNaN(apr) || isNaN(minimumPayment)) {
      setError('Please fill in all required fields with valid numbers.')
      return
    }
    if (balance > creditLimit) {
      setError('Balance cannot exceed credit limit.')
      return
    }
    if (apr <= 0) {
      setError('APR must be greater than 0.')
      return
    }
    if (form.lastFour.length !== 4 || !/^\d{4}$/.test(form.lastFour)) {
      setError('Last four digits must be exactly 4 numbers.')
      return
    }

    try {
      await onSubmit({
        nickname: form.nickname,
        lastFour: form.lastFour,
        provider: form.provider,
        balance,
        creditLimit,
        apr,
        minimumPayment,
        paymentDueDate: form.paymentDueDate || null,
      })
    } catch (err) {
      setError((err as Error).message || 'Failed to save card.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Card nickname *</label>
          <input className="input" value={form.nickname} onChange={set('nickname')} placeholder="e.g. Barclaycard Rewards" required />
        </div>

        <div>
          <label className="label">Last 4 digits *</label>
          <input className="input" value={form.lastFour} onChange={set('lastFour')} placeholder="1234" maxLength={4} pattern="\d{4}" required />
        </div>

        <div>
          <label className="label">Card provider</label>
          <input className="input" value={form.provider} onChange={set('provider')} placeholder="e.g. Barclays" />
        </div>

        <div>
          <label className="label">Current balance (£) *</label>
          <input className="input" type="number" step="0.01" min="0" value={form.balance} onChange={set('balance')} placeholder="1234.56" required />
        </div>

        <div>
          <label className="label">Credit limit (£) *</label>
          <input className="input" type="number" step="0.01" min="0.01" value={form.creditLimit} onChange={set('creditLimit')} placeholder="5000.00" required />
        </div>

        <div>
          <label className="label">APR (%) *</label>
          <input className="input" type="number" step="0.01" min="0.01" max="200" value={form.apr} onChange={set('apr')} placeholder="26.4" required />
        </div>

        <div>
          <label className="label">Minimum monthly payment (£) *</label>
          <input className="input" type="number" step="0.01" min="0" value={form.minimumPayment} onChange={set('minimumPayment')} placeholder="25.00" required />
        </div>

        <div className="col-span-2">
          <label className="label">Payment due date</label>
          <input className="input" type="date" value={form.paymentDueDate} onChange={set('paymentDueDate')} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
          {isLoading ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
