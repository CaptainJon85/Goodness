const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('clearpath_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const err = new Error(body.error || 'Request failed') as Error & { status: number; code?: string; requiredTier?: string }
    err.status = res.status
    err.code = body.code
    err.requiredTier = body.requiredTier
    throw err
  }

  const json = await res.json()
  return json.data as T
}

export const api = {
  // Auth
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

  // Cards
  cards: {
    list: () => request<import('@clearpath/shared').CreditCard[]>('/cards'),
    createManual: (data: {
      nickname: string; lastFour: string; provider: string
      balance: number; creditLimit: number; apr: number
      minimumPayment: number; paymentDueDate?: string | null
    }) => request<import('@clearpath/shared').CreditCard>('/cards/manual', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('@clearpath/shared').CreditCard>) =>
      request<import('@clearpath/shared').CreditCard>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ deleted: boolean }>(`/cards/${id}`, { method: 'DELETE' }),
  },

  // Repayment
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
    history: () => request<import('@clearpath/shared').RepaymentPlan[]>('/repayment/plan/history'),
  },

  // Dashboard
  dashboard: {
    summary: () => request<import('@clearpath/shared').DashboardSummary>('/dashboard/summary'),
  },

  // Subscription
  subscription: {
    get: () => request<{ tier: string; stripeCustomerId: string | null }>('/subscription'),
    checkout: (tier: 'plus' | 'premium') =>
      request<{ checkoutUrl: string }>('/subscription/checkout', { method: 'POST', body: JSON.stringify({ tier }) }),
    portal: () => request<{ portalUrl: string }>('/subscription/portal', { method: 'POST' }),
  },

  // Credit score
  creditScore: {
    latest: () => request<{ score: number; band: string; provider: string; recordedAt: string; factors: import('@clearpath/shared').ScoreFactor[] }>('/credit-score'),
    history: () => request<{ score: number; band: string; recordedAt: string }[]>('/credit-score/history'),
    projection: () => request<{ currentScore: number; projectedScore: number; estimatedScoreGain: number; payoffMonths: number }>('/credit-score/projection'),
  },

  // Virtual card
  virtualCard: {
    get: () => request<import('@clearpath/shared').VirtualCard>('/virtual-card'),
    activate: () => request<import('@clearpath/shared').VirtualCard>('/virtual-card/activate', { method: 'POST' }),
    freeze: (frozen: boolean) => request<{ isFrozen: boolean }>('/virtual-card/freeze', { method: 'PATCH', body: JSON.stringify({ frozen }) }),
    setRoutingMode: (routingMode: string) =>
      request<{ routingMode: string }>('/virtual-card/routing-mode', { method: 'PATCH', body: JSON.stringify({ routingMode }) }),
    transactions: () => request<import('@clearpath/shared').Transaction[]>('/virtual-card/transactions'),
  },
}
