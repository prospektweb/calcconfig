/**
 * Calculation Logic Processor
 * 
 * Extracts and processes calculation logic from CALC_SETTINGS and CALC_STAGES
 * to support dynamic formula-based calculations.
 */

import { extractLogicJsonString } from '@/lib/stage-utils'
import type { ElementsStoreItem, BitrixPropertyValue, CalculationStageLogEntry } from '@/lib/types'

/**
 * Interface for a variable definition from LOGIC_JSON
 */
export interface LogicVar {
  name: string
  formula?: string
  value?: any
  type?: string
}

/**
 * Interface for parsed LOGIC_JSON structure
 */
export interface LogicDefinition {
  vars?: LogicVar[]
  inputs?: string[]
  outputs?: string[]
  [key: string]: any
}

/**
 * Interface for input parameter from CALC_SETTINGS.PARAMS
 */
export interface InputParam {
  name: string
  type: string
  sourcePath?: string
}

/**
 * Interface for input wiring from CALC_STAGES.INPUTS
 */
export interface InputWiring {
  paramName: string
  sourcePath: string
}

/**
 * Interface for output mapping from CALC_STAGES.OUTPUTS
 */
export interface OutputMapping {
  key: string // e.g., "width", "purchasingPrice", or custom "slug|title"
  sourceRef: string // variable name to map from
}

/**
 * Extract PARAMS definitions from CALC_SETTINGS element
 */
export function extractParams(settingsElement: ElementsStoreItem | null | undefined): InputParam[] {
  if (!settingsElement?.properties?.PARAMS) {
    return []
  }

  const paramsValue = settingsElement.properties.PARAMS.VALUE
  const paramsDesc = (settingsElement.properties.PARAMS as any).DESCRIPTION

  if (!Array.isArray(paramsValue)) {
    return []
  }

  return paramsValue.map((name, i) => ({
    name: String(name),
    type: Array.isArray(paramsDesc) ? String(paramsDesc[i] || 'unknown') : 'unknown',
  }))
}

/**
 * Extract INPUTS wiring from CALC_STAGES element
 */
export function extractInputs(stageElement: ElementsStoreItem | null | undefined): InputWiring[] {
  if (!stageElement?.properties?.INPUTS) {
    return []
  }

  const inputsValue = stageElement.properties.INPUTS.VALUE
  const inputsDesc = (stageElement.properties.INPUTS as any).DESCRIPTION

  if (!Array.isArray(inputsValue)) {
    return []
  }

  const missingDescriptions = Array.isArray(inputsDesc)
    ? inputsValue.filter((_, i) => !String(inputsDesc[i] || '').trim()).length
    : inputsValue.length

  if (missingDescriptions > 0) {
    console.warn(
      '[CALC] INPUTS wiring has missing DESCRIPTION entries for',
      missingDescriptions,
      'input(s). INPUTS.VALUE length:',
      inputsValue.length,
      'DESCRIPTION length:',
      Array.isArray(inputsDesc) ? inputsDesc.length : 0
    )
  }

  return inputsValue.map((paramName, i) => ({
    paramName: String(paramName),
    sourcePath: Array.isArray(inputsDesc) ? String(inputsDesc[i] || '') : '',
  }))
}

/**
 * Extract and parse LOGIC_JSON from CALC_SETTINGS element
 */
export function extractLogicDefinition(settingsElement: ElementsStoreItem | null | undefined): LogicDefinition | null {
  if (!settingsElement?.properties?.LOGIC_JSON) {
    return null
  }

  const logicJsonRaw = extractLogicJsonString(settingsElement.properties.LOGIC_JSON as any)
  
  if (!logicJsonRaw) {
    return null
  }

  try {
    const parsed = JSON.parse(logicJsonRaw)
    return parsed
  } catch (e) {
    console.warn('[CALC] Failed to parse LOGIC_JSON:', e)
    return null
  }
}

/**
 * Extract OUTPUTS mapping from CALC_STAGES element
 */
export function extractOutputs(stageElement: ElementsStoreItem | null | undefined): OutputMapping[] {
  if (!stageElement?.properties?.OUTPUTS) {
    return []
  }

  const outputsValue = stageElement.properties.OUTPUTS.VALUE
  const outputsDesc = (stageElement.properties.OUTPUTS as any).DESCRIPTION

  if (!Array.isArray(outputsValue)) {
    return []
  }

  return outputsValue.map((key, i) => ({
    key: String(key),
    sourceRef: Array.isArray(outputsDesc) ? String(outputsDesc[i] || '') : '',
  }))
}

