import { Iblock, Preset, ElementsStore } from './types'
import { BitrixTreeItem, BitrixProperty } from './bitrix-transformers'

export type MessageType =
  // Жизненный цикл
  | 'READY'
  | 'INIT'
  | 'INIT_DONE'
  
  // Общие
  | 'ERROR'
  | 'CLOSE_REQUEST'
  | 'RESPONSE'        // ЕДИНЫЙ ответ на любой *_REQUEST
  
  // Расчёт и сохранение
  | 'CALC_RUN'        // iframe → bitrix: запуск расчёта
  | 'CALC_INFO'       // bitrix → iframe: информация о расчёте
  
  // Legacy responses (still in use)
  | 'SELECT_DONE'
  | 'CALC_SETTINGS_RESPONSE'
  | 'CALC_OPERATION_RESPONSE'
  | 'CALC_MATERIAL_RESPONSE'
  | 'CALC_OPERATION_VARIANT_RESPONSE'
  | 'CALC_MATERIAL_VARIANT_RESPONSE'
  | 'REFRESH_REQUEST'
  | 'REFRESH_RESULT'
  | 'ADD_NEW_GROUP_RESPONSE'
  | 'SELECT_DETAILS_REQUEST'
  
  // Детали
  | 'ADD_DETAIL_REQUEST'      // переименован из ADD_NEW_DETAIL_REQUEST
  | 'REMOVE_DETAIL_REQUEST'
  | 'RENAME_DETAIL_REQUEST'   // переименование детали
  
  // Этапы
  | 'ADD_STAGE_REQUEST'       // переименован из ADD_NEW_STAGE_REQUEST
  | 'UPDATE_STAGE_REQUEST' 
  | 'DELETE_STAGE_REQUEST'
  
  // Выбор элементов в этапе
  | 'CHANGE_SETTINGS_REQUEST'
  | 'CHANGE_OPERATION_VARIANT_REQUEST'
  | 'CHANGE_EQUIPMENT_REQUEST'
  | 'CHANGE_MATERIAL_VARIANT_REQUEST'
  | 'CHANGE_OPERATION_QUANTITY_REQUEST'   // НОВЫЙ
  | 'CHANGE_MATERIAL_QUANTITY_REQUEST'    // НОВЫЙ
  | 'CHANGE_CUSTOM_FIELDS_VALUE_REQUEST'  // НОВЫЙ
  | 'CHANGE_OPTIONS_OPERATION'            // НОВЫЙ - настройки операции
  | 'CHANGE_OPTIONS_MATERIAL'             // НОВЫЙ - настройки материала
  | 'CLEAR_OPTIONS_OPERATION'             // НОВЫЙ - сброс настроек операции
  | 'CLEAR_OPTIONS_MATERIAL'              // НОВЫЙ - сброс настроек материала
  
  // Группы/Скрепления
  | 'ADD_GROUP_REQUEST'       // переименован из ADD_NEW_GROUP_REQUEST
  | 'UPDATE_GROUP_REQUEST'    // НОВЫЙ
  | 'DELETE_GROUP_REQUEST'
  
  // Пресеты
  | 'CLEAR_PRESET_REQUEST'    // НОВЫЙ - очистка пресета
  
  // Сортировка
  | 'CHANGE_SORT_STAGE_REQUEST'  // Изменение порядка этапов
  | 'CHANGE_DETAIL_SORT_REQUEST' // Изменение порядка деталей/скреплений внутри скрепления
  | 'CHANGE_DETAIL_LEVEL_REQUEST' // Перенос детали/скрепления в другое скрепление
  
  // Добавление элементов в скрепление
  | 'ADD_DETAIL_TO_BINDING_REQUEST'       // Создать новую деталь внутри скрепления
  | 'SELECT_DETAILS_TO_BINDING_REQUEST'   // Выбрать существующие детали для скрепления
  
  // Диапазоны цен
  | 'ADD_PRICE_RANGE_REQUEST'
  | 'DELETE_PRICE_RANGE_REQUEST'
  | 'UPDATE_PRESET_PRICES_REQUEST'  // НОВЫЙ
  | 'CHANGE_PRICE_PRESET_REQUEST'   // НОВЫЙ - единый тип для изменения цен
  
  // Логика расчёта этапа
  | 'SAVE_CALC_LOGIC_REQUEST'         // НОВЫЙ - атомарное сохранение CALC_SETTINGS + CALC_STAGES

