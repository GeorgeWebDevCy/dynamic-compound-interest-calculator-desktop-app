import type { CompoundSettings } from './types/finance'

declare global {
  interface Window {
    configAPI?: {
      load: () => Promise<CompoundSettings>
      save: (payload: CompoundSettings) => Promise<CompoundSettings>
    }
  }
}

export {}
