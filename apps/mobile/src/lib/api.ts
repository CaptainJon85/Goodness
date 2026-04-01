/**
 * Mobile API client — mirrors apps/web/src/lib/api.ts
 * Uses AsyncStorage for token persistence instead of localStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.API_BASE_URL ?? 'https://api.clearpath.app'

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('clearpath_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const err = new Error(body.error || 'Request failed') as Error & {
      status: number
      code?: string
      requiredTier?: string
    }
    err.status = res.status
    err.code = body.code
    err.requiredTier = body.requiredTier
    throw err
  }

  const json = await res.json()
  return json.data as T
}

export const api = {
  auth: {
    register: (email: string, password: string, name: string) =>
      request<{ token: string; user: { id: string; email: string; name: string; subscriptionTier: string } }>(
        '/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }
      ),
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: string; email: string; name: string; subscriptionTier: string } }>(
        '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
      ),
    me: () => request<{ id: string; email: string; name: string; kycStatus: string; subscriptionTier: string }>('/auth/me'),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },

  cards: {
    list: () => request<import('@clearpath/shared').CreditCard[]>('/cards'),
    createManual: (data: {
      nickname: string; lastFour: string; provider: string
      balance: number; creditLimit: number; apr: number
      minimumPayment: number; paymentDueDate?: string | null
    }) => request<import('@clearpath/shared').CreditCard>('/cards/manual', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: object) =>
      request<import('@clearpath/shared').CreditCard>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ deleted: boolean }>(`/cards/${id}`, { method: 'DELETE' }),
    syncCard: (id: string) => request<import('@clearpath/shared').CreditCard>(`/cards/open-banking/sync/${id}`, { method: 'POST' }),
  },

  repayment: {
    getPlan: () => request<import('@clearpath/shared').RepaymentPlan>('/repayment/plan'),
    generate: (monthlyBudget: number, method: 'avalanche' | 'snowball' = 'avalanche') =>
      request<import('@clearpath/shared').RepaymentPlan>('/repayment/plan/generate', {
        method: 'POST', body: JSON.stringify({ monthlyBudget, method }),
      }),
    scenario: (monthlyBudget: number, method: 'avalanche' | 'snowball' = 'avalanche') =>
      request<import('@clearpath/shared').RepaymentPlan>('/repayment/plan/scenario', {
        method: 'POST', body: JSON.stringify({ monthlyBudget, method }),
      }),
  },

  dashboard: {
    summary: () => request<import('@clearpath/shared').DashboardSummary>('/dashboard/summary'),
  },

  creditScore: {
    latest: () => request<{ score: number; band: string; provider: string; recordedAt: string; factors: import('@clearpath/shared').ScoreFactor[] }>('/credit-score'),
    history: () => request<{ score: number; band: string; recordedAt: string }[]>('/credit-score/history'),
    projection: () => request<{ currentScore: number; projectedScore: number; estimatedScoreGain: number; currentUtilisation: number; payoffMonths: number }>('/credit-score/projection'),
    fetch: (data: { firstName: string; lastName: string; dateOfBirth: string; postcode: string; addressLine1: string }) =>
      request<{ score: number; band: string }>('/credit-score/fetch', { method: 'POST', body: JSON.stringify(data) }),
  },

  virtualCard: {
    get: () => request<import('@clearpath/shared').VirtualCard>('/virtual-card'),
    activate: () => request<import('@clearpath/shared').VirtualCard>('/virtual-card/activate', { method: 'POST' }),
    freeze: (frozen: boolean) => request<{ isFrozen: boolean }>('/virtual-card/freeze', { method: 'PATCH', body: JSON.stringify({ frozen }) }),
    setRoutingMode: (routingMode: string) =>
      request<{ routingMode: string }>('/virtual-card/routing-mode', { method: 'PATCH', body: JSON.stringify({ routingMode }) }),
    transactions: () => request<import('@clearpath/shared').Transaction[]>('/virtual-card/transactions'),
  },

  subscription: {
    get: () => request<{ tier: string }>('/subscription'),
    checkout: (tier: 'plus' | 'premium') =>
      request<{ checkoutUrl: string }>('/subscription/checkout', { method: 'POST', body: JSON.stringify({ tier }) }),
  },
}
