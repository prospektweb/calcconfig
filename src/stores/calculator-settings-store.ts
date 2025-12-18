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
    console.log('[CalcSettingsStore][DEBUG] setSettings called', {
      calculatorCode,
      itemId: item.id,
      itemName: item.name,
      propertiesCount: item.properties ? Object.keys(item.properties).length : 0,
    })

    set((state) => {
      const newSettings = {
        ...state.settings,
        [calculatorCode]: item,
      }
      console.log('[CalcSettingsStore][DEBUG] New state', {
        keys: Object.keys(newSettings),
        totalCount: Object.keys(newSettings).length,
      })
      return { settings: newSettings }
    })
  },
  
  getSettings: (calculatorCode: string) => {
    const result = get().settings[calculatorCode]
    console.log('[CalcSettingsStore][DEBUG] getSettings called', {
      calculatorCode,
      found: !!result,
      resultId: result?.id,
    })
    return result
  },
  
  clearSettings: (calculatorCode: string) => {
    console.log('[CalcSettingsStore][DEBUG] clearSettings called', { calculatorCode })
    set((state) => {
      const newSettings = { ...state.settings }
      delete newSettings[calculatorCode]
      return { settings: newSettings }
    })
  },
}))
