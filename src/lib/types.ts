import { Material, Work, Equipment, DetailVariant } from './mock-data'

export type HeaderTabType = 'materialsVariants' | 'operationsVariants' | 'equipment' | 'detailsVariants'

export interface HeaderElement {
  id: string
  type: HeaderTabType
  itemId: number
  name: string
  deleted?: number | string | boolean | null
}

export interface HeaderTabsState {
  materialsVariants: HeaderElement[]
  operationsVariants: HeaderElement[]
  equipment: HeaderElement[]
  detailsVariants: HeaderElement[]
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

export type CostingBasedOn = 'COMPONENT_PURCHASE' | 'COMPONENT_PURCHASE_PLUS_MARKUP' | 'COMPONENT_BASE'
export type RoundingStep = 0 | 0.1 | 1 | 10 | 100
export type CorrectionBase = 'RUN' | 'COST'
export type MarkupUnit = '%' | 'RUB'
export type PriceTypeCode = 'BASE_PRICE' | 'TRADE_PRICE'

export interface PriceRange {
  from: number
  markupValue: number
  markupUnit: MarkupUnit
  prettyPriceLimitRub: number
}

export interface PriceTypeSettings {
  correctionBase: CorrectionBase
  prettyPriceEnabled: boolean
  prettyPriceCommonLimitEnabled: boolean
  prettyPriceCommonLimitRub: number
  ranges: PriceRange[]
}

export interface CostingSettings {
  basedOn: CostingBasedOn
  roundingStep: RoundingStep
  markupValue?: number
  markupUnit?: MarkupUnit
}

export interface SalePricesSettings {
  selectedTypes: PriceTypeCode[]
  types: Partial<Record<PriceTypeCode, PriceTypeSettings>>
}

export interface AppState {
  selectedVariantIds: number[]
  testVariantId: number | null
  isEditingTestId: boolean
  headerTabs: HeaderTabsState
  details: Detail[]
  bindings: Binding[]
  infoMessages: InfoMessage[]
  isInfoPanelExpanded: boolean
  isCalculating: boolean
  calculationProgress: number
  calculationCurrentDetail: string | null
  isFullscreen: boolean
  costingSettings?: CostingSettings
  salePricesSettings?: SalePricesSettings
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

export const createEmptyBinding = (name: string = 'Новая группа скрепления'): Binding => ({
  id: `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name,
  isExpanded: true,
  calculators: [createEmptyCalculator()],
  detailIds: [],
  bindingIds: [],
  hasFinishing: false,
  finishingCalculators: [],
})
