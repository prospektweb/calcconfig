/**
 * Calculation Engine Service
 * 
 * Performs progressive calculation for trade offers, details, bindings, and stages.
 * Executes calculations asynchronously to maintain UI responsiveness.
 * Integrates LOGIC_JSON processing for dynamic formula-based calculations.
 */

import type { CalculationStageInputEntry, CalculationStageLogEntry } from '@/lib/types'
import { Detail, Binding, StageInstance } from '@/lib/types'
import { useCalculatorSettingsStore } from '@/stores/calculator-settings-store'
import { useOperationVariantStore } from '@/stores/operation-variant-store'
import { useMaterialVariantStore } from '@/stores/material-variant-store'
import {
  extractParams,
  extractInputs,
  extractLogicDefinition,
  extractOutputs,
  buildCalculationContext,
  evaluateLogicVars,
  mapOutputs,
} from './calculationLogicProcessor'
import type { InitPayload } from '@/lib/postmessage-bridge'

export interface CalculationStageResult {
  stageId: string
  stageName: string
  operationCost: number
  materialCost: number
  totalCost: number
  currency: string
  details?: string
  // Enhanced fields for LOGIC_JSON integration
  logicApplied?: boolean
  variables?: Record<string, any>
  outputs?: Record<string, any>
  logs?: CalculationStageLogEntry[]
  inputs?: CalculationStageInputEntry[]
}

interface ParametrSchemeEntry {
  name: string
  template: string
}

interface ParametrAccumulator {
  offer: Map<string, string>
  product: Map<string, string>
}

export interface CalculationDetailResult {
  detailId: string
  detailName: string
  detailType: 'detail' | 'binding'
  stages: CalculationStageResult[]
  purchasePrice: number
  basePrice: number
  currency: string
  children?: CalculationDetailResult[]
  outputs?: Record<string, any>
  width?: number
  length?: number
  height?: number
  weight?: number
}

export interface CalculationOfferResult {
  offerId: number
  offerName: string
  productId: number
  productName: string
  presetId?: number
  presetName?: string
  presetModified?: string
  details: CalculationDetailResult[]
  directPurchasePrice: number
  purchasePrice: number
  currency: string
  parametrValues?: Array<{
    name: string
    value: string
  }>
  productParametrValues?: Array<{
    name: string
    value: string
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
}

export interface CalculationProgress {
  currentStep: number
  totalSteps: number
  message: string
  percentage: number
}

export type ProgressCallback = (progress: CalculationProgress) => void
export type StepCallback = (result: CalculationStageResult | CalculationDetailResult | CalculationOfferResult) => void

function extractParametrScheme(stageElement: any, propertyCode: string): ParametrSchemeEntry[] {
  const property = stageElement?.properties?.[propertyCode]
  const values = property?.VALUE
  const descriptions = property?.DESCRIPTION
  if (!Array.isArray(values)) {
    return []
  }
  return values
    .map((value: unknown, index: number) => ({
      name: String(value ?? '').trim(),
      template: String(descriptions?.[index] ?? '').trim(),
    }))
    .filter(entry => entry.name.length > 0 || entry.template.length > 0)
}

function applyParametrScheme(
  entries: ParametrSchemeEntry[],
  accumulator: Map<string, string>,
  scope: Record<string, unknown>
): void {
  entries.forEach(entry => {
    const name = entry.name.trim()
    if (!name) {
      return
    }
    const previous = accumulator.get(name) ?? ''
    const template = entry.template ?? ''
    const value = template.replace(/\{([^}]+)\}/g, (_match, token) => {
      const key = String(token).trim()
      if (!key) return ''
      if (key === 'self') {
        return previous
      }
      const replacement = scope[key]
      if (replacement === null || replacement === undefined) {
        return ''
      }
      return String(replacement)
    })
    if (accumulator.has(name)) {
      accumulator.delete(name)
    }
    accumulator.set(name, value)
  })
}

