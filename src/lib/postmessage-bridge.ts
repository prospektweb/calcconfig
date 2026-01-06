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
  
  // Загрузка данных элемента
  | 'LOAD_ELEMENT_REQUEST'  // Объединяет CALC_SETTINGS_REQUEST, CALC_OPERATION_REQUEST и т.д.
  
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
  | 'SELECT_DETAILS_RESPONSE'
  
  // Детали
  | 'ADD_DETAIL_REQUEST'      // переименован из ADD_NEW_DETAIL_REQUEST
  | 'UPDATE_DETAIL_REQUEST'   // объединяет CHANGE_NAME_DETAIL_REQUEST
  | 'DELETE_DETAIL_REQUEST'
  
  // Этапы
  | 'ADD_STAGE_REQUEST'       // переименован из ADD_NEW_STAGE_REQUEST
  | 'UPDATE_STAGE_REQUEST' 
  | 'DELETE_STAGE_REQUEST'
  
  // Группы/Скрепления
  | 'ADD_GROUP_REQUEST'       // переименован из ADD_NEW_GROUP_REQUEST
  | 'UPDATE_GROUP_REQUEST'    // НОВЫЙ
  | 'DELETE_GROUP_REQUEST'
  
  // Сортировка
  | 'REORDER_REQUEST'         // НОВЫЙ
  
  // Диапазоны цен
  | 'ADD_PRICE_RANGE_REQUEST'
  | 'DELETE_PRICE_RANGE_REQUEST'

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
  priceTypes?: Array<{
    id: number
    name: string
    base: boolean
    sort: number
  }>
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
 * Payload for LOAD_ELEMENT_REQUEST - unified request for loading calculator elements
 */
export interface LoadElementRequestPayload {
  elementType: 'calculator' | 'operation' | 'material' | 'equipment'
  elementId: number
  iblockId: number
  iblockType: string
}

/**
 * Payload for UPDATE_DETAIL_REQUEST
 */
export interface UpdateDetailRequestPayload {
  detailId: number
  updates: {
    name?: string
    width?: number
    length?: number
  }
  iblockId: number
  iblockType: string
}

/**
 * Payload for ADD_STAGE_REQUEST
 */
export interface AddStageRequestPayload {
  detailId: number              // ID детали (Bitrix)
  previousStageId?: number      // ID предыдущего этапа (для определения позиции)
  iblockId: number
  iblockType: string
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
 * Payload for REORDER_REQUEST
 */
export interface ReorderRequestPayload {
  entityType: 'details' | 'stages' | 'groups'
  parentId?: number             // Для stages - ID детали
  orderedIds: number[]          // Новый порядок ID
  iblockId: number
  iblockType: string
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

  sendLoadElementRequest(elementType: 'calculator' | 'operation' | 'material' | 'equipment', elementId: number, iblockId: number, iblockType: string) {
    return this.sendMessage('LOAD_ELEMENT_REQUEST', {
      elementType,
      elementId,
      iblockId,
      iblockType,
    })
  }

  // Legacy methods for backward compatibility - they now use sendLoadElementRequest
  sendCalcSettingsRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    return this.sendLoadElementRequest('calculator', id, iblockId, iblockType)
  }

  sendCalcOperationVariantRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    return this.sendLoadElementRequest('operation', id, iblockId, iblockType)
  }

  sendCalcMaterialVariantRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    return this.sendLoadElementRequest('material', id, iblockId, iblockType)
  }

  sendRefreshRequest(offerIds: number[]) {
    this.sendMessage('REFRESH_REQUEST', {
      offerIds,
    })
  }

  // Detail operations
  sendAddDetailRequest(payload: { offerIds: number[], name: string, iblockId: number, iblockType: string }) {
    return this.sendMessage('ADD_DETAIL_REQUEST', payload)
  }

  sendSelectDetailsRequest(payload: { iblockId: number, iblockType: string }) {
    return this.sendMessage('SELECT_DETAILS_REQUEST', payload)
  }

  sendUpdateDetailRequest(payload: UpdateDetailRequestPayload) {
    return this.sendMessage('UPDATE_DETAIL_REQUEST', payload)
  }

  sendDeleteDetailRequest(payload: { detailId: number, iblockId: number, iblockType: string }) {
    return this.sendMessage('DELETE_DETAIL_REQUEST', payload)
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

  // Reorder operation
  sendReorderRequest(payload: ReorderRequestPayload) {
    return this.sendMessage('REORDER_REQUEST', payload)
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
