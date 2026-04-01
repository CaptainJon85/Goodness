import { Router, Response } from 'express'
import { z } from 'zod'
import pool from '../db/pool'
import { requireAuth, requireTier } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'
import { fetchCreditScore, sandboxScore } from '../services/experian'

const router = Router()

function scoreBand(score: number): string {
  if (score >= 881) return 'excellent'
  if (score >= 671) return 'good'
  if (score >= 561) return 'fair'
  return 'poor'
}

function toScoreDto(r: Record<string, unknown>) {
  return {
    id: r.id,
    score: r.score,
    provider: r.provider,
    recordedAt: r.recorded_at,
    factors: r.factors,
    band: scoreBand(r.score as number),
  }
}

// ---------------------------------------------------------------------------
// GET /api/credit-score  — latest score
// ---------------------------------------------------------------------------
router.get('/', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM credit_score_records WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [req.user!.id]
    )
    if (!result.rows[0]) {
      res.status(404).json({ error: 'No credit score data. Use POST /api/credit-score/fetch to pull your score.' })
      return
    }
    res.json({ data: toScoreDto(result.rows[0]) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch credit score' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/credit-score/fetch  — trigger Experian pull and store result
// ---------------------------------------------------------------------------
const fetchSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  postcode: z.string().min(3),
  addressLine1: z.string().min(1),
})

router.post('/fetch', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  // In sandbox mode (no Experian key), return a synthetic score
  const hasExperian = !!(process.env.EXPERIAN_CLIENT_ID && process.env.EXPERIAN_CLIENT_SECRET)

  let scored
  if (!hasExperian) {
    // Sandbox: seed from user id for determinism
    const seed = req.user!.id.charCodeAt(0) % 200 + 620  // 620–819 range
    scored = sandboxScore(seed)
  } else {
    const parsed = fetchSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    try {
      scored = await fetchCreditScore(parsed.data)
    } catch (err) {
      console.error('Experian fetch error:', err)
      res.status(502).json({ error: 'Failed to fetch score from Experian' })
      return
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO credit_score_records (user_id, score, provider, factors)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user!.id, scored.score, scored.provider, JSON.stringify(scored.factors)]
    )
    res.status(201).json({ data: toScoreDto(result.rows[0]) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to store credit score' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/credit-score/history  — last 24 records
// ---------------------------------------------------------------------------
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
  } catch {
    res.status(500).json({ error: 'Failed to fetch score history' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/credit-score/factors  — from latest record
// ---------------------------------------------------------------------------
router.get('/factors', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT factors FROM credit_score_records WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [req.user!.id]
    )
    res.json({ data: { factors: result.rows[0]?.factors ?? [] } })
  } catch {
    res.status(500).json({ error: 'Failed to fetch score factors' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/credit-score/projection  — utilisation-based score projection
// ---------------------------------------------------------------------------
router.get('/projection', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [scoreResult, planResult, cardsResult] = await Promise.all([
      pool.query('SELECT score FROM credit_score_records WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1', [req.user!.id]),
      pool.query('SELECT payoff_months, projected_payoff_date FROM repayment_plans WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1', [req.user!.id]),
      pool.query('SELECT balance, credit_limit FROM credit_cards WHERE user_id = $1', [req.user!.id]),
    ])

    const currentScore: number | null = scoreResult.rows[0]?.score ?? null
    const payoffMonths: number | null = planResult.rows[0]?.payoff_months ?? null

    const totalBalance = cardsResult.rows.reduce((s: number, c: Record<string, unknown>) => s + Number(c.balance), 0)
    const totalLimit = cardsResult.rows.reduce((s: number, c: Record<string, unknown>) => s + Number(c.credit_limit), 0)
    const currentUtil = totalLimit > 0 ? totalBalance / totalLimit : 0

    // Heuristic: every 10% utilisation drop → ~15 point gain (rough industry estimate)
    const projectedUtilDrop = currentUtil * 100  // drop to 0% after payoff
    const estimatedScoreGain = Math.round((projectedUtilDrop / 10) * 15)
    const projectedScore = currentScore != null ? Math.min(999, currentScore + estimatedScoreGain) : null

    res.json({
      data: {
        currentScore,
        projectedScore,
        estimatedScoreGain,
        currentUtilisation: Math.round(currentUtil * 100 * 10) / 10,
        payoffMonths,
        projectedPayoffDate: planResult.rows[0]?.projected_payoff_date ?? null,
        methodology: 'Estimated based on utilisation reduction from your repayment plan. Actual score changes vary and depend on many factors.',
      },
    })
  } catch {
    res.status(500).json({ error: 'Failed to compute score projection' })
  }
})

export default router
