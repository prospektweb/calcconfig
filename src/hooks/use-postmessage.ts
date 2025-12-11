import { useCallback } from 'react'
import { 
  postMessageBridge, 
  MessageType, 
  PwrtMessage,
  InitPayload,
  CalcPreviewPayload,
  SaveRequestPayload,
  SaveResultPayload
} from '@/lib/postmessage-bridge'

export function usePostMessage() {
  const subscribe = useCallback((type: MessageType | '*', callback: (message: PwrtMessage) => void) => {
    return postMessageBridge.on(type, callback)
  }, [])

  const sendCalcPreview = useCallback((payload: CalcPreviewPayload) => {
    postMessageBridge.sendCalcPreview(payload)
  }, [])

  const sendSaveRequest = useCallback((payload: SaveRequestPayload) => {
    return postMessageBridge.sendSaveRequest(payload)
  }, [])

  const sendError = useCallback((code: string, message: string, details?: any, context?: any) => {
    postMessageBridge.sendError(code, message, details, context)
  }, [])

  const sendCloseRequest = useCallback((saved: boolean, hasChanges: boolean) => {
    postMessageBridge.sendCloseRequest(saved, hasChanges)
  }, [])

  const sendInitDone = useCallback((mode: 'NEW_CONFIG' | 'EXISTING_CONFIG', offersCount: number) => {
    postMessageBridge.sendInitDone(mode, offersCount)
  }, [])

  return {
    subscribe,
    sendCalcPreview,
    sendSaveRequest,
    sendError,
    sendCloseRequest,
    sendInitDone,
  }
}

export type { 
  PwrtMessage,
  InitPayload,
  CalcPreviewPayload,
  SaveRequestPayload,
  SaveResultPayload,
  MessageType 
}
