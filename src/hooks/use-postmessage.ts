import { useCallback } from 'react'
import { 
  postMessageBridge, 
  MessageType, 
  PwrtMessage,
  InitPayload
} from '@/lib/postmessage-bridge'

export function usePostMessage() {
  const subscribe = useCallback((type: MessageType | '*', callback: (message: PwrtMessage) => void) => {
    return postMessageBridge.on(type, callback)
  }, [])

  const sendError = useCallback((code: string, message: string, details?: any, context?: any) => {
    postMessageBridge.sendError(code, message, details, context)
  }, [])

  const sendCloseRequest = useCallback((saved: boolean, hasChanges: boolean) => {
    postMessageBridge.sendCloseRequest(saved, hasChanges)
  }, [])

  const sendInitDone = useCallback((offersCount: number) => {
    postMessageBridge.sendInitDone(offersCount)
  }, [])

  return {
    subscribe,
    sendError,
    sendCloseRequest,
    sendInitDone,
  }
}

export type { 
  PwrtMessage,
  InitPayload,
  MessageType 
}