/**
 * Get value from object using dot-notation path
 * e.g., "product.attributes.width" -> obj.product.attributes.width
 * Supports array index notation like "CALC_STAGES[0].properties"
 */
const decodeHtmlEntities = (value: string): string => {
  if (!/[&](quot|#34|amp|lt|gt);/.test(value)) {
    return value
  }
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

type OptionsMapping = {
  propertyCodes: string[]
  mappings: Array<{
    values?: Record<string, {
      value?: string
      xmlId?: string
    }>
    value?: string
    xmlId?: string
    variantId?: number | string
  }>
}

const extractOptionsMapping = (
  stageElement: ElementsStoreItem | null | undefined,
  type: 'operation' | 'material'
): OptionsMapping | null => {
  const property = type === 'operation'
    ? stageElement?.properties?.OPTIONS_OPERATION
    : stageElement?.properties?.OPTIONS_MATERIAL

  if (!property) return null

  const rawValue = property['~VALUE']
  const rawTextValue = typeof rawValue === 'object' && rawValue !== null ? rawValue.TEXT : rawValue
  const fallbackValue = property.VALUE
  const textFallback = typeof fallbackValue === 'object' && fallbackValue !== null ? fallbackValue.TEXT : fallbackValue
  const valueToParse = typeof rawTextValue === 'string'
    ? rawTextValue
    : typeof textFallback === 'string'
      ? textFallback
      : null

  if (!valueToParse) return null

  try {
    const decoded = decodeHtmlEntities(valueToParse)
    const parsed = JSON.parse(decoded)
    const propertyCodes = Array.isArray(parsed?.propertyCodes)
      ? parsed.propertyCodes.map((item: any) => String(item))
      : parsed?.propertyCode
        ? [String(parsed.propertyCode)]
        : []

    if (propertyCodes.length === 0 || !Array.isArray(parsed?.mappings)) {
      return null
    }
    return {
      propertyCodes,
      mappings: parsed.mappings,
    }
  } catch (error) {
    console.warn('[CALC] Failed to parse options mapping JSON:', error)
    return null
  }
}

const getOfferPropertyMatchValues = (
  offerProperties: Record<string, any> | undefined,
  optionsMapping: OptionsMapping
): Record<string, { value: string | null; xmlId: string | null }> => {
  const normalizeValue = (val: any): string | null => {
    if (val === null || val === undefined || val === false) return null
    if (Array.isArray(val)) {
      const first = val.find((entry) => entry !== null && entry !== undefined && entry !== false)
      return first !== undefined ? String(first) : null
    }
    return String(val)
  }

  return optionsMapping.propertyCodes.reduce((acc, propertyCode) => {
    if (!offerProperties) {
      acc[propertyCode] = { value: null, xmlId: null }
      return acc
    }

    const offerProp = offerProperties[propertyCode]
    if (!offerProp) {
      acc[propertyCode] = { value: null, xmlId: null }
      return acc
    }

    const rawValue = offerProp['~VALUE'] ?? offerProp.VALUE ?? offerProp.value ?? null
    const rawXmlId = offerProp.VALUE_XML_ID ?? offerProp.XML_ID ?? offerProp.valueXmlId ?? null

    acc[propertyCode] = {
      value: normalizeValue(rawValue),
      xmlId: normalizeValue(rawXmlId),
    }

    return acc
  }, {} as Record<string, { value: string | null; xmlId: string | null }>)
}

const resolveVariantForStageAlias = (
  initPayload: any,
  currentStageId: number,
  targetStageId: number,
  type: 'operation' | 'material'
): any | null => {
  const currentStageElement = initPayload?.elementsStore?.CALC_STAGES?.find(
    (stage: any) => stage.id === currentStageId
  )
  const targetStageElement = initPayload?.elementsStore?.CALC_STAGES?.find(
    (stage: any) => stage.id === targetStageId
  )

  const optionsMapping = extractOptionsMapping(currentStageElement, type)
  let variantId: number | null = null

  if (optionsMapping) {
    const offerProperties =
      initPayload?.offer?.properties ?? initPayload?.selectedOffers?.[0]?.properties
    const offerMatchValues = getOfferPropertyMatchValues(offerProperties, optionsMapping)

    const mappingMatch = optionsMapping.mappings.find((mapping) => {
      const hasStructuredValues = Boolean(mapping?.values && typeof mapping.values === 'object')

      if (!hasStructuredValues && optionsMapping.propertyCodes.length === 1) {
        const legacyCode = optionsMapping.propertyCodes[0]
        const offerMatch = offerMatchValues[legacyCode]
        const mappingValue = mapping?.value ? String(mapping.value) : null
        const mappingXmlId = mapping?.xmlId ? String(mapping.xmlId) : null
        if (offerMatch?.xmlId && mappingXmlId && offerMatch.xmlId === mappingXmlId) return true
        if (offerMatch?.value && mappingValue && offerMatch.value === mappingValue) return true
        if (offerMatch?.value && mappingXmlId && offerMatch.value === mappingXmlId) return true
        return false
      }

      return optionsMapping.propertyCodes.every((propertyCode) => {
        const offerMatch = offerMatchValues[propertyCode]
        const mappingValue = mapping?.values?.[propertyCode]?.value
          ? String(mapping.values[propertyCode].value)
          : null
        const mappingXmlId = mapping?.values?.[propertyCode]?.xmlId
          ? String(mapping.values[propertyCode].xmlId)
          : null

        if (offerMatch?.xmlId && mappingXmlId && offerMatch.xmlId === mappingXmlId) return true
        if (offerMatch?.value && mappingValue && offerMatch.value === mappingValue) return true
        if (offerMatch?.value && mappingXmlId && offerMatch.value === mappingXmlId) return true
        return false
      })
    })

    if (mappingMatch?.variantId !== undefined && mappingMatch?.variantId !== null) {
      const parsedVariantId = Number(mappingMatch.variantId)
      variantId = Number.isNaN(parsedVariantId) ? null : parsedVariantId
    }
  }

  if (!variantId) {
    const fallbackStageElement = targetStageElement || currentStageElement
    if (fallbackStageElement?.properties) {
      const fallbackValue = type === 'operation'
        ? fallbackStageElement.properties?.OPERATION_VARIANT?.VALUE
        : fallbackStageElement.properties?.MATERIAL_VARIANT?.VALUE
      const parsedFallback = Number(fallbackValue)
      variantId = Number.isNaN(parsedFallback) ? null : parsedFallback
    }
  }

  if (!variantId) return null

  const elementsSiblings = initPayload?.elementsSiblings
    ?? initPayload?.elementsStore?.CALC_STAGES_SIBLINGS
    ?? []
  const stageSiblings = Array.isArray(elementsSiblings)
    ? elementsSiblings.find((item: any) => Number(item.stageId) === Number(targetStageId))
    : null

  const variantsList = type === 'operation'
    ? stageSiblings?.CALC_OPERATIONS_VARIANTS
    : stageSiblings?.CALC_MATERIALS_VARIANTS

  if (Array.isArray(variantsList)) {
    const match = variantsList.find((variant: any) => Number(variant.id) === Number(variantId))
    if (match) return match
  }

  const storeList = type === 'operation'
    ? initPayload?.elementsStore?.CALC_OPERATIONS_VARIANTS
    : initPayload?.elementsStore?.CALC_MATERIALS_VARIANTS

  if (Array.isArray(storeList)) {
    return storeList.find((variant: any) => Number(variant.id) === Number(variantId)) ?? null
  }

  return null
}

export function getValueByPath(obj: any, path: string): any {
  if (!path || !obj) return undefined

  const parts: Array<string | number> = []
  const matcher = /([^[.\]]+)|\[(\d+)\]/g

  for (const match of path.matchAll(matcher)) {
    if (match[1]) {
      parts.push(match[1])
    } else if (match[2]) {
      parts.push(Number(match[2]))
    }
  }

  let current = obj

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]
    if (current === null || current === undefined) {
      return undefined
    }

    if (
      part === 'OUTPUTS' &&
      typeof current === 'object' &&
      Array.isArray((current as any).OUTPUTS_RUNTIME) &&
      typeof parts[index + 1] === 'number'
    ) {
      current = (current as any).OUTPUTS_RUNTIME
      continue
    }

    current = current[part]
  }

  return current
}

