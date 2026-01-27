/**
 * Calculation Engine Service
 * 
 * Performs progressive calculation for trade offers, details, bindings, and stages.
 * Executes calculations asynchronously to maintain UI responsiveness.
 * Integrates LOGIC_JSON processing for dynamic formula-based calculations.
 */

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
  totalPurchasePrice: number
  totalBasePrice: number
  currency: string
  pricesWithMarkup: Array<{
    typeId: number
    typeName: string
    purchasePrice: number
    basePrice: number
    currency: string
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

/**
 * Calculate cost for a single stage
 */
async function calculateStage(
  stage: StageInstance,
  detail: Detail | Binding,
  initPayload: any,
  stepCallback?: StepCallback
): Promise<CalculationStageResult> {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 10))
  
  let operationCost = 0
  let materialCost = 0
  const currency = 'RUB'
  
  // Enhanced: Extract logic data from initPayload
  let logicApplied = false
  let evaluatedVars: Record<string, any> = {}
  let outputValues: Record<string, any> = {}
  
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
      
      // Only process if we have logic definition and outputs
      if (logicDefinition && outputs.length > 0) {
        // Build calculation context with CURRENT_STAGE
        const context = buildCalculationContext(
          initPayload,
          inputs,
          stage.stageId
        )
        
        // Evaluate LOGIC_JSON variables
        evaluatedVars = evaluateLogicVars(logicDefinition, context)
        
        // Map results to outputs
        outputValues = mapOutputs(evaluatedVars, outputs)
        
        logicApplied = true
        
        console.log('[CALC] Logic applied for stage:', stage.id, {
          varsCount: Object.keys(evaluatedVars).length,
          outputsCount: Object.keys(outputValues).length,
          outputs: outputValues
        })
        
        // Use calculated values if available
        // purchasingPrice is typically the total cost for the stage
        if (outputValues.purchasingPrice !== undefined) {
          const totalCost = Number(outputValues.purchasingPrice) || 0
          // Split into operation and material if not specified separately
          operationCost = totalCost
          materialCost = 0
        }
        
        // Override with separate costs if provided
        if (outputValues.operationCost !== undefined) {
          operationCost = Number(outputValues.operationCost) || 0
        }
        
        if (outputValues.materialCost !== undefined) {
          materialCost = Number(outputValues.materialCost) || 0
        }
      } else {
        console.log('[CALC] No logic definition or outputs for stage:', stage.id)
      }
    } catch (error) {
      console.warn('[CALC] Logic processing failed for stage:', stage.id, error)
    }
  }
  
  // Fallback to basic calculation if logic not applied or no costs calculated
  if (!logicApplied || (operationCost === 0 && materialCost === 0)) {
    console.log('[CALC] Using fallback calculation for stage:', stage.id, { logicApplied })
    
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
  totalSteps?: number
): Promise<CalculationDetailResult> {
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
    
    const stageResult = await calculateStage(stage, detail, initPayload, stepCallback)
    stageResults.push(stageResult)
  }
  
  const totalCost = stageResults.reduce((sum, stage) => sum + stage.totalCost, 0)
  
  const result: CalculationDetailResult = {
    detailId: detail.id,
    detailName: detail.name,
    detailType: 'detail',
    stages: stageResults,
    purchasePrice: totalCost,
    basePrice: totalCost, // Will be modified by markups later
    currency: 'RUB',
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
  visited: Set<string> = new Set()
): Promise<CalculationDetailResult> {
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
      const childResult = await calculateDetail(childDetail, bindings, initPayload, stepCallback, progressCallback, currentStep, totalSteps)
      children.push(childResult)
    }
  }
  
  // Calculate all child bindings (recursive)
  for (const bindingId of binding.bindingIds || []) {
    const childBinding = bindings.find(b => b.id === bindingId)
    if (childBinding) {
      const childResult = await calculateBinding(childBinding, details, bindings, initPayload, stepCallback, progressCallback, currentStep, totalSteps, visited)
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
    
    const stageResult = await calculateStage(stage, binding, initPayload, stepCallback)
    stageResults.push(stageResult)
  }
  
  const childrenCost = children.reduce((sum, child) => sum + child.purchasePrice, 0)
  const bindingStageCost = stageResults.reduce((sum, stage) => sum + stage.totalCost, 0)
  const totalCost = childrenCost + bindingStageCost
  
  const result: CalculationDetailResult = {
    detailId: binding.id,
    detailName: binding.name,
    detailType: 'binding',
    stages: stageResults,
    purchasePrice: totalCost,
    basePrice: totalCost,
    currency: 'RUB',
    children,
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

/**
 * Apply price markups based on preset prices
 */
function applyPriceMarkups(
  basePrice: number,
  quantity: number,
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
  typeId: number
  typeName: string
  purchasePrice: number
  basePrice: number
  currency: string
}> {
  const results: Array<{
    typeId: number
    typeName: string
    purchasePrice: number
    basePrice: number
    currency: string
  }> = []
  
  // Group prices by type
  const pricesByType = new Map<number, typeof presetPrices[0][]>()
  for (const price of presetPrices) {
    if (!pricesByType.has(price.typeId)) {
      pricesByType.set(price.typeId, [])
    }
    pricesByType.get(price.typeId)!.push(price)
  }
  
  // Calculate for each price type
  for (const priceType of priceTypes) {
    const typePrices = pricesByType.get(priceType.id) || []
    
    // Find applicable price range
    let applicablePrice = typePrices.find(p => {
      const from = p.quantityFrom ?? 0
      const to = p.quantityTo
      return quantity >= from && (to === null || quantity <= to)
    })
    
    // If no range found, try to find the first range (fallback)
    if (!applicablePrice && typePrices.length > 0) {
      applicablePrice = typePrices[0]
    }
    
    let finalPrice = basePrice
    if (applicablePrice) {
      if (applicablePrice.currency === 'PRC') {
        // Percentage markup
        finalPrice = basePrice * (1 + applicablePrice.price / 100)
      } else {
        // Absolute markup in RUB
        finalPrice = basePrice + applicablePrice.price
      }
    }
    
    results.push({
      typeId: priceType.id,
      typeName: priceType.name,
      purchasePrice: basePrice,
      basePrice: finalPrice,
      currency: 'RUB',
    })
  }
  
  return results
}

/**
 * Main calculation function for an offer
 */
export async function calculateOffer(
  offer: {
    id: number
    productId: number
    name: string
  },
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
  const totalSteps = calculateTotalSteps(details, bindings)
  const currentStep = { value: 0 }
  
  const detailResults: CalculationDetailResult[] = []
  
  // Get top-level details (not in any binding)
  const topLevelDetails = details.filter(detail => 
    !bindings.some(b => b.detailIds?.includes(detail.id))
  )
  
  // Get top-level bindings (not in any parent binding)
  const topLevelBindings = bindings.filter(binding => 
    !bindings.some(b => b.bindingIds?.includes(binding.id))
  )
  
  // Calculate top-level details
  for (const detail of topLevelDetails) {
    const result = await calculateDetail(detail, bindings, initPayload, stepCallback, progressCallback, currentStep, totalSteps)
    detailResults.push(result)
  }
  
  // Calculate top-level bindings
  for (const binding of topLevelBindings) {
    const result = await calculateBinding(binding, details, bindings, initPayload, stepCallback, progressCallback, currentStep, totalSteps)
    detailResults.push(result)
  }
  
  const totalPurchasePrice = detailResults.reduce((sum, detail) => sum + detail.purchasePrice, 0)
  const totalBasePrice = detailResults.reduce((sum, detail) => sum + detail.basePrice, 0)
  
  // Apply price markups
  const pricesWithMarkup = applyPriceMarkups(
    totalBasePrice,
    1, // Default quantity
    preset?.prices || [],
    priceTypes
  )
  
  return {
    offerId: offer.id,
    offerName: offer.name,
    productId: product?.id || offer.productId,
    productName: product?.name || 'Unknown Product',
    presetId: preset?.id,
    presetName: preset?.name,
    presetModified: preset?.properties?.DATE_MODIFY ? String(preset.properties.DATE_MODIFY) : undefined,
    details: detailResults,
    totalPurchasePrice,
    totalBasePrice,
    currency: 'RUB',
    pricesWithMarkup,
  }
}

/**
 * Calculate all offers progressively
 */
export async function calculateAllOffers(
  offers: Array<{
    id: number
    productId: number
    name: string
  }>,
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
