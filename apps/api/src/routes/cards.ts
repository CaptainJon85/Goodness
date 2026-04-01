import { Router, Response, Request } from 'express'
import { z } from 'zod'
import multer from 'multer'
import pool from '../db/pool'
import { requireAuth, requireTier } from '../middleware/auth'
import { ocrLimiter } from '../middleware/rateLimiter'
import { AuthenticatedRequest } from '../types'
import { TIER_LIMITS } from '@clearpath/shared'
import * as truelayer from '../services/truelayer'
import * as ocr from '../services/ocr'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const manualCardSchema = z.object({
  nickname: z.string().min(1).max(100),
  lastFour: z.string().length(4).regex(/^\d{4}$/),
  provider: z.string().max(100).default(''),
  balance: z.number().int().min(0),
  creditLimit: z.number().int().min(1),
  apr: z.number().positive().max(200),
  minimumPayment: z.number().int().min(0),
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

async function checkCardLimit(userId: string, tier: string): Promise<boolean> {
  const limit = TIER_LIMITS[tier as keyof typeof TIER_LIMITS]?.maxCards ?? 2
  if (limit === Infinity) return true
  const r = await pool.query('SELECT COUNT(*) FROM credit_cards WHERE user_id = $1', [userId])
  return Number(r.rows[0].count) < limit
}

// ---------------------------------------------------------------------------
// GET /api/cards
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// POST /api/cards/manual
// ---------------------------------------------------------------------------
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

  const canAdd = await checkCardLimit(req.user!.id, req.user!.subscriptionTier)
  if (!canAdd) {
    res.status(403).json({
      error: 'Free tier allows up to 2 cards. Upgrade to Plus for unlimited cards.',
      code: 'TIER_REQUIRED',
      requiredTier: 'plus',
    })
    return
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

// ---------------------------------------------------------------------------
// PATCH /api/cards/:id
// ---------------------------------------------------------------------------
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = patchCardSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    return
  }

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

// ---------------------------------------------------------------------------
// DELETE /api/cards/:id
// ---------------------------------------------------------------------------
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const existing = await pool.query('SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id])
  if (!existing.rows[0]) {
    res.status(404).json({ error: 'Card not found' })
    return
  }
  await pool.query('DELETE FROM credit_cards WHERE id = $1', [req.params.id])
  res.json({ data: { deleted: true } })
})

// ---------------------------------------------------------------------------
// POST /api/cards/screenshot  — Google Vision OCR
// ---------------------------------------------------------------------------
router.post(
  '/screenshot',
  requireAuth,
  requireTier('plus'),
  ocrLimiter,
  upload.single('image'),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' })
      return
    }

    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
    if (!allowed.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'Unsupported file type. Use JPEG, PNG, HEIC, or WebP.' })
      return
    }

    try {
      const result = await ocr.parseCardScreenshot(req.file.buffer, req.file.mimetype)
      res.json({ data: result })
    } catch (err) {
      console.error('OCR error:', err)
      res.status(500).json({ error: 'OCR processing failed' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /api/cards/open-banking/connect  — TrueLayer OAuth start
// ---------------------------------------------------------------------------
router.get('/open-banking/connect', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  // State encodes userId so we can look it up on callback
  const state = Buffer.from(JSON.stringify({ userId: req.user!.id, ts: Date.now() })).toString('base64url')
  const authUrl = truelayer.buildAuthUrl(state)
  res.json({ data: { authUrl } })
})

// ---------------------------------------------------------------------------
// GET /api/cards/open-banking/callback  — TrueLayer OAuth callback
// ---------------------------------------------------------------------------
router.get('/open-banking/callback', async (req: Request, res: Response) => {
  const { code, state, error: tlError } = req.query as Record<string, string>

  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  if (tlError || !code || !state) {
    res.redirect(`${appUrl}/cards?ob_error=${encodeURIComponent(tlError || 'missing_params')}`)
    return
  }

  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
    userId = decoded.userId
  } catch {
    res.redirect(`${appUrl}/cards?ob_error=invalid_state`)
    return
  }

  try {
    const tokens = await truelayer.exchangeCode(code)

    // Encrypt and store refresh token
    const encryptedRefresh = truelayer.encryptToken(tokens.refresh_token)
    const encryptedAccess = truelayer.encryptToken(tokens.access_token)

    // Fetch all cards from TrueLayer
    const tlCards = await truelayer.getCards(tokens.access_token)

    let synced = 0
    for (const tlCard of tlCards) {
      const canAdd = await checkCardLimit(userId, 'plus') // Plus required for OB
      if (!canAdd) break

      const syncData = await truelayer.syncCard(tokens.access_token, tlCard)

      // Upsert: if card with this truelayer_account_id already exists, update it
      await pool.query(
        `INSERT INTO credit_cards
           (user_id, nickname, last_four, provider, balance, credit_limit, apr, minimum_payment, payment_due_date,
            connection_type, truelayer_account_id, truelayer_access_token_enc, last_synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open_banking',$10,$11,NOW())
         ON CONFLICT (user_id, truelayer_account_id) DO UPDATE SET
           balance = EXCLUDED.balance,
           credit_limit = EXCLUDED.credit_limit,
           minimum_payment = EXCLUDED.minimum_payment,
           payment_due_date = EXCLUDED.payment_due_date,
           truelayer_access_token_enc = EXCLUDED.truelayer_access_token_enc,
           last_synced_at = NOW()`,
        [
          userId,
          syncData.nickname,
          syncData.lastFour,
          syncData.provider,
          syncData.balance,
          syncData.creditLimit,
          0,                          // APR not available from TrueLayer — user sets manually
          syncData.minimumPayment,
          syncData.paymentDueDate,
          tlCard.account_id,
          encryptedAccess,            // we store access token per-card; refresh stored in first card only
        ]
      )
      synced++
    }

    // Store encrypted refresh token in user record for background re-auth
    await pool.query(
      'UPDATE users SET truelayer_refresh_token_enc = $1 WHERE id = $2',
      [encryptedRefresh, userId]
    ).catch(() => {
      // Column may not exist yet if migration hasn't been run — non-fatal
    })

    res.redirect(`${appUrl}/cards?ob_synced=${synced}`)
  } catch (err) {
    console.error('TrueLayer callback error:', err)
    res.redirect(`${appUrl}/cards?ob_error=sync_failed`)
  }
})

// ---------------------------------------------------------------------------
// POST /api/cards/open-banking/sync/:id  — Force sync a single card
// ---------------------------------------------------------------------------
router.post('/open-banking/sync/:id', requireAuth, requireTier('plus'), async (req: AuthenticatedRequest, res: Response) => {
  const cardResult = await pool.query(
    'SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user!.id]
  )
  const card = cardResult.rows[0]
  if (!card) {
    res.status(404).json({ error: 'Card not found' })
    return
  }
  if (card.connection_type !== 'open_banking' || !card.truelayer_account_id || !card.truelayer_access_token_enc) {
    res.status(400).json({ error: 'Card is not connected via Open Banking' })
    return
  }

  try {
    let accessToken = truelayer.decryptToken(card.truelayer_access_token_enc)

    // Attempt sync; if it fails due to expired token, try refresh
    let syncData
    try {
      const tlCard: truelayer.TrueLayerCard = {
        account_id: card.truelayer_account_id,
        display_name: card.nickname,
        card_network: card.provider,
        card_type: 'credit',
        partial_card_number: card.last_four,
        update_timestamp: new Date().toISOString(),
      }
      syncData = await truelayer.syncCard(accessToken, tlCard)
    } catch {
      // Try to refresh token
      const userResult = await pool.query('SELECT truelayer_refresh_token_enc FROM users WHERE id = $1', [req.user!.id])
      const encRefresh = userResult.rows[0]?.truelayer_refresh_token_enc
      if (!encRefresh) throw new Error('No refresh token available — please reconnect Open Banking')

      const refreshToken = truelayer.decryptToken(encRefresh)
      const newTokens = await truelayer.refreshAccessToken(refreshToken)
      accessToken = newTokens.access_token

      const tlCard: truelayer.TrueLayerCard = {
        account_id: card.truelayer_account_id,
        display_name: card.nickname,
        card_network: card.provider,
        card_type: 'credit',
        partial_card_number: card.last_four,
        update_timestamp: new Date().toISOString(),
      }
      syncData = await truelayer.syncCard(accessToken, tlCard)

      // Update stored access token
      await pool.query(
        'UPDATE credit_cards SET truelayer_access_token_enc = $1 WHERE id = $2',
        [truelayer.encryptToken(accessToken), card.id]
      )
    }

    const result = await pool.query(
      `UPDATE credit_cards SET
         balance = $1, credit_limit = $2, minimum_payment = $3, payment_due_date = $4, last_synced_at = NOW()
       WHERE id = $5 RETURNING *`,
      [syncData.balance, syncData.creditLimit, syncData.minimumPayment, syncData.paymentDueDate, card.id]
    )

    res.json({ data: toCamel(result.rows[0]) })
  } catch (err) {
    console.error('OB sync error:', err)
    res.status(500).json({ error: (err as Error).message || 'Sync failed' })
  }
})

export default router