/**
 * Calculate cost for a single stage
 */
async function calculateStage(
  stage: StageInstance,
  detail: Detail | Binding,
  initPayload: any,
  stepCallback?: StepCallback,
  parametrAccumulator?: ParametrAccumulator
): Promise<CalculationStageResult> {
  console.log('[CALC] ==> Processing stage:', {
    stageId: stage.id,
    stageName: stage.stageName,
    detailName: detail.name,
    detailType: 'detailIds' in detail ? 'binding' : 'detail',
  })
  
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 10))
  
  let operationCost = 0
  let materialCost = 0
  const currency = 'RUB'
  const stageLogs: CalculationStageLogEntry[] = []
  
  // Enhanced: Extract logic data from initPayload
  let logicApplied = false
  let evaluatedVars: Record<string, any> = {}
  let outputValues: Record<string, any> = {}
  let inputEntries: CalculationStageInputEntry[] = []
  const applyRuntimeOutputs = (stageElementToUpdate: any, outputsToApply: Record<string, any>) => {
    if (!stageElementToUpdate?.properties || !outputsToApply) {
      return
    }

    const outputsProperty = stageElementToUpdate.properties.OUTPUTS
    const outputKeys: string[] = Array.isArray(outputsProperty?.VALUE)
      ? outputsProperty.VALUE.map((value: any) => String(value))
      : outputsProperty?.VALUE !== undefined && outputsProperty?.VALUE !== null
          ? [String(outputsProperty.VALUE)]
          : Array.isArray(outputsProperty)
              ? outputsProperty
                  .map((entry: any) => String(entry?.VALUE ?? entry?.DESCRIPTION ?? ''))
                  .filter((value: string) => value)
              : []

    const runtimeOutputs = (outputKeys.length > 0 ? outputKeys : Object.keys(outputsToApply)).map((key) => {
      const keyString = String(key)
      const slug = keyString.split('|', 1)[0]
      const value = outputsToApply[slug] ?? outputsToApply[keyString]
      return {
        VALUE: value ?? null,
        DESCRIPTION: keyString,
      }
    })

    stageElementToUpdate.properties.OUTPUTS_RUNTIME = runtimeOutputs
  }
  
  // Get calculator settings element
  let settingsElement = null
  let stageElement = null
  
  if (initPayload?.elementsStore) {
    if (stage.settingsId) {
      settingsElement = initPayload.elementsStore.CALC_SETTINGS?.find(
        (s: any) => s.id === stage.settingsId
      )
    }
    
    if (stage.stageId) {
      stageElement = initPayload.elementsStore.CALC_STAGES?.find(
        (s: any) => s.id === stage.stageId
      )
    }
  }
  
  // Process LOGIC_JSON if available
  if (settingsElement && stageElement && stage.stageId) {
    try {
      // Extract logic components
      const params = extractParams(settingsElement)
      const inputs = extractInputs(stageElement)
      const logicDefinition = extractLogicDefinition(settingsElement)
      const outputs = extractOutputs(stageElement)
      
      console.log('[CALC] Logic extraction:', {
        stageId: stage.id,
        hasParams: !!params && Object.keys(params).length > 0,
        inputsCount: inputs.length,
        hasLogicDefinition: !!logicDefinition,
        outputsCount: outputs.length,
      })
      
      // Only process if we have logic definition
      if (logicDefinition) {
        // Build calculation context with CURRENT_STAGE
        const context = buildCalculationContext(
          initPayload,
          inputs,
          stage.stageId
        )
        
        console.log('[CALC] Calculation context built:', {
          stageId: stage.id,
          contextKeys: Object.keys(context),
          inputValues: inputs.map(i => ({ param: i.paramName, value: context[i.paramName] })),
        })
        
        inputEntries = inputs.map((input) => ({
          name: input.paramName,
          value: context[input.paramName],
          sourcePath: input.sourcePath,
        }))

        // Evaluate LOGIC_JSON variables
        evaluatedVars = evaluateLogicVars(logicDefinition, context, (entry) => {
          stageLogs.push(entry)
        })
        
        console.log('[CALC] Variables evaluated:', {
          stageId: stage.id,
          variableNames: Object.keys(evaluatedVars),
          variableValues: evaluatedVars,
        })
        
        if (outputs.length > 0) {
          // Map results to outputs
          outputValues = mapOutputs(evaluatedVars, outputs)

          if (Object.keys(outputValues).length > 0) {
            applyRuntimeOutputs(stageElement, outputValues)
          }
        }

        if (parametrAccumulator) {
          const inputScope = inputEntries.reduce<Record<string, unknown>>((acc, entry) => {
            acc[entry.name] = entry.value
            return acc
          }, {})
          const scope = {
            ...inputScope,
            ...evaluatedVars,
          }
          const offerScheme = extractParametrScheme(stageElement, 'SCHEME_PARAMETR_VALUES')
          const productScheme = extractParametrScheme(stageElement, 'SCHEME_PRODUCT_PARAMETR_VALUES')
          applyParametrScheme(offerScheme, parametrAccumulator.offer, scope)
          applyParametrScheme(productScheme, parametrAccumulator.product, scope)
        }
        
        logicApplied = true
        
        console.log('[CALC] Logic applied for stage:', stage.id, {
          varsCount: Object.keys(evaluatedVars).length,
          outputsCount: Object.keys(outputValues).length,
          outputs: outputValues
        })
        
        // Use calculated values if available
        // Priority: specific costs (operationCost/materialCost) > total (purchasingPrice)
        
        // 1. Check for specific operation and material costs first
        if (outputValues.operationCost !== undefined || outputValues.materialCost !== undefined) {
          operationCost = Number(outputValues.operationCost) || 0
          materialCost = Number(outputValues.materialCost) || 0
        }
        // 2. If only purchasingPrice provided, treat as total operation cost
        // (common for service-based calculations where material cost is separate or zero)
        else if (outputValues.purchasingPrice !== undefined) {
          const totalCost = Number(outputValues.purchasingPrice) || 0
          operationCost = totalCost
          materialCost = 0
        }
      } else {
        console.log('[CALC] No logic definition or outputs for stage:', stage.id)
      }
    } catch (error) {
      console.warn('[CALC] Logic processing failed for stage:', stage.id, error)
    }
  }
  
  // Fallback to basic calculation if logic not applied or produced no output values
  // Note: Zero costs can be legitimate, so we check if outputs were actually produced
  const hasOutputValues = logicApplied && Object.keys(outputValues).length > 0
  
  if (!hasOutputValues) {
    console.log('[CALC] Using fallback calculation for stage:', stage.id, { 
      logicApplied, 
      outputCount: Object.keys(outputValues).length 
    })
    
    // Get calculator settings
    if (stage.settingsId) {
      const settingsStore = useCalculatorSettingsStore.getState()
      const settings = settingsStore.getSettings(stage.settingsId.toString())
      // Settings contain custom fields and parameters
    }
    
    // Calculate operation cost
    if (stage.operationVariantId) {
      const operationVariantStore = useOperationVariantStore.getState()
      const operationVariant = operationVariantStore.getVariant(stage.operationVariantId.toString())
      
      if (operationVariant) {
        // Use price from variant if available
        const price = operationVariant.purchasingPrice || 0
        operationCost = price * (stage.operationQuantity || 1)
      }
    }
    
    // Calculate material cost
    if (stage.materialVariantId) {
      const materialVariantStore = useMaterialVariantStore.getState()
      const materialVariant = materialVariantStore.getVariant(stage.materialVariantId.toString())
      
      if (materialVariant) {
        // Use price from variant if available
        const price = materialVariant.purchasingPrice || 0
        materialCost = price * (stage.materialQuantity || 1)
      }
    }
  }
  
  const result: CalculationStageResult = {
    stageId: stage.id,
    stageName: stage.stageName || `Этап ${stage.id}`,
    operationCost,
    materialCost,
    totalCost: operationCost + materialCost,
    currency,
    logicApplied,
    variables: logicApplied ? evaluatedVars : undefined,
    outputs: logicApplied ? outputValues : undefined,
    logs: stageLogs.length > 0 ? stageLogs : undefined,
    inputs: inputEntries.length > 0 ? inputEntries : undefined,
  }
  
  if (stepCallback) {
    stepCallback(result)
  }
  
  return result
}

