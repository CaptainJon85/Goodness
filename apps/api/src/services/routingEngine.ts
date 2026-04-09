/**
 * ClearPath Smart Routing Engine
 *
 * Determines which real credit card to charge for a given virtual card
 * transaction, based on the user's routing mode preference.
 *
 * Routing modes:
 *   maximise_rewards — score by cashback/points rate for the MCC category
 *   minimise_cost    — score by inverse APR (lower APR = higher score)
 *   protect_score    — score by distance from 30% utilisation threshold
 *
 * MCC → category mapping covers the most common UK merchant categories.
 */

export interface EligibleCard {
  id: string
  balance: number      // pence
  creditLimit: number  // pence
  apr: number
  nickname: string
  provider: string
}

export type RoutingMode = 'maximise_rewards' | 'minimise_cost' | 'protect_score'

// ---------------------------------------------------------------------------
// MCC → category mapping
// ---------------------------------------------------------------------------

const MCC_CATEGORIES: Record<string, string> = {
  // Supermarkets / Grocery
  '5411': 'grocery', '5412': 'grocery', '5422': 'grocery', '5441': 'grocery',
  // Restaurants / Dining
  '5812': 'dining', '5813': 'dining', '5814': 'dining', '5811': 'dining',
  // Travel
  '4511': 'travel', '4112': 'travel', '7011': 'travel', '4722': 'travel',
  '7512': 'travel', '4111': 'travel', '4131': 'travel',
  // Petrol
  '5541': 'petrol', '5542': 'petrol',
  // Online / General retail
  '5999': 'retail', '5945': 'retail', '5947': 'retail',
  // Entertainment
  '7832': 'entertainment', '7922': 'entertainment', '7991': 'entertainment',
  // Utilities
  '4900': 'utilities', '4911': 'utilities',
}

function mccToCategory(mcc: string): string {
  return MCC_CATEGORIES[mcc] ?? 'other'
}

// ---------------------------------------------------------------------------
// Cashback/rewards rates by provider × category (% of spend, rough estimates)
// ---------------------------------------------------------------------------

const REWARDS: Record<string, Record<string, number>> = {
  amex:        { grocery: 1.0, dining: 2.0, travel: 3.0, petrol: 1.0, retail: 1.0, other: 0 },
  barclays:    { grocery: 0.5, dining: 0.5, travel: 1.0, petrol: 0.5, retail: 0.5, other: 0 },
  hsbc:        { grocery: 0.5, dining: 0.5, travel: 2.0, petrol: 0.5, retail: 0.5, other: 0 },
  lloyds:      { grocery: 0.5, dining: 0.5, travel: 0.5, petrol: 0.5, retail: 0.5, other: 0 },
  santander:   { grocery: 0.5, dining: 0.5, travel: 0.5, petrol: 1.0, retail: 0.5, other: 0 },
  default:     { grocery: 0.25, dining: 0.25, travel: 0.5, petrol: 0.25, retail: 0.25, other: 0 },
}

function rewardsRate(provider: string, category: string): number {
  const key = provider.toLowerCase()
  return (REWARDS[key] ?? REWARDS.default)[category] ?? REWARDS.default.other
}

// ---------------------------------------------------------------------------
// Scoring functions (all return 0–100)
// ---------------------------------------------------------------------------

function rewardsScore(card: EligibleCard, category: string): number {
  const rate = rewardsRate(card.provider, category)
  return Math.min(100, rate * 20)  // 5% = 100 pts
}

function costScore(card: EligibleCard): number {
  // Lower APR = higher score. Scale: 0% APR = 100, 50% APR = 0
  return Math.max(0, 100 - card.apr * 2)
}

function protectScoreScore(card: EligibleCard): number {
  // Score highest for cards furthest below 30% utilisation threshold
  // Penalise cards already above 30%
  const utilPct = card.creditLimit > 0 ? (card.balance / card.creditLimit) * 100 : 100
  const THRESHOLD = 30
  if (utilPct >= THRESHOLD) {
    // Already over threshold — low score, proportional to how far over
    return Math.max(0, 50 - (utilPct - THRESHOLD))
  }
  // Under threshold — score proportional to headroom
  return 50 + (THRESHOLD - utilPct) * (50 / THRESHOLD)
}

// ---------------------------------------------------------------------------
// Eligibility check
// ---------------------------------------------------------------------------

function isEligible(card: EligibleCard, transactionAmount: number): boolean {
  // Must have headroom
  const headroom = card.creditLimit - card.balance
  return headroom >= transactionAmount
}

// ---------------------------------------------------------------------------
// Main routing function
// ---------------------------------------------------------------------------

export interface RoutingDecision {
  cardId: string
  cardNickname: string
  reasoning: string
  rewardEarned: number   // pence (estimated cashback)
  score: number
}

export function routeTransaction(
  cards: EligibleCard[],
  transactionAmount: number,   // pence
  mcc: string,
  merchantName: string,
  routingMode: RoutingMode
): RoutingDecision | null {
  const eligible = cards.filter((c) => isEligible(c, transactionAmount))
  if (eligible.length === 0) return null

  const category = mccToCategory(mcc)

  const scored = eligible.map((card) => {
    let score: number

    switch (routingMode) {
      case 'maximise_rewards':
        score = rewardsScore(card, category)
        break
      case 'minimise_cost':
        score = costScore(card)
        break
      case 'protect_score':
        score = protectScoreScore(card)
        break
    }

    return { card, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const winner = scored[0]

  const rewardRate = rewardsRate(winner.card.provider, category)
  const rewardEarned = Math.round(transactionAmount * (rewardRate / 100))

  const reasoning = buildReasoning(winner.card, routingMode, category, rewardRate, transactionAmount)

  return {
    cardId: winner.card.id,
    cardNickname: winner.card.nickname,
    reasoning,
    rewardEarned,
    score: winner.score,
  }
}

function buildReasoning(
  card: EligibleCard,
  mode: RoutingMode,
  category: string,
  rewardRate: number,
  amount: number
): string {
  const amountGBP = (amount / 100).toFixed(2)
  switch (mode) {
    case 'maximise_rewards':
      return rewardRate > 0
        ? `${card.nickname} earns ${rewardRate}% cashback at ${category} merchants — best rewards for this spend.`
        : `${card.nickname} selected; no cashback available for this category.`
    case 'minimise_cost':
      return `${card.nickname} has the lowest APR (${card.apr}%) among eligible cards — minimises interest on £${amountGBP}.`
    case 'protect_score': {
      const util = card.creditLimit > 0 ? (card.balance / card.creditLimit) * 100 : 0
      const newUtil = card.creditLimit > 0 ? ((card.balance + amount) / card.creditLimit) * 100 : 0
      return `${card.nickname} keeps your utilisation healthiest (${util.toFixed(0)}% → ${newUtil.toFixed(0)}% after this spend).`
    }
  }
}
