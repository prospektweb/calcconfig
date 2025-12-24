import { AppState, Detail, Binding, HeaderElement, CostingSettings, SalePricesSettings, HeaderTabsState } from './types'
import { BitrixTreeItem, BitrixProperty } from './bitrix-transformers'

export type MessageType =
  | 'READY'
  | 'INIT'
  | 'INIT_DONE'
  | 'CALC_PREVIEW'
  | 'SAVE_REQUEST'
  | 'SAVE_RESULT'
  | 'ERROR'
  | 'CLOSE_REQUEST'
  | 'ADD_OFFER_REQUEST'
  | 'REMOVE_OFFER_REQUEST'
  | 'SELECT_REQUEST'
  | 'SELECT_DONE'
  | 'CONFIG_ITEM_REMOVE'
  | 'HEADER_ITEM_REMOVE'
  | 'REFRESH_REQUEST'
  | 'REFRESH_RESULT'
  | 'CALC_SETTINGS_REQUEST'
  | 'CALC_SETTINGS_RESPONSE'
  | 'CALC_OPERATION_REQUEST'
  | 'CALC_OPERATION_RESPONSE'
  | 'CALC_MATERIAL_REQUEST'
  | 'CALC_MATERIAL_RESPONSE'
  | 'CALC_OPERATION_VARIANT_REQUEST'
  | 'CALC_OPERATION_VARIANT_RESPONSE'
  | 'CALC_MATERIAL_VARIANT_REQUEST'
  | 'CALC_MATERIAL_VARIANT_RESPONSE'
  | 'SYNC_VARIANTS_REQUEST'
  | 'SYNC_VARIANTS_RESPONSE'
  | 'ADD_NEW_DETAIL_REQUEST'
  | 'ADD_NEW_DETAIL_RESPONSE'
  | 'GET_DETAIL_REQUEST'
  | 'GET_DETAIL_RESPONSE'
  | 'COPY_DETAIL_REQUEST'
  | 'COPY_DETAIL_RESPONSE'
  | 'USE_DETAIL_REQUEST'
  | 'USE_DETAIL_RESPONSE'
  | 'DELETE_DETAIL_REQUEST'
  | 'DELETE_DETAIL_RESPONSE'
  | 'DELETE_STAGE_REQUEST'
  | 'DELETE_STAGE_RESPONSE'
  | 'CHANGE_NAME_DETAIL_REQUEST'
  | 'CHANGE_NAME_DETAIL_RESPONSE'
  | 'ADD_NEW_GROUP_REQUEST'
  | 'ADD_NEW_GROUP_RESPONSE'
  | 'DELETE_GROUP_REQUEST'
  | 'DELETE_GROUP_RESPONSE'
  | 'ADD_NEW_STAGE_REQUEST'
  | 'ADD_NEW_STAGE_RESPONSE'

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
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG'
  context: {
    siteId: string
    userId: string
    lang: 'ru' | 'en'
    timestamp: number
    url: string
  }
  iblocks: {
    products: number
    offers: number
    calcDetails: number
    calcDetailsVariants: number
    calcMaterials: number
    calcMaterialsVariants: number
    calcOperations: number
    calcOperationsVariants: number
    calcEquipment: number
    calcSettings?: number
    calcConfig?: number
  }
  iblocksTypes: Record<string, string>
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
  config?: {
    id: number
    name: string
    data: ConfigData
  }
  priceTypes?: Array<{
    id: number
    name: string
    base: boolean
    sort: number
  }>
}

export interface ConfigData {
  details: Detail[]
  bindings: Binding[]
  costingSettings?: CostingSettings
  salePricesSettings?: SalePricesSettings
  headerTabs?: HeaderTabsState
}

export interface CalcPreviewPayload {
  type: 'test' | 'full'
  results: Array<{
    offerId: number
    dimensions?: {
      width: number
      length: number
      height: number
      weight: number
    }
    cost?: {
      materials: number
      operations: number
      equipment: number
      total: number
    }
    prices?: Record<string, number>
    errors?: string[]
  }>
  summary: {
    totalCost: number
    calculatedAt: number
  }
}

export interface SaveRequestPayload {
  configuration: {
    name: string
    data: ConfigData
  }
  offerUpdates: Array<{
    offerId: number
    fields?: Record<string, any>
    prices?: Record<string, number>
    properties?: Record<string, any>
    comments?: string
  }>
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG'
  configId?: number
}

export interface SaveResultPayload {
  status: 'ok' | 'error' | 'partial'
  configId?: number
  successOffers?: number[]
  errors?: Array<{
    offerId: number
    message: string
    code?: string
  }>
  message?: string
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

/**
 * Payload for sync variants request
 */
export interface SyncVariantsRequestPayload {
  items: Array<{
    id: string
    type: 'detail' | 'binding'
    name: string
    bitrixId?: number
    calculators: Array<{
      id: string
      calculatorCode?: number
      operationVariantId?: number
      materialVariantId?: number
      equipmentId?: number
      operationQuantity?: number
      materialQuantity?: number
      otherOptions?: Record<string, any>
      configId?: number
    }>
    // Только для скреплений
    bindingCalculators?: Array<{
      id: string
      calculatorCode?: number
      operationVariantId?: number
      materialVariantId?: number
      equipmentId?: number
      operationQuantity?: number
      materialQuantity?: number
      otherOptions?: Record<string, any>
      configId?: number
    }>
    finishingCalculators?: Array<{
      id: string
      calculatorCode?: number
      operationVariantId?: number
      materialVariantId?: number
      equipmentId?: number
      operationQuantity?: number
      materialQuantity?: number
      otherOptions?: Record<string, any>
      configId?: number
    }>
    childIds?: string[]
  }>
  offerIds: number[]
  deletedConfigIds?: number[]
  context: {
    mode: 'NEW_CONFIG' | 'EXISTING_CONFIG'
    configId?: number
    timestamp: number
  }
}

/**
 * Payload for sync variants response
 */
export interface SyncVariantsResponsePayload {
  status: 'ok' | 'error' | 'partial'
  items: Array<{
    id: string
    bitrixId: number
    type: 'detail' | 'binding'
    calculators: Array<{
      id: string
      configId: number
    }>
  }>
  canCalculate: boolean
  stats: {
    detailsCreated: number
    detailsUpdated: number
    configsCreated: number
  }
  errors?: Array<{
    itemId?: string
    message: string
  }>
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
        
