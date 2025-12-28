export interface Material {
  id:  number
  name: string
  width: number | null
  length:  number | null
  height: number
  density?:  number
  price:  number
}

export interface Work {
  id:  number
  name:  string
  maxWidth: number | null
  maxLength:  number | null
  equipmentIds: number[]
  price: number
}

export type Operation = Work

export interface Equipment {
  id:  number
  name:  string
  fields: string
  maxWidth: number | null
  maxLength:  number | null
  startCost: number
}

export interface DetailVariant {
  id: number
  name: string
  width: number
  length: number
}

// Iblock interface for the new data model
export interface Iblock {
  id: number
  code: string
  type: string
  name: string
  parent:  number | null
}

// Preset interface for the new data model
export interface Preset {
  id: number
  name: string
  properties: {
    CALC_STAGES?:  number[]
    CALC_SETTINGS?: number[]
    CALC_MATERIALS?: number[]
    CALC_MATERIALS_VARIANTS?: number[]
    CALC_OPERATIONS?: number[]
    CALC_OPERATIONS_VARIANTS?: number[]
    CALC_EQUIPMENT?: number[]
    CALC_DETAILS?: number[]
    CALC_DETAILS_VARIANTS?: number[]
  }
}

// ElementsStore type for the new data model
// Keys are iblock codes (e.g., 'CALC_DETAILS', 'CALC_STAGES'), values are arrays of elements
export type ElementsStore = Record<string, ElementsStoreItem[]>

// Base interface for elements in ElementsStore
export interface ElementsStoreItem {
  id:  number
  iblockId: number
  code: string
  productId: number | null
  name: string
  fields: {
    width: number | null
    height: number | null
    length: number | null
    weight: number
  }
  measure: string | null
  measureRatio: number | null
  purchasingPrice: number | null
  purchasingCurrency: string | null
  prices: Array<{
    typeId: number
    price: number
    currency: string
    quantityFrom: number | null
    quantityTo: number | null
  }>
  properties: Record<string, BitrixPropertyValue>
}

// Bitrix property value structure
export interface BitrixPropertyValue {
  ID: string
  IBLOCK_ID: string
  NAME: string
  CODE: string
  PROPERTY_TYPE: string
  MULTIPLE:  string
  VALUE: string | string[] | boolean | null
  VALUE_XML_ID?:  string | null
  VALUE_ENUM?: string | null
  DESCRIPTION?: string | null
  PROPERTY_VALUE_ID?: string | string[] | boolean
  [key: string]: unknown
}

// Detail element from CALC_DETAILS in elementsStore
export interface CalcDetailElement extends ElementsStoreItem {
  properties: {
    TYPE: BitrixPropertyValue // VALUE_XML_ID:  'DETAIL' | 'BINDING'
    CALC_STAGES: BitrixPropertyValue // VALUE:  number[] - IDs of stages
    DETAILS?:  BitrixPropertyValue // VALUE: string[] - IDs of child details (for BINDING type)
    [key: string]: BitrixPropertyValue
  }
}

// Stage element from CALC_STAGES in elementsStore
export interface CalcStageElement extends ElementsStoreItem {
  properties: {
    PREV_STAGE?: BitrixPropertyValue
    NEXT_STAGE?: BitrixPropertyValue
    CALC_SETTINGS?: BitrixPropertyValue // ID of calculator settings
    OPERATION_VARIANT?: BitrixPropertyValue // ID from CALC_OPERATIONS_VARIANTS
    OPERATION_QUANTITY?: BitrixPropertyValue
    EQUIPMENT?:  BitrixPropertyValue
    MATERIAL_VARIANT?: BitrixPropertyValue // ID from CALC_MATERIALS_VARIANTS
    MATERIAL_QUANTITY?: BitrixPropertyValue
    CUSTOM_FIELDS_VALUE?: BitrixPropertyValue
    [key:  string]: BitrixPropertyValue | undefined
  }
}

export interface CalculatorInstance {
  id: string
  calculatorCode:  string | null
  operationId: number | null
  operationQuantity: number
  equipmentId: number | null
  materialId: number | null
  materialQuantity: number
  extraOptions: Record<string, any>
  configId?:  number
  stageId?: number // ID of the stage element in CALC_STAGES iblock
}

export interface Detail {
  id:  string
  name:  string
  width:  number
  length:  number
  isExpanded: boolean
  calculators: CalculatorInstance[]
  bitrixId?:  number | null
}

export interface Binding {
  id: string
  name: string
  isExpanded:  boolean
  calculators: CalculatorInstance[] // Stages of the binding itself (activated by "Считать скрепление" checkbox)
  detailIds: string[]
  bindingIds:  string[]
  bindingCalculators?:  CalculatorInstance[] // Legacy, may be removed
  bitrixId?: number | null
  calculateBinding?: boolean // Checkbox "Считать скрепление"
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
  markupUnit:  MarkupUnit
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
  types:  Partial<Record<PriceTypeCode, PriceTypeSettings>>
}

export interface AppState {
  selectedVariantIds: number[]
  testVariantId:  number | null
  isEditingTestId: boolean
  details: Detail[]
  bindings: Binding[]
  infoMessages: InfoMessage[]
  isInfoPanelExpanded:  boolean
  isCalculating: boolean
  calculationProgress: number
  calculationCurrentDetail: string | null
  isFullscreen: boolean
  costingSettings?: CostingSettings
  salePricesSettings?:  SalePricesSettings
}

export const createEmptyCalculator = (): CalculatorInstance => ({
  id: `calc_${Date. now()}_${Math.random().toString(36).substr(2, 9)}`,
  calculatorCode: null,
  operationId: null,
  operationQuantity: 1,
  equipmentId: null,
  materialId: null,
  materialQuantity: 1,
  extraOptions:  {},
})

export const createEmptyDetail = (name: string = 'Новая деталь', bitrixId: number | null = null): Detail => ({
  id: `detail_${Date. now()}_${Math.random().toString(36).substr(2, 9)}`,
  name,
  width: 210,
  length:  297,
  isExpanded: true,
  calculators: [createEmptyCalculator()],
  bitrixId,
})

export const createEmptyBinding = (name: string = 'Новая группа скрепления'): Binding => ({
  id: `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name,
  isExpanded: true,
  calculators:  [],
  detailIds: [],
  bindingIds: [],
  calculateBinding: false,
})
