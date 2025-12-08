import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CaretDown, CaretUp, CurrencyDollar } from '@phosphor-icons/react'

interface CostMessage {
  id: string
  timestamp: number
  message: string
}

interface CostPanelProps {
  messages: CostMessage[]
  isExpanded: boolean
  onToggle: () => void
}

export function CostPanel({ messages, isExpanded, onToggle }: CostPanelProps) {
  return (
    <div className="border-t border-border bg-card">
      <div className="max-w-[1920px] mx-auto">
        <button
          onClick={onToggle}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <span className="text-sm font-medium flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <CurrencyDollar className="w-4 h-4" />
            </div>
            Себестоимость
          </span>
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            {isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
          </div>
        </button>
        
        {isExpanded && (
          <ScrollArea className="h-[150px] px-4 pb-2">
            <div className="space-y-1">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Нет данных по себестоимости</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="flex items-start gap-2 py-1">
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                      <Badge className="bg-accent text-accent-foreground">
                        <CurrencyDollar className="w-3.5 h-3.5" />
                      </Badge>
                    </div>
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
