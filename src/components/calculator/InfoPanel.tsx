import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowsIn, ArrowsOut, CaretDown, CaretUp, Info, Warning, X as XIcon } from '@phosphor-icons/react'
import { InfoMessage } from '@/lib/types'
import { CalculationReport, buildFullReportText } from './CalculationReport'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import type { InitPayload } from '@/lib/postmessage-bridge'
import { cn } from '@/lib/utils'

interface InfoPanelProps {
  messages: InfoMessage[]
  isExpanded: boolean
  onToggle: () => void
  onSaveCalculationResult: (offerId: number, overrides?: ReportOverrides) => void
  bitrixMeta?: InitPayload | null
}

type ReportOverrides = {
  priceRangesWithMarkup?: NonNullable<InfoMessage['calculationData']>['priceRangesWithMarkup']
  parametrValues?: NonNullable<InfoMessage['calculationData']>['parametrValues']
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

export function InfoPanel({ messages, isExpanded, onToggle, onSaveCalculationResult, bitrixMeta }: InfoPanelProps) {
  const [selectedMessage, setSelectedMessage] = useState<InfoMessage | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isReportFullscreen, setIsReportFullscreen] = useState(false)
  const [reportOverrides, setReportOverrides] = useState<Record<number, ReportOverrides>>({})
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

  const handleReportChange = useCallback((offerId: number, overrides: ReportOverrides) => {
    setReportOverrides(prev => ({
      ...prev,
      [offerId]: overrides,
    }))
  }, [])

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
                          {msg.offerId ? ` | ${msg.offerId}` : ''}
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
        <DialogContent
          className={cn(
            "p-0 gap-0 flex flex-col overflow-hidden min-h-0",
            isReportFullscreen
              ? "inset-0 w-screen h-screen max-w-none max-h-none sm:max-w-none sm:max-h-none rounded-none translate-x-0 translate-y-0"
              : "min-w-[1024px] w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh]"
          )}
          hideClose
        >
          <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-lg font-semibold">
                Отчёт по торговому предложению
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setIsReportFullscreen(!isReportFullscreen)}
                  title={isReportFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
                >
                  {isReportFullscreen ? <ArrowsIn className="w-4 h-4" /> : <ArrowsOut className="w-4 h-4" />}
                </Button>
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Закрыть"
                  >
                    <span className="sr-only">Close</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                      <path
                        d="M18 6 6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Button>
                </DialogClose>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {selectedMessage && (
              <CalculationReport
                message={selectedMessage}
                bitrixMeta={bitrixMeta}
                onChange={handleReportChange}
              />
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2 sm:justify-end border-t px-6 py-4">
            <Button variant="outline" onClick={handleCopyReport}>
              Копировать отчёт в буфер
            </Button>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Закрыть
            </Button>
            {selectedMessage?.offerId && (
              <Button
                variant="outline"
                onClick={() => onSaveCalculationResult(selectedMessage.offerId!, reportOverrides[selectedMessage.offerId!])}
              >
                Сохранить
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
