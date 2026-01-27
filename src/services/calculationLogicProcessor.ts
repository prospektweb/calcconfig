/**
 * Calculation Logic Processor
 * 
 * Extracts and processes calculation logic from CALC_SETTINGS and CALC_STAGES
 * to support dynamic formula-based calculations.
 */

import { extractLogicJsonString } from '@/lib/stage-utils'
import type { ElementsStoreItem, BitrixPropertyValue } from '@/lib/types'

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
 */
export function getValueByPath(obj: any, path: string): any {
  if (!path || !obj) return undefined
  
  const parts = path.split('.')
  let current = obj
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
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
  const context: Record<string, any> = {
    // Add the entire initPayload for deep access
    ...initPayload,
    CURRENT_STAGE: currentStageId,
  }

  // Wire inputs from initPayload to context based on INPUTS mappings
  for (const wiring of inputWirings) {
    if (wiring.sourcePath) {
      const value = getValueByPath(initPayload, wiring.sourcePath)
      context[wiring.paramName] = value
      console.log('[CALC] Wired input:', wiring.paramName, '=', value, 'from', wiring.sourcePath)
    }
  }

  console.log('[CALC] Built context with', Object.keys(context).length, 'keys')
  return context
}

/**
 * Simple formula evaluator
 * Supports basic arithmetic and variable references
 * For production, consider using a proper expression parser
 */
export function evaluateFormula(formula: string, context: Record<string, any>): any {
  if (!formula) return undefined

  try {
    // Replace variable references with context values
    // This is a simple implementation - for production use a proper parser
    const func = new Function(...Object.keys(context), `return ${formula}`)
    return func(...Object.values(context))
  } catch (e) {
    console.warn('[CALC] Failed to evaluate formula:', formula, e)
    return undefined
  }
}

/**
 * Evaluate all variables from LOGIC_JSON in dependency order
 */
export function evaluateLogicVars(
  logicDefinition: LogicDefinition | null,
  context: Record<string, any>
): Record<string, any> {
  if (!logicDefinition?.vars || !Array.isArray(logicDefinition.vars)) {
    console.log('[CALC] No vars in logic definition')
    return {}
  }

  const results: Record<string, any> = { ...context }

  console.log('[CALC] Evaluating', logicDefinition.vars.length, 'variables')

  // Simple evaluation - process variables in order
  // For production, implement proper dependency resolution
  for (const varDef of logicDefinition.vars) {
    if (!varDef.name) continue

    if (varDef.formula) {
      // Evaluate formula
      const value = evaluateFormula(varDef.formula, results)
      results[varDef.name] = value
      console.log('[CALC] Var', varDef.name, '=', value, 'from formula:', varDef.formula)
    } else if (varDef.value !== undefined) {
      // Use static value
      results[varDef.name] = varDef.value
      console.log('[CALC] Var', varDef.name, '=', varDef.value, '(static)')
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
  const REQUIRED_KEYS = ['width', 'length', 'height', 'weight', 'purchasingPrice', 'basePrice']

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
