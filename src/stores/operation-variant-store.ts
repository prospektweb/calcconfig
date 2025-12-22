import { create } from 'zustand'
import { BitrixProperty } from '@/lib/bitrix-transformers'

export interface OperationVariantItem {
  id: number
  name: string
  properties: Record<string, BitrixProperty>
  measure?: {
    symbol: string
    id?: number
    name?: string
  }
}

interface OperationVariantState {
  variants: Record<string, OperationVariantItem>
  setVariant: (operationId: string, item: OperationVariantItem) => void
  getVariant: (operationId: string) => OperationVariantItem | undefined
}

export const useOperationVariantStore = create<OperationVariantState>((set, get) => ({
  variants: {},
  
  setVariant: (operationId: string, item: OperationVariantItem) => {
    set((state) => ({
      variants: {
        ...state.variants,
        [operationId]: item,
      },
    }))
  },
  
  getVariant: (operationId: string) => {
    return get().variants[operationId]
  },
}))
