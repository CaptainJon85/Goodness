import { Router, Request, Response } from 'express'
import { z } from 'zod'
import pool from '../db/pool'
import { requireAuth, requireTier } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'
import * as modulr from '../services/modulr'
import { routeTransaction, type EligibleCard } from '../services/routingEngine'

const router = Router()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toVirtualCardDto(v: Record<string, unknown>) {
  return {
    id: v.id,
    modulrCardId: v.modulr_card_id,
    routingMode: v.routing_mode,
    isActive: v.is_active,
    isFrozen: v.is_frozen,
    createdAt: v.created_at,
  }
}

// ---------------------------------------------------------------------------
// GET /api/virtual-card
// ---------------------------------------------------------------------------
router.get('/', requireAuth, requireTier('premium'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM virtual_cards WHERE user_id = $1', [req.user!.id])
    if (!result.rows[0]) {
      res.status(404).json({ error: 'No virtual card found. Activate one first.' })
      return
    }
    res.json({ data: toVirtualCardDto(result.rows[0]) })
  } catch {
    res.status(500).json({ error: 'Failed to fetch virtual card' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/virtual-card/activate
// ---------------------------------------------------------------------------
router.post('/activate', requireAuth, requireTier('premium'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await pool.query('SELECT id FROM virtual_cards WHERE user_id = $1', [req.user!.id])
    if (existing.rows[0]) {
      res.status(409).json({ error: 'Virtual card already exists' })
      return
    }

    // KYC check — virtual card requires verified identity
    const userResult = await pool.query('SELECT name, email, kyc_status FROM users WHERE id = $1', [req.user!.id])
    const user = userResult.rows[0]
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    if (user.kyc_status !== 'verified') {
      res.status(403).json({
        error: 'Identity verification required before activating a virtual card.',
        code: 'KYC_REQUIRED',
      })
      return
    }

    // Provision via Modulr
    const accountId = await modulr.getOrCreateAccount(req.user!.id, user.email)
    const card = await modulr.provisionCard(accountId, req.user!.id, user.name || 'CLEARPATH USER')

    const result = await pool.query(
      `INSERT INTO virtual_cards (user_id, modulr_card_id, is_active, routing_mode)
       VALUES ($1, $2, TRUE, 'minimise_cost') RETURNING *`,
      [req.user!.id, card.id]
    )

    res.status(201).json({ data: toVirtualCardDto(result.rows[0]) })
  } catch (err) {
    console.error('Virtual card activation error:', err)
    res.status(500).json({ error: 'Failed to activate virtual card' })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/virtual-card/freeze
// ---------------------------------------------------------------------------
router.patch('/freeze', requireAuth, requireTier('premium'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = z.object({ frozen: z.boolean() }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'frozen must be a boolean' })
    return
  }

  try {
    const vcResult = await pool.query('SELECT modulr_card_id FROM virtual_cards WHERE user_id = $1', [req.user!.id])
    if (!vcResult.rows[0]) {
      res.status(404).json({ error: 'Virtual card not found' })
      return
    }

    // Update Modulr
    await modulr.setCardFrozen(vcResult.rows[0].modulr_card_id, parsed.data.frozen)

    const result = await pool.query(
      'UPDATE virtual_cards SET is_frozen = $1 WHERE user_id = $2 RETURNING is_frozen',
      [parsed.data.frozen, req.user!.id]
    )
    res.json({ data: { isFrozen: result.rows[0].is_frozen } })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update freeze status' })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/virtual-card/routing-mode
// ---------------------------------------------------------------------------
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
  } catch {
    res.status(500).json({ error: 'Failed to update routing mode' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/virtual-card/transactions
// ---------------------------------------------------------------------------
router.get('/transactions', requireAuth, requireTier('premium'), async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 100)
  const offset = Number(req.query.offset ?? 0)

  try {
    const result = await pool.query(
      `SELECT t.*, c.nickname as card_nickname
       FROM transactions t
       LEFT JOIN credit_cards c ON c.id = t.allocated_to_card_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user!.id, limit, offset]
    )
    res.json({
      data: result.rows.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        merchantName: t.merchant_name,
        merchantCategory: t.merchant_category,
        allocatedToCardId: t.allocated_to_card_id,
        allocatedToCardNickname: t.card_nickname,
        allocationReason: t.allocation_reason,
        rewardEarned: Number(t.reward_earned),
        createdAt: t.created_at,
      })),
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch transactions' })
  }
})

// ---------------------------------------------------------------------------
// GET /api/virtual-card/details  — reveal masked PAN + expiry (no CVV via API)
// ---------------------------------------------------------------------------
router.get('/details', requireAuth, requireTier('premium'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const vcResult = await pool.query('SELECT modulr_card_id FROM virtual_cards WHERE user_id = $1', [req.user!.id])
    if (!vcResult.rows[0]) {
      res.status(404).json({ error: 'Virtual card not found' })
      return
    }
    const details = await modulr.getCardDetails(vcResult.rows[0].modulr_card_id)
    // Never log PAN. Return only what's needed.
    res.json({
      data: {
        maskedPan: `**** **** **** ${details.pan.replace(/\s/g, '').slice(-4)}`,
        expiryDate: details.expiryDate,
        // CVV is revealed client-side via Modulr SDK — never transited through our servers
      },
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch card details' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/virtual-card/webhook  — Modulr transaction webhook + routing
// ---------------------------------------------------------------------------
router.post('/webhook', async (req: Request, res: Response) => {
  // Validate webhook signature
  const signature = req.headers['x-modulr-signature'] as string ?? ''
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)

  if (!modulr.validateWebhookSignature(rawBody, signature)) {
    res.status(401).json({ error: 'Invalid webhook signature' })
    return
  }

  // Acknowledge immediately — Modulr expects a fast 200
  res.json({ received: true })

  // Process asynchronously
  setImmediate(async () => {
    try {
      await processWebhook(req.body)
    } catch (err) {
      console.error('Webhook processing error:', err)
    }
  })
})

// ---------------------------------------------------------------------------
// Webhook processing (routing logic)
// ---------------------------------------------------------------------------

interface ModulrWebhookPayload {
  type: string
  data: {
    id: string
    cardId: string           // Modulr card ID
    amount: number           // pence (positive = debit)
    currency: string
    merchantName: string
    merchantCategoryCode: string
    status: string
  }
}

async function processWebhook(payload: ModulrWebhookPayload) {
  if (payload.type !== 'CARD_TRANSACTION_AUTHORISATION') return
  const { data } = payload

  // Look up which ClearPath user owns this card
  const vcResult = await pool.query(
    'SELECT vc.*, u.id as user_id FROM virtual_cards vc JOIN users u ON u.id = vc.user_id WHERE vc.modulr_card_id = $1',
    [data.cardId]
  )
  const vc = vcResult.rows[0]
  if (!vc) {
    console.warn('Webhook: no virtual card found for Modulr card ID', data.cardId)
    return
  }

  if (vc.is_frozen) {
    console.warn('Webhook: card is frozen, transaction declined', data.id)
    return
  }

  // Load user's real cards (active, have headroom)
  const cardsResult = await pool.query(
    'SELECT id, balance, credit_limit, apr, nickname, provider FROM credit_cards WHERE user_id = $1 AND balance < credit_limit',
    [vc.user_id]
  )

  const eligibleCards: EligibleCard[] = cardsResult.rows.map((c) => ({
    id: c.id,
    balance: Number(c.balance),
    creditLimit: Number(c.credit_limit),
    apr: Number(c.apr),
    nickname: c.nickname,
    provider: c.provider,
  }))

  if (eligibleCards.length === 0) {
    console.warn('Webhook: no eligible cards for routing, transaction declined')
    return
  }

  const decision = routeTransaction(
    eligibleCards,
    data.amount,
    data.merchantCategoryCode,
    data.merchantName,
    vc.routing_mode
  )

  if (!decision) {
    console.warn('Webhook: routing returned no decision (insufficient headroom)')
    return
  }

  // Record transaction
  await pool.query(
    `INSERT INTO transactions
       (user_id, virtual_card_id, amount, merchant_name, merchant_category,
        allocated_to_card_id, allocation_reason, reward_earned)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      vc.user_id,
      vc.id,
      data.amount,
      data.merchantName,
      data.merchantCategoryCode,
      decision.cardId,
      decision.reasoning,
      decision.rewardEarned,
    ]
  )

  // Update the real card's balance
  await pool.query(
    'UPDATE credit_cards SET balance = balance + $1 WHERE id = $2',
    [data.amount, decision.cardId]
  )

  console.info(
    `Routed £${(data.amount / 100).toFixed(2)} at ${data.merchantName} → ${decision.cardNickname} (${vc.routing_mode})`
  )
}
