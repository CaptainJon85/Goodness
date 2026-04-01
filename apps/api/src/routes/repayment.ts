import { Router, Response } from 'express'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import pool from '../db/pool'
import { requireAuth, requireTier } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'
import { generateAvalanchePlan, generateSnowballPlan, calculateScenario, CardInput } from '../services/repaymentEngine'

const router = Router()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function generateNarrative(cards: CardInput[], plan: ReturnType<typeof generateAvalanchePlan>, method: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return ''
  try {
    const totalDebt = cards.reduce((s, c) => s + c.balance, 0)
    const highestApr = Math.max(...cards.map((c) => c.apr))
    const cardSummary = cards
      .map((c) => `£${(c.balance / 100).toFixed(0)} at ${c.apr}% APR`)
      .join(', ')

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: 'You are a friendly, encouraging UK debt repayment advisor. Be concise, specific, and positive. Never use jargon. Speak directly to "you".',
      messages: [
        {
          role: 'user',
          content: `My debt: ${cardSummary}. Total: £${(totalDebt / 100).toFixed(0)}.
Strategy: ${method} method. Payoff: ${plan.payoffMonths} months. Interest saved vs minimums: £${(plan.totalInterestSaved / 100).toFixed(0)}.
${plan.insufficientBudget ? 'Note: budget is below minimum payments — flag this.' : ''}
Write 2–3 sentences explaining why this strategy works for my situation and one concrete encouraging fact.`,
        },
      ],
    })
    const block = msg.content[0]
    return block.type === 'text' ? block.text : ''
  } catch {
    return ''
  }
}

async function getCardsForUser(userId: string): Promise<CardInput[]> {
  const result = await pool.query(
    'SELECT id, balance, apr, minimum_payment FROM credit_cards WHERE user_id = $1',
    [userId]
  )
  return result.rows.map((r) => ({
    id: r.id,
    balance: Number(r.balance),
    apr: Number(r.apr),
    minimumPayment: Number(r.minimum_payment),
  }))
}

// GET /api/repayment/plan
router.get('/plan', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM repayment_plans WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1',
      [req.user!.id]
    )
    if (!result.rows[0]) {
      res.status(404).json({ error: 'No plan found. Generate one first.' })
      return
    }
    const p = result.rows[0]
    res.json({
      data: {
        id: p.id,
        method: p.method,
        monthlyBudget: Number(p.monthly_budget),
        generatedAt: p.generated_at,
        allocations: p.allocations,
        projectedPayoffDate: p.projected_payoff_date,
        totalInterestSaved: Number(p.total_interest_saved),
        totalInterestPaid: Number(p.total_interest_paid),
        payoffMonths: p.payoff_months,
        narrative: p.narrative,
      },
    })
  } catch (err) {
    console.error('Get plan error:', err)
    res.status(500).json({ error: 'Failed to fetch repayment plan' })
  }
})

const generateSchema = z.object({
  monthlyBudget: z.number().int().positive(),  // pence
  method: z.enum(['avalanche', 'snowball']).default('avalanche'),
})

// POST /api/repayment/plan/generate
router.post('/plan/generate', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = generateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    return
  }

  const { monthlyBudget, method } = parsed.data

  try {
    const cards = await getCardsForUser(req.user!.id)
    if (cards.length === 0) {
      res.status(400).json({ error: 'Add at least one card before generating a plan' })
      return
    }

    const plan = method === 'avalanche'
      ? generateAvalanchePlan(cards, monthlyBudget)
      : generateSnowballPlan(cards, monthlyBudget)

    const narrative = await generateNarrative(cards, plan, method)

    const result = await pool.query(
      `INSERT INTO repayment_plans
        (user_id, method, monthly_budget, projected_payoff_date, total_interest_saved, total_interest_paid, payoff_months, narrative, allocations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, generated_at`,
      [
        req.user!.id,
        method,
        monthlyBudget,
        plan.projectedPayoffDate,
        plan.totalInterestSaved,
        plan.totalInterestPaid,
        plan.payoffMonths,
        narrative,
        JSON.stringify(plan.allocations),
      ]
    )

    res.status(201).json({
      data: {
        id: result.rows[0].id,
        method,
        monthlyBudget,
        generatedAt: result.rows[0].generated_at,
        allocations: plan.allocations,
        projectedPayoffDate: plan.projectedPayoffDate,
        totalInterestSaved: plan.totalInterestSaved,
        totalInterestPaid: plan.totalInterestPaid,
        payoffMonths: plan.payoffMonths,
        insufficientBudget: plan.insufficientBudget,
        narrative,
      },
    })
  } catch (err) {
    console.error('Generate plan error:', err)
    res.status(500).json({ error: 'Failed to generate repayment plan' })
  }
})

