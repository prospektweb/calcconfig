import { useEffect, useCallback, useRef } from 'react'
import { postMessageBridge, MessageType, CalculatorState } from '@/lib/postmessage-bridge'

interface UsePostMessageOptions {
  onStateRequest?: () => CalculatorState | null
  onStateResponse?: (state: CalculatorState) => void
  syncOnChange?: boolean
  syncDelay?: number
}

export function usePostMessage(options: UsePostMessageOptions = {}) {
  const {
    onStateRequest,
    onStateResponse,
    syncOnChange = true,
    syncDelay = 300,
  } = options

  const syncTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const lastStateRef = useRef<string>('')

  useEffect(() => {
    const unsubscribeStateRequest = postMessageBridge.on('STATE_REQUEST', () => {
      if (onStateRequest) {
        const state = onStateRequest()
        if (state) {
          postMessageBridge.sendMessage('STATE_RESPONSE', state)
        }
      }
    })

    const unsubscribeStateResponse = postMessageBridge.on('STATE_RESPONSE', (data) => {
      if (onStateResponse && data) {
        onStateResponse(data as CalculatorState)
      }
    })

    return () => {
      unsubscribeStateRequest()
      unsubscribeStateResponse()
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [onStateRequest, onStateResponse])

  const syncState = useCallback((state: Partial<CalculatorState>) => {
    const stateString = JSON.stringify(state)
    
    if (stateString === lastStateRef.current) {
      return
    }

    lastStateRef.current = stateString

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    syncTimeoutRef.current = setTimeout(() => {
      postMessageBridge.sendStateUpdate(state)
    }, syncDelay)
  }, [syncDelay])

  const syncStateImmediate = useCallback((state: Partial<CalculatorState>) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }
    postMessageBridge.sendStateUpdate(state)
  }, [])

  const sendMessage = useCallback((type: MessageType, data?: any) => {
    postMessageBridge.sendMessage(type, data)
  }, [])

  const subscribe = useCallback((type: MessageType | '*', callback: (data: any) => void) => {
    return postMessageBridge.on(type, callback)
  }, [])

  const requestState = useCallback(() => {
    postMessageBridge.requestState()
  }, [])

  const sendVariantRemove = useCallback((variantIds: number[]) => {
    postMessageBridge.sendMessage('VARIANT_REMOVE', { variantIds })
  }, [])

  const sendVariantSelectRequest = useCallback(() => {
    postMessageBridge.sendMessage('VARIANT_SELECT_REQUEST', {})
  }, [])

  return {
    syncState,
    syncStateImmediate,
    sendMessage,
    subscribe,
    requestState,
    sendVariantRemove,
    sendVariantSelectRequest,
  }
}
