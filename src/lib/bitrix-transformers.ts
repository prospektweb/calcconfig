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
  properties?: Record<string, unknown>
  children?: BitrixTreeItem[]
}

/**
 * Transform Bitrix tree for calcSettings and calcEquipment
 * Selectable type: 'element'
 */
export function transformBitrixTreeSelectElement(items: BitrixTreeItem[]): MultiLevelItem[] {
  return items.map(item => ({
    id: String(item.id),
    label: item.name,
    value: item.type === 'element' ? String(item.id) : undefined,
    children: item.children?.length 
      ? transformBitrixTreeSelectElement(item.children) 
      : undefined,
  }))
}

/**
 * Transform Bitrix tree for calcOperations and calcMaterials
 * Selectable type: 'child'
 */
export function transformBitrixTreeSelectChild(items: BitrixTreeItem[]): MultiLevelItem[] {
  return items.map(item => ({
    id: String(item.id),
    label: item.name,
    value: item.type === 'child' ? String(item.id) : undefined,
    children: item.children?.length 
      ? transformBitrixTreeSelectChild(item.children) 
      : undefined,
  }))
}