export type MessageSource = 'prospektweb.calc' | 'bitrix'

export interface PwrtMessage {
  protocol?: string
  source: MessageSource
  target: MessageSource
  type: MessageType
  requestId?: string
  payload?: any
  timestamp?: number
}

export interface InitPayload {
  context: {
    siteId: string
    userId: string
    lang: 'ru' | 'en'
    timestamp: number
    url: string
    defaultExtraCurrency?: 'RUB' | 'PRC'
    defaultExtraValue?: number
  }
  iblocks: Iblock[]
  iblocksTree?: {
    calcSettings?: BitrixTreeItem[]
    calcEquipment?: BitrixTreeItem[]
    calcOperations?: BitrixTreeItem[]
    calcMaterials?: BitrixTreeItem[]
  }
  selectedOffers: Array<{
    id: number
    productId: number
    name: string
    fields?: Record<string, any>
    prices?: Array<{
      type: string
      value: number
      currency: string
    }>
    properties?: Record<string, any>
  }>
  preset?: Preset
  elementsStore?: ElementsStore
  elementsSiblings?: Array<Record<string, any>>
  priceTypes?: Array<{
    id: number
    name: string
    base: boolean
    sort: number
  }>
  siblings?: {
    operationsVariants?: BitrixTreeItem[]
    materialsVariants?: BitrixTreeItem[]
    skuProperties?: Record<string, {
      CODE: string
      NAME: string
      PROPERTY_TYPE: string
      ENUMS?: Array<{
        VALUE: string
        VALUE_XML_ID?: string
      }>
    }>
  }
}

export interface CalcInfoPayload {
  status: 'progress' | 'complete' | 'error'
  message?: string
  progress?: number
  updatedOffers?: Array<{
    offerId: number
    // ... данные для отображения
  }>
}

/**
 * Payload for ADD_STAGE_REQUEST
 * 
 * Note: Stage positioning (previousStageId, etc.) is handled by the Bitrix backend.
 * The backend determines the correct insertion position based on the current state.
 */
export interface AddStageRequestPayload {
  detailId: number              // ID детали (Bitrix)
}

/**
 * Payload for UPDATE_STAGE_REQUEST
 */
export interface UpdateStageRequestPayload {
  stageId?: number              // ID стадии в Битрикс
  detailId: number              // К какой детали относится
  updates: {
    calculatorId?: number
    operationId?: number
    materialId?: number
    equipmentId?: number
    operationQuantity?: number
    materialQuantity?: number
  }
  iblockId: number
  iblockType: string
}

/**
 * Payload for DELETE_STAGE_REQUEST (с расширенной информацией)
 */
export interface DeleteStageRequestPayload {
  stageId: number               // ID удаляемого этапа
  detailId: number              // ID детали
  previousStageId?: number      // ID предыдущего этапа
  nextStageId?: number          // ID следующего этапа
  iblockId: number
  iblockType: string
}

/**
 * Payload for CHANGE_SORT_STAGE_REQUEST
 */
export interface ChangeSortStageRequestPayload {
  detailId: number              // ID детали/скрепления в которой меняется сортировка этапов
  sorting: number[]             // массив с ID этапов в заданной последовательности
}

/**
 * Payload for CHANGE_DETAIL_SORT_REQUEST
 */
export interface ChangeDetailSortRequestPayload {
  parentId: number              // ID текущего скрепления
  sorting: number[]             // массив с ID вложенных деталей/скреплений в заданной последовательности
}

/**
 * Payload for CHANGE_DETAIL_LEVEL_REQUEST
 */
export interface ChangeDetailLevelRequestPayload {
  fromParentId: number          // ID текущего скрепления
  detailId: number              // ID переносимой детали/скрепления
  toParentId: number            // ID скрепления, куда переносим
  sorting: number[]             // массив с ID вложенных деталей/скреплений для toParentId
}

/**
 * Payload for ADD_DETAIL_TO_BINDING_REQUEST
 */
