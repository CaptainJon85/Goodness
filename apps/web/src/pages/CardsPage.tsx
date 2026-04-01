import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'
import ConnectMethodPicker from '../components/cards/ConnectMethodPicker'
import CardForm from '../components/cards/CardForm'
import ScreenshotUploader from '../components/cards/ScreenshotUploader'
import OCRConfirmForm, { type OCRResult } from '../components/cards/OCRConfirmForm'

type Step =
  | { type: 'pick' }
  | { type: 'manual' }
  | { type: 'screenshot_upload' }
  | { type: 'screenshot_confirm'; ocr: OCRResult }
  | { type: 'ob_connecting' }

export default function AddCardPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>({ type: 'pick' })
  const [isLoading, setIsLoading] = useState(false)
  const [obStatus, setObStatus] = useState<{ error?: string; synced?: string } | null>(null)

  // Check URL params for OB callback result
  if (typeof window !== 'undefined' && step.type === 'pick' && !obStatus) {
    const params = new URLSearchParams(window.location.search)
    if (params.get('ob_synced')) {
      setObStatus({ synced: params.get('ob_synced')! })
      window.history.replaceState({}, '', '/cards/add')
    } else if (params.get('ob_error')) {
      setObStatus({ error: params.get('ob_error')! })
      window.history.replaceState({}, '', '/cards/add')
    }
  }

  async function handleManualSubmit(data: Parameters<typeof api.cards.createManual>[0]) {
    setIsLoading(true)
    try {
      await api.cards.createManual(data)
      navigate('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleScreenshotUpload(file: File) {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const token = localStorage.getItem('clearpath_token')
      const res = await fetch('/api/cards/screenshot', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'OCR failed')
      }
      const { data } = await res.json()
      setStep({ type: 'screenshot_confirm', ocr: data })
    } catch (err) {
      alert((err as Error).message)
      setStep({ type: 'screenshot_upload' })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOCRConfirm(data: Parameters<typeof api.cards.createManual>[0]) {
    setIsLoading(true)
    try {
      await api.cards.createManual(data)
      navigate('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOpenBanking() {
    setIsLoading(true)
    try {
      const { authUrl } = await api.cards.openBankingConnect()
      window.location.href = authUrl
    } catch (err) {
      alert((err as Error).message)
      setIsLoading(false)
    }
  }

  function handleMethodSelect(method: 'open_banking' | 'screenshot' | 'manual') {
    if (method === 'open_banking') {
      setStep({ type: 'ob_connecting' })
      handleOpenBanking()
    } else if (method === 'screenshot') {
      setStep({ type: 'screenshot_upload' })
    } else {
      setStep({ type: 'manual' })
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6 flex items-center gap-3">
        {step.type !== 'pick' && (
          <button onClick={() => setStep({ type: 'pick' })} className="rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add a card</h1>
          <p className="text-sm text-gray-500">
            {step.type === 'pick' ? 'Choose how to add your card' :
             step.type === 'manual' ? 'Enter details manually' :
             step.type === 'screenshot_upload' ? 'Upload a screenshot' :
             step.type === 'screenshot_confirm' ? 'Review OCR results' :
             'Connecting to your bank…'}
          </p>
        </div>
      </div>

      {obStatus && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${obStatus.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {obStatus.error
            ? `Open Banking connection failed: ${obStatus.error}. Please try again.`
            : `Successfully synced ${obStatus.synced} card${obStatus.synced === '1' ? '' : 's'} from your bank.`}
        </div>
      )}

      <div className="card">
        {step.type === 'pick' && (
          <ConnectMethodPicker onSelect={handleMethodSelect} tier={user?.subscriptionTier ?? 'free'} />
        )}

        {step.type === 'manual' && (
          <CardForm
            onSubmit={handleManualSubmit}
            onCancel={() => setStep({ type: 'pick' })}
            isLoading={isLoading}
          />
        )}

        {step.type === 'screenshot_upload' && (
          <ScreenshotUploader onUpload={handleScreenshotUpload} isLoading={isLoading} />
        )}

        {step.type === 'screenshot_confirm' && (
          <OCRConfirmForm
            ocr={step.ocr}
            onConfirm={handleOCRConfirm}
            onBack={() => setStep({ type: 'screenshot_upload' })}
            isLoading={isLoading}
          />
        )}

        {step.type === 'ob_connecting' && (
          <div className="py-12 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Redirecting to your bank…</p>
          </div>
        )}
      </div>
    </div>
  )
}