/**
 * Build calculation context from initPayload and input wirings
 */
export function buildCalculationContext(
  initPayload: any,
  inputWirings: InputWiring[],
  currentStageId: number
): Record<string, any> {
  const getRuntimePrevStageValue = (sourcePath: string): any | undefined => {
    if (!sourcePath) return undefined

    const stageMatch = sourcePath.match(/elementsStore\.CALC_STAGES\[(\d+)\]/)
    if (!stageMatch) return undefined

    const outputMatch = sourcePath.match(/OUTPUTS\.(?:VALUE|DESCRIPTION)\[(\d+)\]/)
    if (!outputMatch) return undefined

    const stageIndex = Number(stageMatch[1])
    const outputIndex = Number(outputMatch[1])
    const runtimeOutputs = initPayload?.elementsStore?.CALC_STAGES?.[stageIndex]?.properties?.OUTPUTS_RUNTIME
    if (!Array.isArray(runtimeOutputs)) return undefined

    return runtimeOutputs[outputIndex]?.VALUE
  }

  const context: Record<string, any> = {
    // Add the entire initPayload for deep access
    ...initPayload,
    CURRENT_STAGE: currentStageId,
  }

  // Wire inputs from initPayload to context based on INPUTS mappings
  for (const wiring of inputWirings) {
    if (wiring.sourcePath) {
      const stageAliasMatch = wiring.sourcePath.match(
        /^stage_(\d+)\.(operationVariant|materialVariant)(?:\.(.+))?$/
      )
      if (stageAliasMatch) {
        const targetStageId = Number(stageAliasMatch[1])
        const aliasType = stageAliasMatch[2] === 'operationVariant' ? 'operation' : 'material'
        const aliasRemainder = stageAliasMatch[3]
        const variant = resolveVariantForStageAlias(
          initPayload,
          currentStageId,
          targetStageId,
          aliasType
        )
        const aliasValue = aliasRemainder
          ? getValueByPath(variant, aliasRemainder)
          : variant
        context[wiring.paramName] = aliasValue
        console.log('[CALC] Wired input:', wiring.paramName, '=', aliasValue, 'from', wiring.sourcePath)
        continue
      }

      const runtimeValue = getRuntimePrevStageValue(wiring.sourcePath)
      const value = runtimeValue !== undefined
        ? runtimeValue
        : getValueByPath(initPayload, wiring.sourcePath)
      context[wiring.paramName] = value
      console.log('[CALC] Wired input:', wiring.paramName, '=', value, 'from', wiring.sourcePath)
    }
  }

  console.log('[CALC] Built context with', Object.keys(context).length, 'keys')
  return context
}

