import { create } from 'zustand'
import { BitrixProperty } from '@/lib/bitrix-transformers'

export interface MaterialItem {
  id: number
  name: string
  properties: Record<string, BitrixProperty>
}

interface MaterialSettingsState {
  materials: Record<string, MaterialItem>
  setMaterial: (materialId: string, item: MaterialItem) => void
  getMaterial: (materialId: string) => MaterialItem | undefined
}

export const useMaterialSettingsStore = create<MaterialSettingsState>((set, get) => ({
  materials: {},
  
  setMaterial: (materialId: string, item: MaterialItem) => {
    set((state) => ({
      materials: {
        ...state.materials,
        [materialId]: item,
      },
    }))
  },
  
  getMaterial: (materialId: string) => {
    return get().materials[materialId]
  },
}))
