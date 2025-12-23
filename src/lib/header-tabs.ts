import { HeaderElement, HeaderTabType, HeaderTabsState } from './types'

export const createEmptyHeaderTabs = (): HeaderTabsState => ({
  equipment: [],
  materialsVariants: [],
  operationsVariants: [],
  details: [],
})

const toHeaderElements = (value: any, overrideType?: HeaderTabType): HeaderElement[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => ({
    ...item,
    ...(overrideType ? { type: overrideType } : {}),
  }))
}

export const hasLegacyHeaderTabsStructure = (raw: any): boolean => {
  if (!raw || typeof raw !== 'object') return false
  return 'materials' in raw || 'operations' in raw || 'details' in raw
}

export function normalizeHeaderTabs(raw: any): HeaderTabsState {
  if (!raw || typeof raw !== 'object') {
    return createEmptyHeaderTabs()
  }

  const normalized: HeaderTabsState = {
    equipment: toHeaderElements(raw.equipment, 'equipment'),
    materialsVariants: toHeaderElements(raw.materialsVariants || raw.materials, 'materialsVariants'),
    operationsVariants: toHeaderElements(raw.operationsVariants || raw.operations, 'operationsVariants'),
    details: toHeaderElements(raw.details || raw.detailsVariants, 'details'),
  }

  return {
    equipment: normalized.equipment || [],
    materialsVariants: normalized.materialsVariants || [],
    operationsVariants: normalized.operationsVariants || [],
    details: normalized.details || [],
  }
}