type FormulaTokenType = 'number' | 'string' | 'identifier' | 'operator' | 'paren' | 'comma'

interface FormulaToken {
  type: FormulaTokenType
  value: string
}

type FormulaAstNode =
  | { type: 'Literal'; value: number | string | boolean | null }
  | { type: 'Identifier'; name: string }
  | { type: 'UnaryExpression'; operator: string; argument: FormulaAstNode }
  | { type: 'BinaryExpression'; operator: string; left: FormulaAstNode; right: FormulaAstNode }
  | { type: 'CallExpression'; callee: string; args: FormulaAstNode[] }

const FORMULA_OPERATORS = new Set(['+', '-', '*', '/', '%', '>', '<', '>=', '<=', '==', '!=', '&&', '||'])
const FORMULA_BUILTINS = {
  get: (value: any, path: any) => {
    if (typeof path === 'number') {
      if (value === null || value === undefined) return undefined
      return value[path]
    }
    if (typeof path !== 'string') return undefined
    if (path === '') return value
    if (Array.isArray(value) && /^\d+$/.test(path)) {
      return value[Number(path)]
    }
    return getValueByPath(value, path)
  },
  split: (value: any, delimiter?: any) =>
    typeof value === 'string' ? value.split(delimiter === undefined ? /\s+/ : String(delimiter)) : [],
  ceil: (value: any) => Math.ceil(Number(value)),
  floor: (value: any) => Math.floor(Number(value)),
  max: (...values: any[]) => {
    const flattened = values.length === 1 && Array.isArray(values[0]) ? values[0] : values
    return Math.max(...flattened.map((entry) => Number(entry)))
  },
  min: (...values: any[]) => {
    const flattened = values.length === 1 && Array.isArray(values[0]) ? values[0] : values
    return Math.min(...flattened.map((entry) => Number(entry)))
  },
  abs: (value: any) => Math.abs(Number(value)),
  trim: (value: any) => (value === null || value === undefined ? '' : String(value).trim()),
  lower: (value: any) => (value === null || value === undefined ? '' : String(value).toLowerCase()),
  round: (value: any) => Math.round(Number(value)),
  if: (condition: any, whenTrue: any, whenFalse: any) => (condition ? whenTrue : whenFalse),
  upper: (value: any) => (value === null || value === undefined ? '' : String(value).toUpperCase()),
  len: (value: any) => {
    if (typeof value === 'string' || Array.isArray(value)) return value.length
    if (value && typeof value === 'object') return Object.keys(value).length
    return 0
  },
  contains: (value: any, search: any) => {
    if (typeof value === 'string') return value.includes(String(search))
    if (Array.isArray(value)) return value.includes(search)
    return false
  },
  replace: (value: any, search: any, replacement: any, flags?: any) => {
    if (value === null || value === undefined) return ''
    const source = String(value)
    if (flags !== undefined) {
      return source.replace(new RegExp(String(search), String(flags)), String(replacement))
    }
    if (search instanceof RegExp) {
      return source.replace(search, String(replacement))
    }
    return source.replace(String(search), String(replacement))
  },
  toNumber: (value: any) => Number(value),
  toString: (value: any) => (value === null || value === undefined ? '' : String(value)),
  join: (value: any, delimiter?: any) =>
    Array.isArray(value) ? value.join(delimiter === undefined ? '' : String(delimiter)) : '',
  regexMatch: (value: any, pattern: any, flags?: any) => {
    const regex = new RegExp(String(pattern), flags === undefined ? undefined : String(flags))
    return regex.test(String(value))
  },
  regexExtract: (value: any, pattern: any, flags?: any) => {
    const regex = new RegExp(String(pattern), flags === undefined ? undefined : String(flags))
    const match = String(value).match(regex)
    if (!match) return ''
    return match.length > 1 ? match[1] : match[0]
  },
  getPrice: (quantity: any, prices: any, exact?: any) => {
    const numericQuantity = Number(quantity)
    if (!Array.isArray(prices) || !Number.isFinite(numericQuantity)) {
      return undefined
    }

    const sortedRanges = [...prices].sort((a, b) => {
      const fromA = Number(a?.quantityFrom ?? 0)
      const fromB = Number(b?.quantityFrom ?? 0)
      return fromA - fromB
    })

    if (exact === true) {
      for (const range of sortedRanges) {
        const fromRaw = range?.quantityFrom
        const toRaw = range?.quantityTo
        const from =
          fromRaw === null || fromRaw === undefined ? null : Number(fromRaw)
        const to = toRaw === null || toRaw === undefined ? null : Number(toRaw)
        if (
          (from !== null && !Number.isFinite(from)) ||
          (to !== null && !Number.isFinite(to))
        ) {
          continue
        }
        if (
          (from === null || numericQuantity >= from) &&
          (to === null || numericQuantity <= to)
        ) {
          return Number(range?.price ?? 0)
        }
      }
      return undefined
    }

    if (numericQuantity === 0) {
      return 0
    }

    let bestPrice: number | undefined
    let bestTotal = Infinity
    let bestBilledQty = Infinity

    for (const range of sortedRanges) {
      const price = Number(range?.price ?? 0)
      const fromRaw = range?.quantityFrom
      const toRaw = range?.quantityTo
      const from =
        fromRaw === null || fromRaw === undefined ? 1 : Number(fromRaw)
      const to = toRaw === null || toRaw === undefined ? Infinity : Number(toRaw)
      if (!Number.isFinite(price) || !Number.isFinite(from) || (to !== Infinity && !Number.isFinite(to))) {
        continue
      }
      if (numericQuantity > to) {
        continue
      }
      const billedQty = Math.max(numericQuantity, from)
      const total = billedQty * price
      if (
        total < bestTotal ||
        (total === bestTotal &&
          (price < (bestPrice ?? Infinity) ||
            (price === (bestPrice ?? Infinity) && billedQty < bestBilledQty)))
      ) {
        bestTotal = total
        bestPrice = price
        bestBilledQty = billedQty
      }
    }

    return bestPrice
  },
}

