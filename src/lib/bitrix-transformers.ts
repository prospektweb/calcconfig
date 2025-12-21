import { MultiLevelItem } from '@/components/calculator/MultiLevelSelect'

export interface BitrixProperty {
  ID?: string
  NAME: string
  VALUE: string | string[] | null
  VALUE_XML_ID: string | string[] | null
  MULTIPLE: 'Y' | 'N'
  PROPERTY_TYPE: string
  // Опциональные поля
  VALUE_ENUM?: string
  DESCRIPTION?: string | null
  [key: string]: any // Для других полей которые могут приходить
}

export interface BitrixTreeItem {
  type: 'section' | 'element' | 'child'
  id: number
  name: string
  code: string
  iblockId: number
  parentId?: number | null
  sectionId?: number
  depth?: number
  sort?: number
  properties?: Record<string, unknown>
  children?: BitrixTreeItem[]
}

/**
 * Sort items by SORT field (if available), then by NAME
 */
function sortBitrixTreeItems(items: BitrixTreeItem[]): BitrixTreeItem[] {
  return [...items].sort((a, b) => {
    // First, sort by sort field if both have it
    if (a.sort !== undefined && b.sort !== undefined) {
      if (a.sort !== b.sort) {
        return a.sort - b.sort
      }
    }
    // If sort is equal or not available, sort by name
    return a.name.localeCompare(b.name, 'ru')
  })
}

/**
 * Transform Bitrix tree for calcSettings and calcEquipment
 * Selectable type: 'element'
 */
export function transformBitrixTreeSelectElement(items: BitrixTreeItem[], iblockType?: string): MultiLevelItem[] {
  const sortedItems = sortBitrixTreeItems(items)
  return sortedItems.map(item => ({
    id: String(item.id),
    label: item.name,
    value: item.type === 'element' ? String(item.id) : undefined,
    children: item.children?.length 
      ? transformBitrixTreeSelectElement(item.children, iblockType) 
      : undefined,
    // Add Bitrix metadata for opening items in Bitrix admin
    iblockId: item.iblockId,
    iblockType: iblockType,
    itemType: item.type === 'section' ? 'section' : 'element',
  }))
}

/**
 * Transform Bitrix tree for calcOperations and calcMaterials
 * Selectable type: 'child'
 */
export function transformBitrixTreeSelectChild(items: BitrixTreeItem[], iblockType?: string): MultiLevelItem[] {
  const sortedItems = sortBitrixTreeItems(items)
  return sortedItems.map(item => ({
    id: String(item.id),
    label: item.name,
    value: item.type === 'child' ? String(item.id) : undefined,
    children: item.children?.length 
      ? transformBitrixTreeSelectChild(item.children, iblockType) 
      : undefined,
    // Add Bitrix metadata for opening items in Bitrix admin
    iblockId: item.iblockId,
    iblockType: iblockType,
    itemType: item.type === 'section' ? 'section' : 'element',
  }))
}