export interface AddDetailToBindingRequestPayload {
  parentId: number              // ID скрепления, в которое добавляется деталь
  iblockId: number              // ID инфоблока CALC_DETAILS для создания элемента
  iblockType: string            // Тип инфоблока CALC_DETAILS
}

/**
 * Payload for SELECT_DETAILS_TO_BINDING_REQUEST
 */
export interface SelectDetailsToBindingRequestPayload {
  parentId: number              // ID скрепления, куда добавляются детали
  iblockId: number              // ID инфоблока CALC_DETAILS для выбора элементов
  iblockType: string            // Тип инфоблока CALC_DETAILS
}

/**
 * Price range item structure used in multiple payload types
 */
export interface PriceRangeItem {
  typeId: number
  price: number
  currency: 'RUB' | 'PRC'
  quantityFrom: number | null
  quantityTo: number | null
}

/**
 * Payload for UPDATE_PRESET_PRICES_REQUEST
 */
export interface UpdatePresetPricesRequestPayload {
  presetId: number
  prices: PriceRangeItem[]
}

/**
 * Payload for SAVE_CALC_LOGIC_REQUEST
 * Атомарно обновляет CALC_SETTINGS (params + logicJson) и CALC_STAGES (inputs + outputs)
 */
export interface SaveCalcLogicRequestPayload {
  settingsId: number    // CALC_SETTINGS ID
  stageId: number       // CALC_STAGES ID

  calcSettings: {
    params: Array<{ name: string; type: string }>
    logicJson: string   // stringified JSON с { version: 1, vars: [...] }
  }

  stageWiring: {
    inputs: Array<{ name: string; path: string }>
    outputs: Array<{ key: string; var: string }>
    // key для обязательных: "width", "length", etc.
    // key для дополнительных: "${slug}|${title}"
  }
}


/**
 * Payload for RESPONSE (единый ответ)
 */
export interface ResponsePayload {
  requestType: Exclude<MessageType, 'READY' | 'INIT' | 'INIT_DONE' | 'ERROR' | 'RESPONSE'>
  requestId: string
  status: 'success' | 'error'
  message?: string
  state?: Partial<{
    elementsStore: ElementsStore
    iblocksTree: {
      calcSettings?: any[]
      calcEquipment?: any[]
      calcOperations?: any[]
      calcMaterials?: any[]
    }
    preset: any
    loadedElement?: {
      type: 'calculator' | 'operation' | 'material' | 'equipment'
      id: number
      properties: Record<string, BitrixProperty>
    }
  }>
}

/**
 * Payload for calculator settings response from Bitrix.
 * The actual calculator data is nested in the `item` field.
 */
export interface CalcSettingsResponsePayload {
  id: number
  /** Bitrix information block ID */
  iblockId: number
  /** Bitrix information block type identifier */
  iblockType: string
  /** Language code (e.g., 'ru', 'en') */
  lang: string
  /** Response status from Bitrix (e.g., 'ok', 'error') */
  status: string
  /** The actual calculator item data */
  item: {
    id: number
    code: string
    productId?: number | null
    name: string
    fields?: Record<string, any>
    measure?: string | null
    measureRatio?: number | null
    prices?: any[]
    properties: Record<string, BitrixProperty>
  }
}

/**
 * Payload for operation response from Bitrix.
 * The actual operation data is nested in the `item` field.
 */
export interface CalcOperationResponsePayload {
  id: number
  /** Bitrix information block ID */
  iblockId: number
  /** Bitrix information block type identifier */
  iblockType: string
  /** Language code (e.g., 'ru', 'en') */
  lang: string
  /** Response status from Bitrix (e.g., 'ok', 'error') */
  status: string
  /** The actual operation item data */
  item: {
    id: number
    code: string
    name: string
    properties: Record<string, BitrixProperty>
  }
}

/**
 * Payload for material response from Bitrix.
 * The actual material data is nested in the `item` field.
 */
export interface CalcMaterialResponsePayload {
  id: number
  /** Bitrix information block ID */
  iblockId: number
  /** Bitrix information block type identifier */
  iblockType: string
  /** Language code (e.g., 'ru', 'en') */
  lang: string
  /** Response status from Bitrix (e.g., 'ok', 'error') */
  status: string
  /** The actual material item data */
  item: {
    id: number
    code: string
    name: string
    properties: Record<string, BitrixProperty>
  }
}

