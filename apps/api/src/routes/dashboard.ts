import { Router, Response } from 'express'
import pool from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'

const router = Router()

// GET /api/dashboard/summary
router.get('/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cardsResult = await pool.query(
      'SELECT * FROM credit_cards WHERE user_id = $1 ORDER BY apr DESC',
      [req.user!.id]
    )

    const cards = cardsResult.rows

    const totalDebt = cards.reduce((sum: number, c: Record<string, unknown>) => sum + Number(c.balance), 0)
    const totalLimit = cards.reduce((sum: number, c: Record<string, unknown>) => sum + Number(c.credit_limit), 0)
    const averageUtilisation = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0

    // Monthly interest burn = sum of (balance * monthlyRate) for each card
    const monthlyInterestBurn = cards.reduce((sum: number, c: Record<string, unknown>) => {
      const monthlyRate = Number(c.apr) / 100 / 12
      return sum + Math.round(Number(c.balance) * monthlyRate)
    }, 0)

    // Cards due within 5 days
    const today = new Date()
    const fiveDaysFromNow = new Date()
    fiveDaysFromNow.setDate(today.getDate() + 5)

    const cardsDueSoon = cards
      .filter((c: Record<string, unknown>) => {
        if (!c.payment_due_date) return false
        const due = new Date(c.payment_due_date as string)
        return due >= today && due <= fiveDaysFromNow
      })
      .map((c: Record<string, unknown>) => ({
        id: c.id,
        nickname: c.nickname,
        paymentDueDate: c.payment_due_date,
        minimumPayment: Number(c.minimum_payment),
      }))

    // Latest repayment plan payoff date
    const planResult = await pool.query(
      'SELECT projected_payoff_date FROM repayment_plans WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1',
      [req.user!.id]
    )
    const projectedPayoffDate = planResult.rows[0]?.projected_payoff_date ?? null

    res.json({
      data: {
        totalDebt,
        totalCreditLimit: totalLimit,
        averageUtilisation: Math.round(averageUtilisation * 10) / 10,
        monthlyInterestBurn,
        projectedPayoffDate,
        cardsCount: cards.length,
        cardsDueSoon,
      },
    })
  } catch (err) {
    console.error('Dashboard summary error:', err)
    res.status(500).json({ error: 'Failed to fetch dashboard summary' })
  }
})

export default router
