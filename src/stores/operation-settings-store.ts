import { create } from 'zustand'
import { BitrixProperty } from '@/lib/bitrix-transformers'

export interface OperationItem {
  id: number
  name: string
  properties: Record<string, BitrixProperty>
  itemParent?: {
    id: number
    name: string
    properties: Record<string, BitrixProperty>
  }
}

interface OperationSettingsState {
  operations: Record<string, OperationItem>
  setOperation: (operationId: string, item: OperationItem) => void
  getOperation: (operationId: string) => OperationItem | undefined
}

export const useOperationSettingsStore = create<OperationSettingsState>((set, get) => ({
  operations: {},
  
  setOperation: (operationId: string, item: OperationItem) => {
    set((state) => ({
      operations: {
        ...state.operations,
        [operationId]: item,
      },
    }))
  },
  
  getOperation: (operationId: string) => {
    return get().operations[operationId]
  },
}))
