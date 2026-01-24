import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEffect, useState } from 'react'
import { postMessageBridge } from '@/lib/postmessage-bridge'

interface HelpDetailDialogProps {
  isOpen: boolean
  onClose: () => void
  placeCode: string
  title: string
}

export function HelpDetailDialog({ isOpen, onClose, placeCode, title }: HelpDetailDialogProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !placeCode) return

    setLoading(true)
    setContent('')

    // Send request for info text
    const requestId = postMessageBridge.sendInfoTextRequest({ placeCode })

    // Listen for response
    const unsubscribe = postMessageBridge.on('INFOTEXT_RESPONSE', (message) => {
      if (message.payload?.placeCode === placeCode) {
        setContent(message.payload?.text || 'Информация не найдена')
        setLoading(false)
      }
    })

    // Timeout fallback
    const timeout = setTimeout(() => {
      if (loading) {
        setContent('Информация временно недоступна. Попробуйте позже.')
        setLoading(false)
      }
    }, 5000)

    return () => {
      unsubscribe()
      clearTimeout(timeout)
    }
  }, [isOpen, placeCode])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Загрузка...
            </div>
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