/**
 * Payload for operation variant response from Bitrix.
 * The actual operation variant data is nested in the `item` field.
 */
export interface CalcOperationVariantResponsePayload {
  id: number
  /** Bitrix information block ID */
  iblockId: number
  /** Bitrix information block type identifier */
  iblockType: string
  /** Language code (e.g., 'ru', 'en') */
  lang: string
  /** Response status from Bitrix (e.g., 'ok', 'error') */
  status: string
  /** The actual operation variant item data */
  item: {
    id: number
    code: string
    name: string
    properties: Record<string, BitrixProperty>
    /** Родительская операция с SUPPORTED_EQUIPMENT_LIST и SUPPORTED_MATERIALS_VARIANTS_LIST */
    itemParent?: {
      id: number
      name: string
      code?: string
      properties: Record<string, BitrixProperty>
    }
    /** Единица измерения */
    measure?: {
      id: number
      code: string
      symbol: string
      name?: string
    }
  }
}

/**
 * Payload for material variant response from Bitrix.
 * The actual material variant data is nested in the `item` field.
 */
export interface CalcMaterialVariantResponsePayload {
  id: number
  /** Bitrix information block ID */
  iblockId: number
  /** Bitrix information block type identifier */
  iblockType: string
  /** Language code (e.g., 'ru', 'en') */
  lang: string
  /** Response status from Bitrix (e.g., 'ok', 'error') */
  status: string
  /** The actual material variant item data */
  item: {
    id: number
    code: string
    name: string
    properties: Record<string, BitrixProperty>
    /** Родительский материал */
    itemParent?: {
      id: number
      name: string
      code?: string
      properties: Record<string, BitrixProperty>
    }
    /** Единица измерения */
    measure?: {
      id: number
      code: string
      symbol: string
      name?: string
    }
  }
}

class PostMessageBridge {
  private targetOrigin: string = '*'
  private listeners: Map<MessageType | '*', Set<(message: PwrtMessage) => void>> = new Map()
  private isInitialized = false
  private protocolVersion = '1.0.0'
  private protocolCode = 'pwrt-v1'

