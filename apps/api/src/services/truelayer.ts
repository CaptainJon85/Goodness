/**
 * TrueLayer Open Banking service
 * Handles OAuth flow and data sync for credit card accounts.
 *
 * Token encryption uses AES-256-GCM via Node.js crypto.
 * Tokens are NEVER returned to the frontend.
 */
import crypto from 'crypto'

const TRUELAYER_BASE = 'https://api.truelayer.com'
const TRUELAYER_AUTH = 'https://auth.truelayer.com'

const {
  TRUELAYER_CLIENT_ID,
  TRUELAYER_CLIENT_SECRET,
  TRUELAYER_REDIRECT_URI,
} = process.env

// ---------------------------------------------------------------------------
// Encryption helpers (AES-256-GCM)
// ---------------------------------------------------------------------------

const ENCRYPTION_KEY = Buffer.from(
  (process.env.JWT_SECRET || 'change-me-in-production-32charslong!!').padEnd(32, '0').slice(0, 32)
)

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(hex):tag(hex):ciphertext(hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptToken(stored: string): string {
  const [ivHex, tagHex, ctHex] = stored.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ct = Buffer.from(ctHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TRUELAYER_CLIENT_ID!,
    redirect_uri: TRUELAYER_REDIRECT_URI!,
    scope: 'info accounts balance cards transactions',
    state,
    providers: 'uk-ob-all uk-oauth-all',
  })
  return `${TRUELAYER_AUTH}/?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(`${TRUELAYER_AUTH}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: TRUELAYER_CLIENT_ID!,
      client_secret: TRUELAYER_CLIENT_SECRET!,
      redirect_uri: TRUELAYER_REDIRECT_URI!,
      code,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`TrueLayer token exchange failed: ${err}`)
  }
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${TRUELAYER_AUTH}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: TRUELAYER_CLIENT_ID!,
      client_secret: TRUELAYER_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error('TrueLayer token refresh failed')
  return res.json()
}

// ---------------------------------------------------------------------------
// Data fetch
// ---------------------------------------------------------------------------

async function tlFetch(path: string, accessToken: string) {
  const res = await fetch(`${TRUELAYER_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`TrueLayer API error on ${path}: ${res.status}`)
  return res.json()
}

export interface TrueLayerCard {
  account_id: string
  display_name: string
  card_network: string
  card_type: string
  partial_card_number: string   // last 4
  name_on_card?: string
  valid_to?: string
  update_timestamp: string
}

export interface TrueLayerCardBalance {
  available: number     // available credit (pounds)
  current: number       // outstanding balance (pounds, negative = credit)
  credit_limit: number  // credit limit (pounds)
  last_statement_balance?: number
  last_statement_date?: string
  payment_due?: number
  payment_due_date?: string
}

export async function getCards(accessToken: string): Promise<TrueLayerCard[]> {
  const data = await tlFetch('/data/v1/cards', accessToken)
  return data.results ?? []
}

export async function getCardBalance(accessToken: string, accountId: string): Promise<TrueLayerCardBalance | null> {
  try {
    const data = await tlFetch(`/data/v1/cards/${accountId}/balance`, accessToken)
    return data.results?.[0] ?? null
  } catch {
    return null
  }
}

export interface SyncResult {
  nickname: string
  lastFour: string
  provider: string
  balance: number           // pence
  creditLimit: number       // pence
  minimumPayment: number    // pence
  paymentDueDate: string | null
  truelayerAccountId: string
}

export async function syncCard(accessToken: string, card: TrueLayerCard): Promise<SyncResult> {
  const balance = await getCardBalance(accessToken, card.account_id)

  const balancePence = balance ? Math.round(Math.abs(balance.current) * 100) : 0
  const limitPence = balance ? Math.round(balance.credit_limit * 100) : 0
  const minPayPence = balance?.payment_due ? Math.round(balance.payment_due * 100) : 0

  return {
    nickname: card.display_name || `${card.card_network} ••••${card.partial_card_number}`,
    lastFour: card.partial_card_number?.slice(-4) ?? '0000',
    provider: card.card_network ?? '',
    balance: balancePence,
    creditLimit: limitPence,
    minimumPayment: minPayPence,
    paymentDueDate: balance?.payment_due_date ?? null,
    truelayerAccountId: card.account_id,
  }
}
