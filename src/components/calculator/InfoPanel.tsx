import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CaretDown, CaretUp, Info, Warning, X as XIcon } from '@phosphor-icons/react'
import { InfoMessage } from '@/lib/types'

interface InfoPanelProps {
  messages: InfoMessage[]
  isExpanded: boolean
  onToggle: () => void
}

export function InfoPanel({ messages, isExpanded, onToggle }: InfoPanelProps) {
  const getMessageIcon = (type: InfoMessage['type']) => {
    switch (type) {
      case 'error':
        return <XIcon className="w-4 h-4" />
      case 'warning':
        return <Warning className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  const getMessageColor = (type: InfoMessage['type']) => {
    switch (type) {
      case 'error':
        return 'bg-error text-error-foreground'
      case 'warning':
        return 'bg-warning text-warning-foreground'
      case 'success':
        return 'bg-success text-success-foreground'
      default:
        return 'bg-accent text-accent-foreground'
    }
  }

  return (
    <div className="border-t border-border bg-card">
      <div className="max-w-[1920px] mx-auto">
        <button
          onClick={onToggle}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <span className="text-sm font-medium">Информация</span>
          {isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
        </button>
        
        {isExpanded && (
          <ScrollArea className="h-[150px] px-4 pb-2">
            <div className="space-y-1">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Нет сообщений</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="flex items-start gap-2 py-1">
                    <Badge className={getMessageColor(msg.type)}>
                      {getMessageIcon(msg.type)}
                    </Badge>
                    <span className="text-sm flex-1">{msg.message}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
