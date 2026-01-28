import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CaretDown, CaretUp, Info, Warning, X as XIcon } from '@phosphor-icons/react'
import { InfoMessage } from '@/lib/types'
import { CalculationReport, buildFullReportText } from './CalculationReport'
import { useState } from 'react'
import { toast } from 'sonner'

interface InfoPanelProps {
  messages: InfoMessage[]
  isExpanded: boolean
  onToggle: () => void
  onSaveCalculationResult: (offerId: number) => void
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
}

export function InfoPanel({ messages, isExpanded, onToggle }: InfoPanelProps) {
  const [selectedMessage, setSelectedMessage] = useState<InfoMessage | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
  const getMessageIcon = (type: InfoMessage['type']) => {
    switch (type) {
      case 'error':
        return <XIcon className="w-3.5 h-3.5" />
      case 'warning':
        return <Warning className="w-3.5 h-3.5" />
      default:
        return <Info className="w-3.5 h-3.5" />
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

  const formatPrice = (price: number, currency: string) => `${price.toFixed(2)} ${currency}`

  const getMaxOfferPrice = (message: InfoMessage): { value: number | null; currency: string } => {
    const data = message.calculationData
    if (!data) return { value: null, currency: 'RUB' }

    const ranges = data.priceRangesWithMarkup
    if (!ranges || ranges.length === 0) {
      return { value: null, currency: data.currency || 'RUB' }
    }

    let maxValue = -Infinity
    let currency = data.currency || 'RUB'
    for (const range of ranges) {
      for (const price of range.prices) {
        if (price.basePrice > maxValue) {
          maxValue = price.basePrice
          currency = price.currency
        }
      }
    }

    if (!Number.isFinite(maxValue)) {
      return { value: null, currency }
    }

    return { value: maxValue, currency }
  }

  const handleOpenReport = (message: InfoMessage) => {
    setSelectedMessage(message)
    setIsDialogOpen(true)
  }

  const handleCopyReport = () => {
    if (!selectedMessage) return
    const text = buildFullReportText(selectedMessage)
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Отчёт скопирован в буфер обмена')
    }).catch(() => {
      toast.error('Ошибка при копировании')
    })
  }

  return (
    <div className="border-t border-border bg-card" data-pwcode="infopanel">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        data-pwcode="btn-toggle-infopanel"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge className="bg-success text-success-foreground flex-shrink-0" data-pwcode="info-count">{messages.length}</Badge>
          <span className="text-sm font-medium flex-shrink-0">Информация</span>
            {lastMessage && (
              <>
                <span className="text-sm text-muted-foreground flex-1 text-left ml-2 truncate">
                  {lastMessage.message}
                </span>
              <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                {formatTimestamp(lastMessage.timestamp)}
              </span>
            </>
          )}
        </div>
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 ml-2">
          {isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
        </div>
      </button>
      
      {isExpanded && (
        <ScrollArea className="h-[400px] px-4 pb-2" data-pwcode="info-messages">
          <div className="space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Нет сообщений</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="py-2 border-b border-border last:border-0" data-pwcode="info-msg">
                  {msg.level === 'calculation' && msg.calculationData ? (
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => handleOpenReport(msg)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium truncate">
                          {msg.calculationData.offerName}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {typeof msg.calculationData.purchasePrice === 'number' && (
                            <span title="Закупочная цена">
                              {formatPrice(msg.calculationData.purchasePrice, msg.calculationData.currency || 'RUB')}
                            </span>
                          )}
                          <span>&gt;</span>
                          {(() => {
                            const maxPrice = getMaxOfferPrice(msg)
                            return (
                              <span title="Максимальная отпускная цена">
                                {maxPrice.value !== null
                                  ? formatPrice(maxPrice.value, maxPrice.currency)
                                  : '—'}
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    </button>
                  ) : (
                    // Render regular message
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                        <Badge className={getMessageColor(msg.type)}>
                          {getMessageIcon(msg.type)}
                        </Badge>
                      </div>
                      <div className="flex-1">
                        <span className="text-sm">{msg.message}</span>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatTimestamp(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Отчёт по торговому предложению</DialogTitle>
          </DialogHeader>
          {selectedMessage && <CalculationReport message={selectedMessage} />}
          <DialogFooter className="gap-2 sm:gap-2 sm:justify-end">
            <Button variant="outline" onClick={handleCopyReport}>
              Копировать отчёт в буфер
            </Button>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Закрыть
            </Button>
            {selectedMessage?.offerId && (
              <Button variant="outline" onClick={() => onSaveCalculationResult(selectedMessage.offerId!)}>
                Сохранить
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