function tokenizeFormula(formula: string): FormulaToken[] {
  const tokens: FormulaToken[] = []
  let index = 0

  const isDigit = (char: string) => char >= '0' && char <= '9'
  const isIdentifierStart = (char: string) => /[A-Za-z_]/.test(char)
  const isIdentifierPart = (char: string) => /[A-Za-z0-9_]/.test(char)

  while (index < formula.length) {
    const char = formula[index]

    if (/\s/.test(char)) {
      index++
      continue
    }

    if (char === '"' || char === "'") {
      const quote = char
      let value = ''
      index++
      while (index < formula.length) {
        const current = formula[index]
        if (current === '\\') {
          const next = formula[index + 1]
          if (next !== undefined) {
            value += next
            index += 2
            continue
          }
        }
        if (current === quote) {
          index++
          break
        }
        value += current
        index++
      }
      tokens.push({ type: 'string', value })
      continue
    }

    if (isDigit(char) || (char === '.' && isDigit(formula[index + 1] || ''))) {
      let value = ''
      let dotCount = 0
      while (index < formula.length) {
        const current = formula[index]
        if (current === '.') {
          dotCount += 1
          if (dotCount > 1) break
          value += current
          index++
          continue
        }
        if (!isDigit(current)) break
        value += current
        index++
      }
      tokens.push({ type: 'number', value })
      continue
    }

    if (isIdentifierStart(char)) {
      let value = ''
      while (index < formula.length && isIdentifierPart(formula[index])) {
        value += formula[index]
        index++
      }
      const lowerValue = value.toLowerCase()
      if (lowerValue === 'and') {
        tokens.push({ type: 'operator', value: '&&' })
      } else if (lowerValue === 'or') {
        tokens.push({ type: 'operator', value: '||' })
      } else if (lowerValue === 'not') {
        tokens.push({ type: 'operator', value: '!' })
      } else {
        tokens.push({ type: 'identifier', value })
      }
      continue
    }

    const twoCharOperator = formula.slice(index, index + 2)
    if (['>=', '<=', '==', '!=', '&&', '||'].includes(twoCharOperator)) {
      tokens.push({ type: 'operator', value: twoCharOperator })
      index += 2
      continue
    }

    if (['+', '-', '*', '/', '%', '>', '<', '!'].includes(char)) {
      tokens.push({ type: 'operator', value: char })
      index++
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char })
      index++
      continue
    }

    if (char === ',') {
      tokens.push({ type: 'comma', value: char })
      index++
      continue
    }

    throw new Error(`Unsupported character: ${char}`)
  }

  return tokens
}