/**
 * Calculate cost for a detail (including all its stages)
 */
async function calculateDetail(
  detail: Detail,
  bindings: Binding[],
  initPayload: any,
  stepCallback?: StepCallback,
  progressCallback?: ProgressCallback,
  currentStep?: { value: number },
  totalSteps?: number,
  parametrAccumulator?: ParametrAccumulator
): Promise<CalculationDetailResult> {
  console.log('[CALC] ===> Processing detail:', {
    detailId: detail.id,
    detailName: detail.name,
    stagesCount: detail.stages?.length || 0,
  })
  
  const stageResults: CalculationStageResult[] = []
  
  // Calculate all stages for this detail
  for (const stage of detail.stages || []) {
    if (currentStep && totalSteps && progressCallback) {
      currentStep.value++
      progressCallback({
        currentStep: currentStep.value,
        totalSteps,
        message: `Расчёт этапа: ${stage.stageName || stage.id}`,
        percentage: Math.round((currentStep.value / totalSteps) * 100),
      })
    }
    
    const stageResult = await calculateStage(stage, detail, initPayload, stepCallback, parametrAccumulator)
    stageResults.push(stageResult)
  }
  
  const totalCost = stageResults.reduce((sum, stage) => sum + stage.totalCost, 0)
  const lastStageWithOutputs = [...stageResults].reverse().find(stage => stage.outputs && Object.keys(stage.outputs).length > 0)
  const derivedOutputs = lastStageWithOutputs?.outputs
  const derivedPurchasePrice = derivedOutputs?.purchasingPrice
  const derivedBasePrice = derivedOutputs?.basePrice
  const derivedWidth = derivedOutputs?.width
  const derivedLength = derivedOutputs?.length
  const derivedHeight = derivedOutputs?.height
  const derivedWeight = derivedOutputs?.weight
  
  console.log('[CALC] Detail calculation complete:', {
    detailId: detail.id,
    detailName: detail.name,
    stagesProcessed: stageResults.length,
    totalCost,
    derivedPurchasePrice,
    derivedBasePrice,
    derivedOutputs,
  })
  
  const result: CalculationDetailResult = {
    detailId: detail.id,
    detailName: detail.name,
    detailType: 'detail',
    stages: stageResults,
    purchasePrice: typeof derivedPurchasePrice === 'number' ? derivedPurchasePrice : totalCost,
    basePrice: typeof derivedBasePrice === 'number' ? derivedBasePrice : totalCost, // Will be modified by markups later
    currency: 'RUB',
    outputs: derivedOutputs,
    width: typeof derivedWidth === 'number' ? derivedWidth : undefined,
    length: typeof derivedLength === 'number' ? derivedLength : undefined,
    height: typeof derivedHeight === 'number' ? derivedHeight : undefined,
    weight: typeof derivedWeight === 'number' ? derivedWeight : undefined,
  }
  
  if (stepCallback) {
    stepCallback(result)
  }
  
  return result
}

