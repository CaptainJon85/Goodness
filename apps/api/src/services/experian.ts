/**
 * Experian Credit Score API integration.
 *
 * Uses OAuth 2.0 client_credentials flow to obtain an access token,
 * then calls the Experian Credit Match / Score APIs.
 *
 * Sandbox base URL: https://sandbox.experian.com
 * Production base URL: https://api.experian.com
 *
 * Both endpoints require prior Experian partner onboarding.
 * This integration targets the UK Experian Consumer Credit Score API.
 */

import type { ScoreFactor } from '@clearpath/shared'

const EXPERIAN_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api.experian.com'
  : 'https://sandbox.experian.com'

interface ExperianTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface ExperianScoreResponse {
  creditScore: number
  creditBand: string
  factors?: Array<{
    factorCode: string
    factorText: string
    positiveOrNegative: 'P' | 'N'
    ratingImpact: 'H' | 'M' | 'L'
  }>
}

async function getAccessToken(): Promise<string> {
  const { EXPERIAN_CLIENT_ID, EXPERIAN_CLIENT_SECRET } = process.env
  if (!EXPERIAN_CLIENT_ID || !EXPERIAN_CLIENT_SECRET) {
    throw new Error('Experian credentials not configured')
  }

  const res = await fetch(`${EXPERIAN_BASE}/oauth2/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: EXPERIAN_CLIENT_ID,
      client_secret: EXPERIAN_CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    throw new Error(`Experian auth failed: ${res.status}`)
  }

  const data: ExperianTokenResponse = await res.json()
  return data.access_token
}

export interface FetchedScore {
  score: number
  provider: 'experian'
  factors: ScoreFactor[]
}

/**
 * Fetch the credit score for a user identified by their personal data.
 * In sandbox mode, Experian returns a synthetic score based on test data.
 *
 * @param personalData - PII required by Experian (name, DOB, address)
 */
export async function fetchCreditScore(personalData: {
  firstName: string
  lastName: string
  dateOfBirth: string      // YYYY-MM-DD
  postcode: string
  addressLine1: string
}): Promise<FetchedScore> {
  const accessToken = await getAccessToken()

  const res = await fetch(`${EXPERIAN_BASE}/consumerservices/credit-profile/v2/credit-score`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      subject: {
        name: {
          firstName: personalData.firstName,
          surname: personalData.lastName,
        },
        dateOfBirth: personalData.dateOfBirth,
        addresses: [
          {
            postCode: personalData.postcode,
            addressLine1: personalData.addressLine1,
            residencyType: 'CURRENT',
          },
        ],
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Experian score fetch failed (${res.status}): ${body}`)
  }

  const data: ExperianScoreResponse = await res.json()

  const factors: ScoreFactor[] = (data.factors ?? []).map((f) => ({
    type: f.positiveOrNegative === 'P' ? 'positive' : 'negative',
    description: f.factorText,
    impact: f.ratingImpact === 'H' ? 'high' : f.ratingImpact === 'M' ? 'medium' : 'low',
  }))

  return {
    score: data.creditScore,
    provider: 'experian',
    factors,
  }
}

/**
 * Sandbox stub — returns a deterministic synthetic score when no Experian
 * credentials are configured. Used in development and tests.
 */
export function sandboxScore(seedScore = 720): FetchedScore {
  return {
    score: seedScore,
    provider: 'experian',
    factors: [
      { type: 'positive', description: 'Long credit history on oldest account', impact: 'high' },
      { type: 'positive', description: 'No missed payments in the last 12 months', impact: 'high' },
      { type: 'negative', description: 'High credit utilisation (above 50%)', impact: 'high' },
      { type: 'negative', description: 'Multiple credit searches in the last 6 months', impact: 'medium' },
      { type: 'positive', description: 'Electoral roll registered at current address', impact: 'low' },
    ],
  }
}
