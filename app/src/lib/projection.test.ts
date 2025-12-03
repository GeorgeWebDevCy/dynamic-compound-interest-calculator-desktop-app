import { describe, it, expect } from 'vitest'
import { buildProjection } from './projection'
import { DEFAULT_SETTINGS } from '../types/finance'
import type { CompoundSettings } from '../types/finance'

describe('buildProjection - FIRE Metrics', () => {
    const baseSettings: CompoundSettings = DEFAULT_SETTINGS[0].settings

    it('calculates FIRE number correctly', () => {
        const settings = {
            ...baseSettings,
            annualExpenses: 24000,
        }
        const result = buildProjection(settings)
        expect(result.fireMetrics.fireNumber).toBe(600000) // 24000 * 25
    })

    it('calculates FIRE year correctly when achieved', () => {
        // High contribution to ensure FIRE is reached quickly
        const settings = {
            ...baseSettings,
            principal: 0,
            contribution: 5000, // 60k/year
            contributionFrequency: 12,
            annualReturn: 10,
            years: 20,
            annualExpenses: 24000, // Target 600k
        }
        const result = buildProjection(settings)

        expect(result.fireMetrics.fireNumber).toBe(600000)
        expect(result.fireMetrics.fireYear).not.toBeNull()
        expect(result.fireMetrics.yearsToFire).not.toBeNull()

        // Rough check: 60k/year + 10% growth.
        // Year 1: ~60k
        // Year 2: ~126k
        // Year 3: ~198k
        // ...
        // Should be around 7-8 years
        expect(result.fireMetrics.fireYear).toBeGreaterThan(0)
        expect(result.fireMetrics.fireYear).toBeLessThan(10)
    })

    it('returns null for fireYear when not achieved', () => {
        const settings = {
            ...baseSettings,
            principal: 0,
            contribution: 100,
            years: 5,
            annualExpenses: 100000, // Target 2.5M
        }
        const result = buildProjection(settings)
        expect(result.fireMetrics.fireYear).toBeNull()
        expect(result.fireMetrics.yearsToFire).toBeNull()
    })

    it('handles already FIREd case', () => {
        const settings = {
            ...baseSettings,
            principal: 1000000,
            annualExpenses: 24000, // Target 600k
        }
        const result = buildProjection(settings)
        expect(result.fireMetrics.fireYear).toBe(0)
        expect(result.fireMetrics.yearsToFire).toBe(0)
    })

    it('handles zero expenses', () => {
        const settings = {
            ...baseSettings,
            annualExpenses: 0,
        }
        const result = buildProjection(settings)
        expect(result.fireMetrics.fireNumber).toBe(0)
        expect(result.fireMetrics.fireYear).toBeNull()
    })

    it('calculates annualInterest correctly', () => {
        const settings = {
            ...baseSettings,
            principal: 10000,
            contribution: 0,
            annualReturn: 10,
            years: 2,
            inflationRate: 0,
            fundExpenseRatio: 0,
            platformFee: 0,
        }
        const result = buildProjection(settings)

        // Year 1: 10000 * 1.1 = 11000. Growth = 1000. Annual Interest = 1000.
        expect(result.table[0].annualInterest).toBeCloseTo(1000, 0)

        // Year 2: 11000 * 1.1 = 12100. Total Growth = 2100. Previous Growth = 1000. Annual Interest = 1100.
        expect(result.table[1].annualInterest).toBeCloseTo(1100, 0)
    })
})
