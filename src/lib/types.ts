import { Material, Work, Equipment, DetailVariant } from './mock-data'

export type HeaderTabType = 'materials' | 'operations' | 'equipment' | 'details'

export interface HeaderElement {
  id: string
  type: HeaderTabType
  itemId: number
  name: string
}

export interface CalculatorInstance {
  id: string
  calculatorCode: string | null
  operationId: number | null
  operationQuantity: number
  equipmentId: number | null
  materialId: number | null
  materialQuantity: number
  extraOptions: Record<string, any>
}

export interface Detail {
  id: string
  name: string
  width: number
  length: number
  isExpanded: boolean
  calculators: CalculatorInstance[]
}

export interface Binding {
  id: string
  name: string
  isExpanded: boolean
  calculators: CalculatorInstance[]
  detailIds: string[]
  bindingIds: string[]
  hasFinishing: boolean
  finishingCalculators: CalculatorInstance[]
}

export interface InfoMessage {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  timestamp: number
}

export interface AppState {
  selectedVariantIds: number[]
  testVariantId: number | null
  isEditingTestId: boolean
  headerTabs: {
    materials: HeaderElement[]
    operations: HeaderElement[]
    equipment: HeaderElement[]
    details: HeaderElement[]
  }
  details: Detail[]
  bindings: Binding[]
  infoMessages: InfoMessage[]
  isInfoPanelExpanded: boolean
  isCalculating: boolean
  calculationProgress: number
  calculationCurrentDetail: string | null
  isFullscreen: boolean
}

export const createEmptyCalculator = (): CalculatorInstance => ({
  id: `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  calculatorCode: null,
  operationId: null,
  operationQuantity: 1,
  equipmentId: null,
  materialId: null,
  materialQuantity: 1,
  extraOptions: {},
})

export const createEmptyDetail = (name: string = 'Новая деталь'): Detail => ({
  id: `detail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name,
  width: 210,
  length: 297,
  isExpanded: true,
  calculators: [createEmptyCalculator()],
})

export const createEmptyBinding = (): Binding => ({
  id: `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Группа скрепления',
  isExpanded: true,
  calculators: [createEmptyCalculator()],
  detailIds: [],
  bindingIds: [],
  hasFinishing: false,
  finishingCalculators: [],
})
