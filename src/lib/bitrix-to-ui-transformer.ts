import { 
  StageInstance, 
  Detail, 
  Binding, 
  Preset, 
  ElementsStore, 
  CalcDetailElement, 
  CalcStageElement,
  BitrixPropertyValue 
} from './types'

/**
 * Transform a CALC_STAGES element from elementsStore to StageInstance
 */
export function transformStage(stageElement: CalcStageElement): StageInstance {
  const props = stageElement.properties
  
  console.log('[transformStage] Transforming stage:', {
    id: stageElement.id,
    name: stageElement.name,
    properties: props
  })
  
  // Transform CUSTOM_FIELDS_VALUE to customFields object
  const customFields: Record<string, string> = {}
  if (props.CUSTOM_FIELDS_VALUE?.VALUE && props.CUSTOM_FIELDS_VALUE?.DESCRIPTION) {
    const values = Array.isArray(props.CUSTOM_FIELDS_VALUE.VALUE) 
      ? props.CUSTOM_FIELDS_VALUE.VALUE 
      : [props.CUSTOM_FIELDS_VALUE.VALUE]
    const descriptions = Array.isArray(props.CUSTOM_FIELDS_VALUE.DESCRIPTION)
      ? props.CUSTOM_FIELDS_VALUE.DESCRIPTION
      : [props.CUSTOM_FIELDS_VALUE.DESCRIPTION]
    
    values.forEach((key, index) => {
      if (key && typeof key === 'string') {
        customFields[key] = descriptions[index] || ''
      }
    })
  }
  
  // Helper to parse number value
  const parseNumber = (value: BitrixPropertyValue['VALUE']): number | null => {
    if (value === null || value === false) return null
    const parsed = typeof value === 'string' ? parseInt(value, 10) : Number(value)
    return isNaN(parsed) ? null : parsed
  }
  
  // Helper to parse string value
  const parseString = (value: BitrixPropertyValue['VALUE']): string | undefined => {
    if (typeof value === 'string' && value) return value
    return undefined
  }
  
  const result = {
    id: `stage_${stageElement.id}`,
    stageId: stageElement.id,
    stageName: stageElement.name,
    settingsId: parseNumber(props.CALC_SETTINGS?.VALUE ?? null),
    operationVariantId: parseNumber(props.OPERATION_VARIANT?.VALUE ?? null),
    operationQuantity: parseNumber(props.OPERATION_QUANTITY?.VALUE ?? null) ?? 1,
    equipmentId: parseNumber(props.EQUIPMENT?.VALUE ?? null),
    materialVariantId: parseNumber(props.MATERIAL_VARIANT?.VALUE ?? null),
    materialQuantity: parseNumber(props.MATERIAL_QUANTITY?.VALUE ?? null) ?? 1,
    customFields,
    optionsOperation: parseString(props.OPTIONS_OPERATION?.VALUE),
    optionsMaterial: parseString(props.OPTIONS_MATERIAL?.VALUE),
  }
  
  console.log('[transformStage] Result:', result)
  
  return result
}

/**
 * Transform a CALC_DETAILS element of type DETAIL to Detail
 */
