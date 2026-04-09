/**
 * Google Vision OCR service for credit card screenshot parsing.
 *
 * Sends the image to Google Vision TEXT_DETECTION, then applies
 * regex heuristics to extract card fields. Returns a confidence
 * score (0–1) per field so the frontend can highlight low-confidence values.
 */

export interface OCRField<T> {
  value: T | null
  confidence: 'high' | 'medium' | 'low'
  raw: string
}

export interface OCRResult {
  balance: OCRField<number>       // pence
  creditLimit: OCRField<number>   // pence
  apr: OCRField<number>           // percent
  paymentDueDate: OCRField<string> // ISO date
  lastFour: OCRField<string>       // 4-digit string
  rawText: string
}

// ---------------------------------------------------------------------------
// Google Vision API call
// ---------------------------------------------------------------------------

async function detectText(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY
  if (!apiKey) throw new Error('GOOGLE_CLOUD_API_KEY not configured')

  const base64 = imageBuffer.toString('base64')
  const requestBody = {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        imageContext: { languageHints: ['en'] },
      },
    ],
  }

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Vision API error: ${err}`)
  }

  const data = await res.json() as { responses?: Array<{ fullTextAnnotation?: { text?: string } }> }
  const fullText: string = data.responses?.[0]?.fullTextAnnotation?.text ?? ''
  return fullText
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parsePounds(raw: string): number | null {
  // Matches: £1,234.56  /  1234.56  /  1,234  (no pence)
  const match = raw.match(/£?\s*([\d,]+\.?\d{0,2})/)
  if (!match) return null
  const cleaned = match[1].replace(/,/g, '')
  const pounds = parseFloat(cleaned)
  if (isNaN(pounds)) return null
  return Math.round(pounds * 100)
}

function confidenceFor(value: unknown, alternatives: string[]): 'high' | 'medium' | 'low' {
  if (value === null) return 'low'
  if (alternatives.length >= 2) return 'high'
  return 'medium'
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function extractBalance(text: string): OCRField<number> {
  const patterns = [
    /(?:current\s+balance|balance\s+due|outstanding\s+balance|amount\s+owed)[:\s]*£?\s*([\d,]+\.?\d{0,2})/gi,
    /(?:balance)[:\s]*£?\s*([\d,]+\.?\d{0,2})/gi,
  ]
  const matches: string[] = []
  for (const pat of patterns) {
    for (const m of text.matchAll(pat)) matches.push(m[1])
  }
  const raw = matches[0] ?? ''
  const value = raw ? parsePounds(`£${raw}`) : null
  return { value, confidence: confidenceFor(value, matches), raw }
}

function extractCreditLimit(text: string): OCRField<number> {
  const patterns = [
    /(?:credit\s+limit|total\s+credit\s+limit|your\s+limit)[:\s]*£?\s*([\d,]+\.?\d{0,2})/gi,
    /(?:limit)[:\s]*£?\s*([\d,]+\.?\d{0,2})/gi,
  ]
  const matches: string[] = []
  for (const pat of patterns) {
    for (const m of text.matchAll(pat)) matches.push(m[1])
  }
  const raw = matches[0] ?? ''
  const value = raw ? parsePounds(`£${raw}`) : null
  return { value, confidence: confidenceFor(value, matches), raw }
}

function extractAPR(text: string): OCRField<number> {
  const patterns = [
    /(?:purchase\s+rate|annual\s+percentage\s+rate|apr|interest\s+rate)[:\s]*([\d.]+)\s*%/gi,
    /([\d.]+)\s*%\s*(?:apr|p\.?a\.?|per\s+annum)/gi,
  ]
  const matches: string[] = []
  for (const pat of patterns) {
    for (const m of text.matchAll(pat)) matches.push(m[1])
  }
  const raw = matches[0] ?? ''
  const value = raw ? parseFloat(raw) : null
  return { value: isNaN(value as number) ? null : value, confidence: confidenceFor(value, matches), raw }
}

function extractDueDate(text: string): OCRField<string> {
  // UK date formats: 25 Apr 2026 / 25/04/2026 / April 25, 2026
  const patterns = [
    /(?:payment\s+due|due\s+date|minimum\s+payment\s+due)[:\s]*(\d{1,2}[\s/\-]\w{3,9}[\s/\-]\d{4})/gi,
    /(?:payment\s+due|due\s+date)[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+20\d{2})/gi,
  ]
  const matches: string[] = []
  for (const pat of patterns) {
    for (const m of text.matchAll(pat)) matches.push(m[1])
  }
  const raw = matches[0] ?? ''
  let isoDate: string | null = null
  if (raw) {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) isoDate = d.toISOString().split('T')[0]
  }
  return { value: isoDate, confidence: confidenceFor(isoDate, matches), raw }
}

function extractLastFour(text: string): OCRField<string> {
  const patterns = [
    /(?:card\s+(?:ending|number|no\.?)[:\s]*(?:\*+|x+)?)(\d{4})\b/gi,
    /\b(?:\*{4}|\*+\s*)(\d{4})\b/g,
    /\b(\d{4})\s+(\d{4})\s+(\d{4})\s+(\d{4})\b/g,  // full PAN — take last group
  ]
  for (const pat of patterns) {
    const m = pat.exec(text)
    if (m) {
      const value = m[m.length - 1]  // last capture group
      return { value, confidence: 'high', raw: m[0] }
    }
  }
  return { value: null, confidence: 'low', raw: '' }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function parseCardScreenshot(imageBuffer: Buffer, mimeType: string): Promise<OCRResult> {
  const rawText = await detectText(imageBuffer, mimeType)

  return {
    balance: extractBalance(rawText),
    creditLimit: extractCreditLimit(rawText),
    apr: extractAPR(rawText),
    paymentDueDate: extractDueDate(rawText),
    lastFour: extractLastFour(rawText),
    rawText,
  }
}

// ---------------------------------------------------------------------------
// Stub for unit testing without API key
// ---------------------------------------------------------------------------
export function parseCardScreenshotFromText(rawText: string): Omit<OCRResult, 'rawText'> {
  return {
    balance: extractBalance(rawText),
    creditLimit: extractCreditLimit(rawText),
    apr: extractAPR(rawText),
    paymentDueDate: extractDueDate(rawText),
    lastFour: extractLastFour(rawText),
  }
}
