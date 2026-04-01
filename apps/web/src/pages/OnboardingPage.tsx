import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CreditCard, LayoutDashboard, TrendingDown } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import CardForm from '../components/cards/CardForm'
import { api } from '../lib/api'

type Step = 'welcome' | 'add-card' | 'plan' | 'done'

const STEPS: { id: Step; label: string; icon: typeof Check }[] = [
  { id: 'welcome',  label: 'Account',      icon: Check },
  { id: 'add-card', label: 'First card',   icon: CreditCard },
  { id: 'plan',     label: 'View plan',    icon: TrendingDown },
  { id: 'done',     label: 'Dashboard',    icon: LayoutDashboard },
]

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.id === current)
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, i) => {
        const done = i < idx
        const active = i === idx
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center justify-center h-8 w-8 rounded-full border-2 text-xs font-semibold transition-colors ${
              done   ? 'border-brand-600 bg-brand-600 text-white' :
              active ? 'border-brand-600 bg-white text-brand-600' :
                       'border-gray-300 bg-white text-gray-400'
            }`}>
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden sm:block ml-2 text-xs font-medium mr-4 ${active ? 'text-brand-700' : done ? 'text-gray-600' : 'text-gray-400'}`}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 sm:w-12 mr-2 rounded ${i < idx ? 'bg-brand-600' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function OnboardingPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('welcome')
  const [cardSaved, setCardSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleCardSave(data: Parameters<typeof api.cards.createManual>[0]) {
    setIsLoading(true)
    try {
      await api.cards.createManual(data)
      setCardSaved(true)
      setStep('plan')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 mb-3">
            <span className="text-white text-xl font-bold">CP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to ClearPath</h1>
        </div>

        <StepIndicator current={step} />

        <div className="card">
          {/* Step 1: Welcome */}
          {step === 'welcome' && (
            <div className="text-center space-y-5">
              <div className="text-4xl">👋</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Hi{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!</h2>
                <p className="text-gray-500 mt-2">
                  ClearPath helps you become debt-free faster using AI-powered repayment planning.
                  Let's get set up in 2 minutes.
                </p>
              </div>
              <ul className="text-sm text-left text-gray-600 space-y-2 max-w-xs mx-auto">
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">1.</span> Add your credit cards</li>
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">2.</span> We'll generate your payoff plan</li>
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">3.</span> Follow the plan and watch your debt shrink</li>
              </ul>
              <button onClick={() => setStep('add-card')} className="btn-primary w-full">
                Get started →
              </button>
              <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-gray-600 underline">
                Skip setup, go to dashboard
              </button>
            </div>
          )}

          {/* Step 2: Add first card */}
          {step === 'add-card' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add your first card</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enter the details of your highest-interest card first — that's usually the most important to tackle.
                </p>
              </div>
              <CardForm
                onSubmit={handleCardSave}
                onCancel={() => setStep('welcome')}
                submitLabel="Save and continue"
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Step 3: View plan prompt */}
          {step === 'plan' && (
            <div className="text-center space-y-5">
              <div className="text-4xl">🎉</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Card added!</h2>
                <p className="text-gray-500 mt-2">
                  Great work. Head to your Repayment Plan to generate your AI-powered payoff strategy — it takes just a few seconds.
                </p>
              </div>
              <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 text-left text-sm text-brand-900">
                <p className="font-semibold mb-1">💡 Pro tip</p>
                <p>The Avalanche method (highest APR first) saves the most money. The Snowball method (lowest balance first) gives you quick wins for motivation. You can switch anytime.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => navigate('/repayment')} className="btn-primary flex-1">
                  Generate my plan →
                </button>
                <button onClick={() => setStep('add-card')} className="btn-secondary">
                  Add another card
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="text-center space-y-5">
              <div className="text-4xl">✅</div>
              <h2 className="text-xl font-bold text-gray-900">You're all set!</h2>
              <p className="text-gray-500">Your ClearPath dashboard is ready. Check back regularly to track your progress.</p>
              <button onClick={() => navigate('/dashboard')} className="btn-primary w-full">
                Go to dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
