import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AuthenticatedRequest } from '../types'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' })
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      id: string
      email: string
      subscriptionTier: 'free' | 'plus' | 'premium'
    }
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireTier(tier: 'plus' | 'premium') {
  const tierRank: Record<string, number> = { free: 0, plus: 1, premium: 2 }
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userTier = req.user?.subscriptionTier ?? 'free'
    if (tierRank[userTier] < tierRank[tier]) {
      res.status(403).json({
        error: 'Subscription upgrade required',
        code: 'TIER_REQUIRED',
        requiredTier: tier,
      })
      return
    }
    next()
  }
}
