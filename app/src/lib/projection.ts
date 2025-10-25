import type { CompoundSettings } from '../types/finance'

export type ProjectionOptions = {
  remainingContributionMonths?: number
}

export type ProjectionPoint = {
  year: number
  balance: number
}

const WITHDRAWAL_RATE = 0.04

export type YearlyBreakdown = {
  year: number
  endingBalance: number
  contributions: number
  growth: number
  allowedWithdrawal: number
}

export type ProjectionResult = {
  chartPoints: ProjectionPoint[]
  table: YearlyBreakdown[]
  totals: {
    contributions: number
    growth: number
    endingBalance: number
  }
}

const clampPositive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback

export const buildProjection = (
  settings: CompoundSettings,
  options: ProjectionOptions = {},
): ProjectionResult => {
  const compounding = clampPositive(settings.compoundingFrequency, 1)
  const years = clampPositive(settings.years, 1)

  const contributionPerPeriod =
    settings.contribution * (settings.contributionFrequency / compounding)

  const normalizedContributionMonths = Math.min(
    Math.max(options.remainingContributionMonths ?? 12, 0),
    12,
  )
  const firstYearContributionFactor = normalizedContributionMonths / 12

  const netAnnualRate = getNetAnnualRate(
    settings.annualReturn,
    settings.fundExpenseRatio + settings.platformFee,
  )
  const growthFactor = Math.max(1 + netAnnualRate, 0.0001)
  const periodicRate = Math.pow(growthFactor, 1 / compounding) - 1

  const totalPeriods = Math.ceil(years * compounding)
  const chartPoints: ProjectionPoint[] = [{ year: 0, balance: settings.principal }]
  const table: YearlyBreakdown[] = []

  let balance = settings.principal
  let totalContributions = settings.principal

  for (let period = 1; period <= totalPeriods; period += 1) {
    balance *= 1 + periodicRate
    const contributionFactor = period <= compounding ? firstYearContributionFactor : 1
    const adjustedContribution = contributionPerPeriod * contributionFactor

    if (adjustedContribution > 0) {
      balance += adjustedContribution
      totalContributions += adjustedContribution
    }

    const isYearBoundary = period % compounding === 0 || period === totalPeriods
    if (isYearBoundary) {
      const year = Number((period / compounding).toFixed(2))
      const growth = Math.max(balance - totalContributions, 0)
      chartPoints.push({ year, balance })
      table.push({
        year,
        endingBalance: balance,
        contributions: totalContributions,
        growth,
        allowedWithdrawal: balance * WITHDRAWAL_RATE,
      })
    }
  }

  const endingBalance = balance
  const growth = Math.max(endingBalance - totalContributions, 0)

  return {
    chartPoints,
    table,
    totals: {
      contributions: totalContributions,
      growth,
      endingBalance,
    },
  }
}

export const getNetAnnualRate = (expectedReturnPct: number, expensesPct: number) => {
  const grossReturn = expectedReturnPct / 100
  const expenseDrag = expensesPct / 100
  return (1 + grossReturn) * (1 - expenseDrag) - 1
}
