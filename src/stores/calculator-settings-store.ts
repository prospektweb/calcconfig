import { create } from 'zustand'

export interface CalcSettingsProperties {
  CAN_BE_FIRST: { VALUE: string }
  REQUIRES_BEFORE: { VALUE: string | null }
  USE_OPERATION: { VALUE: string }
  USE_MATERIAL: { VALUE: string }
  DEFAULT_OPERATION: { VALUE: string | null }
  DEFAULT_MATERIAL: { VALUE: string | null }
  SUPPORTED_EQUIPMENT_LIST: { VALUE: string[] }
}

export interface CalcSettingsItem {
  id: number
  name: string
  properties: CalcSettingsProperties
}

interface CalcSettingsState {
  settings: Record<string, CalcSettingsItem>  // key is calculatorCode
  setSettings: (calculatorCode: string, item: CalcSettingsItem) => void
  getSettings: (calculatorCode: string) => CalcSettingsItem | undefined
  clearSettings: (calculatorCode: string) => void
}

export const useCalculatorSettingsStore = create<CalcSettingsState>((set, get) => ({
  settings: {},
  
  setSettings: (calculatorCode: string, item: CalcSettingsItem) => {
    set((state) => ({
      settings: {
        ...state.settings,
        [calculatorCode]: item,
      },
    }))
  },
  
  getSettings: (calculatorCode: string) => {
    return get().settings[calculatorCode]
  },
  
  clearSettings: (calculatorCode: string) => {
    set((state) => {
      const newSettings = { ...state.settings }
      delete newSettings[calculatorCode]
      return { settings: newSettings }
    })
  },
}))
