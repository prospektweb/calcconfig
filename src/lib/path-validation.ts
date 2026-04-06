import type { InitPayload } from '@/lib/postmessage-bridge'

const LITERAL_PREFIX = '__literal__:'

const hasEntityAtIndex = (initPayload: InitPayload | null | undefined, entityCode: string, index: number): boolean => {
  const list = (initPayload?.elementsStore as any)?.[entityCode]
  return Array.isArray(list) && index >= 0 && index < list.length
}

export function isBrokenSourcePath(sourcePath: string, initPayload: InitPayload | null | undefined): boolean {
  const path = String(sourcePath || '').trim()
  if (!path || path.startsWith(LITERAL_PREFIX)) {
    return false
  }

  const stageAlias = path.match(/^stage_(\d+)(?:\.(.+))?$/)
  if (stageAlias) {
    const stageId = Number(stageAlias[1])
    const remainder = String(stageAlias[2] || '')
    const stage = initPayload?.elementsStore?.CALC_STAGES?.find((s: any) => Number(s?.id) === stageId)
    if (!stage) return true
    if (!remainder) return false

    if (remainder.startsWith('outputVar.')) {
      const varName = remainder.replace(/^outputVar\./, '')
      const descriptions = stage?.properties?.OUTPUTS?.DESCRIPTION
      return !Array.isArray(descriptions) || !descriptions.some((d: any) => String(d) === varName)
    }

    if (remainder.startsWith('outputSlug.')) {
      const slug = remainder.replace(/^outputSlug\./, '')
      const outputsValue = stage?.properties?.OUTPUTS?.VALUE
      if (!Array.isArray(outputsValue)) return true
      return !outputsValue.some((entry: any) => String(entry || '').split('|')[0] === slug)
    }

    if (remainder.startsWith('operationVariant')) {
      const variantId = Number(stage?.properties?.OPERATION_VARIANT?.VALUE ?? 0)
      return !variantId
    }
    if (remainder.startsWith('materialVariant')) {
      const variantId = Number(stage?.properties?.MATERIAL_VARIANT?.VALUE ?? 0)
      return !variantId
    }
    if (remainder.startsWith('equipment')) {
      const equipmentId = Number(stage?.properties?.EQUIPMENT?.VALUE ?? 0)
      return !equipmentId
    }

    return false
  }

  const legacyStagePath = path.match(/^elementsStore\.CALC_STAGES\[(\d+)\](?:\.(.+))?$/)
  if (legacyStagePath) {
    const stageIndex = Number(legacyStagePath[1])
    if (!hasEntityAtIndex(initPayload, 'CALC_STAGES', stageIndex)) return true

    const outputRef = path.match(/OUTPUTS\.(?:VALUE|DESCRIPTION)\[(\d+)\]/)
    if (outputRef) {
      const outputIndex = Number(outputRef[1])
      const stage = initPayload?.elementsStore?.CALC_STAGES?.[stageIndex]
      const values = stage?.properties?.OUTPUTS?.VALUE
      if (!Array.isArray(values)) return true
      return outputIndex < 0 || outputIndex >= values.length
    }
    return false
  }

  const genericElementsStore = path.match(/^elementsStore\.([A-Z_]+)\[(\d+)\]/)
  if (genericElementsStore) {
    const entityCode = genericElementsStore[1]
    const index = Number(genericElementsStore[2])
    return !hasEntityAtIndex(initPayload, entityCode, index)
  }

  return false
}

export function collectInvalidStageIds(initPayload: InitPayload | null | undefined): Set<number> {
  const invalidStageIds = new Set<number>()
  const stages = initPayload?.elementsStore?.CALC_STAGES
  if (!Array.isArray(stages)) return invalidStageIds

  stages.forEach((stage: any) => {
    const desc = stage?.properties?.INPUTS?.DESCRIPTION
    if (!Array.isArray(desc)) return
    const hasInvalid = desc.some((source: any) => isBrokenSourcePath(String(source || ''), initPayload))
    if (hasInvalid) {
      invalidStageIds.add(Number(stage.id))
    }
  })

  return invalidStageIds
}