class FormulaParser {
  private tokens: FormulaToken[]
  private position = 0

  constructor(tokens: FormulaToken[]) {
    this.tokens = tokens
  }

  parse(): FormulaAstNode {
    const expression = this.parseOr()
    if (this.position < this.tokens.length) {
      throw new Error('Unexpected token after end of expression')
    }
    return expression
  }

  private peek(): FormulaToken | undefined {
    return this.tokens[this.position]
  }

  private consume(): FormulaToken {
    const token = this.tokens[this.position]
    if (!token) {
      throw new Error('Unexpected end of expression')
    }
    this.position += 1
    return token
  }

  private matchOperator(...operators: string[]): string | null {
    const token = this.peek()
    if (token?.type === 'operator' && operators.includes(token.value)) {
      this.position += 1
      return token.value
    }
    return null
  }

  private parseOr(): FormulaAstNode {
    let left = this.parseAnd()
    let operator = this.matchOperator('||')
    while (operator) {
      const right = this.parseAnd()
      left = { type: 'BinaryExpression', operator, left, right }
      operator = this.matchOperator('||')
    }
    return left
  }

  private parseAnd(): FormulaAstNode {
    let left = this.parseEquality()
    let operator = this.matchOperator('&&')
    while (operator) {
      const right = this.parseEquality()
      left = { type: 'BinaryExpression', operator, left, right }
      operator = this.matchOperator('&&')
    }
    return left
  }

  private parseEquality(): FormulaAstNode {
    let left = this.parseComparison()
    let operator = this.matchOperator('==', '!=')
    while (operator) {
      const right = this.parseComparison()
      left = { type: 'BinaryExpression', operator, left, right }
      operator = this.matchOperator('==', '!=')
    }
    return left
  }

  private parseComparison(): FormulaAstNode {
    let left = this.parseAdditive()
    let operator = this.matchOperator('>', '<', '>=', '<=')
    while (operator) {
      const right = this.parseAdditive()
      left = { type: 'BinaryExpression', operator, left, right }
      operator = this.matchOperator('>', '<', '>=', '<=')
    }
    return left
  }

  private parseAdditive(): FormulaAstNode {
    let left = this.parseMultiplicative()
    let operator = this.matchOperator('+', '-')
    while (operator) {
      const right = this.parseMultiplicative()
      left = { type: 'BinaryExpression', operator, left, right }
      operator = this.matchOperator('+', '-')
    }
    return left
  }

  private parseMultiplicative(): FormulaAstNode {
    let left = this.parseUnary()
    let operator = this.matchOperator('*', '/', '%')
    while (operator) {
      const right = this.parseUnary()
      left = { type: 'BinaryExpression', operator, left, right }
      operator = this.matchOperator('*', '/', '%')
    }
    return left
  }

