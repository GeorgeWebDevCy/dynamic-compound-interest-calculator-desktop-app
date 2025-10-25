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
  freedom24EuroBalance: number
  freedom24UsdBalance: number
  vuaaShareCount: number
  vuaaPurchasePrice: number
  vuaaPurchaseDate: string
}

export type FrequencyOption = {
  label: string
  value: number
}

export const CONTRIBUTION_OPTIONS: FrequencyOption[] = [
  { label: 'Monthly (12×)', value: 12 },
  { label: 'Bi-weekly (26×)', value: 26 },
  { label: 'Weekly (52×)', value: 52 },
  { label: 'Quarterly (4×)', value: 4 },
  { label: 'Annually', value: 1 },
]

export const COMPOUNDING_OPTIONS: FrequencyOption[] = [
  { label: 'Daily (365×)', value: 365 },
  { label: 'Weekly (52×)', value: 52 },
  { label: 'Monthly (12×)', value: 12 },
  { label: 'Quarterly (4×)', value: 4 },
  { label: 'Semi-Annual (2×)', value: 2 },
  { label: 'Annually', value: 1 },
]

export const DEFAULT_SETTINGS: CompoundSettings = rawDefaults as CompoundSettings
