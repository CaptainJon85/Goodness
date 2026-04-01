import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import pool from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { authLimiter } from '../middleware/rateLimiter'
import { AuthenticatedRequest } from '../types'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'

function signToken(user: { id: string; email: string; subscriptionTier: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, subscriptionTier: user.subscriptionTier },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
})

// POST /api/auth/register
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    return
  }

  const { email, password, name } = parsed.data

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      res.status(400).json({ error: authError.message })
      return
    }

    const userId = authData.user.id

    await pool.query(
      `INSERT INTO users (id, email, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [userId, email, name]
    )

    const userRow = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
    const user = userRow.rows[0]

    const token = signToken({ id: user.id, email: user.email, subscriptionTier: user.subscription_tier })
    res.status(201).json({ data: { token, user: { id: user.id, email: user.email, name: user.name, subscriptionTier: user.subscription_tier } } })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
    return
  }

  const { email, password } = parsed.data

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Upsert user record (handles SSO sign-ups that skipped /register)
    await pool.query(
      `INSERT INTO users (id, email, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [authData.user.id, email, authData.user.user_metadata?.name ?? '']
    )

    const userRow = await pool.query('SELECT * FROM users WHERE id = $1', [authData.user.id])
    const user = userRow.rows[0]

    const token = signToken({ id: user.id, email: user.email, subscriptionTier: user.subscription_tier })
    res.json({ data: { token, user: { id: user.id, email: user.email, name: user.name, subscriptionTier: user.subscription_tier } } })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/auth/logout
router.post('/logout', requireAuth, async (_req: Request, res: Response) => {
  // JWT is stateless; client drops the token. Supabase session also signed out.
  res.json({ data: { message: 'Logged out successfully' } })
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRow = await pool.query('SELECT * FROM users WHERE id = $1', [req.user!.id])
    if (!userRow.rows[0]) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const u = userRow.rows[0]
    res.json({
      data: {
        id: u.id,
        email: u.email,
        name: u.name,
        kycStatus: u.kyc_status,
        subscriptionTier: u.subscription_tier,
        createdAt: u.created_at,
      },
    })
  } catch (err) {
    console.error('Get me error:', err)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// POST /api/auth/kyc/initiate  (stub — integrate Onfido SDK in Phase 2)
router.post('/kyc/initiate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ data: { message: 'KYC flow stub — integrate Onfido SDK', sdkToken: null } })
})

// POST /api/auth/kyc/complete  (stub)
router.post('/kyc/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pool.query("UPDATE users SET kyc_status = 'verified' WHERE id = $1", [req.user!.id])
    res.json({ data: { kycStatus: 'verified' } })
  } catch (err) {
    res.status(500).json({ error: 'KYC update failed' })
  }
})

export default router
