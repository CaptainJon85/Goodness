import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import pool from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { AuthenticatedRequest } from '../types'

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia',
})

// GET /api/subscription
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT subscription_tier, stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1', [req.user!.id])
    const user = result.rows[0]
    res.json({
      data: {
        tier: user?.subscription_tier ?? 'free',
        stripeCustomerId: user?.stripe_customer_id ?? null,
        stripeSubscriptionId: user?.stripe_subscription_id ?? null,
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscription' })
  }
})

// POST /api/subscription/checkout
router.post('/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { tier } = req.body as { tier: 'plus' | 'premium' }

  const priceId = tier === 'premium'
    ? process.env.STRIPE_PREMIUM_PRICE_ID
    : process.env.STRIPE_PLUS_PRICE_ID

  if (!priceId) {
    res.status(500).json({ error: 'Stripe price ID not configured' })
    return
  }

  try {
    // Get or create Stripe customer
    const userResult = await pool.query('SELECT email, stripe_customer_id FROM users WHERE id = $1', [req.user!.id])
    const user = userResult.rows[0]
    let customerId: string = user?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { clearpath_user_id: req.user!.id },
      })
      customerId = customer.id
      await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.user!.id])
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/dashboard?upgrade=success`,
      cancel_url: `${process.env.APP_URL}/pricing`,
      metadata: { userId: req.user!.id, tier },
    })

    res.json({ data: { checkoutUrl: session.url } })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// POST /api/subscription/portal
router.post('/portal', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userResult = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.user!.id])
    const customerId = userResult.rows[0]?.stripe_customer_id
    if (!customerId) {
      res.status(400).json({ error: 'No Stripe customer found' })
      return
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL}/dashboard`,
    })

    res.json({ data: { portalUrl: session.url } })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create portal session' })
  }
})

// POST /api/subscription/webhook
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret || !sig) {
    res.status(400).json({ error: 'Missing webhook secret or signature' })
    return
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('Stripe webhook signature error:', err)
    res.status(400).json({ error: 'Invalid webhook signature' })
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const tier = session.metadata?.tier as 'plus' | 'premium'
        if (userId && tier) {
          await pool.query(
            'UPDATE users SET subscription_tier = $1, stripe_subscription_id = $2 WHERE id = $3',
            [tier, session.subscription, userId]
          )
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const status = sub.status
        if (status === 'active') {
          // Tier is determined by price ID
          const priceId = sub.items.data[0]?.price.id
          let tier: string = 'free'
          if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) tier = 'premium'
          else if (priceId === process.env.STRIPE_PLUS_PRICE_ID) tier = 'plus'
          await pool.query(
            'UPDATE users SET subscription_tier = $1 WHERE stripe_customer_id = $2',
            [tier, customerId]
          )
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await pool.query(
          "UPDATE users SET subscription_tier = 'free', stripe_subscription_id = NULL WHERE stripe_customer_id = $1",
          [sub.customer]
        )
        break
      }
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Webhook processing error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

export default router