/**
 * Calculate cost for a binding (group of details)
 */
async function calculateBinding(
  binding: Binding,
  details: Detail[],
  bindings: Binding[],
  initPayload: any,
  stepCallback?: StepCallback,
  progressCallback?: ProgressCallback,
  currentStep?: { value: number },
  totalSteps?: number,
  visited: Set<string> = new Set(),
  parametrAccumulator?: ParametrAccumulator
): Promise<CalculationDetailResult> {
  console.log('[CALC] ===> Processing binding:', {
    bindingId: binding.id,
    bindingName: binding.name,
    childDetailsCount: binding.detailIds?.length || 0,
    childBindingsCount: binding.bindingIds?.length || 0,
    stagesCount: binding.stages?.length || 0,
  })
  
  // Prevent circular references
  if (visited.has(binding.id)) {
    console.warn(`[CALC] Circular reference detected in binding: ${binding.id}`)
    return {
      detailId: binding.id,
      detailName: binding.name,
      detailType: 'binding',
      stages: [],
      purchasePrice: 0,
      basePrice: 0,
      currency: 'RUB',
      children: [],
    }
  }
  visited.add(binding.id)
  
  const children: CalculationDetailResult[] = []
  const stageResults: CalculationStageResult[] = []
  
  // Calculate all child details
  for (const detailId of binding.detailIds || []) {
    const childDetail = details.find(d => d.id === detailId)
    if (childDetail) {
      const childResult = await calculateDetail(childDetail, bindings, initPayload, stepCallback, progressCallback, currentStep, totalSteps, parametrAccumulator)
      children.push(childResult)
    }
  }
  
  // Calculate all child bindings (recursive)
  for (const bindingId of binding.bindingIds || []) {
    const childBinding = bindings.find(b => b.id === bindingId)
    if (childBinding) {
      const childResult = await calculateBinding(childBinding, details, bindings, initPayload, stepCallback, progressCallback, currentStep, totalSteps, visited, parametrAccumulator)
      children.push(childResult)
    }
  }
  
  // Calculate binding's own stages
  for (const stage of binding.stages || []) {
    if (currentStep && totalSteps && progressCallback) {
      currentStep.value++
      progressCallback({
        currentStep: currentStep.value,
        totalSteps,
        message: `Расчёт этапа скрепления: ${stage.stageName || stage.id}`,
        percentage: Math.round((currentStep.value / totalSteps) * 100),
      })
    }
    
    const stageResult = await calculateStage(stage, binding, initPayload, stepCallback, parametrAccumulator)
    stageResults.push(stageResult)
  }
  
  const childrenCost = children.reduce((sum, child) => sum + child.purchasePrice, 0)
  const bindingStageCost = stageResults.reduce((sum, stage) => sum + stage.totalCost, 0)
  const totalCost = childrenCost + bindingStageCost
  const lastStageWithOutputs = [...stageResults].reverse().find(stage => stage.outputs && Object.keys(stage.outputs).length > 0)

  const aggregateChildren = (items: CalculationDetailResult[]) => {
    let purchasePrice = 0
    let basePrice = 0
    let weight = 0
    let heightMax = 0
    let lengthMax = 0
    let widthMax = 0

    for (const item of items) {
      const outputs = item.outputs || {}
      const itemPurchasePrice = typeof outputs.purchasingPrice === 'number' ? outputs.purchasingPrice : item.purchasePrice
      const itemBasePrice = typeof outputs.basePrice === 'number' ? outputs.basePrice : item.basePrice
      const itemWeight = typeof outputs.weight === 'number' ? outputs.weight : item.weight
      const itemHeight = typeof outputs.height === 'number' ? outputs.height : item.height
      const itemLength = typeof outputs.length === 'number' ? outputs.length : item.length
      const itemWidth = typeof outputs.width === 'number' ? outputs.width : item.width

      purchasePrice += Number(itemPurchasePrice || 0)
      basePrice += Number(itemBasePrice || 0)
      weight += Number(itemWeight || 0)
      heightMax = Math.max(heightMax, Number(itemHeight || 0))
      lengthMax = Math.max(lengthMax, Number(itemLength || 0))
      widthMax = Math.max(widthMax, Number(itemWidth || 0))
    }

    return {
      purchasePrice,
      basePrice,
      weight,
      height: heightMax || undefined,
      length: lengthMax || undefined,
      width: widthMax || undefined,
    }
  }

  const derivedOutputs = lastStageWithOutputs?.outputs
  const derivedPurchasePrice = derivedOutputs?.purchasingPrice
  const derivedBasePrice = derivedOutputs?.basePrice
  const derivedWidth = derivedOutputs?.width
  const derivedLength = derivedOutputs?.length
  const derivedHeight = derivedOutputs?.height
  const derivedWeight = derivedOutputs?.weight
  const aggregatedChildren = stageResults.length === 0 ? aggregateChildren(children) : null
  
  console.log('[CALC] Binding calculation complete:', {
    bindingId: binding.id,
    bindingName: binding.name,
    childrenProcessed: children.length,
    childrenCost,
    bindingStageCost,
    totalCost,
    derivedPurchasePrice,
    derivedBasePrice,
    derivedOutputs,
    aggregatedChildren,
  })
  
  const result: CalculationDetailResult = {
    detailId: binding.id,
    detailName: binding.name,
    detailType: 'binding',
    stages: stageResults,
    purchasePrice: typeof derivedPurchasePrice === 'number'
      ? derivedPurchasePrice
      : aggregatedChildren?.purchasePrice ?? totalCost,
    basePrice: typeof derivedBasePrice === 'number'
      ? derivedBasePrice
      : aggregatedChildren?.basePrice ?? totalCost,
    currency: 'RUB',
    children,
    outputs: derivedOutputs ?? (aggregatedChildren ? {
      purchasingPrice: aggregatedChildren.purchasePrice,
      basePrice: aggregatedChildren.basePrice,
      width: aggregatedChildren.width,
      length: aggregatedChildren.length,
      height: aggregatedChildren.height,
      weight: aggregatedChildren.weight,
    } : undefined),
    width: typeof derivedWidth === 'number' ? derivedWidth : aggregatedChildren?.width,
    length: typeof derivedLength === 'number' ? derivedLength : aggregatedChildren?.length,
    height: typeof derivedHeight === 'number' ? derivedHeight : aggregatedChildren?.height,
    weight: typeof derivedWeight === 'number' ? derivedWeight : aggregatedChildren?.weight,
  }
  
  if (stepCallback) {
    stepCallback(result)
  }
  
  return result
}

