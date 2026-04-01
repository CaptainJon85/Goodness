import { routeTransaction, type EligibleCard } from '../services/routingEngine'

const highAprCard: EligibleCard = { id: 'card1', balance: 100000, creditLimit: 500000, apr: 29.9, nickname: 'High APR Amex', provider: 'amex' }
const lowAprCard: EligibleCard  = { id: 'card2', balance: 50000,  creditLimit: 500000, apr: 9.9,  nickname: 'Low APR Lloyds', provider: 'lloyds' }
const nearLimitCard: EligibleCard = { id: 'card3', balance: 420000, creditLimit: 500000, apr: 19.9, nickname: 'Near Limit', provider: 'barclays' }

const GROCERY_MCC = '5411'
const DINING_MCC  = '5812'
const UNKNOWN_MCC = '9999'

describe('Routing Engine', () => {
  describe('minimise_cost mode', () => {
    it('selects the card with the lowest APR', () => {
      const decision = routeTransaction([highAprCard, lowAprCard], 5000, GROCERY_MCC, 'Tesco', 'minimise_cost')
      expect(decision?.cardId).toBe('card2')
    })

    it('includes APR in reasoning', () => {
      const decision = routeTransaction([highAprCard, lowAprCard], 5000, GROCERY_MCC, 'Tesco', 'minimise_cost')
      expect(decision?.reasoning).toMatch(/9\.9%/)
    })
  })

  describe('maximise_rewards mode', () => {
    it('selects Amex for dining (higher cashback rate)', () => {
      const decision = routeTransaction([highAprCard, lowAprCard], 5000, DINING_MCC, 'Nandos', 'maximise_rewards')
      expect(decision?.cardId).toBe('card1')  // Amex earns 2% at dining
    })

    it('calculates reward earned correctly', () => {
      // Amex 2% cashback on £50 = £1 = 100 pence
      const decision = routeTransaction([highAprCard], 5000, DINING_MCC, 'Nandos', 'maximise_rewards')
      expect(decision?.rewardEarned).toBe(100)
    })

    it('returns 0 reward for unknown MCC with no cashback', () => {
      const decision = routeTransaction([lowAprCard], 5000, UNKNOWN_MCC, 'Unknown', 'maximise_rewards')
      expect(decision?.rewardEarned).toBe(0)
    })
  })

  describe('protect_score mode', () => {
    it('avoids the card near its credit limit', () => {
      const decision = routeTransaction([nearLimitCard, lowAprCard], 5000, GROCERY_MCC, 'Waitrose', 'protect_score')
      expect(decision?.cardId).toBe('card2')  // lowAprCard has much lower utilisation
    })

    it('includes utilisation info in reasoning', () => {
      const decision = routeTransaction([nearLimitCard, lowAprCard], 5000, GROCERY_MCC, 'Waitrose', 'protect_score')
      expect(decision?.reasoning).toMatch(/%/)
    })
  })

  describe('eligibility', () => {
    it('returns null when no card has headroom', () => {
      const maxedCard: EligibleCard = { ...highAprCard, balance: 499999, creditLimit: 500000 }
      const decision = routeTransaction([maxedCard], 5000, GROCERY_MCC, 'Tesco', 'minimise_cost')
      expect(decision).toBeNull()
    })

    it('skips cards without sufficient headroom', () => {
      const almostFull: EligibleCard = { ...highAprCard, balance: 499000, creditLimit: 500000 }
      const decision = routeTransaction([almostFull, lowAprCard], 5000, GROCERY_MCC, 'Tesco', 'minimise_cost')
      expect(decision?.cardId).toBe('card2')
    })

    it('handles empty card array', () => {
      expect(routeTransaction([], 5000, GROCERY_MCC, 'Tesco', 'minimise_cost')).toBeNull()
    })
  })
})
