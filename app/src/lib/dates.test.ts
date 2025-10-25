import { describe, expect, it } from 'vitest'

import { getWholeMonthsUntilYearEnd, isPurchaseDateInFuture } from './dates'

describe('getWholeMonthsUntilYearEnd', () => {
  it('returns remaining months when the purchase happened earlier this year', () => {
    const referenceDate = new Date(2024, 4, 15)
    expect(getWholeMonthsUntilYearEnd('2024-01-20', referenceDate)).toBe(7)
  })

  it('clamps to zero when the purchase date is in the future', () => {
    const referenceDate = new Date(2024, 4, 15)
    expect(getWholeMonthsUntilYearEnd('2024-11-05', referenceDate)).toBe(0)
  })

  it('accounts for leap years when calculating remaining months', () => {
    const referenceDate = new Date(2024, 1, 29)
    expect(getWholeMonthsUntilYearEnd('2024-02-01', referenceDate)).toBe(10)
  })
})

describe('isPurchaseDateInFuture', () => {
  it('returns true when the purchase date is after the reference date', () => {
    const referenceDate = new Date(2024, 4, 15)
    expect(isPurchaseDateInFuture('2024-06-01', referenceDate)).toBe(true)
  })

  it('returns false for past or same-day purchases', () => {
    const referenceDate = new Date(2024, 4, 15)
    expect(isPurchaseDateInFuture('2024-04-30', referenceDate)).toBe(false)
    expect(isPurchaseDateInFuture('2024-05-15', referenceDate)).toBe(false)
  })
})