/**
 * Calculate total steps needed for progress tracking
 */
function calculateTotalSteps(details: Detail[], bindings: Binding[]): number {
  let count = 0
  
  const countDetailStages = (detail: Detail): number => {
    return (detail.stages || []).length
  }
  
  const countBindingStages = (binding: Binding, visited: Set<string> = new Set()): number => {
    if (visited.has(binding.id)) return 0
    visited.add(binding.id)
    
    let count = (binding.stages || []).length
    
    // Count child details
    for (const detailId of binding.detailIds || []) {
      const detail = details.find(d => d.id === detailId)
      if (detail) {
        count += countDetailStages(detail)
      }
    }
    
    // Count child bindings (recursive)
    for (const bindingId of binding.bindingIds || []) {
      const childBinding = bindings.find(b => b.id === bindingId)
      if (childBinding) {
        count += countBindingStages(childBinding, visited)
      }
    }
    
    return count
  }
  
  // Count top-level details
  for (const detail of details) {
    // Only count if not in any binding
    const isInBinding = bindings.some(b => 
      b.detailIds?.includes(detail.id)
    )
    if (!isInBinding) {
      count += countDetailStages(detail)
    }
  }
  
  // Count top-level bindings
  for (const binding of bindings) {
    // Only count if not in any parent binding
    const isInParentBinding = bindings.some(b => 
      b.bindingIds?.includes(binding.id)
    )
    if (!isInParentBinding) {
      count += countBindingStages(binding)
    }
  }
  
  return count
}

