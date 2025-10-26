import type { Scenario } from './types/finance'

export type ScenarioConfig = {
  scenarios: Scenario[]
}

declare global {
  interface Window {
    configAPI?: {
      load: () => Promise<ScenarioConfig>
      save: (payload: ScenarioConfig) => Promise<ScenarioConfig>
    }
  }
}

export {}