export function transformDetail(
  detailElement: CalcDetailElement,
  elementsStore: ElementsStore,
  expandedById?: Record<string, boolean>
): Detail {
  console.log('[transformDetail] Transforming detail:', {
    id: detailElement.id,
    name: detailElement.name,
    stagesProperty: detailElement.properties.CALC_STAGES
  })
  
  // Get stages for this detail
  const stageIds = detailElement.properties.CALC_STAGES?.VALUE || []
  const stageIdArray = Array.isArray(stageIds) ? stageIds : [stageIds]
  
  console.log('[transformDetail] Stage IDs to process:', {
    stageIds,
    stageIdArray,
    hasStagesInStore: !!elementsStore.CALC_STAGES,
    stagesInStore: elementsStore.CALC_STAGES?.length
  })
  
  const stages: StageInstance[] = []
  if (elementsStore.CALC_STAGES) {
    stageIdArray.forEach(stageId => {
      const stageIdNum = typeof stageId === 'string' ? parseInt(stageId, 10) : stageId
      console.log('[transformDetail] Looking for stage:', {
        stageId,
        stageIdNum,
        availableStageIds: elementsStore.CALC_STAGES.map(s => s.id)
      })
      const stageElement = elementsStore.CALC_STAGES.find(s => s.id === stageIdNum)
      if (stageElement) {
        console.log('[transformDetail] Found stage element:', stageElement)
        stages.push(transformStage(stageElement as CalcStageElement))
      } else {
        console.warn('[transformDetail] Stage not found in store:', stageIdNum)
      }
    })
  }
  
  const uiId = `detail_${detailElement.id}`
  const result = {
    id: uiId,
    name: detailElement.name || 'Деталь',
    width: detailElement.fields?.width ?? null,
    length: detailElement.fields?.length ?? null,
    isExpanded: expandedById?.[uiId] ?? false,
    stages,
    bitrixId: detailElement.id,
  }
  
  console.log('[transformDetail] Result:', {
    id: result.id,
    name: result.name,
    stagesCount: result.stages.length,
    stages: result.stages
  })
  
  return result
}

/**
 * Transform a CALC_DETAILS element of type BINDING to Binding (recursive)
 */
export function transformBinding(
  bindingElement: CalcDetailElement,
  elementsStore: ElementsStore,
  expandedById?: Record<string, boolean>
): Binding {
  // Get stages for this binding
  const stageIds = bindingElement.properties.CALC_STAGES?.VALUE || []
  const stageIdArray = Array.isArray(stageIds) ? stageIds : [stageIds]
  
  const stages: StageInstance[] = []
  if (elementsStore.CALC_STAGES) {
    stageIdArray.forEach(stageId => {
      const stageIdNum = typeof stageId === 'string' ? parseInt(stageId, 10) : stageId
      const stageElement = elementsStore.CALC_STAGES.find(s => s.id === stageIdNum)
      if (stageElement) {
        stages.push(transformStage(stageElement as CalcStageElement))
      }
    })
  }
  
  const hasStages = stages.length > 0
  
  // Get child detail IDs and binding IDs in the correct order
  const childIds = bindingElement.properties.DETAILS?.VALUE || []
  const childIdArray = Array.isArray(childIds) ? childIds : (childIds ? [childIds] : [])
  
  const detailIds: string[] = []
  const bindingIds: string[] = []
  const childrenOrder: string[] = [] // Unified order list
  
  if (elementsStore.CALC_DETAILS) {
    childIdArray.forEach(childId => {
      const childIdNum = typeof childId === 'string' ? parseInt(childId, 10) : childId
      const childElement = elementsStore.CALC_DETAILS.find(d => d.id === childIdNum) as CalcDetailElement
      
      if (childElement) {
        const childType = childElement.properties.TYPE?.VALUE_XML_ID
        if (childType === 'DETAIL') {
          const detailUiId = `detail_${childElement.id}`
          detailIds.push(detailUiId)
          childrenOrder.push(detailUiId)
        } else if (childType === 'BINDING') {
          const bindingUiId = `binding_${childElement.id}`
          bindingIds.push(bindingUiId)
          childrenOrder.push(bindingUiId)
        }
      }
    })
  }
  
  const uiId = `binding_${bindingElement.id}`
  return {
    id: uiId,
    name: bindingElement.name || 'Группа',
    isExpanded: expandedById?.[uiId] ?? false,
    hasStages,
    stages,
    detailIds,
    bindingIds,
    childrenOrder, // Add unified order
    bitrixId: bindingElement.id,
  }
}

/**
 * Main transformation function: transforms preset + elementsStore to UI format
 */