function buildPriceMarkupRanges(
  basePrice: number,
  presetPrices: Array<{
    typeId: number
    price: number
    currency: string
    quantityFrom: number | null
    quantityTo: number | null
  }>,
  priceTypes: Array<{
    id: number
    name: string
    base: boolean
    sort: number
  }>
): Array<{
  quantityFrom: number | null
  quantityTo: number | null
  prices: Array<{
    typeId: number
    typeName: string
    purchasePrice: number
    basePrice: number
    currency: string
  }>
}> {
  const rangesMap = new Map<string, { quantityFrom: number | null; quantityTo: number | null; prices: Array<{
    typeId: number
    typeName: string
    purchasePrice: number
    basePrice: number
    currency: string
  }> }>()

  for (const price of presetPrices) {
    const key = `${price.quantityFrom ?? 0}-${price.quantityTo ?? '∞'}`
    if (!rangesMap.has(key)) {
      rangesMap.set(key, {
        quantityFrom: price.quantityFrom ?? 0,
        quantityTo: price.quantityTo ?? null,
        prices: [],
      })
    }
  }

  if (rangesMap.size === 0) {
    return []
  }

  for (const range of rangesMap.values()) {
    for (const priceType of priceTypes) {
      const matching = presetPrices.find(p => p.typeId === priceType.id
        && (p.quantityFrom ?? 0) === (range.quantityFrom ?? 0)
        && (p.quantityTo ?? null) === (range.quantityTo ?? null))

      if (!matching) {
        range.prices.push({
          typeId: priceType.id,
          typeName: priceType.name,
          purchasePrice: basePrice,
          basePrice: basePrice,
          currency: 'RUB',
        })
        continue
      }

      const finalPrice = matching.currency === 'PRC'
        ? basePrice * (1 + matching.price / 100)
        : basePrice + matching.price

      range.prices.push({
        typeId: priceType.id,
        typeName: priceType.name,
        purchasePrice: basePrice,
        basePrice: finalPrice,
        currency: matching.currency === 'PRC' ? 'RUB' : matching.currency || 'RUB',
      })
    }
  }

  return Array.from(rangesMap.values()).sort((a, b) => (a.quantityFrom ?? 0) - (b.quantityFrom ?? 0))
}