        if (isDebug || ['INIT', 'REFRESH_RESULT'].includes(message.type)) {
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

  sendInitDone(mode: 'NEW_CONFIG' | 'EXISTING_CONFIG', offersCount: number) {
    this.sendMessage('INIT_DONE', {
      mode,
      offersCount,
    })
  }

  sendCalcPreview(payload: CalcPreviewPayload) {
    this.sendMessage('CALC_PREVIEW', payload)
  }

  sendSaveRequest(payload: SaveRequestPayload): string {
    const requestId = `save_${Date.now()}`
    this.sendMessage('SAVE_REQUEST', payload, requestId)
    return requestId
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

  sendAddOfferRequest(iblockId: number, iblockType: string, lang: string) {
    return this.sendMessage('ADD_OFFER_REQUEST', {
      iblockId,
      iblockType,
      lang,
    })
  }

  sendRemoveOfferRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    this.sendMessage('REMOVE_OFFER_REQUEST', {
      id,
      iblockId,
      iblockType,
      lang,
    })
  }

  sendCalcSettingsRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    return this.sendMessage('CALC_SETTINGS_REQUEST', {
      id,
      iblockId,
      iblockType,
      lang,
    })
  }

  sendCalcOperationRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    return this.sendMessage('CALC_OPERATION_REQUEST', {
      id,
      iblockId,
      iblockType,
      lang,
    })
  }

  sendCalcMaterialRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    return this.sendMessage('CALC_MATERIAL_REQUEST', {
      id,
      iblockId,
      iblockType,
      lang,
    })
  }

  sendCalcOperationVariantRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    return this.sendMessage('CALC_OPERATION_VARIANT_REQUEST', {
      id,
      iblockId,
      iblockType,
      lang,
    })
  }

  sendCalcMaterialVariantRequest(id: number, iblockId: number, iblockType: string, lang: string) {
    return this.sendMessage('CALC_MATERIAL_VARIANT_REQUEST', {
      id,
      iblockId,
      iblockType,
      lang,
    })
  }

  sendSelectRequest(iblockId: number, iblockType: string, lang: string) {
    return this.sendMessage('SELECT_REQUEST', {
      iblockId,
      iblockType,
      lang,
    })
  }

  sendConfigItemRemove(kind: 'detail' | 'material' | 'operation' | 'equipment', id: number) {
    this.sendMessage('CONFIG_ITEM_REMOVE', {
      kind,
      id,
    })
  }
  
  sendHeaderItemRemove(kind: 'detail' | 'material' | 'operation' | 'equipment', id: number) {
    this.sendMessage('HEADER_ITEM_REMOVE', {
      kind,
      id,
    })
  }
  
  sendRefreshRequest(offerIds: number[]) {
    this.sendMessage('REFRESH_REQUEST', {
      offerIds,
    })
  }

  sendSyncVariantsRequest(payload: SyncVariantsRequestPayload): string {
    const requestId = `sync_variants_${Date.now()}`
    this.sendMessage('SYNC_VARIANTS_REQUEST', payload, requestId)
    return requestId
  }

  // Detail operations
  sendAddNewDetailRequest(payload: { offerIds: number[], name: string, iblockId: number, iblockType: string }) {
    return this.sendMessage('ADD_NEW_DETAIL_REQUEST', payload)
  }

  sendGetDetailRequest(payload: { iblockId: number, iblockType: string }) {
    return this.sendMessage('GET_DETAIL_REQUEST', payload)
  }

  sendCopyDetailRequest(payload: { detailId: number, offerIds: number[], iblockId: number, iblockType: string }) {
    return this.sendMessage('COPY_DETAIL_REQUEST', payload)
  }

  sendUseDetailRequest(payload: { detailId: number, offerIds: number[], iblockId: number, iblockType: string }) {
    return this.sendMessage('USE_DETAIL_REQUEST', payload)
  }

  sendDeleteDetailRequest(payload: { detailId: number, iblockId: number, iblockType: string }) {
    return this.sendMessage('DELETE_DETAIL_REQUEST', payload)
  }

  sendChangeNameDetailRequest(payload: { detailId: number, newName: string, iblockId: number, iblockType: string }) {
    return this.sendMessage('CHANGE_NAME_DETAIL_REQUEST', payload)
  }

  // Stage operations
  sendDeleteStageRequest(payload: { configId: number, iblockId: number, iblockType: string }) {
    return this.sendMessage('DELETE_STAGE_REQUEST', payload)
  }

  // Group operations
  sendAddNewGroupRequest(payload: { name: string, detailIds: (number | string)[], iblockId: number, iblockType: string }) {
    return this.sendMessage('ADD_NEW_GROUP_REQUEST', payload)
  }

  sendDeleteGroupRequest(payload: { groupId: string, detailIdToKeep?: number | string, deleteAll?: boolean, iblockId: number, iblockType: string }) {
    return this.sendMessage('DELETE_GROUP_REQUEST', payload)
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
