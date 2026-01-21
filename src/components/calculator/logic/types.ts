export type ValueType = 'number' | 'string' | 'bool' | 'any' | 'unknown'

export interface InputParam {
  id: string
  name: string
  sourcePath: string
  sourceType: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'
  valueType?: ValueType
}

export interface FormulaVar {
  id: string
  name: string
  formula: string
  error?: string | null
  inferredType?: ValueType
}

export interface StageOutputs {
  costVar?: string  // переменная для себестоимости этапа
  weightVar?: string  // переменная для веса
  widthVar?: string
  heightVar?: string
  depthVar?: string
}

export interface OfferPlanItem {
  id: string
  field: 'PRICE' | 'WEIGHT' | 'DIM_W' | 'DIM_H' | 'DIM_D'
  varName: string
}

export interface StageLogic {
  version: 1
  stageIndex: number
  inputs: InputParam[]
  vars: FormulaVar[]
  outputs: StageOutputs
  offerPlan: OfferPlanItem[]
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  scope: 'input' | 'var' | 'result'
  refId: string
  message: string
  hint?: string
}

export const ALLOWED_FUNCTIONS = [
  'if', 'round', 'ceil', 'floor', 'min', 'max', 'abs',
  'trim', 'lower', 'upper', 'len', 'contains', 'replace',
  'toNumber', 'toString',
  'split', 'join', 'get',
  'regexMatch', 'regexExtract'
] as const
