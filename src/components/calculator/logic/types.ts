export type ValueType = 'number' | 'string' | 'bool' | 'array' | 'any' | 'unknown'

export interface InputParam {
  id: string
  name: string
  sourcePath: string
  sourceKind?: 'context' | 'literal'
  literalValue?: string
  sourceType: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'
  valueType?: ValueType
  typeSource?: 'auto' | 'manual'
  autoTypeReason?: string
}

export interface FormulaVar {
  id: string
  name: string
  formula: string
  error?: string | null
  inferredType?: ValueType
}

/**
 * @deprecated Legacy type - use ResultsHL and WritePlan instead
 */
export interface StageOutputs {
  costVar?: string  // переменная для себестоимости этапа
  weightVar?: string  // переменная для веса
  widthVar?: string
  heightVar?: string
  depthVar?: string
}

/**
 * @deprecated Legacy type - use WritePlanItem instead
 */
export interface OfferPlanItem {
  id: string
  // Old fields (for backward compatibility):
  field?: 'PRICE' | 'WEIGHT' | 'DIM_W' | 'DIM_H' | 'DIM_D'
  varName: string
  // New fields:
  targetPath?: string  // e.g.: offer.properties.COLOR.VALUE_XML_ID
  sourceType?: 'var' | 'input' | 'const'  // where value comes from
  constValue?: string | number  // if sourceType === 'const'
}

// HL mapping для обязательных полей этапа
export interface HLMapping {
  sourceKind: 'var' | 'input' | null
  sourceRef: string  // имя переменной или input
}

export interface ResultsHL {
  width: HLMapping
  length: HLMapping
  height: HLMapping
  weight: HLMapping
  purchasingPrice: HLMapping
  basePrice: HLMapping
  operationPurchasingPrice?: HLMapping
  operationBasePrice?: HLMapping
  materialPurchasingPrice?: HLMapping
  materialBasePrice?: HLMapping
}

// Правило записи в ТП
export interface WritePlanItem {
  id: string
  targetPath: string  // offer.name | offer.code | offer.properties.COLOR.VALUE | etc
  sourceKind: 'var' | 'input'
  sourceRef: string
  expectedType: 'string' | 'number' | 'bool'
}

// Дополнительный результат этапа
export interface AdditionalResult {
  id: string
  title: string  // пользовательское название
  key: string    // slug(title) — автогенерируется
  sourceKind: 'var' | 'input'
  sourceRef: string
}

export interface ParametrValuesSchemeEntry {
  id: string
  name: string
  template: string
}

export interface StageLogic {
  version: 1
  stageIndex: number
  inputs: InputParam[]
  vars: FormulaVar[]
  outputs: StageOutputs  // deprecated, но оставить для обратной совместимости
  offerPlan: OfferPlanItem[]  // deprecated
  // НОВЫЕ поля:
  resultsHL?: ResultsHL
  writePlan?: WritePlanItem[]  // deprecated - для обратной совместимости при парсинге
  additionalResults?: AdditionalResult[]
  parametrValuesScheme?: ParametrValuesSchemeEntry[]
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  scope: 'input' | 'var' | 'result' | 'global'
  refId?: string
  message: string
  hint?: string
}

export const ALLOWED_FUNCTIONS = [
  'if', 'round', 'ceil', 'floor', 'min', 'max', 'abs',
  'trim', 'lower', 'upper', 'len', 'contains', 'replace',
  'toNumber', 'toString',
  'split', 'join', 'get',
  'regexMatch', 'regexExtract',
  'getPrice'
] as const
