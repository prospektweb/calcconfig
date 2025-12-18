import { create } from 'zustand'

export interface CalcSettings {
  calculatorId: number
  calculatorName: string
  canBeFirst: boolean
  requiresBefore: number | null
  useOperation: boolean
  useMaterial: boolean
  defaultOperation: number | null
  defaultMaterial: number | null
  supportedEquipmentList: number[]
}

interface CalculatorSettingsState {
  settings: Map<string, CalcSettings>
  
  setSettings: (calculatorCode: string, settings: CalcSettings) => void
  getSettings: (calculatorCode: string) => CalcSettings | undefined
  clearSettings: () => void
}

export const useCalculatorSettingsStore = create<CalculatorSettingsState>((set, get) => ({
  settings: new Map(),
  
  setSettings: (calculatorCode, settings) => {
    set((state) => {
      const newSettings = new Map(state.settings)
      newSettings.set(calculatorCode, settings)
      return { settings: newSettings }
    })
  },
  
  getSettings: (calculatorCode) => {
    return get().settings.get(calculatorCode)
  },
  
  clearSettings: () => {
    set({ settings: new Map() })
  },
}))
