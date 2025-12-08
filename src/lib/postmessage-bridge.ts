import { AppState, Detail, Binding, HeaderElement } from './types'

export type MessageType = 
  | 'INIT'
  | 'STATE_UPDATE'
  | 'STATE_REQUEST'
  | 'STATE_RESPONSE'
  | 'VARIANT_SELECTED'
  | 'DETAIL_ADDED'
  | 'DETAIL_UPDATED'
  | 'DETAIL_DELETED'
  | 'BINDING_CREATED'
  | 'BINDING_UPDATED'
  | 'BINDING_DELETED'
  | 'CALCULATION_START'
  | 'CALCULATION_PROGRESS'
  | 'CALCULATION_COMPLETE'
  | 'ERROR'

export interface PostMessagePayload {
  type: MessageType
  data?: any
  timestamp?: number
  error?: string
}

export interface CalculatorState {
  selectedVariantIds: number[]
  testVariantId: number | null
  headerTabs: {
    materials: HeaderElement[]
    operations: HeaderElement[]
    equipment: HeaderElement[]
    details: HeaderElement[]
  }
  details: Detail[]
  bindings: Binding[]
}

class PostMessageBridge {
  private targetOrigin: string = '*'
  private listeners: Map<MessageType, Set<(data: any) => void>> = new Map()
  private isInitialized = false

  constructor() {
    this.initializeListener()
  }

  private initializeListener() {
    if (typeof window === 'undefined') return

    window.addEventListener('message', (event: MessageEvent) => {
      try {
        const payload = event.data as PostMessagePayload
        
        if (!payload || !payload.type) return

        console.log('[PostMessageBridge] Received:', payload.type, payload.data)

        const listeners = this.listeners.get(payload.type)
        if (listeners) {
          listeners.forEach(callback => {
            try {
              callback(payload.data)
            } catch (error) {
              console.error('[PostMessageBridge] Listener error:', error)
            }
          })
        }

        const allListeners = this.listeners.get('*' as MessageType)
        if (allListeners) {
          allListeners.forEach(callback => {
            try {
              callback(payload)
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
    this.sendMessage('INIT', { ready: true })
  }

  setTargetOrigin(origin: string) {
    this.targetOrigin = origin
  }

  sendMessage(type: MessageType, data?: any) {
    if (typeof window === 'undefined') return

    const payload: PostMessagePayload = {
      type,
      data,
      timestamp: Date.now(),
    }

    console.log('[PostMessageBridge] Sending:', type, data)

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, this.targetOrigin)
    } else {
      window.postMessage(payload, this.targetOrigin)
    }
  }

  sendError(error: string, data?: any) {
    this.sendMessage('ERROR', { error, ...data })
  }

  sendStateUpdate(state: Partial<CalculatorState>) {
    this.sendMessage('STATE_UPDATE', state)
  }

  requestState() {
    this.sendMessage('STATE_REQUEST', {})
  }

  on(type: MessageType | '*', callback: (data: any) => void): () => void {
    const typeKey = type as MessageType
    if (!this.listeners.has(typeKey)) {
      this.listeners.set(typeKey, new Set())
    }
    this.listeners.get(typeKey)!.add(callback)

    return () => {
      this.off(typeKey, callback)
    }
  }

  off(type: MessageType | '*', callback: (data: any) => void) {
    const typeKey = type as MessageType
    const listeners = this.listeners.get(typeKey)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  clear() {
    this.listeners.clear()
  }
}

export const postMessageBridge = new PostMessageBridge()

export const usePostMessageSync = () => {
  const syncState = (state: Partial<CalculatorState>) => {
    postMessageBridge.sendStateUpdate(state)
  }

  const notifyVariantSelected = (variantIds: number[], testVariantId: number | null) => {
    postMessageBridge.sendMessage('VARIANT_SELECTED', { variantIds, testVariantId })
  }

  const notifyDetailAdded = (detail: Detail) => {
    postMessageBridge.sendMessage('DETAIL_ADDED', { detail })
  }

  const notifyDetailUpdated = (detailId: string, updates: Partial<Detail>) => {
    postMessageBridge.sendMessage('DETAIL_UPDATED', { detailId, updates })
  }

  const notifyDetailDeleted = (detailId: string) => {
    postMessageBridge.sendMessage('DETAIL_DELETED', { detailId })
  }

  const notifyBindingCreated = (binding: Binding) => {
    postMessageBridge.sendMessage('BINDING_CREATED', { binding })
  }

  const notifyBindingUpdated = (bindingId: string, updates: Partial<Binding>) => {
    postMessageBridge.sendMessage('BINDING_UPDATED', { bindingId, updates })
  }

  const notifyBindingDeleted = (bindingId: string) => {
    postMessageBridge.sendMessage('BINDING_DELETED', { bindingId })
  }

  const notifyCalculationStart = () => {
    postMessageBridge.sendMessage('CALCULATION_START', {})
  }

  const notifyCalculationProgress = (progress: number, currentDetail?: string) => {
    postMessageBridge.sendMessage('CALCULATION_PROGRESS', { progress, currentDetail })
  }

  const notifyCalculationComplete = (result: any) => {
    postMessageBridge.sendMessage('CALCULATION_COMPLETE', { result })
  }

  return {
    syncState,
    notifyVariantSelected,
    notifyDetailAdded,
    notifyDetailUpdated,
    notifyDetailDeleted,
    notifyBindingCreated,
    notifyBindingUpdated,
    notifyBindingDeleted,
    notifyCalculationStart,
    notifyCalculationProgress,
    notifyCalculationComplete,
  }
}