// POST /api/repayment/plan/scenario
router.post('/plan/scenario', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = generateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    return
  }

  const { monthlyBudget, method } = parsed.data

  // Free tier can use basic scenario; advanced slider is Premium
  const userTier = req.user!.subscriptionTier
  if (userTier === 'free') {
    res.status(403).json({ error: 'Upgrade required', code: 'TIER_REQUIRED', requiredTier: 'plus' })
    return
  }

  try {
    const cards = await getCardsForUser(req.user!.id)
    const plan = calculateScenario(cards, monthlyBudget, method)
    res.json({
      data: {
        monthlyBudget,
        method,
        projectedPayoffDate: plan.projectedPayoffDate,
        totalInterestPaid: plan.totalInterestPaid,
        totalInterestSaved: plan.totalInterestSaved,
        payoffMonths: plan.payoffMonths,
        insufficientBudget: plan.insufficientBudget,
        allocations: plan.allocations,
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Scenario calculation failed' })
  }
})

// PATCH /api/repayment/plan/budget — regenerates plan with new budget
router.patch('/plan/budget', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = z.object({
    monthlyBudget: z.number().int().positive(),
    method: z.enum(['avalanche', 'snowball']).default('avalanche'),
  }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed' })
    return
  }
  const { monthlyBudget, method } = parsed.data
  try {
    const cards = await getCardsForUser(req.user!.id)
    if (cards.length === 0) { res.status(400).json({ error: 'No cards found' }); return }
    const plan = method === 'avalanche' ? generateAvalanchePlan(cards, monthlyBudget) : generateSnowballPlan(cards, monthlyBudget)
    const narrative = await generateNarrative(cards, plan, method)
    const result = await pool.query(
      `INSERT INTO repayment_plans (user_id, method, monthly_budget, projected_payoff_date, total_interest_saved, total_interest_paid, payoff_months, narrative, allocations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, generated_at`,
      [req.user!.id, method, monthlyBudget, plan.projectedPayoffDate, plan.totalInterestSaved, plan.totalInterestPaid, plan.payoffMonths, narrative, JSON.stringify(plan.allocations)]
    )
    res.json({ data: { id: result.rows[0].id, method, monthlyBudget, generatedAt: result.rows[0].generated_at, allocations: plan.allocations, projectedPayoffDate: plan.projectedPayoffDate, totalInterestSaved: plan.totalInterestSaved, totalInterestPaid: plan.totalInterestPaid, payoffMonths: plan.payoffMonths, narrative } })
  } catch {
    res.status(500).json({ error: 'Failed to update plan budget' })
  }
})

// GET /api/repayment/plan/history
router.get('/plan/history', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM repayment_plans WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 20',
      [req.user!.id]
    )
    res.json({
      data: result.rows.map((p) => ({
        id: p.id,
        method: p.method,
        monthlyBudget: Number(p.monthly_budget),
        generatedAt: p.generated_at,
        projectedPayoffDate: p.projected_payoff_date,
        totalInterestSaved: Number(p.total_interest_saved),
        payoffMonths: p.payoff_months,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plan history' })
  }
})

export default router
