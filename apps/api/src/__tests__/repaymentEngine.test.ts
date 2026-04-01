import { generateAvalanchePlan, generateSnowballPlan } from '../services/repaymentEngine'

const card1 = { id: 'card1', balance: 300000, apr: 29.9, minimumPayment: 6000 }  // £3000 @ 29.9%
const card2 = { id: 'card2', balance: 100000, apr: 19.9, minimumPayment: 2500 }  // £1000 @ 19.9%
const card3 = { id: 'card3', balance: 50000,  apr: 9.9,  minimumPayment: 1500 }  // £500  @ 9.9%

const budget = 30000  // £300/month

describe('Repayment Engine', () => {
  describe('generateAvalanchePlan', () => {
    it('generates a plan with correct structure', () => {
      const plan = generateAvalanchePlan([card1, card2, card3], budget)
      expect(plan.allocations).toHaveLength(3)
      expect(plan.payoffMonths).toBeGreaterThan(0)
      expect(plan.totalInterestPaid).toBeGreaterThan(0)
      expect(plan.projectedPayoffDate).toBeInstanceOf(Date)
    })

    it('marks the highest APR card as priority (not minimum-only)', () => {
      const plan = generateAvalanchePlan([card1, card2, card3], budget)
      const priorityAlloc = plan.allocations.find((a) => a.cardId === 'card1')
      expect(priorityAlloc).toBeDefined()
      expect(priorityAlloc!.isMinimumOnly).toBe(false)
    })

    it('marks lower APR cards as minimum-only when budget is tight', () => {
      const plan = generateAvalanchePlan([card1, card2, card3], budget)
      const card3Alloc = plan.allocations.find((a) => a.cardId === 'card3')
      expect(card3Alloc!.isMinimumOnly).toBe(true)
    })

    it('saves more interest than minimum-only payments', () => {
      const plan = generateAvalanchePlan([card1, card2, card3], budget)
      expect(plan.totalInterestSaved).toBeGreaterThan(0)
    })

    it('flags insufficient budget', () => {
      const plan = generateAvalanchePlan([card1, card2, card3], 5000)  // £50 < minimums
      expect(plan.insufficientBudget).toBe(true)
    })

    it('handles empty cards array', () => {
      const plan = generateAvalanchePlan([], 30000)
      expect(plan.allocations).toHaveLength(0)
      expect(plan.payoffMonths).toBe(0)
    })

    it('completes in under 200ms for 3 cards', () => {
      const start = Date.now()
      generateAvalanchePlan([card1, card2, card3], budget)
      expect(Date.now() - start).toBeLessThan(200)
    })
  })

  describe('generateSnowballPlan', () => {
    it('marks the lowest balance card as priority', () => {
      const plan = generateSnowballPlan([card1, card2, card3], budget)
      const priorityAlloc = plan.allocations.find((a) => a.cardId === 'card3')
      expect(priorityAlloc!.isMinimumOnly).toBe(false)
    })

    it('generates a valid plan', () => {
      const plan = generateSnowballPlan([card1, card2, card3], budget)
      expect(plan.payoffMonths).toBeGreaterThan(0)
      expect(plan.allocations).toHaveLength(3)
    })
  })

  describe('Avalanche vs Snowball', () => {
    it('avalanche pays less total interest than snowball for high-APR scenarios', () => {
      const avalanche = generateAvalanchePlan([card1, card2, card3], budget)
      const snowball = generateSnowballPlan([card1, card2, card3], budget)
      // Avalanche always ≤ snowball in total interest
      expect(avalanche.totalInterestPaid).toBeLessThanOrEqual(snowball.totalInterestPaid)
    })
  })
})
