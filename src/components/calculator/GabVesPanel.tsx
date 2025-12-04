import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CaretDown, CaretUp, Cube } from '@phosphor-icons/react'

interface GabVesMessage {
  id: string
  timestamp: number
  message: string
}

interface GabVesPanelProps {
  messages: GabVesMessage[]
  isExpanded: boolean
  onToggle: () => void
}

export function GabVesPanel({ messages, isExpanded, onToggle }: GabVesPanelProps) {
  return (
    <div className="border-t border-border bg-card">
      <div className="max-w-[1920px] mx-auto">
        <button
          onClick={onToggle}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <span className="text-sm font-medium flex items-center gap-2">
            <Cube className="w-4 h-4" />
            Габариты и Вес
          </span>
          {isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
        </button>
        
        {isExpanded && (
          <ScrollArea className="h-[150px] px-4 pb-2">
            <div className="space-y-1">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Нет сообщений о габаритах и весе</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="flex items-start gap-2 py-1">
                    <Badge className="bg-accent text-accent-foreground">
                      <Cube className="w-4 h-4" />
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
