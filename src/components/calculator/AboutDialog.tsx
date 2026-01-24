import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEffect, useState } from 'react'
import { postMessageBridge } from '@/lib/postmessage-bridge'

interface AboutDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    setContent('')

    // Send request for info text
    postMessageBridge.sendInfoTextRequest({ placeCode: 'about' })

    // Listen for response
    const unsubscribe = postMessageBridge.on('INFOTEXT_RESPONSE', (message) => {
      if (message.payload?.placeCode === 'about') {
        setContent(message.payload?.text || 'Информация не найдена')
        setLoading(false)
      }
    })

    // Timeout fallback
    const timeout = setTimeout(() => {
      // Check loading state via setLoading callback to avoid stale closure
      setLoading(prev => {
        if (prev) {
          setContent('Информация временно недоступна. Попробуйте позже.')
        }
        return false
      })
    }, 5000)

    return () => {
      unsubscribe()
      clearTimeout(timeout)
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>О программе</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Загрузка...
            </div>
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
