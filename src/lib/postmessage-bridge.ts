import { AppState, Detail, Binding, HeaderElement, CostingSettings, SalePricesSettings } from './types'

export type MessageType =
  | 'READY'
  | 'INIT'
  | 'INIT_DONE'
  | 'CALC_PREVIEW'
  | 'SAVE_REQUEST'
  | 'SAVE_RESULT'
  | 'ERROR'
  | 'CLOSE_REQUEST'
  | 'SELECT_REQUEST'
  | 'ADD_OFFER_REQUEST'
  | 'REMOVE_OFFER_REQUEST'
  | 'CONFIG_ITEM_REMOVE'
  | 'HEADER_ITEM_REMOVE'
  | 'REFRESH_REQUEST'
  | 'REFRESH_RESULT'

export type MessageSource = 'prospektweb.calc' | 'bitrix'

export interface PwrtMessage {
  protocol: string
  version: string
  source: MessageSource
  target: MessageSource
  type: MessageType
  pwcode: string
  requestId: string | null
  timestamp: number
  payload: any
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
    calculators?: number
    configurations?: number
  }
  iblocksTypes: Record<string, string>
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
}

export interface ConfigData {
  details: Detail[]
  bindings: Binding[]
  costingSettings?: CostingSettings
  salePricesSettings?: SalePricesSettings
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

class PostMessageBridge {
  private targetOrigin: string = '*'
  private listeners: Map<MessageType | '*', Set<(message: PwrtMessage) => void>> = new Map()
  private isInitialized = false
  private protocolVersion = '1.0.0'
  private protocolCode = 'pwrt-v1'

  constructor() {
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

  private buildMessage(type: MessageType, payload: any = {}, requestId?: string | null, pwcode?: string): PwrtMessage {
    const timestamp = Date.now()
    const resolvedRequestId = requestId === undefined
      ? `req_${type.toLowerCase()}_${timestamp}`
      : requestId

    return {
      protocol: this.protocolCode,
      version: this.protocolVersion,
      source: 'prospektweb.calc',
      target: 'bitrix',
      type,
      pwcode: pwcode ?? 'system',
      requestId: resolvedRequestId ?? null,
      timestamp,
      payload: payload ?? {},
    }
  }

  private sendMessage(type: MessageType, payload: any = {}, requestId?: string | null, pwcode?: string) {
    if (typeof window === 'undefined') return

    const message = this.buildMessage(type, payload, requestId, pwcode)

    const isDebug = typeof localStorage !== 'undefined' && localStorage.getItem('pwrt_debug') === '1'
    
    if (isDebug || ['INIT_DONE', 'REFRESH_REQUEST'].includes(type)) {
      console.log('[PostMessageBridge] Sending:', type, payload)
    }

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, this.targetOrigin)
    } else {
      window.postMessage(message, this.targetOrigin)
    }
  }

  sendReady() {
    this.sendMessage('READY', {
      version: this.protocolVersion,
    }, null, 'system')
  }

  sendInitDone(mode: 'NEW_CONFIG' | 'EXISTING_CONFIG', offersCount: number) {
    this.sendMessage('INIT_DONE', {
      mode,
      offersCount,
    }, null, 'system')
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
    }, undefined, 'system')
  }

  sendCloseRequest(saved: boolean, hasChanges: boolean) {
    this.sendMessage('CLOSE_REQUEST', {
      saved,
      hasChanges,
    }, undefined, 'system')
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
  
  sendRefreshRequest(refreshPayload: Array<{ iblockId: number, iblockType: string, ids: number[] }>) {
    this.sendMessage('REFRESH_REQUEST', refreshPayload, undefined, 'btn-refresh')
  }

  sendSelectRequest(payload: { iblockId: number, iblockType: string, lang: string, tab: string }) {
    this.sendMessage('SELECT_REQUEST', payload, undefined, 'btn-select')
  }

  sendAddOfferRequest(payload: { offerIds: number[] }) {
    this.sendMessage('ADD_OFFER_REQUEST', payload, undefined, 'btn-add-offer')
  }

  sendRemoveOfferRequest(payload: { iblockId: number, iblockType: string, id: number }) {
    this.sendMessage('REMOVE_OFFER_REQUEST', payload, undefined, 'btn-remove-offer')
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
