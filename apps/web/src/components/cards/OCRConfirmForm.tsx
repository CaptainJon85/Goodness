import { useState } from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface OCRField<T> {
  value: T | null
  confidence: 'high' | 'medium' | 'low'
  raw: string
}

export interface OCRResult {
  balance: OCRField<number>
  creditLimit: OCRField<number>
  apr: OCRField<number>
  paymentDueDate: OCRField<string>
  lastFour: OCRField<string>
}

interface OCRConfirmFormProps {
  ocr: OCRResult
  onConfirm: (data: {
    nickname: string; lastFour: string; provider: string
    balance: number; creditLimit: number; apr: number
    minimumPayment: number; paymentDueDate: string | null
  }) => Promise<void>
  onBack: () => void
  isLoading?: boolean
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  if (confidence === 'high') return <CheckCircle className="h-4 w-4 text-green-500" />
  if (confidence === 'medium') return <AlertTriangle className="h-4 w-4 text-amber-500" />
  return <AlertTriangle className="h-4 w-4 text-red-500" />
}

function fieldClass(confidence: 'high' | 'medium' | 'low') {
  if (confidence === 'low') return 'input border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500'
  if (confidence === 'medium') return 'input border-amber-300 bg-amber-50'
  return 'input border-green-300'
}

export default function OCRConfirmForm({ ocr, onConfirm, onBack, isLoading }: OCRConfirmFormProps) {
  const [form, setForm] = useState({
    nickname: '',
    lastFour: ocr.lastFour.value ?? '',
    provider: '',
    balance: ocr.balance.value != null ? (ocr.balance.value / 100).toFixed(2) : '',
    creditLimit: ocr.creditLimit.value != null ? (ocr.creditLimit.value / 100).toFixed(2) : '',
    apr: ocr.apr.value != null ? ocr.apr.value.toFixed(2) : '',
    minimumPayment: '',
    paymentDueDate: ocr.paymentDueDate.value ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const balance = Math.round(parseFloat(form.balance) * 100)
    const creditLimit = Math.round(parseFloat(form.creditLimit) * 100)
    const apr = parseFloat(form.apr)
    const minimumPayment = Math.round(parseFloat(form.minimumPayment || '0') * 100)

    if (isNaN(balance) || isNaN(creditLimit) || isNaN(apr)) {
      setError('Balance, credit limit and APR are required.')
      return
    }
    if (balance > creditLimit) {
      setError('Balance cannot exceed credit limit.')
      return
    }
    if (form.lastFour.length !== 4 || !/^\d{4}$/.test(form.lastFour)) {
      setError('Last 4 digits must be exactly 4 numbers.')
      return
    }
    try {
      await onConfirm({ nickname: form.nickname, lastFour: form.lastFour, provider: form.provider, balance, creditLimit, apr, minimumPayment, paymentDueDate: form.paymentDueDate || null })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const lowConfidenceCount = [ocr.balance, ocr.creditLimit, ocr.apr, ocr.lastFour].filter((f) => f.confidence === 'low').length

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {lowConfidenceCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            {lowConfidenceCount} field{lowConfidenceCount > 1 ? 's' : ''} could not be read clearly — please review and correct.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Card nickname *</label>
          <input className="input" value={form.nickname} onChange={set('nickname')} placeholder="e.g. Barclaycard Rewards" required />
        </div>

        <div>
          <label className="label flex items-center gap-1">
            Last 4 digits * <ConfidenceBadge confidence={ocr.lastFour.confidence} />
          </label>
          <input className={fieldClass(ocr.lastFour.confidence)} value={form.lastFour} onChange={set('lastFour')} maxLength={4} pattern="\d{4}" required />
        </div>

        <div>
          <label className="label">Provider</label>
          <input className="input" value={form.provider} onChange={set('provider')} placeholder="e.g. Barclays" />
        </div>

        <div>
          <label className="label flex items-center gap-1">
            Balance (£) * <ConfidenceBadge confidence={ocr.balance.confidence} />
          </label>
          <input className={fieldClass(ocr.balance.confidence)} type="number" step="0.01" min="0" value={form.balance} onChange={set('balance')} required />
          {ocr.balance.raw && <p className="text-xs text-gray-400 mt-0.5">OCR read: "{ocr.balance.raw}"</p>}
        </div>

        <div>
          <label className="label flex items-center gap-1">
            Credit limit (£) * <ConfidenceBadge confidence={ocr.creditLimit.confidence} />
          </label>
          <input className={fieldClass(ocr.creditLimit.confidence)} type="number" step="0.01" min="0.01" value={form.creditLimit} onChange={set('creditLimit')} required />
          {ocr.creditLimit.raw && <p className="text-xs text-gray-400 mt-0.5">OCR read: "{ocr.creditLimit.raw}"</p>}
        </div>

        <div>
          <label className="label flex items-center gap-1">
            APR (%) * <ConfidenceBadge confidence={ocr.apr.confidence} />
          </label>
          <input className={fieldClass(ocr.apr.confidence)} type="number" step="0.01" min="0.01" max="200" value={form.apr} onChange={set('apr')} required />
          {ocr.apr.raw && <p className="text-xs text-gray-400 mt-0.5">OCR read: "{ocr.apr.raw}"</p>}
        </div>

        <div>
          <label className="label">Minimum payment (£)</label>
          <input className="input" type="number" step="0.01" min="0" value={form.minimumPayment} onChange={set('minimumPayment')} placeholder="25.00" />
        </div>

        <div className="col-span-2">
          <label className="label flex items-center gap-1">
            Payment due date <ConfidenceBadge confidence={ocr.paymentDueDate.confidence} />
          </label>
          <input className={fieldClass(ocr.paymentDueDate.confidence)} type="date" value={form.paymentDueDate} onChange={set('paymentDueDate')} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
          {isLoading ? 'Saving…' : 'Confirm and save card'}
        </button>
        <button type="button" onClick={onBack} className="btn-secondary">
          Re-upload
        </button>
      </div>
    </form>
  )
}