/**
 * Main calculation function for an offer
 */
export async function calculateOffer(
  offer: InitPayload['selectedOffers'][number],
  product: {
    id: number
    name: string
  } | null,
  preset: {
    id: number
    name: string
    prices?: Array<{
      typeId: number
      price: number
      currency: string
      quantityFrom: number | null
      quantityTo: number | null
    }>
  } | null,
  details: Detail[],
  bindings: Binding[],
  priceTypes: Array<{
    id: number
    name: string
    base: boolean
    sort: number
  }>,
  initPayload: any,
  progressCallback?: ProgressCallback,
  stepCallback?: StepCallback
): Promise<CalculationOfferResult> {
  console.log('[CALC] ====> Starting offer calculation:', {
    offerId: offer.id,
    offerName: offer.name,
    totalDetails: details.length,
    totalBindings: bindings.length,
  })
  
  const totalSteps = calculateTotalSteps(details, bindings)
  const currentStep = { value: 0 }
  
  const detailResults: CalculationDetailResult[] = []
  const parametrAccumulator: ParametrAccumulator = {
    offer: new Map(),
    product: new Map(),
  }
  
  // Get top-level details (not in any binding)
  const topLevelDetails = details.filter(detail => 
    !bindings.some(b => b.detailIds?.includes(detail.id))
  )
  
  // Get top-level bindings (not in any parent binding)
  const topLevelBindings = bindings.filter(binding => 
    !bindings.some(b => b.bindingIds?.includes(binding.id))
  )
  
  console.log('[CALC] Top-level items identified:', {
    topLevelDetailsCount: topLevelDetails.length,
    topLevelDetails: topLevelDetails.map(d => ({ id: d.id, name: d.name })),
    topLevelBindingsCount: topLevelBindings.length,
    topLevelBindings: topLevelBindings.map(b => ({ id: b.id, name: b.name })),
    totalSteps,
  })
  
  const offerPayload = {
    ...initPayload,
    offer,
  }

  // Calculate top-level details
  for (const detail of topLevelDetails) {
    const result = await calculateDetail(detail, bindings, offerPayload, stepCallback, progressCallback, currentStep, totalSteps, parametrAccumulator)
    detailResults.push(result)
  }
  
  // Calculate top-level bindings
  for (const binding of topLevelBindings) {
    const result = await calculateBinding(binding, details, bindings, offerPayload, stepCallback, progressCallback, currentStep, totalSteps, new Set(), parametrAccumulator)
    detailResults.push(result)
  }
  
  const directPurchasePrice = detailResults.reduce((sum, detail) => sum + detail.purchasePrice, 0)
  const purchasePrice = detailResults.reduce((sum, detail) => sum + detail.basePrice, 0)
  
  const priceRangesWithMarkup = buildPriceMarkupRanges(purchasePrice, preset?.prices || [], priceTypes)
  
  console.log('[CALC] Offer calculation complete:', {
    offerId: offer.id,
    offerName: offer.name,
    detailsProcessed: detailResults.length,
    purchasePrice,
    directPurchasePrice,
  })
  
  return {
    offerId: offer.id,
    offerName: offer.name,
    productId: product?.id || offer.productId,
    productName: product?.name || 'Unknown Product',
    presetId: preset?.id,
    presetName: preset?.name,
    presetModified: preset?.properties?.DATE_MODIFY ? String(preset.properties.DATE_MODIFY) : undefined,
    details: detailResults,
    directPurchasePrice,
    purchasePrice,
    currency: 'RUB',
    parametrValues: Array.from(parametrAccumulator.offer, ([name, value]) => ({ name, value })),
    productParametrValues: Array.from(parametrAccumulator.product, ([name, value]) => ({ name, value })),
    priceRangesWithMarkup,
  }
}

