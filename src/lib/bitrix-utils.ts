// ============================================
// Iblock types and helpers
// ============================================

export interface Iblock {
  id: number
  code: string
  type: string
  name: string
  parent:  number | null
}

export function getIblockByCode(iblocks: Iblock[], code: string): Iblock | undefined {
  return iblocks.find(ib => ib.code === code)
}

// ============================================
// Bitrix Admin URL helpers
// ============================================

interface OpenBitrixAdminParams {
  iblockId: number
  type: string
  lang: string
  id?: number
  isSection?:  boolean
}

interface BitrixContext {
  baseUrl: string
  lang: string
}

let bitrixContext: BitrixContext | null = null

export function setBitrixContext(context: BitrixContext) {
  bitrixContext = context
}

export function getBitrixContext(): BitrixContext | null {
  return bitrixContext
}

export function openBitrixAdmin(params: OpenBitrixAdminParams) {
  if (!bitrixContext) {
    console.error('[openBitrixAdmin] Bitrix context not initialized')
    throw new Error('Контекст Bitrix не инициализирован')
  }

  const { iblockId, type, lang, id, isSection = false } = params
  const { baseUrl } = bitrixContext

  if (!iblockId || !type || !lang) {
    console.error('[openBitrixAdmin] Missing required parameters', { iblockId, type, lang })
    throw new Error('Не указаны обязательные параметры для открытия Bitrix')
  }

  let url: string

  if (id !== undefined) {
    if (isSection) {
      url = `${baseUrl}/bitrix/admin/iblock_section_edit.php?IBLOCK_ID=${iblockId}&type=${type}&lang=${lang}&ID=${id}`
    } else {
      url = `${baseUrl}/bitrix/admin/iblock_element_edit.php?IBLOCK_ID=${iblockId}&type=${type}&lang=${lang}&ID=${id}`
    }
  } else {
    url = `${baseUrl}/bitrix/admin/iblock_list_admin.php?IBLOCK_ID=${iblockId}&type=${type}&lang=${lang}&find_section_section=0`
  }

  // Просто открываем URL, без проверки на блокировку
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function openIblockEditPage(iblockId: number, type: string = 'calculator', lang: string = 'ru') {
  if (!bitrixContext) {
    console.error('[openIblockEditPage] Bitrix context not initialized')
    throw new Error('Контекст Bitrix не инициализирован')
  }

  const { baseUrl } = bitrixContext
  const url = `${baseUrl}/bitrix/admin/iblock_edit.php?type=${type}&lang=${lang}&ID=${iblockId}`

  window.open(url, '_blank', 'noopener,noreferrer')
}

// ============================================
// Helper to open iblock catalog (list page)
// ============================================

export function openIblockCatalog(iblock: Iblock, lang: string = 'ru') {
  if (!bitrixContext) {
    console.error('[openIblockCatalog] Bitrix context not initialized')
    throw new Error('Контекст Bitrix не инициализирован')
  }

  const { baseUrl } = bitrixContext
  const url = `${baseUrl}/bitrix/admin/iblock_list_admin.php?IBLOCK_ID=${iblock.id}&type=${iblock.type}&lang=${lang}&find_section_section=0`

  window.open(url, '_blank', 'noopener,noreferrer')
}

// ============================================
// Helper to open catalog product page
// ============================================

export function openCatalogProduct(productId: number, iblockId: number, type: string, lang: string = 'ru') {
  if (!bitrixContext) {
    throw new Error('Контекст Bitrix не инициализирован')
  }

  const { baseUrl } = bitrixContext
  const url = `${baseUrl}/bitrix/admin/cat_product_edit.php?IBLOCK_ID=${iblockId}&type=${type}&lang=${lang}&ID=${productId}`

  window.open(url, '_blank', 'noopener,noreferrer')
}
