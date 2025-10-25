import { describe, expect, it } from 'vitest'

import { createPrefixedCurrencyFormatter } from './currency'

describe('createPrefixedCurrencyFormatter', () => {
  it('places the currency symbol before the amount for locales with trailing symbols', () => {
    const formatter = createPrefixedCurrencyFormatter('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    expect(formatter.format(1234.5)).toBe('€1.234,50')
  })

  it('preserves the sign ahead of the currency symbol', () => {
    const formatter = createPrefixedCurrencyFormatter('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    expect(formatter.format(-1234.5)).toBe('-€1.234,50')
  })

  it('keeps existing prefix placement when already leading', () => {
    const formatter = createPrefixedCurrencyFormatter('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    expect(formatter.format(1234.5)).toBe('$1,234.50')
  })
})
