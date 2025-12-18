import { create } from 'zustand'
import { BitrixProperty } from '@/lib/bitrix-transformers'

export interface MaterialVariantItem {
  id: number
  name: string
  properties: Record<string, BitrixProperty>
}

interface MaterialVariantState {
  variants: Record<string, MaterialVariantItem>
  setVariant: (materialId: string, item: MaterialVariantItem) => void
  getVariant: (materialId: string) => MaterialVariantItem | undefined
}

export const useMaterialVariantStore = create<MaterialVariantState>((set, get) => ({
  variants: {},
  
  setVariant: (materialId: string, item: MaterialVariantItem) => {
    set((state) => ({
      variants: {
        ...state.variants,
        [materialId]: item,
      },
    }))
  },
  
  getVariant: (materialId: string) => {
    return get().variants[materialId]
  },
}))
