/**
 * Calculation Engine Service
 * 
 * Performs progressive calculation for trade offers, details, bindings, and stages.
 * Executes calculations asynchronously to maintain UI responsiveness.
 * Integrates LOGIC_JSON processing for dynamic formula-based calculations.
 */

import type { CalculationStageInputEntry, CalculationStageLogEntry } from '@/lib/types'
import { Detail, Binding, StageInstance, type Iblock } from '@/lib/types'
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

export interface CalculationStageAddedCosts {
  operation: {
    purchasingPrice: number
    basePrice: number
  }
  material: {
    purchasingPrice: number
    basePrice: number
  }
}

export interface CalculationStageDelta {
  purchasingPrice: number
  basePrice: number
}

export interface CalculationStageResult {
  stageId: string
  stageName: string
  timestamp_x?: string
  modified_by?: string
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
  added?: CalculationStageAddedCosts
  delta?: CalculationStageDelta
}

interface ParametrSchemeEntry {
  name: string
  template: string
}

interface ParametrAccumulator {
  offer: Map<string, string>
  offerName?: string
}

interface GlobalPricingState {
  purchasingPrice: number
  basePrice: number
}

export interface CalculationDetailResult {
  detailId: string
  detailName: string
  detailType: 'detail' | 'binding'
  timestamp_x?: string
  modified_by?: string
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
  timestamp_x?: string
  modified_by?: string
  details: CalculationDetailResult[]
  directPurchasePrice: number
  purchasePrice: number
  currency: string
  parametrValues?: Array<{
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

function extractMetaFields(source: any): { timestamp_x?: string; modified_by?: string } {
  const timestamp = source?.timestamp_x
  const modifiedBy = source?.modified_by
  return {
    timestamp_x: timestamp !== undefined && timestamp !== null ? String(timestamp) : undefined,
    modified_by: modifiedBy !== undefined && modifiedBy !== null ? String(modifiedBy) : undefined,
  }
}

function getStoreElementById(initPayload: any, storeCode: string, id: number | null | undefined): any | undefined {
  if (!id) return undefined
  const elements = initPayload?.elementsStore?.[storeCode]
  if (!Array.isArray(elements)) return undefined
  return elements.find((item: any) => Number(item?.id) === Number(id))
}

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

const OFFER_NAME_PARAM = 'Название ТП'

const resolveEnumDisplayValue = (value: unknown, iblocks?: Iblock[]): string | undefined => {
  if (value === null || value === undefined || !Array.isArray(iblocks)) {
    return undefined
  }
  const raw = String(value)
  for (const iblock of iblocks) {
    const properties = iblock.properties ?? []
    for (const property of properties) {
      const enums = property.ENUMS ?? []
      for (const entry of enums) {
        if (entry.XML_ID === raw) {
          return entry.VALUE
        }
      }
    }
  }
  return undefined
}

function applyParametrScheme(
  entries: ParametrSchemeEntry[],
  accumulator: Map<string, string>,
  scope: Record<string, unknown>,
  options?: {
    onOfferName?: (value: string) => void
    previousOfferName?: string
    iblocks?: Iblock[]
  }
): void {
  let currentOfferName = options?.previousOfferName ?? ''
  entries.forEach(entry => {
    const name = entry.name.trim()
    if (!name) {
      return
    }
    const previous = name === OFFER_NAME_PARAM ? currentOfferName : accumulator.get(name) ?? ''
    const template = entry.template ?? ''
    const value = template.replace(/\{([^}]+)\}/g, (_match, token) => {
      const key = String(token).trim()
      if (!key) return ''
      if (key === 'self') {
        return previous
      }
      if (key.endsWith('~')) {
        const baseKey = key.slice(0, -1).trim()
        if (!baseKey) return ''
        const rawValue = scope[baseKey]
        if (rawValue === null || rawValue === undefined) {
          return ''
        }
        const readableValue = resolveEnumDisplayValue(rawValue, options?.iblocks)
        return readableValue ?? String(rawValue)
      }
      const replacement = scope[key]
      if (replacement === null || replacement === undefined) {
        return ''
      }
      return String(replacement)
    })
    if (name === OFFER_NAME_PARAM && options?.onOfferName) {
      const nextOfferName = value.trim()
      if (nextOfferName) {
        options.onOfferName(nextOfferName)
        currentOfferName = nextOfferName
      }
      return
    }
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
  parametrAccumulator?: ParametrAccumulator,
  pricingState?: GlobalPricingState
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
          applyParametrScheme(offerScheme, parametrAccumulator.offer, scope, {
            onOfferName: (value) => {
              parametrAccumulator.offerName = value
            },
            previousOfferName: parametrAccumulator.offerName,
            iblocks: initPayload?.iblocks,
          })
        }
        
        logicApplied = true
        
        console.log('[CALC] Logic applied for stage:', stage.id, {
          varsCount: Object.keys(evaluatedVars).length,
          outputsCount: Object.keys(outputValues).length,
          outputs: outputValues
        })
        
        // Use calculated values if available
        const operationPurchasing = outputValues.operationPurchasingPrice
        const materialPurchasing = outputValues.materialPurchasingPrice

        if (operationPurchasing !== undefined || materialPurchasing !== undefined) {
          operationCost = Number(operationPurchasing) || 0
          materialCost = Number(materialPurchasing) || 0
        } else if (outputValues.purchasingPrice !== undefined) {
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
  
  const operationPurchasingPrice = logicApplied
    ? Number(outputValues.operationPurchasingPrice ?? operationCost) || 0
    : operationCost
  const operationBasePrice = logicApplied
    ? Number(outputValues.operationBasePrice ?? operationCost) || 0
    : operationCost
  const materialPurchasingPrice = logicApplied
    ? Number(outputValues.materialPurchasingPrice ?? materialCost) || 0
    : materialCost
  const materialBasePrice = logicApplied
    ? Number(outputValues.materialBasePrice ?? materialCost) || 0
    : materialCost

  const previousPurchasingPrice = Number(pricingState?.purchasingPrice || 0)
  const previousBasePrice = Number(pricingState?.basePrice || 0)

  const stageDelta = {
    purchasingPrice: operationPurchasingPrice + materialPurchasingPrice,
    basePrice: operationBasePrice + materialBasePrice,
  }

  const {
    operationPurchasingPrice: _opPurchasing,
    operationBasePrice: _opBase,
    materialPurchasingPrice: _matPurchasing,
    materialBasePrice: _matBase,
    purchasingPrice: _legacyPurchasing,
    basePrice: _legacyBase,
    ...restOutputValues
  } = outputValues

  const normalizedOutputs = {
    ...restOutputValues,
    purchasingPrice: previousPurchasingPrice + stageDelta.purchasingPrice,
    basePrice: previousBasePrice + stageDelta.basePrice,
  }

  if (pricingState) {
    pricingState.purchasingPrice = normalizedOutputs.purchasingPrice
    pricingState.basePrice = normalizedOutputs.basePrice
  }

  const result: CalculationStageResult = {
    stageId: stage.id,
    stageName: stage.stageName || `Этап ${stage.id}`,
    ...extractMetaFields(getStoreElementById(initPayload, 'CALC_STAGES', stage.stageId)),
    operationCost,
    materialCost,
    totalCost: operationCost + materialCost,
    currency,
    logicApplied,
    variables: logicApplied ? evaluatedVars : undefined,
    outputs: normalizedOutputs,
    logs: stageLogs.length > 0 ? stageLogs : undefined,
    inputs: inputEntries.length > 0 ? inputEntries : undefined,
    added: {
      operation: {
        purchasingPrice: operationPurchasingPrice,
        basePrice: operationBasePrice,
      },
      material: {
        purchasingPrice: materialPurchasingPrice,
        basePrice: materialBasePrice,
      },
    },
    delta: stageDelta,
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
  parametrAccumulator?: ParametrAccumulator,
  pricingState?: GlobalPricingState
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
    
    const stageResult = await calculateStage(stage, detail, initPayload, stepCallback, parametrAccumulator, pricingState)
    stageResults.push(stageResult)
  }
  
  const totalCost = stageResults.reduce((sum, stage) => sum + stage.totalCost, 0)
  const detailPurchasePrice = stageResults.reduce((sum, stage) => sum + Number(stage.delta?.purchasingPrice || stage.totalCost || 0), 0)
  const detailBasePrice = stageResults.reduce((sum, stage) => sum + Number(stage.delta?.basePrice || stage.totalCost || 0), 0)
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
    ...extractMetaFields(getStoreElementById(initPayload, 'CALC_DETAILS', detail.bitrixId)),
    stages: stageResults,
    purchasePrice: detailPurchasePrice || (typeof derivedPurchasePrice === 'number' ? derivedPurchasePrice : totalCost),
    basePrice: detailBasePrice || (typeof derivedBasePrice === 'number' ? derivedBasePrice : totalCost), // Will be modified by markups later
    currency: 'RUB',
    outputs: derivedOutputs ? { ...derivedOutputs, purchasingPrice: detailPurchasePrice, basePrice: detailBasePrice } : undefined,
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
  parametrAccumulator?: ParametrAccumulator,
  pricingState?: GlobalPricingState
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
      ...extractMetaFields(getStoreElementById(initPayload, 'CALC_DETAILS', binding.bitrixId)),
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
      const childResult = await calculateDetail(childDetail, bindings, initPayload, stepCallback, progressCallback, currentStep, totalSteps, parametrAccumulator, pricingState)
      children.push(childResult)
    }
  }
  
  // Calculate all child bindings (recursive)
  for (const bindingId of binding.bindingIds || []) {
    const childBinding = bindings.find(b => b.id === bindingId)
    if (childBinding) {
      const childResult = await calculateBinding(childBinding, details, bindings, initPayload, stepCallback, progressCallback, currentStep, totalSteps, visited, parametrAccumulator, pricingState)
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
    
    const stageResult = await calculateStage(stage, binding, initPayload, stepCallback, parametrAccumulator, pricingState)
    stageResults.push(stageResult)
  }
  
  const childrenCost = children.reduce((sum, child) => sum + child.purchasePrice, 0)
  const bindingStageCost = stageResults.reduce((sum, stage) => sum + stage.totalCost, 0)
  const bindingStagePurchase = stageResults.reduce((sum, stage) => sum + Number(stage.delta?.purchasingPrice || stage.totalCost || 0), 0)
  const bindingStageBase = stageResults.reduce((sum, stage) => sum + Number(stage.delta?.basePrice || stage.totalCost || 0), 0)
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
      const itemPurchasePrice = item.purchasePrice
      const itemBasePrice = item.basePrice
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
    ...extractMetaFields(getStoreElementById(initPayload, 'CALC_DETAILS', binding.bitrixId)),
    stages: stageResults,
    purchasePrice: (aggregatedChildren?.purchasePrice ?? children.reduce((sum, child) => sum + child.purchasePrice, 0)) + bindingStagePurchase,
    basePrice: (aggregatedChildren?.basePrice ?? children.reduce((sum, child) => sum + child.basePrice, 0)) + bindingStageBase,
    currency: 'RUB',
    children,
    outputs: (derivedOutputs ? { ...derivedOutputs, purchasingPrice: (aggregatedChildren?.purchasePrice ?? children.reduce((sum, child) => sum + child.purchasePrice, 0)) + bindingStagePurchase, basePrice: (aggregatedChildren?.basePrice ?? children.reduce((sum, child) => sum + child.basePrice, 0)) + bindingStageBase } : undefined) ?? (aggregatedChildren ? {
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
    offerName: offer.name,
  }
  const pricingState: GlobalPricingState = { purchasingPrice: 0, basePrice: 0 }
  
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
    const result = await calculateDetail(detail, bindings, offerPayload, stepCallback, progressCallback, currentStep, totalSteps, parametrAccumulator, pricingState)
    detailResults.push(result)
  }
  
  // Calculate top-level bindings
  for (const binding of topLevelBindings) {
    const result = await calculateBinding(binding, details, bindings, offerPayload, stepCallback, progressCallback, currentStep, totalSteps, new Set(), parametrAccumulator, pricingState)
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
    offerName: parametrAccumulator.offerName || offer.name,
    productId: product?.id || offer.productId,
    productName: product?.name || 'Unknown Product',
    presetId: preset?.id,
    presetName: preset?.name,
    ...extractMetaFields(preset),
    details: detailResults,
    directPurchasePrice,
    purchasePrice,
    currency: 'RUB',
    parametrValues: Array.from(parametrAccumulator.offer, ([name, value]) => ({ name, value })),
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
