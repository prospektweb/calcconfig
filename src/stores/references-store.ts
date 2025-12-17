import { create } from 'zustand'
import { MultiLevelItem } from '@/components/calculator/MultiLevelSelect'

interface ReferencesState {
  calculatorsHierarchy: MultiLevelItem[]
  equipmentHierarchy: MultiLevelItem[]
  operationsHierarchy: MultiLevelItem[]
  materialsHierarchy: MultiLevelItem[]
  
  isLoaded: boolean
  
  setCalculatorsHierarchy: (items: MultiLevelItem[]) => void
  setEquipmentHierarchy: (items: MultiLevelItem[]) => void
  setOperationsHierarchy: (items: MultiLevelItem[]) => void
  setMaterialsHierarchy: (items: MultiLevelItem[]) => void
  setLoaded: (loaded: boolean) => void
}

export const useReferencesStore = create<ReferencesState>((set) => ({
  calculatorsHierarchy: [],
  equipmentHierarchy: [],
  operationsHierarchy: [],
  materialsHierarchy: [],
  
  isLoaded: false,
  
  setCalculatorsHierarchy: (items) => set({ calculatorsHierarchy: items }),
  setEquipmentHierarchy: (items) => set({ equipmentHierarchy: items }),
  setOperationsHierarchy: (items) => set({ operationsHierarchy: items }),
  setMaterialsHierarchy: (items) => set({ materialsHierarchy: items }),
  setLoaded: (loaded) => set({ isLoaded: loaded }),
}))
