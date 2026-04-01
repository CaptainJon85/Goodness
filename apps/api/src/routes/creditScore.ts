import { Router, Response } from 'express'
import pool from '../db/pool'
import { requireAuth, requireTier } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'

const router = Router()

// GET /api/credit-score  — latest score
router.get('/', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM credit_score_records WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [req.user!.id]
    )
    if (!result.rows[0]) {
      res.status(404).json({ error: 'No credit score data. Connect Experian to begin tracking.' })
      return
    }
    const r = result.rows[0]
    res.json({
      data: {
        id: r.id,
        score: r.score,
        provider: r.provider,
        recordedAt: r.recorded_at,
        factors: r.factors,
        band: scoreBand(r.score),
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch credit score' })
  }
})

// GET /api/credit-score/history
router.get('/history', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, score, provider, recorded_at FROM credit_score_records WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 24',
      [req.user!.id]
    )
    res.json({
      data: result.rows.map((r) => ({
        id: r.id,
        score: r.score,
        provider: r.provider,
        recordedAt: r.recorded_at,
        band: scoreBand(r.score),
      })),
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch score history' })
  }
})

// GET /api/credit-score/factors
router.get('/factors', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT factors FROM credit_score_records WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [req.user!.id]
    )
    res.json({ data: { factors: result.rows[0]?.factors ?? [] } })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch score factors' })
  }
})

// GET /api/credit-score/projection
router.get('/projection', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [scoreResult, planResult, cardsResult] = await Promise.all([
      pool.query('SELECT score FROM credit_score_records WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1', [req.user!.id]),
      pool.query('SELECT payoff_months, projected_payoff_date FROM repayment_plans WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1', [req.user!.id]),
      pool.query('SELECT balance, credit_limit FROM credit_cards WHERE user_id = $1', [req.user!.id]),
    ])

    const currentScore: number = scoreResult.rows[0]?.score ?? null
    const payoffMonths: number = planResult.rows[0]?.payoff_months ?? null

    // Estimate score improvement based on utilisation reduction
    // Rough model: every 10% utilisation reduction ≈ +15 score points
    const totalBalance = cardsResult.rows.reduce((s: number, c: Record<string, unknown>) => s + Number(c.balance), 0)
    const totalLimit = cardsResult.rows.reduce((s: number, c: Record<string, unknown>) => s + Number(c.credit_limit), 0)
    const currentUtil = totalLimit > 0 ? totalBalance / totalLimit : 0
    const projectedUtilImprovement = currentUtil * 100 // goes to 0% after payoff
    const estimatedScoreGain = Math.round((projectedUtilImprovement / 10) * 15)
    const projectedScore = currentScore ? Math.min(999, currentScore + estimatedScoreGain) : null

    res.json({
      data: {
        currentScore,
        projectedScore,
        estimatedScoreGain,
        payoffMonths,
        projectedPayoffDate: planResult.rows[0]?.projected_payoff_date ?? null,
        methodology: 'Estimated based on utilisation reduction from repayment plan. Actual score changes vary.',
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute score projection' })
  }
})

function scoreBand(score: number): string {
  if (score >= 881) return 'excellent'
  if (score >= 671) return 'good'
  if (score >= 561) return 'fair'
  return 'poor'
}

export default router
