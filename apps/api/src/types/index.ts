import { Request } from 'express'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    subscriptionTier: 'free' | 'plus' | 'premium'
  }
}
