// ClearPath shared types

export interface User {
  id: string
  email: string
  name: string
  createdAt: Date
  kycStatus: 'pending' | 'verified' | 'failed'
  subscriptionTier: 'free' | 'plus' | 'premium'
}

export interface CreditCard {
  id: string
  userId: string
  nickname: string
  lastFour: string
  provider: string
  balance: number          // current balance in pence
  creditLimit: number      // in pence
  apr: number              // e.g. 26.4
  minimumPayment: number   // in pence
  paymentDueDate: Date
  connectionType: 'open_banking' | 'screenshot' | 'manual'
  truelayerAccountId?: string
  lastSyncedAt: Date
}

export interface PaymentAllocation {
  cardId: string
  monthlyAmount: number
  isMinimumOnly: boolean
  reasoning: string
}

export interface RepaymentPlan {
  id: string
  userId: string
  method: 'avalanche' | 'snowball'
  monthlyBudget: number
  generatedAt: Date
  allocations: PaymentAllocation[]
  projectedPayoffDate: Date
  totalInterestSaved: number
  totalInterestPaid: number
  payoffMonths: number
  narrative?: string
}

export interface VirtualCard {
  id: string
  userId: string
  modulrCardId: string
  routingMode: 'maximise_rewards' | 'minimise_cost' | 'protect_score'
  isActive: boolean
  isFrozen: boolean
}

export interface Transaction {
  id: string
  userId: string
  virtualCardId: string
  amount: number
  merchantName: string
  merchantCategory: string
  allocatedToCardId: string
  allocationReason: string
  rewardEarned: number
  createdAt: Date
}

export interface ScoreFactor {
  type: 'positive' | 'negative'
  description: string
  impact: 'high' | 'medium' | 'low'
}

export interface CreditScoreRecord {
  id: string
  userId: string
  score: number
  provider: 'experian' | 'transunion' | 'equifax'
  recordedAt: Date
  factors: ScoreFactor[]
}

export interface DashboardSummary {
  totalDebt: number
  totalCreditLimit: number
  averageUtilisation: number
  monthlyInterestBurn: number
  projectedPayoffDate: Date | null
  cardsCount: number
  cardsDueSoon: CreditCard[]
}

// API response shapes
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  error: string
  code?: string
  details?: unknown
}

// Subscription tiers
export type SubscriptionTier = 'free' | 'plus' | 'premium'

export const TIER_LIMITS = {
  free: { maxCards: 2, openBanking: false, repaymentEngine: false, creditScore: false, virtualCard: false, scenarioModeller: false },
  plus: { maxCards: Infinity, openBanking: true, repaymentEngine: true, creditScore: true, virtualCard: false, scenarioModeller: false },
  premium: { maxCards: Infinity, openBanking: true, repaymentEngine: true, creditScore: true, virtualCard: true, scenarioModeller: true },
} as const