  constructor() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('pwrt_debug', '1')
    }
    this.initializeListener()
  }

  private initializeListener() {
    if (typeof window === 'undefined') return

    window.addEventListener('message', (event: MessageEvent) => {
      try {
        const message = event.data as PwrtMessage
        
        if (!message || !message.type) return
        if (message.target !== 'prospektweb.calc') return

        const isDebug = typeof localStorage !== 'undefined' && localStorage.getItem('pwrt_debug') === '1'
        
        if (isDebug || ['INIT', 'RESPONSE'].includes(message.type)) {
          console.log('[PostMessageBridge] Received:', message.type, message.payload)
        }

        const listeners = this.listeners.get(message.type)
        if (listeners) {
          listeners.forEach(callback => {
            try {
              callback(message)
            } catch (error) {
              console.error('[PostMessageBridge] Listener error:', error)
            }
          })
        }

        const allListeners = this.listeners.get('*')
        if (allListeners) {
          allListeners.forEach(callback => {
            try {
              callback(message)
            } catch (error) {
              console.error('[PostMessageBridge] All listener error:', error)
            }
          })
        }
      } catch (error) {
        console.error('[PostMessageBridge] Parse error:', error)
      }
    })

    this.isInitialized = true
    this.sendReady()
  }

  setTargetOrigin(origin: string) {
    this.targetOrigin = origin
  }

  private sendMessage(type: MessageType, payload?: any, requestId?: string): string | undefined {
    if (typeof window === 'undefined') return

    const requiresProtocol = !['READY', 'INIT', 'INIT_DONE'].includes(type)
    const finalRequestId = requestId ?? (requiresProtocol ? this.generateRequestId(type) : undefined)

    const message: PwrtMessage = {
      ...(requiresProtocol ? { protocol: this.protocolCode } : {}),
      source: 'prospektweb.calc',
      target: 'bitrix',
      type,
      ...(finalRequestId ? { requestId: finalRequestId } : {}),
      payload: requiresProtocol ? payload ?? {} : payload,
      timestamp: Date.now(),
    }

    const isDebug = typeof localStorage !== 'undefined' && localStorage.getItem('pwrt_debug') === '1'
    
    if (isDebug || ['INIT_DONE', 'REFRESH_REQUEST'].includes(type)) {
      console.log('[PostMessageBridge] Sending:', type, message.payload)
    }

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, this.targetOrigin)
    } else {
      window.postMessage(message, this.targetOrigin)
    }

    return finalRequestId
  }

  private generateRequestId(type: MessageType) {
    return `${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  sendReady() {
    this.sendMessage('READY', {
      version: this.protocolVersion,
      timestamp: Date.now(),
    })
  }

  sendInitDone(offersCount: number) {
    this.sendMessage('INIT_DONE', {
      offersCount,
    })
  }

  sendCalcRun(payload?: any) {
    this.sendMessage('CALC_RUN', payload)
  }

  sendError(code: string, message: string, details?: any, context?: any) {
    this.sendMessage('ERROR', {
      code,
      message,
      details,
      context,
    })
  }

  sendCloseRequest(saved: boolean, hasChanges: boolean) {
    this.sendMessage('CLOSE_REQUEST', {
      saved,
      hasChanges,
    })
  }

  sendRefreshRequest(offerIds: number[]) {
    this.sendMessage('REFRESH_REQUEST', {
      offerIds,
    })
  }

  // Legacy methods for backward compatibility - kept as stubs
  // The actual element data loading is handled by Bitrix through other mechanisms
  sendCalcSettingsRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    // Stub - Bitrix handles this through its own mechanisms
    console.log('[PostMessageBridge] sendCalcSettingsRequest (legacy stub)', { id, iblockId, iblockType, lang })
  }

  sendCalcOperationVariantRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    // Stub - Bitrix handles this through its own mechanisms
    console.log('[PostMessageBridge] sendCalcOperationVariantRequest (legacy stub)', { id, iblockId, iblockType, lang })
  }

  sendCalcMaterialVariantRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    // Stub - Bitrix handles this through its own mechanisms
    console.log('[PostMessageBridge] sendCalcMaterialVariantRequest (legacy stub)', { id, iblockId, iblockType, lang })
  }

  // Detail operations
  sendAddDetailRequest(payload: { offerIds: number[], name: string, binding: boolean, iblockId: number, iblockType: string }) {
    return this.sendMessage('ADD_DETAIL_REQUEST', payload)
  }

  sendSelectDetailsRequest(payload: { binding: boolean, iblockId: number, iblockType: string }) {
    return this.sendMessage('SELECT_DETAILS_REQUEST', payload)
  }

  sendRenameDetailRequest(payload: { detailId: number, name: string }) {
    return this.sendMessage('RENAME_DETAIL_REQUEST', payload)
  }

  sendRemoveDetailRequest(payload: { detailId: number, parentId: number | null, iblockId: number, iblockType: string }) {
    return this.sendMessage('REMOVE_DETAIL_REQUEST', payload)
  }

  // Stage operations
  sendAddStageRequest(payload: AddStageRequestPayload) {
    return this.sendMessage('ADD_STAGE_REQUEST', payload)
  }

  sendUpdateStageRequest(payload: UpdateStageRequestPayload) {
    return this.sendMessage('UPDATE_STAGE_REQUEST', payload)
  }

  sendDeleteStageRequest(payload: DeleteStageRequestPayload) {
    return this.sendMessage('DELETE_STAGE_REQUEST', payload)
  }

  // Element selection in stages
  sendChangeSettingsRequest(payload: { settingsId: number, stageId: number }) {
    return this.sendMessage('CHANGE_SETTINGS_REQUEST', payload)
  }

  sendChangeOperationVariantRequest(payload: { operationVariantId: number, stageId: number }) {
    return this.sendMessage('CHANGE_OPERATION_VARIANT_REQUEST', payload)
  }

  sendChangeEquipmentRequest(payload: { equipmentId: number, stageId: number }) {
    return this.sendMessage('CHANGE_EQUIPMENT_REQUEST', payload)
  }

  sendChangeMaterialVariantRequest(payload: { materialVariantId: number, stageId: number }) {
    return this.sendMessage('CHANGE_MATERIAL_VARIANT_REQUEST', payload)
  }

  sendChangeOperationQuantityRequest(payload: { stageId: number, quantityValue: number }) {
    return this.sendMessage('CHANGE_OPERATION_QUANTITY_REQUEST', payload)
  }

  sendChangeMaterialQuantityRequest(payload: { stageId: number, quantityValue: number }) {
    return this.sendMessage('CHANGE_MATERIAL_QUANTITY_REQUEST', payload)
  }

  sendChangeCustomFieldsValueRequest(payload: { stageId: number, customFieldsValue: Array<{ CODE: string, VALUE: string }> }) {
    return this.sendMessage('CHANGE_CUSTOM_FIELDS_VALUE_REQUEST', payload)
  }

  sendChangeOptionsOperation(payload: { stageId: number, json: string }) {
    return this.sendMessage('CHANGE_OPTIONS_OPERATION', payload)
  }

  sendChangeOptionsMaterial(payload: { stageId: number, json: string }) {
    return this.sendMessage('CHANGE_OPTIONS_MATERIAL', payload)
  }

  sendClearOptionsOperation(payload: { stageId: number }) {
    return this.sendMessage('CLEAR_OPTIONS_OPERATION', payload)
  }

  sendClearOptionsMaterial(payload: { stageId: number }) {
    return this.sendMessage('CLEAR_OPTIONS_MATERIAL', payload)
  }

  // Group operations
  sendAddGroupRequest(payload: { name: string, detailIds: (number | string)[], iblockId: number, iblockType: string }) {
    return this.sendMessage('ADD_GROUP_REQUEST', payload)
  }

  sendUpdateGroupRequest(payload: { groupId: string, updates: { name?: string }, iblockId: number, iblockType: string }) {
    return this.sendMessage('UPDATE_GROUP_REQUEST', payload)
  }

  sendDeleteGroupRequest(payload: { groupId: string, detailIdToKeep?: number | string, deleteAll?: boolean, iblockId: number, iblockType: string }) {
    return this.sendMessage('DELETE_GROUP_REQUEST', payload)
  }

  // Preset operations
  sendClearPresetRequest(payload: { iblockId: number, iblockType: string }) {
    return this.sendMessage('CLEAR_PRESET_REQUEST', payload)
  }

  // Sorting operations
  sendChangeSortStageRequest(payload: ChangeSortStageRequestPayload) {
    return this.sendMessage('CHANGE_SORT_STAGE_REQUEST', payload)
  }

  sendChangeDetailSortRequest(payload: ChangeDetailSortRequestPayload) {
    return this.sendMessage('CHANGE_DETAIL_SORT_REQUEST', payload)
  }

  sendChangeDetailLevelRequest(payload: ChangeDetailLevelRequestPayload) {
    return this.sendMessage('CHANGE_DETAIL_LEVEL_REQUEST', payload)
  }

  // Binding operations
  sendAddDetailToBindingRequest(payload: AddDetailToBindingRequestPayload) {
    return this.sendMessage('ADD_DETAIL_TO_BINDING_REQUEST', payload)
  }

  sendSelectDetailsToBindingRequest(payload: SelectDetailsToBindingRequestPayload) {
    return this.sendMessage('SELECT_DETAILS_TO_BINDING_REQUEST', payload)
  }

  // Preset prices operation
  sendUpdatePresetPricesRequest(payload: UpdatePresetPricesRequestPayload) {
    return this.sendMessage('UPDATE_PRESET_PRICES_REQUEST', payload)
  }

  sendChangePricePresetRequest(prices: Array<{
    typeId: number
    price: number
    currency: 'RUB' | 'PRC'
    quantityFrom: number | null
    quantityTo: number | null
  }>) {
    return this.sendMessage('CHANGE_PRICE_PRESET_REQUEST', prices)
  }

  // Stage logic operations
  sendSaveCalcLogicRequest(payload: SaveCalcLogicRequestPayload): string | undefined {
    return this.sendMessage('SAVE_CALC_LOGIC_REQUEST', payload)
  }

  on(type: MessageType | '*', callback: (message: PwrtMessage) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(callback)

    return () => {
      this.off(type, callback)
    }
  }

  off(type: MessageType | '*', callback: (message: PwrtMessage) => void) {
    const listeners = this.listeners.get(type)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  clear() {
    this.listeners.clear()
  }
}

export const postMessageBridge = new PostMessageBridge()
