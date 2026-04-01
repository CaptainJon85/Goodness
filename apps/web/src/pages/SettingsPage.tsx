import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [portalLoading, setPortalLoading] = useState(false)

  async function openPortal() {
    setPortalLoading(true)
    try {
      const { portalUrl } = await api.subscription.portal()
      window.location.href = portalUrl
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setPortalLoading(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900">Account</h2>
        <div>
          <p className="text-xs text-gray-500">Name</p>
          <p className="text-sm font-medium text-gray-900">{user?.name || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Email</p>
          <p className="text-sm font-medium text-gray-900">{user?.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Plan</p>
          <p className="text-sm font-medium text-gray-900 capitalize">{user?.subscriptionTier}</p>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900">Subscription</h2>
        <p className="text-sm text-gray-500">Manage billing, upgrade or cancel your subscription via Stripe.</p>
        <div className="flex gap-3">
          <button onClick={openPortal} disabled={portalLoading} className="btn-secondary">
            {portalLoading ? 'Loading…' : 'Manage billing'}
          </button>
          <button onClick={() => navigate('/pricing')} className="btn-primary">
            View plans
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Sign out</h2>
        <button onClick={handleLogout} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
          Log out
        </button>
      </div>
    </div>
  )
}
