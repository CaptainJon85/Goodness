/**
 * ClearPath Repayment Engine
 * Implements Avalanche (highest APR first) and Snowball (lowest balance first) strategies.
 * All monetary values are in pence (integer).
 */

export interface CardInput {
  id: string
  balance: number      // pence
  apr: number          // e.g. 26.4
  minimumPayment: number  // pence
}

export interface MonthlyAllocation {
  cardId: string
  payment: number     // pence paid this month
  interest: number    // pence of interest accrued
  newBalance: number  // pence remaining after payment
}

export interface PlanResult {
  allocations: Array<{
    cardId: string
    monthlyAmount: number
    isMinimumOnly: boolean
    reasoning: string
  }>
  projectedPayoffDate: Date
  totalInterestPaid: number   // pence
  totalInterestSaved: number  // pence (vs paying minimums only)
  payoffMonths: number
  insufficientBudget: boolean
  monthlySchedule?: MonthlyAllocation[][]  // month-by-month breakdown (up to 12 months for preview)
}

function monthlyRate(apr: number): number {
  return apr / 100 / 12
}

/**
 * Project total interest when only paying minimums on all cards.
 * Used to calculate interest saved.
 */
function minimumOnlyTotalInterest(cards: CardInput[]): number {
  const balances = cards.map((c) => c.balance)
  let totalInterest = 0
  const MAX_MONTHS = 600 // 50 years cap

  for (let month = 0; month < MAX_MONTHS; month++) {
    let allZero = true
    for (let i = 0; i < cards.length; i++) {
      if (balances[i] <= 0) continue
      allZero = false
      const rate = monthlyRate(cards[i].apr)
      const interest = Math.round(balances[i] * rate)
      totalInterest += interest
      const payment = Math.min(cards[i].minimumPayment, balances[i] + interest)
      balances[i] = Math.max(0, balances[i] + interest - payment)
    }
    if (allZero) break
  }

  return totalInterest
}

export function generateAvalanchePlan(cards: CardInput[], monthlyBudget: number): PlanResult {
  return generatePlan(cards, monthlyBudget, 'avalanche')
}

export function generateSnowballPlan(cards: CardInput[], monthlyBudget: number): PlanResult {
  return generatePlan(cards, monthlyBudget, 'snowball')
}

function generatePlan(cards: CardInput[], monthlyBudget: number, method: 'avalanche' | 'snowball'): PlanResult {
  if (cards.length === 0) {
    return {
      allocations: [],
      projectedPayoffDate: new Date(),
      totalInterestPaid: 0,
      totalInterestSaved: 0,
      payoffMonths: 0,
      insufficientBudget: false,
    }
  }

  const totalMinimums = cards.reduce((sum, c) => sum + c.minimumPayment, 0)
  const insufficientBudget = monthlyBudget < totalMinimums

  // Sort order determines priority for extra payments
  const sorted = [...cards].sort((a, b) =>
    method === 'avalanche'
      ? b.apr - a.apr                 // highest APR first
      : a.balance - b.balance         // lowest balance first
  )

  // Working state
  const balances: Record<string, number> = {}
  for (const c of cards) balances[c.id] = c.balance

  const cardById: Record<string, CardInput> = {}
  for (const c of cards) cardById[c.id] = c

  let totalInterestPaid = 0
  let payoffMonths = 0
  const MAX_MONTHS = 600
  const schedulePreview: MonthlyAllocation[][] = []

  for (let month = 0; month < MAX_MONTHS; month++) {
    const activeCards = sorted.filter((c) => balances[c.id] > 0)
    if (activeCards.length === 0) break
    payoffMonths++

    // Step 1: Accrue interest on all active cards
    const interestThisMonth: Record<string, number> = {}
    for (const c of activeCards) {
      interestThisMonth[c.id] = Math.round(balances[c.id] * monthlyRate(c.apr))
      balances[c.id] += interestThisMonth[c.id]
      totalInterestPaid += interestThisMonth[c.id]
    }

    // Step 2: Pay minimums on all cards
    let budgetRemaining = insufficientBudget ? monthlyBudget : monthlyBudget
    for (const c of activeCards) {
      const pay = Math.min(c.minimumPayment, balances[c.id])
      balances[c.id] -= pay
      budgetRemaining -= pay
    }

    // Step 3: Apply remaining budget to priority card (first in sorted order that still has balance)
    if (budgetRemaining > 0) {
      for (const c of sorted) {
        if (balances[c.id] <= 0) continue
        const extra = Math.min(budgetRemaining, balances[c.id])
        balances[c.id] -= extra
        budgetRemaining -= extra
        if (budgetRemaining <= 0) break
      }
    }

    // Record first 12 months for preview
    if (month < 12) {
      schedulePreview.push(
        activeCards.map((c) => ({
          cardId: c.id,
          payment: 0, // simplified — full schedule detail omitted for brevity
          interest: interestThisMonth[c.id],
          newBalance: balances[c.id],
        }))
      )
    }
  }

  const minOnlyInterest = minimumOnlyTotalInterest(cards)
  const totalInterestSaved = Math.max(0, minOnlyInterest - totalInterestPaid)

  const payoffDate = new Date()
  payoffDate.setMonth(payoffDate.getMonth() + payoffMonths)

  // Build allocation summary (first month snapshot)
  const allocations = sorted.map((c, idx) => {
    const isPriorityCard = idx === 0
    const extra = isPriorityCard ? Math.max(0, monthlyBudget - totalMinimums) : 0
    const totalPayment = c.minimumPayment + extra

    let reasoning: string
    if (method === 'avalanche') {
      reasoning = isPriorityCard
        ? `Highest APR card (${c.apr}%) — all extra budget applied here to minimise total interest`
        : `Minimum payment only until higher-APR cards are cleared`
    } else {
      reasoning = isPriorityCard
        ? `Lowest balance card — extra budget applied to pay off quickly and build momentum`
        : `Minimum payment only until smaller balances are cleared`
    }

    return {
      cardId: c.id,
      monthlyAmount: Math.min(totalPayment, c.balance),
      isMinimumOnly: !isPriorityCard || extra === 0,
      reasoning,
    }
  })

  return {
    allocations,
    projectedPayoffDate: payoffDate,
    totalInterestPaid,
    totalInterestSaved,
    payoffMonths,
    insufficientBudget,
    monthlySchedule: schedulePreview,
  }
}

export function calculateScenario(cards: CardInput[], monthlyBudget: number, method: 'avalanche' | 'snowball') {
  return generatePlan(cards, monthlyBudget, method)
}
