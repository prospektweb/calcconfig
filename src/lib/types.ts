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
  properties?: Array<{
    ID: number
    CODE: string
    NAME: string
    PROPERTY_TYPE: string
    ENUMS?: Array<{
      ID: number
      VALUE: string
      XML_ID?: string
      SORT?: number
    }>
  }>
}

// Preset interface for the new data model
export interface Preset {
  id: number
  name: string
  properties: {
    CALC_STAGES?: number[]
    CALC_SETTINGS?: number[]
    CALC_MATERIALS?: number[]
    CALC_MATERIALS_VARIANTS?: number[]
    CALC_OPERATIONS?: number[]
    CALC_OPERATIONS_VARIANTS?: number[]
    CALC_EQUIPMENT?: number[]
    CALC_DETAILS?: number[]
    CALC_DETAILS_VARIANTS?: number[]
  }
  prices?: Array<{
    typeId: number
    price: number
    currency: string  // "RUB" or "PRC" (percent)
    quantityFrom: number | null
    quantityTo: number | null
  }>
  measure?: {
    code: string  // "796" = pieces, "999" = service
    name: string
  }
}

// Product interface - товар (similar to SelectedOffer but for product data)
export interface Product {
  id: number
  iblockId: number
  code: string | null
  productId: number | null
  name: string
  attributes: {
    width: number | null
    height: number | null
    length: number | null
    weight: number | null
  }
  measure: {
    code: string
    name: string
  } | null
  measureRatio: number | null
  purchasingPrice: number | null
  purchasingCurrency: string | null
  prices: Array<{
    typeId: number
    price: number
    currency: string
  }>
  properties: Record<string, BitrixPropertyValue>
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
    OPTIONS_OPERATION?: BitrixPropertyValue // JSON string with operation options mapping
    OPTIONS_MATERIAL?: BitrixPropertyValue // JSON string with material options mapping
    [key:  string]: BitrixPropertyValue | undefined
  }
}

export interface StageInstance {
  id: string
  stageId: number | null // ID из CALC_STAGES
  stageName?: string // NAME from CALC_STAGES element
  settingsId: number | null // ID из CALC_SETTINGS
  operationVariantId: number | null // из OPERATION_VARIANT
  operationQuantity: number // из OPERATION_QUANTITY
  equipmentId: number | null // из EQUIPMENT
  materialVariantId: number | null // из MATERIAL_VARIANT
  materialQuantity: number // из MATERIAL_QUANTITY
  customFields: Record<string, string> // из CUSTOM_FIELDS_VALUE (VALUE[i] → DESCRIPTION[i])
  optionsOperation?: string // JSON string from OPTIONS_OPERATION
  optionsMaterial?: string // JSON string from OPTIONS_MATERIAL
}

export interface Detail {
  id: string
  name: string
  width: number | null
  length: number | null
  isExpanded: boolean
  stages: StageInstance[]
  bitrixId: number | null
}

export interface Binding {
  id: string
  name: string
  isExpanded: boolean
  hasStages: boolean // true если есть CALC_STAGES
  stages: StageInstance[] // этапы скрепления
  detailIds: string[] // ID дочерних деталей (формат detail_${bitrixId})
  bindingIds: string[] // ID вложенных скреплений (формат binding_${bitrixId})
  childrenOrder: string[] // Unified order list combining detailIds and bindingIds
  bitrixId: number | null
}

export interface InfoMessage {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  timestamp: number
  // Extended fields for nested accordion structure
  level?: 'calculation' | 'offer' | 'detail' | 'stage' | 'root'
  parentId?: string
  offerId?: number
  detailId?: string
  stageId?: string
  // Calculation-specific data (when type is calculation report)
  calculationData?: {
    offerName?: string
    productId?: number
    productName?: string
    presetId?: number
    presetName?: string
    presetModified?: string
    detailName?: string
    detailType?: 'detail' | 'binding'
    stageName?: string
    purchasePrice?: number
    basePrice?: number
    directPurchasePrice?: number
    currency?: string
    priceRangesWithMarkup?: Array<{
      quantityFrom: number | null
      quantityTo: number | null
      prices: Array<{
        typeId: number
        typeName: string
        purchasePrice: number
        basePrice: number
        currency: string
      }>
    }>
    priceRangesWithMarkup?: Array<{
      quantityFrom: number | null
      quantityTo: number | null
      prices: Array<{
        typeId: number
        typeName: string
        purchasePrice: number
        basePrice: number
        currency: string
      }>
    }>
    children?: InfoMessage[]
  }
}

export type CorrectionBase = 'RUN' | 'COST'
export type MarkupUnit = '%' | 'RUB'
export type PriceTypeCode = 'BASE_PRICE' | 'TRADE_PRICE'

export interface PriceRange {
  from: number
  markupValue: number
  markupUnit: MarkupUnit
}

export interface PriceTypeSettings {
  correctionBase: CorrectionBase
  ranges: PriceRange[]
}

export interface SalePricesSettings {
  selectedTypes: PriceTypeCode[]
  types: Partial<Record<PriceTypeCode, PriceTypeSettings>>
}

export interface AppState {
  selectedVariantIds: number[]
  isEditingTestId: boolean
  details: Detail[]
  bindings: Binding[]
  infoMessages: InfoMessage[]
  isInfoPanelExpanded: boolean
  isCalculating: boolean
  calculationProgress: number
  calculationCurrentDetail: string | null
  isFullscreen: boolean
  salePricesSettings?: SalePricesSettings
  calculationResults?: any[] // Store calculation results
  hasSuccessfulCalculations?: boolean // Track if there are successful calculations
}

export const createEmptyStage = (): StageInstance => ({
  id: `stage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  stageId: null,
  settingsId: null,
  operationVariantId: null,
  operationQuantity: 1,
  equipmentId: null,
  materialVariantId: null,
  materialQuantity: 1,
  customFields: {},
})

export const createEmptyDetail = (name: string = 'Новая деталь', bitrixId: number | null = null): Detail => ({
  id: `detail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name,
  width: 210,
  length: 297,
  isExpanded: false,
  stages: [createEmptyStage()],
  bitrixId,
})

export const createEmptyBinding = (name: string = 'Новая группа скрепления'): Binding => ({
  id: `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  name,
  isExpanded: false,
  hasStages: false,
  stages: [],
  detailIds: [],
  bindingIds: [],
  childrenOrder: [],
  bitrixId: null,
})

// Интерфейс для инфоблока
export interface Iblock {
  id: number
  code: string
  type: string
  name: string
  parent: number | null
}
