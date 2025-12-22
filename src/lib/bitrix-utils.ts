interface OpenBitrixAdminParams {
  iblockId: number
  type: string
  lang: string
  id?: number
  isSection?: boolean
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

  try {
    const newWindow = window.open('', '_blank')

    if (!newWindow) {
      console.warn('[openBitrixAdmin] Popup was blocked')
      throw new Error('Всплывающее окно заблокировано браузером. Разрешите всплывающие окна для этого сайта.')
    }

    newWindow.opener = window
    newWindow.location.href = url
  } catch (error) {
    console.error('[openBitrixAdmin] Failed to open window', error)
    throw error
  }
}

export function openIblockEditPage(iblockId: number, type: string = 'calculator', lang: string = 'ru') {
  if (!bitrixContext) {
    console.error('[openIblockEditPage] Bitrix context not initialized')
    throw new Error('Контекст Bitrix не инициализирован')
  }

  const { baseUrl } = bitrixContext
  const url = `${baseUrl}/bitrix/admin/iblock_edit.php?type=${type}&lang=${lang}&ID=${iblockId}`

  try {
    const newWindow = window.open('', '_blank')
    if (!newWindow) {
      throw new Error('Всплывающее окно заблокировано браузером')
    }
    newWindow.opener = window
    newWindow.location.href = url
  } catch (error) {
    console.error('[openIblockEditPage] Failed to open window', error)
    throw error
  }
}
