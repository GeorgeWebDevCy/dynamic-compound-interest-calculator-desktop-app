import rawDefaults from '../shared/default-settings.json'

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

export const DEFAULT_SETTINGS: Scenario[] = rawDefaults as Scenario[]
