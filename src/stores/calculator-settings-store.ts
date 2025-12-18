import { create } from 'zustand'
import { BitrixProperty } from '@/lib/bitrix-transformers'

export interface CalcSettingsItem {
  id: number
  name: string
  properties: Record<string, BitrixProperty>
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