export function transformPresetToUI(
  preset: Preset,
  elementsStore: ElementsStore,
  expandedById?: Record<string, boolean>
): { details: Detail[]; bindings: Binding[] } {
  console.log('[transformPresetToUI] Starting transformation:', {
    presetId: preset.id,
    presetName: preset.name,
    topLevelDetailIds: preset.properties.CALC_DETAILS,
    elementsStoreKeys: Object.keys(elementsStore),
    calcDetailsCount: elementsStore.CALC_DETAILS?.length,
    calcStagesCount: elementsStore.CALC_STAGES?.length
  })
  
  const details: Detail[] = []
  const bindings: Binding[] = []
  
  // Get top-level detail IDs from preset
  const topLevelIds = preset.properties.CALC_DETAILS || []
  
  if (!elementsStore.CALC_DETAILS) {
    return { details, bindings }
  }
  
  // Process each top-level detail/binding
  topLevelIds.forEach(detailId => {
    const detailIdNum = typeof detailId === 'string' ? parseInt(detailId, 10) : detailId
    console.log('[transformPresetToUI] Processing top-level ID:', { detailId, detailIdNum })
    const element = elementsStore.CALC_DETAILS.find(d => d.id === detailIdNum) as CalcDetailElement
    
    if (!element) {
      console.warn('[transformPresetToUI] Element not found for ID:', detailIdNum)
      return
    }
    
    const elementType = element.properties.TYPE?.VALUE_XML_ID
    console.log('[transformPresetToUI] Found element:', { 
      id: element.id, 
      name: element.name, 
      type: elementType 
    })
    
    if (elementType === 'DETAIL') {
      details.push(transformDetail(element, elementsStore, expandedById))
    } else if (elementType === 'BINDING') {
      bindings.push(transformBinding(element, elementsStore, expandedById))
    }
  })
  
  // Also recursively process all child details and bindings
  // Build a complete map of all details and bindings
  const allDetails = new Map<number, Detail>()
  const allBindings = new Map<number, Binding>()
  
  // Process all CALC_DETAILS elements
  elementsStore.CALC_DETAILS.forEach(element => {
    const calcDetailElement = element as CalcDetailElement
    const elementType = calcDetailElement.properties.TYPE?.VALUE_XML_ID
    
    if (elementType === 'DETAIL') {
      const detail = transformDetail(calcDetailElement, elementsStore, expandedById)
      allDetails.set(calcDetailElement.id, detail)
    } else if (elementType === 'BINDING') {
      const binding = transformBinding(calcDetailElement, elementsStore, expandedById)
      allBindings.set(calcDetailElement.id, binding)
    }
  })
  
  console.log('[transformPresetToUI] Processing complete:', {
    topLevelDetailsCount: details.length,
    topLevelBindingsCount: bindings.length,
    allDetailsCount: allDetails.size,
    allBindingsCount: allBindings.size
  })
  
  // If no top-level details were found in preset, return all details that are not part of any binding
  // BUG FIX: Removed incorrect .slice(0, details.length || 1) which was limiting to 1 detail
  const finalDetails = details.length > 0 
    ? details 
    : Array.from(allDetails.values()).filter(d => 
        !Array.from(allBindings.values()).some(b => 
          b.detailIds.includes(d.id)
        )
      )
  
  // Collect all detail IDs that are nested in ANY binding (including nested bindings)
  const nestedDetailIds = new Set<string>()
  Array.from(allBindings.values()).forEach(binding => {
    binding.detailIds?.forEach(detailId => nestedDetailIds.add(detailId))
  })
  
  // Set isExpanded: false for all details that are nested in bindings
  const allDetailsArray = Array.from(allDetails.values())
  const finalDetailsWithCollapsed = allDetailsArray.map(detail => {
    if (nestedDetailIds.has(detail.id)) {
      // If localStorage has a saved value - use it
      // Otherwise default to collapsed
      const persistedExpanded = expandedById?.[detail.id]
      if (persistedExpanded !== undefined) {
        return { ...detail, isExpanded: persistedExpanded }
      }
      return { ...detail, isExpanded: false }
    }
    return detail
  })
  
  console.log('[transformPresetToUI] Final result:', {
    allDetailsCount: finalDetailsWithCollapsed.length,
    topLevelDetailsCount: finalDetails.length,
    bindingsCount: allBindings.size,
    nestedDetailIds: Array.from(nestedDetailIds),
  })
  
  return { 
    details: finalDetailsWithCollapsed,
    bindings: Array.from(allBindings.values())
  }
}
