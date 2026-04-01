import { Router, Response } from 'express'
import { z } from 'zod'
import pool from '../db/pool'
import { requireAuth, requireTier } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'
import { TIER_LIMITS } from '@clearpath/shared'

const router = Router()

const manualCardSchema = z.object({
  nickname: z.string().min(1).max(100),
  lastFour: z.string().length(4).regex(/^\d{4}$/),
  provider: z.string().max(100).default(''),
  balance: z.number().int().min(0),          // pence
  creditLimit: z.number().int().min(1),      // pence
  apr: z.number().positive().max(200),
  minimumPayment: z.number().int().min(0),   // pence
  paymentDueDate: z.string().nullable().optional(),
})

const patchCardSchema = manualCardSchema.partial()

function toCamel(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    lastFour: row.last_four,
    provider: row.provider,
    balance: Number(row.balance),
    creditLimit: Number(row.credit_limit),
    apr: Number(row.apr),
    minimumPayment: Number(row.minimum_payment),
    paymentDueDate: row.payment_due_date,
    connectionType: row.connection_type,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
  }
}

// GET /api/cards
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM credit_cards WHERE user_id = $1 ORDER BY apr DESC',
      [req.user!.id]
    )
    res.json({ data: result.rows.map(toCamel) })
  } catch (err) {
    console.error('List cards error:', err)
    res.status(500).json({ error: 'Failed to fetch cards' })
  }
})

// POST /api/cards/manual
router.post('/manual', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = manualCardSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    return
  }

  const { nickname, lastFour, provider, balance, creditLimit, apr, minimumPayment, paymentDueDate } = parsed.data

  if (balance > creditLimit) {
    res.status(400).json({ error: 'Balance cannot exceed credit limit' })
    return
  }

  // Enforce tier card limits
  const userTier = req.user!.subscriptionTier
  const limit = TIER_LIMITS[userTier].maxCards
  if (limit !== Infinity) {
    const countResult = await pool.query('SELECT COUNT(*) FROM credit_cards WHERE user_id = $1', [req.user!.id])
    if (Number(countResult.rows[0].count) >= limit) {
      res.status(403).json({
        error: `Free tier allows up to ${limit} cards. Upgrade to Plus for unlimited cards.`,
        code: 'TIER_REQUIRED',
        requiredTier: 'plus',
      })
      return
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO credit_cards (user_id, nickname, last_four, provider, balance, credit_limit, apr, minimum_payment, payment_due_date, connection_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual') RETURNING *`,
      [req.user!.id, nickname, lastFour, provider, balance, creditLimit, apr, minimumPayment, paymentDueDate ?? null]
    )
    res.status(201).json({ data: toCamel(result.rows[0]) })
  } catch (err) {
    console.error('Create card error:', err)
    res.status(500).json({ error: 'Failed to create card' })
  }
})

// PATCH /api/cards/:id
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = patchCardSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    return
  }

  // Ownership check
  const existing = await pool.query('SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id])
  if (!existing.rows[0]) {
    res.status(404).json({ error: 'Card not found' })
    return
  }

  const fields = parsed.data
  if (fields.balance !== undefined && fields.creditLimit !== undefined && fields.balance > fields.creditLimit) {
    res.status(400).json({ error: 'Balance cannot exceed credit limit' })
    return
  }

  const sets: string[] = []
  const values: unknown[] = []
  let i = 1

  const fieldMap: Record<string, string> = {
    nickname: 'nickname', lastFour: 'last_four', provider: 'provider',
    balance: 'balance', creditLimit: 'credit_limit', apr: 'apr',
    minimumPayment: 'minimum_payment', paymentDueDate: 'payment_due_date',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in fields) {
      sets.push(`${col} = $${i++}`)
      values.push((fields as Record<string, unknown>)[key])
    }
  }

  if (sets.length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  values.push(req.params.id)
  const result = await pool.query(
    `UPDATE credit_cards SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  )
  res.json({ data: toCamel(result.rows[0]) })
})

// DELETE /api/cards/:id
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const existing = await pool.query('SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id])
  if (!existing.rows[0]) {
    res.status(404).json({ error: 'Card not found' })
    return
  }
  await pool.query('DELETE FROM credit_cards WHERE id = $1', [req.params.id])
  res.json({ data: { deleted: true } })
})

// Screenshot OCR endpoint stub (Phase 2 will wire Google Vision)
router.post('/screenshot', requireAuth, requireTier('plus'), async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ data: { message: 'OCR stub — Phase 2 integration pending' } })
})

// TrueLayer Open Banking stubs (Phase 2)
router.get('/open-banking/connect', requireAuth, requireTier('plus'), async (_req, res) => {
  res.json({ data: { message: 'TrueLayer integration stub — Phase 2' } })
})

router.get('/open-banking/callback', async (_req, res) => {
  res.json({ data: { message: 'TrueLayer callback stub — Phase 2' } })
})

router.post('/open-banking/sync/:id', requireAuth, requireTier('plus'), async (_req, res) => {
  res.json({ data: { message: 'TrueLayer sync stub — Phase 2' } })
})

export default router
