/**
 * Modulr Virtual Card service
 *
 * Handles provisioning and management of Modulr virtual Mastercards.
 * Uses HMAC-SHA1 request signing as required by the Modulr API.
 *
 * Sandbox: https://api-sandbox.modulrfinance.com
 * Production: https://api.modulrfinance.com
 *
 * Docs: https://modulr.readme.io/docs
 */

import crypto from 'crypto'

const MODULR_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api.modulrfinance.com/api-sandbox'
  : 'https://api-sandbox.modulrfinance.com/api-sandbox'

const MODULR_API_KEY = process.env.MODULR_API_KEY ?? ''
const MODULR_API_SECRET = process.env.MODULR_API_SECRET ?? ''

// ---------------------------------------------------------------------------
// HMAC-SHA1 request signing
// ---------------------------------------------------------------------------

function buildAuthHeader(nonce: string, timestamp: string): string {
  const message = `date: ${timestamp}\nnonce: ${nonce}`
  const signature = crypto
    .createHmac('sha1', MODULR_API_SECRET)
    .update(message)
    .digest('base64')
  return `Signature keyId="${MODULR_API_KEY}",algorithm="hmac-sha1",headers="date nonce",signature="${signature}"`
}

async function modulrRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const timestamp = new Date().toUTCString()
  const nonce = crypto.randomBytes(16).toString('hex')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Date: timestamp,
    Nonce: nonce,
    Authorization: buildAuthHeader(nonce, timestamp),
  }

  const res = await fetch(`${MODULR_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Modulr API error (${res.status}) on ${method} ${path}: ${err}`)
  }

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModulrAccount {
  id: string
  name: string
  status: string
}

interface ModulrCard {
  id: string
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN' | 'CANCELLED'
  maskedPan: string
  expiryDate: string   // MM/YY
  embossName: string
}

interface ModulrCardDetails {
  id: string
  pan: string          // full PAN — only returned for reveal, never logged
  expiryDate: string
  cvv: string
}

// ---------------------------------------------------------------------------
// Stubs used in sandbox / when no Modulr key is configured
// ---------------------------------------------------------------------------

function isSandboxMode(): boolean {
  return !MODULR_API_KEY || !MODULR_API_SECRET
}

function stubCard(userId: string): ModulrCard {
  const seed = userId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return {
    id: `STUB_CARD_${seed}`,
    status: 'ACTIVE',
    maskedPan: `**** **** **** ${seed.slice(-4).replace(/[^0-9]/g, '1234').slice(0, 4)}`,
    expiryDate: '12/28',
    embossName: 'CLEARPATH USER',
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find or create a Modulr customer account for this ClearPath user.
 * In production, each user needs their own Modulr e-money account.
 */
export async function getOrCreateAccount(userId: string, email: string): Promise<string> {
  if (isSandboxMode()) return `STUB_ACCOUNT_${userId.slice(0, 8).toUpperCase()}`

  // Check if account already exists by external reference
  const accounts = await modulrRequest<{ content: ModulrAccount[] }>(
    'GET', `/accounts?externalReference=${encodeURIComponent(userId)}`
  )
  if (accounts.content?.length > 0) return accounts.content[0].id

  const created = await modulrRequest<ModulrAccount>('POST', '/customers', {
    type: 'INDIVIDUAL',
    externalReference: userId,
    individual: { email },
  })
  return created.id
}

/**
 * Provision a new virtual Mastercard for a Modulr account.
 */
export async function provisionCard(accountId: string, userId: string, holderName: string): Promise<ModulrCard> {
  if (isSandboxMode()) return stubCard(userId)

  return modulrRequest<ModulrCard>('POST', `/accounts/${accountId}/cards`, {
    type: 'VIRTUAL',
    embossName: holderName.toUpperCase().slice(0, 26),
    currency: 'GBP',
  })
}

/**
 * Freeze or unfreeze a Modulr card.
 */
export async function setCardFrozen(modulrCardId: string, frozen: boolean): Promise<void> {
  if (isSandboxMode()) return
  const action = frozen ? 'block' : 'unblock'
  await modulrRequest('PUT', `/cards/${modulrCardId}/${action}`)
}

/**
 * Retrieve sensitive card details (PAN + CVV) — only called on explicit user reveal.
 * In production this requires re-authentication before calling.
 */
export async function getCardDetails(modulrCardId: string): Promise<ModulrCardDetails> {
  if (isSandboxMode()) {
    const seed = modulrCardId.replace('STUB_CARD_', '')
    return {
      id: modulrCardId,
      pan: `5100 0000 0000 ${seed.slice(-4).replace(/[^0-9]/g, '1').slice(0, 4)}`,
      expiryDate: '12/28',
      cvv: '***',   // Modulr never exposes CVV via API — revealed via client-side SDK
    }
  }
  return modulrRequest<ModulrCardDetails>('GET', `/cards/${modulrCardId}/details`)
}

/**
 * Validate an inbound Modulr webhook signature.
 */
export function validateWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.MODULR_WEBHOOK_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // allow in dev without secret
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
