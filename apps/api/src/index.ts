import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import { apiLimiter } from './middleware/rateLimiter'
import authRoutes from './routes/auth'
import cardsRoutes from './routes/cards'
import repaymentRoutes from './routes/repayment'
import dashboardRoutes from './routes/dashboard'
import subscriptionRoutes from './routes/subscription'
import creditScoreRoutes from './routes/creditScore'
import virtualCardRoutes from './routes/virtualCard'

const app = express()
const PORT = process.env.PORT || 4000

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}))

// CORS — only allow app origin
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}))

// Body parsing
// Stripe webhook needs raw body
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Global rate limit
app.use('/api/', apiLimiter)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/cards', cardsRoutes)
app.use('/api/repayment', repaymentRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/subscription', subscriptionRoutes)
app.use('/api/credit-score', creditScoreRoutes)
app.use('/api/virtual-card', virtualCardRoutes)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Global error handler — never leak stack traces
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`ClearPath API running on port ${PORT}`)
})

export default app
