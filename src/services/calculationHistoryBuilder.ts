/**
 * Calculation History Builder Service
 * 
 * Converts CalculationOfferResult to CalculationHistoryJson format
 * for storage in HighloadBlock.
 */

import type { CalculationHistoryJson, CalculationStructureItem, CalculationHistoryStage } from '@/lib/types'
import type { CalculationOfferResult, CalculationDetailResult, CalculationStageResult } from './calculationEngine'
import type { InitPayload } from '@/lib/postmessage-bridge'

/**
 * Build calculation history JSON from calculation result
 * 
 * @param result - The calculation result for a single offer
 * @param bitrixMeta - Bitrix metadata containing product and preset information
 * @returns JSON structure ready for storage in HighloadBlock
 */
export function buildCalculationHistoryJson(
  result: CalculationOfferResult,
  bitrixMeta: InitPayload | null
): CalculationHistoryJson {
  // Convert parametrValues array to Record format
  const parametrValues: Record<string, string> = {}
  if (result.parametrValues && Array.isArray(result.parametrValues)) {
    result.parametrValues.forEach(param => {
      parametrValues[param.name] = param.value
    })
  }

  // Build structure from details
  const structure = result.details.map(detail => convertDetailToStructureItem(detail))

  // Determine totals - use purchasePrice from result
  const totals = {
    purchasePrice: result.purchasePrice,
    basePrice: result.purchasePrice, // Base price is the same as purchase price in most cases
    currency: result.currency || 'RUB',
    priceRangesWithMarkup: result.priceRangesWithMarkup,
    parametrValues: parametrValues,
  }

  const historyJson: CalculationHistoryJson = {
    offerId: result.offerId,
    offerName: result.offerName,
    productId: result.productId,
    productName: result.productName,
    presetId: result.presetId || 0,
    presetName: result.presetName || '',
    timestamp: Date.now(),
    structure,
    totals,
  }

  return historyJson
}

/**
 * Convert a CalculationDetailResult to CalculationStructureItem
 * Handles both details and bindings recursively
 */
function convertDetailToStructureItem(detail: CalculationDetailResult): CalculationStructureItem {
  // Convert stages
  const stages: CalculationHistoryStage[] = detail.stages.map(stage => convertStageToHistoryStage(stage))

  // Convert children (for bindings)
  const children: CalculationStructureItem[] | undefined = detail.children?.map(child => 
    convertDetailToStructureItem(child)
  )

  // Calculate totals according to the rules:
  // - Итог последнего этапа внутри детали = итог детали
  // - Итог последнего этапа скрепления = итог скрепления
  // - Если у скрепления нет собственных этапов, то итогом скрепления являются итоги последнего этапа последней детали
  
  let totals: CalculationStructureItem['totals']
  
  if (stages.length > 0) {
    // If there are stages, use the last stage's totals
    const lastStage = stages[stages.length - 1]
    totals = {
      purchasePrice: lastStage.outputs?.purchasingPrice ?? lastStage.totalCost,
      basePrice: lastStage.outputs?.basePrice ?? lastStage.totalCost,
      currency: lastStage.currency || 'RUB',
    }
  } else if (detail.detailType === 'binding' && children && children.length > 0) {
    // If it's a binding with no stages but has children, use the last child's last stage totals
    const lastChild = children[children.length - 1]
    // Get the last stage of the last child
    if (lastChild.stages.length > 0) {
      const lastStage = lastChild.stages[lastChild.stages.length - 1]
      totals = {
        purchasePrice: lastStage.outputs?.purchasingPrice ?? lastStage.totalCost,
        basePrice: lastStage.outputs?.basePrice ?? lastStage.totalCost,
        currency: lastStage.currency || 'RUB',
      }
    } else {
      // If the last child also has no stages, use its totals
      totals = lastChild.totals
    }
  } else {
    // Fallback to detail's own totals
    totals = {
      purchasePrice: detail.purchasePrice,
      basePrice: detail.basePrice,
      currency: detail.currency || 'RUB',
    }
  }

  const structureItem: CalculationStructureItem = {
    id: detail.detailId,
    name: detail.detailName,
    type: detail.detailType,
    stages,
    children,
    totals,
  }

  return structureItem
}

/**
 * Convert a CalculationStageResult to CalculationHistoryStage
 */
function convertStageToHistoryStage(stage: CalculationStageResult): CalculationHistoryStage {
  return {
    stageId: stage.stageId,
    stageName: stage.stageName,
    operationCost: stage.operationCost,
    materialCost: stage.materialCost,
    totalCost: stage.totalCost,
    currency: stage.currency || 'RUB',
    logicApplied: stage.logicApplied,
    variables: stage.variables,
    outputs: stage.outputs,
  }
}
