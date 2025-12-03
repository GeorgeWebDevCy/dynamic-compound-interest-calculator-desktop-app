

export type CompoundSettings = {
  principal: number
  contribution: number
  contributionFrequency: number
  annualReturn: number
  compoundingFrequency: number
  years: number
  fundExpenseRatio: number
  platformFee: number
  targetBalance: number
  vuaaShareCount: number
  vuaaPurchasePrice: number
  vuaaPurchaseDate: string
  inflationRate: number
  annualExpenses: number
  birthDate: string
  retirementAge: number
}

export type FrequencyOption = {
  labelKey: string
  value: number
}

export type Scenario = {
  id: string
  name: string
  color: string
  settings: CompoundSettings
}

export const CONTRIBUTION_OPTIONS: FrequencyOption[] = [
  { labelKey: 'options.contribution.monthly', value: 12 },
  { labelKey: 'options.contribution.biweekly', value: 26 },
  { labelKey: 'options.contribution.weekly', value: 52 },
  { labelKey: 'options.contribution.quarterly', value: 4 },
  { labelKey: 'options.contribution.annually', value: 1 },
]

export const COMPOUNDING_OPTIONS: FrequencyOption[] = [
  { labelKey: 'options.compounding.daily', value: 365 },
  { labelKey: 'options.compounding.weekly', value: 52 },
  { labelKey: 'options.compounding.monthly', value: 12 },
  { labelKey: 'options.compounding.quarterly', value: 4 },
  { labelKey: 'options.compounding.semiAnnual', value: 2 },
  { labelKey: 'options.compounding.annually', value: 1 },
]

export const DEFAULT_SETTINGS: Scenario[] = [
  {
    id: 'default',
    name: 'Default Scenario',
    color: '#10b981',
    settings: {
      principal: 10000,
      contribution: 500,
      contributionFrequency: 12,
      annualReturn: 7,
      compoundingFrequency: 12,
      years: 20,
      fundExpenseRatio: 0.07,
      platformFee: 0,
      targetBalance: 1000000,
      vuaaShareCount: 0,
      vuaaPurchasePrice: 0,
      vuaaPurchaseDate: '',
      inflationRate: 2,
      annualExpenses: 24000,
      birthDate: '30/10/1982',
      retirementAge: 67,
    },
  },
]
