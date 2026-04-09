import { parseCardScreenshotFromText } from '../services/ocr'

describe('OCR parser', () => {
  const sampleText = `
Barclaycard
Card ending 4567
Current balance: £1,234.56
Credit limit: £5,000.00
Minimum payment: £25.00
Payment due date: 25 Apr 2026
Purchase rate: 26.9% APR
  `

  it('extracts balance', () => {
    const { balance } = parseCardScreenshotFromText(sampleText)
    expect(balance.value).toBe(123456)  // pence
  })

  it('extracts credit limit', () => {
    const { creditLimit } = parseCardScreenshotFromText(sampleText)
    expect(creditLimit.value).toBe(500000)
  })

  it('extracts APR', () => {
    const { apr } = parseCardScreenshotFromText(sampleText)
    expect(apr.value).toBeCloseTo(26.9, 1)
  })

  it('extracts last four digits', () => {
    const { lastFour } = parseCardScreenshotFromText(sampleText)
    expect(lastFour.value).toBe('4567')
  })

  it('extracts payment due date as ISO string', () => {
    const { paymentDueDate } = parseCardScreenshotFromText(sampleText)
    expect(paymentDueDate.value).toMatch(/2026-04-25/)
  })

  it('returns low confidence for missing fields', () => {
    const { balance } = parseCardScreenshotFromText('No useful text here')
    expect(balance.value).toBeNull()
    expect(balance.confidence).toBe('low')
  })

  it('handles amount without pence', () => {
    const { creditLimit } = parseCardScreenshotFromText('Credit limit: £3,000')
    expect(creditLimit.value).toBe(300000)
  })
})