  private parseUnary(): FormulaAstNode {
    const operator = this.matchOperator('!', '-')
    if (operator) {
      const argument = this.parseUnary()
      return { type: 'UnaryExpression', operator, argument }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): FormulaAstNode {
    const token = this.consume()

    if (token.type === 'number') {
      return { type: 'Literal', value: Number(token.value) }
    }

    if (token.type === 'string') {
      return { type: 'Literal', value: token.value }
    }

    if (token.type === 'identifier') {
      if (token.value === 'true') return { type: 'Literal', value: true }
      if (token.value === 'false') return { type: 'Literal', value: false }
      if (token.value === 'null') return { type: 'Literal', value: null }

      const next = this.peek()
      if (next?.type === 'paren' && next.value === '(') {
        this.consume()
        const args: FormulaAstNode[] = []
        const closing = this.peek()
        if (closing?.type === 'paren' && closing.value === ')') {
          this.consume()
          return { type: 'CallExpression', callee: token.value, args }
        }
        while (true) {
          args.push(this.parseOr())
          const separator = this.peek()
          if (separator?.type === 'comma') {
            this.consume()
            continue
          }
          if (separator?.type === 'paren' && separator.value === ')') {
            this.consume()
            break
          }
          throw new Error('Expected comma or closing parenthesis in function call')
        }
        return { type: 'CallExpression', callee: token.value, args }
      }

      return { type: 'Identifier', name: token.value }
    }

    if (token.type === 'paren' && token.value === '(') {
      const expression = this.parseOr()
      const closing = this.consume()
      if (closing.type !== 'paren' || closing.value !== ')') {
        throw new Error('Expected closing parenthesis')
      }
      return expression
    }

    throw new Error(`Unexpected token: ${token.value}`)
  }
}

const FORMULA_IDENTIFIER_PATTERN = /\b[A-Za-z_][A-Za-z0-9_]*\b/g
const FORMULA_RESERVED = new Set(['true', 'false', 'null', 'undefined'])

function formatFormulaValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch (error) {
    return String(value)
  }
}

function getFormulaIdentifiers(formula: string, context: Record<string, any>): string[] {
  const builtins = new Set(Object.keys(FORMULA_BUILTINS))
  const identifiers = new Set<string>()
  const matches = formula.match(FORMULA_IDENTIFIER_PATTERN) || []

  for (const token of matches) {
    if (builtins.has(token) || FORMULA_RESERVED.has(token)) {
      continue
    }
    if (Object.prototype.hasOwnProperty.call(context, token)) {
      identifiers.add(token)
    }
  }

  return Array.from(identifiers)
}

function buildFormulaPreview(formula: string, context: Record<string, any>): string {
  const builtins = new Set(Object.keys(FORMULA_BUILTINS))
  return formula.replace(FORMULA_IDENTIFIER_PATTERN, (token) => {
    if (builtins.has(token) || FORMULA_RESERVED.has(token)) {
      return token
    }
    if (Object.prototype.hasOwnProperty.call(context, token)) {
      return formatFormulaValue(context[token])
    }
    return token
  })
}

function evaluateAst(node: FormulaAstNode, context: Record<string, any>): any {
  switch (node.type) {
    case 'Literal':
      return node.value
    case 'Identifier':
      return context[node.name]
    case 'UnaryExpression': {
      const value = evaluateAst(node.argument, context)
      if (node.operator === '!') return !value
      if (node.operator === '-') return -Number(value)
      throw new Error(`Unsupported unary operator: ${node.operator}`)
    }
    case 'BinaryExpression': {
      if (!FORMULA_OPERATORS.has(node.operator)) {
        throw new Error(`Unsupported operator: ${node.operator}`)
      }
      const left = evaluateAst(node.left, context)
      const right = evaluateAst(node.right, context)
      const isNumericValue = (value: unknown): boolean => {
        if (typeof value === 'number') {
          return Number.isFinite(value)
        }
        if (typeof value === 'string') {
          const trimmed = value.trim()
          return trimmed !== '' && Number.isFinite(Number(trimmed))
        }
        return false
      }
      const toNumericValue = (value: unknown): number => (
        typeof value === 'number' ? value : Number(value)
      )
      switch (node.operator) {
        case '+':
          if (isNumericValue(left) && isNumericValue(right)) {
            return toNumericValue(left) + toNumericValue(right)
          }
          return typeof left === 'string' || typeof right === 'string'
            ? String(left) + String(right)
            : Number(left) + Number(right)
        case '-':
          return Number(left) - Number(right)
        case '*':
          return Number(left) * Number(right)
        case '/':
          return Number(left) / Number(right)
        case '%':
          return Number(left) % Number(right)
        case '>':
          return isNumericValue(left) && isNumericValue(right)
            ? toNumericValue(left) > toNumericValue(right)
            : left > right
        case '<':
          return isNumericValue(left) && isNumericValue(right)
            ? toNumericValue(left) < toNumericValue(right)
            : left < right
        case '>=':
          return isNumericValue(left) && isNumericValue(right)
            ? toNumericValue(left) >= toNumericValue(right)
            : left >= right
        case '<=':
          return isNumericValue(left) && isNumericValue(right)
            ? toNumericValue(left) <= toNumericValue(right)
            : left <= right
        case '==':
          return left === right
        case '!=':
          return left !== right
        case '&&':
          return Boolean(left) && Boolean(right)
        case '||':
          return Boolean(left) || Boolean(right)
        default:
          throw new Error(`Unsupported operator: ${node.operator}`)
      }
    }
    case 'CallExpression': {
      const callee = node.callee
      const handler = (FORMULA_BUILTINS as Record<string, (...args: any[]) => any>)[callee]
      if (!handler) {
        throw new Error(`Unknown function: ${callee}`)
      }
      const args = node.args.map((arg) => evaluateAst(arg, context))
      return handler(...args)
    }
    default:
      return undefined
  }
}