/**
 * Calculate all offers progressively
 */
export async function calculateAllOffers(
  offers: InitPayload['selectedOffers'],
  product: {
    id: number
    name: string
  } | null,
  preset: {
    id: number
    name: string
    prices?: Array<{
      typeId: number
      price: number
      currency: string
      quantityFrom: number | null
      quantityTo: number | null
    }>
  } | null,
  details: Detail[],
  bindings: Binding[],
  priceTypes: Array<{
    id: number
    name: string
    base: boolean
    sort: number
  }>,
  initPayload: any,
  progressCallback?: ProgressCallback,
  stepCallback?: StepCallback,
  offerCallback?: (result: CalculationOfferResult) => void
): Promise<CalculationOfferResult[]> {
  const results: CalculationOfferResult[] = []
  
  for (let i = 0; i < offers.length; i++) {
    const offer = offers[i]
    
    if (progressCallback) {
      progressCallback({
        currentStep: i,
        totalSteps: offers.length,
        message: `Расчёт торгового предложения: ${offer.name}`,
        percentage: Math.round((i / offers.length) * 100),
      })
    }
    
    const result = await calculateOffer(
      offer,
      product,
      preset,
      details,
      bindings,
      priceTypes,
      initPayload,
      progressCallback,
      stepCallback
    )
    
    results.push(result)
    
    if (offerCallback) {
      offerCallback(result)
    }
  }
  
  if (progressCallback) {
    progressCallback({
      currentStep: offers.length,
      totalSteps: offers.length,
      message: 'Расчёт завершён',
      percentage: 100,
    })
  }
  
  return results
}
