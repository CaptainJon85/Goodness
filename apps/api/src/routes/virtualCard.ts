import { Router, Request, Response } from 'express'
import { z } from 'zod'
import pool from '../db/pool'
import { requireAuth, requireTier } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'

const router = Router()

// GET /api/virtual-card
router.get('/', requireAuth, requireTier('premium'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM virtual_cards WHERE user_id = $1', [req.user!.id])
    if (!result.rows[0]) {
      res.status(404).json({ error: 'No virtual card. Activate one first.' })
      return
    }
    const v = result.rows[0]
    res.json({
      data: {
        id: v.id,
        modulrCardId: v.modulr_card_id,
        routingMode: v.routing_mode,
        isActive: v.is_active,
        isFrozen: v.is_frozen,
        createdAt: v.created_at,
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch virtual card' })
  }
})

// POST /api/virtual-card/activate
router.post('/activate', requireAuth, requireTier('premium'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await pool.query('SELECT id FROM virtual_cards WHERE user_id = $1', [req.user!.id])
    if (existing.rows[0]) {
      res.status(409).json({ error: 'Virtual card already exists' })
      return
    }

    // Modulr provisioning stub (Phase 3 will wire real API)
    const modulrCardId = `MODULR_STUB_${req.user!.id.slice(0, 8).toUpperCase()}`

    const result = await pool.query(
      `INSERT INTO virtual_cards (user_id, modulr_card_id, is_active) VALUES ($1, $2, TRUE) RETURNING *`,
      [req.user!.id, modulrCardId]
    )

    res.status(201).json({
      data: {
        id: result.rows[0].id,
        modulrCardId,
        routingMode: 'minimise_cost',
        isActive: true,
        isFrozen: false,
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate virtual card' })
  }
})

// PATCH /api/virtual-card/freeze
router.patch('/freeze', requireAuth, requireTier('premium'), async (req: AuthenticatedRequest, res: Response) => {
  const { frozen } = req.body as { frozen: boolean }
  try {
    const result = await pool.query(
      'UPDATE virtual_cards SET is_frozen = $1 WHERE user_id = $2 RETURNING is_frozen',
      [frozen, req.user!.id]
    )
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Virtual card not found' })
      return
    }
    res.json({ data: { isFrozen: result.rows[0].is_frozen } })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update freeze status' })
  }
})

// PATCH /api/virtual-card/routing-mode
router.patch('/routing-mode', requireAuth, requireTier('premium'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = z.object({
    routingMode: z.enum(['maximise_rewards', 'minimise_cost', 'protect_score']),
  }).safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid routing mode' })
    return
  }

  try {
    const result = await pool.query(
      'UPDATE virtual_cards SET routing_mode = $1 WHERE user_id = $2 RETURNING routing_mode',
      [parsed.data.routingMode, req.user!.id]
    )
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Virtual card not found' })
      return
    }
    res.json({ data: { routingMode: result.rows[0].routing_mode } })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update routing mode' })
  }
})

// GET /api/virtual-card/transactions
router.get('/transactions', requireAuth, requireTier('premium'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user!.id]
    )
    res.json({
      data: result.rows.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        merchantName: t.merchant_name,
        merchantCategory: t.merchant_category,
        allocatedToCardId: t.allocated_to_card_id,
        allocationReason: t.allocation_reason,
        rewardEarned: Number(t.reward_earned),
        createdAt: t.created_at,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' })
  }
})

// POST /api/virtual-card/webhook  — Modulr transaction webhook (Phase 3 routing logic)
router.post('/webhook', async (req: Request, res: Response) => {
  const webhookSecret = process.env.MODULR_WEBHOOK_SECRET
  const signature = req.headers['x-modulr-signature']

  if (webhookSecret && signature !== webhookSecret) {
    res.status(401).json({ error: 'Invalid webhook signature' })
    return
  }

  // Stub: Phase 3 will implement full routing logic
  res.json({ received: true })
})

export default router