/**
 * Safe formula evaluator
 * Supports arithmetic, comparisons, logical operators, and whitelisted functions.
 * 
 * Only identifiers from the provided context and built-ins are allowed.
 * This parser does not allow property access or arbitrary code execution.
 */
export function evaluateFormula(formula: string, context: Record<string, any>): number | string | boolean | undefined {
  if (!formula) return undefined

  try {
    const tokens = tokenizeFormula(formula)
    const parser = new FormulaParser(tokens)
    const ast = parser.parse()
    const result = evaluateAst(ast, context)
    return result as number | string | boolean | undefined
  } catch (e) {
    console.warn('[CALC] Failed to evaluate formula:', formula, e)
    return undefined
  }
}

/**
 * Evaluate all variables from LOGIC_JSON in dependency order
 * 
 * NOTE: Current implementation processes variables sequentially.
 * For production with complex dependencies, implement topological sorting
 * to ensure variables are evaluated in correct dependency order.
 */
export function evaluateLogicVars(
  logicDefinition: LogicDefinition | null,
  context: Record<string, any>,
  onLog?: (entry: CalculationStageLogEntry) => void
): Record<string, any> {
  if (!logicDefinition?.vars || !Array.isArray(logicDefinition.vars)) {
    console.log('[CALC] No vars in logic definition')
    onLog?.({ type: 'noVars' })
    return {}
  }

  const results: Record<string, any> = { ...context }

  console.log('[CALC] Evaluating', logicDefinition.vars.length, 'variables')
  onLog?.({ type: 'evaluatingVars', count: logicDefinition.vars.length })

  // Process variables in order
  // Variables can reference previously calculated variables
  // For complex dependency graphs, implement topological sorting
  for (const varDef of logicDefinition.vars) {
    if (!varDef.name) continue

    if (varDef.formula) {
      // Evaluate formula with current results (includes previously calculated vars)
      const value = evaluateFormula(varDef.formula, results)
      const formulaIdentifiers = getFormulaIdentifiers(varDef.formula, results)
      const formulaValues = formulaIdentifiers.map((name) => ({
        name,
        value: results[name],
      }))
      const formulaPreview = buildFormulaPreview(varDef.formula, results)
      results[varDef.name] = value
      console.log('[CALC] Var', varDef.name, '=', value, 'from formula:', varDef.formula)
      onLog?.({
        type: 'varFormula',
        name: varDef.name,
        value,
        formula: varDef.formula,
        formulaPreview,
        formulaValues,
      })
    } else if (varDef.value !== undefined) {
      // Use static value
      results[varDef.name] = varDef.value
      console.log('[CALC] Var', varDef.name, '=', varDef.value, '(static)')
      onLog?.({
        type: 'varStatic',
        name: varDef.name,
        value: varDef.value,
      })
    }
  }

  return results
}

/**
 * Map evaluated variables to outputs using OUTPUTS mapping
 * Handles both required HL fields and additional custom outputs
 */
export function mapOutputs(
  evaluatedVars: Record<string, any>,
  outputMappings: OutputMapping[]
): Record<string, any> {
  const outputs: Record<string, any> = {}
  
  // Required HL output fields
  const REQUIRED_KEYS = ['width', 'length', 'height', 'weight', 'purchasingPrice', 'basePrice', 'operationPurchasingPrice', 'operationBasePrice', 'materialPurchasingPrice', 'materialBasePrice']

  for (const mapping of outputMappings) {
    if (!mapping.sourceRef) continue
    
    const value = evaluatedVars[mapping.sourceRef]
    if (value === undefined) continue

    // Check if this is a required HL field
    if (REQUIRED_KEYS.includes(mapping.key)) {
      outputs[mapping.key] = value
    } else if (mapping.key.includes('|')) {
      // Additional output: "slug|title" format
      const [slug] = mapping.key.split('|', 2)
      outputs[slug] = value
    } else {
      // Unknown format - store as-is
      outputs[mapping.key] = value
    }
  }

  return outputs
}
