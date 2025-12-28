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
  
  return {
    id: `stage_${stageElement.id}`,
    stageId: stageElement.id,
    settingsId: parseNumber(props.CALC_SETTINGS?.VALUE ?? null),
    operationVariantId: parseNumber(props.OPERATION_VARIANT?.VALUE ?? null),
    operationQuantity: parseNumber(props.OPERATION_QUANTITY?.VALUE ?? null) ?? 1,
    equipmentId: parseNumber(props.EQUIPMENT?.VALUE ?? null),
    materialVariantId: parseNumber(props.MATERIAL_VARIANT?.VALUE ?? null),
    materialQuantity: parseNumber(props.MATERIAL_QUANTITY?.VALUE ?? null) ?? 1,
    customFields,
  }
}

/**
 * Transform a CALC_DETAILS element of type DETAIL to Detail
 */
export function transformDetail(
  detailElement: CalcDetailElement,
  elementsStore: ElementsStore
): Detail {
  // Get stages for this detail
  const stageIds = detailElement.properties.CALC_STAGES?.VALUE || []
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
  
  return {
    id: `detail_${detailElement.id}`,
    name: detailElement.name || 'Деталь',
    width: detailElement.fields?.width ?? null,
    length: detailElement.fields?.length ?? null,
    isExpanded: true,
    stages: stages.length > 0 ? stages : [],
    bitrixId: detailElement.id,
  }
}

/**
 * Transform a CALC_DETAILS element of type BINDING to Binding (recursive)
 */
export function transformBinding(
  bindingElement: CalcDetailElement,
  elementsStore: ElementsStore
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
  
  // Get child detail IDs and binding IDs
  const childIds = bindingElement.properties.DETAILS?.VALUE || []
  const childIdArray = Array.isArray(childIds) ? childIds : (childIds ? [childIds] : [])
  
  const detailIds: string[] = []
  const bindingIds: string[] = []
  
  if (elementsStore.CALC_DETAILS) {
    childIdArray.forEach(childId => {
      const childIdNum = typeof childId === 'string' ? parseInt(childId, 10) : childId
      const childElement = elementsStore.CALC_DETAILS.find(d => d.id === childIdNum) as CalcDetailElement
      
      if (childElement) {
        const childType = childElement.properties.TYPE?.VALUE_XML_ID
        if (childType === 'DETAIL') {
          detailIds.push(`detail_${childElement.id}`)
        } else if (childType === 'BINDING') {
          bindingIds.push(`binding_${childElement.id}`)
        }
      }
    })
  }
  
  return {
    id: `binding_${bindingElement.id}`,
    name: bindingElement.name || 'Группа',
    isExpanded: true,
    hasStages,
    stages,
    detailIds,
    bindingIds,
    bitrixId: bindingElement.id,
  }
}

/**
 * Main transformation function: transforms preset + elementsStore to UI format
 */
export function transformPresetToUI(
  preset: Preset,
  elementsStore: ElementsStore
): { details: Detail[]; bindings: Binding[] } {
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
    const element = elementsStore.CALC_DETAILS.find(d => d.id === detailIdNum) as CalcDetailElement
    
    if (!element) return
    
    const elementType = element.properties.TYPE?.VALUE_XML_ID
    
    if (elementType === 'DETAIL') {
      details.push(transformDetail(element, elementsStore))
    } else if (elementType === 'BINDING') {
      bindings.push(transformBinding(element, elementsStore))
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
      const detail = transformDetail(calcDetailElement, elementsStore)
      allDetails.set(calcDetailElement.id, detail)
    } else if (elementType === 'BINDING') {
      const binding = transformBinding(calcDetailElement, elementsStore)
      allBindings.set(calcDetailElement.id, binding)
    }
  })
  
  return { 
    details: details.length > 0 ? details : Array.from(allDetails.values()).filter(d => 
      !Array.from(allBindings.values()).some(b => 
        b.detailIds.includes(d.id)
      )
    ).slice(0, details.length || 1),
    bindings: bindings.length > 0 ? bindings : []
  }
}
