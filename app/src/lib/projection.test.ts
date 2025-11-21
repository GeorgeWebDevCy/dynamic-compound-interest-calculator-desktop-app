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
        // If fireNumber is 0, logic might vary, but usually we don't show FIRE metrics.
        // Based on implementation: if fireNumber > 0 checks are present.
        // Let's check what the function returns.
        // If fireNumber is 0, it shouldn't trigger "met" unless we explicitly handle 0 target.
        // But usually 0 expenses means 0 target, which is met instantly? 
        // Or ignored?
        // In the code: if (fireNumber > 0 && balance >= fireNumber) -> fireYear = 0
        // So if fireNumber is 0, fireYear remains null (initialized to null).
        expect(result.fireMetrics.fireYear).toBeNull()
    })
})
