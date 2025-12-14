import { useState, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, ArrowSquareOut, X, CaretDown, CaretUp, Copy } from '@phosphor-icons/react'
import { InfoMessage } from '@/lib/types'
import { toast } from 'sonner'
import { JsonView, darkStyles, defaultStyles } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import { InitPayload } from '@/lib/postmessage-bridge'
import { openBitrixAdmin, getBitrixContext } from '@/lib/bitrix-utils'
import { postMessageBridge } from '@/lib/postmessage-bridge'

interface VariantsFooterProps {
  selectedOffers: InitPayload['selectedOffers']
  testVariantId: number | null
  setTestVariantId: (id: number | null) => void
  addInfoMessage: (type: InfoMessage['type'], message: string) => void
  bitrixMeta: InitPayload | null
  onRemoveOffer: (offerId: number) => void
  onAddOfferRequest?: (requestId: string) => void
  isBitrixLoading?: boolean
}

export function VariantsFooter({
  selectedOffers,
  testVariantId,
  setTestVariantId,
  addInfoMessage,
  bitrixMeta,
  onRemoveOffer,
  onAddOfferRequest,
  isBitrixLoading,
}: VariantsFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hoveredOfferId, setHoveredOfferId] = useState<number | null>(null)
  const [tooltipOpen, setTooltipOpen] = useState<number | null>(null)
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleVariantClick = (id: number) => {
    if (testVariantId === id) {
      setTestVariantId(null)
      addInfoMessage('info', `Снята метка теста с варианта ID: ${id}`)
    } else {
      setTestVariantId(id)
      addInfoMessage('success', `Установлена метка теста на вариант ID: ${id}`)
    }
  }

  const getOfferRequestContext = () => {
    if (!bitrixMeta) {
      toast.error('Метаданные Bitrix не загружены')
      return null
    }

    const context = getBitrixContext()
    if (!context) {
      toast.error('Контекст Bitrix не инициализирован')
      return null
    }

    const iblockId = bitrixMeta.iblocks.offers
    const iblockType = bitrixMeta.iblocksTypes[iblockId]

    return {
      iblockId,
      iblockType,
      lang: context.lang,
    }
  }

  const handleAddVariant = () => {
    const requestContext = getOfferRequestContext()

    if (!requestContext) return

    const requestId = postMessageBridge.sendAddOfferRequest(
      requestContext.iblockId,
      requestContext.iblockType,
      requestContext.lang
    )
    if (requestId && onAddOfferRequest) {
      onAddOfferRequest(requestId)
    }
    addInfoMessage('info', 'Отправлен запрос на добавление торговых предложений')
  }

  const handleOpenVariant = (offer: InitPayload['selectedOffers'][0], e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!bitrixMeta) {
      toast.error('Метаданные Bitrix не загружены')
      return
    }

    const context = getBitrixContext()
    if (!context) {
      toast.error('Контекст Bitrix не инициализирован')
      return
    }

    try {
      openBitrixAdmin({
        iblockId: bitrixMeta.iblocks.offers,
        type: bitrixMeta.iblocksTypes[bitrixMeta.iblocks.offers],
        lang: context.lang,
        id: offer.id,
      })
      addInfoMessage('info', `Открыто ТП ID: ${offer.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось открыть торговое предложение'
      toast.error(message)
      addInfoMessage('error', message)
    }
  }

  const handleOpenProduct = (offer: InitPayload['selectedOffers'][0], e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!bitrixMeta) {
      toast.error('Метаданные Bitrix не загружены')
      return
    }

    const context = getBitrixContext()
    if (!context) {
      toast.error('Контекст Bitrix не инициализирован')
      return
    }

    try {
      openBitrixAdmin({
        iblockId: bitrixMeta.iblocks.products,
        type: bitrixMeta.iblocksTypes[bitrixMeta.iblocks.products],
        lang: context.lang,
        id: offer.productId,
      })
      addInfoMessage('info', `Открыт родительский товар ID: ${offer.productId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось открыть товар'
      toast.error(message)
      addInfoMessage('error', message)
    }
  }

  const handleRemoveVariant = (offer: InitPayload['selectedOffers'][0], e: React.MouseEvent) => {
    e.stopPropagation()
    setTooltipOpen(null)
    const requestContext = getOfferRequestContext()

    if (!requestContext) return

    onRemoveOffer(offer.id)
    postMessageBridge.sendRemoveOfferRequest(
      offer.id,
      requestContext.iblockId,
      requestContext.iblockType,
      requestContext.lang
    )
    addInfoMessage('warning', `Удалён оффер ID: ${offer.id}`)
  }

  const handleCopyJSON = (offer: InitPayload['selectedOffers'][0]) => {
    navigator.clipboard.writeText(JSON.stringify(offer, null, 2))
    toast.success('JSON скопирован в буфер обмена')
  }

  const handleMouseEnterBadge = (offerId: number) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }
    setTooltipOpen(offerId)
  }

  const handleMouseLeaveBadge = (offerId: number) => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipOpen(null)
    }, 300)
  }

  const handleMouseEnterTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }
  }

  const handleMouseLeaveTooltip = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipOpen(null)
    }, 300)
  }

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="border-t border-border bg-card px-4 py-2" data-pwcode="offerspanel">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium whitespace-nowrap">Торговые предложения:</span>
        <div className={`flex gap-2 flex-wrap flex-1 ${!isExpanded && selectedOffers.length > 5 ? 'max-h-8 overflow-hidden' : ''}`}>
          <TooltipProvider>
            {selectedOffers.map(offer => {
              const isTest = testVariantId === offer.id
              
              return (
                <Tooltip key={offer.id} open={tooltipOpen === offer.id}>
                  <TooltipTrigger asChild>
                    <div 
                      className="group relative"
                      onMouseEnter={() => handleMouseEnterBadge(offer.id)}
                      onMouseLeave={() => handleMouseLeaveBadge(offer.id)}
                    >
                      <Badge
                        variant={isTest ? "default" : "secondary"}
                        className={`
                          px-2 py-1 flex items-center gap-1.5 cursor-pointer transition-colors text-xs
                          ${isTest ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}
                        `}
                        onClick={() => handleVariantClick(offer.id)}
                        title={offer.name}
                        data-pwcode="offer-badge"
                      >
                        <span className="font-mono">{offer.id}</span>
                        {isTest && <span className="text-[10px]">TEST</span>}
                        <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-accent hover:text-accent-foreground"
                            onClick={(e) => handleOpenVariant(offer, e)}
                            data-pwcode="btn-open-offer"
                          >
                            <ArrowSquareOut className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => handleRemoveVariant(offer, e)}
                            data-pwcode="btn-remove-offer"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    className="max-w-2xl p-0 bg-card border-border"
                    onMouseEnter={handleMouseEnterTooltip}
                    onMouseLeave={handleMouseLeaveTooltip}
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4 pb-3 border-b border-border">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm text-foreground">{offer.name}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">
                              ID родительского товара: {offer.productId}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={(e) => handleOpenProduct(offer, e)}
                              title="Открыть родительский товар"
                            >
                              <ArrowSquareOut className="w-3.5 h-3.5 text-foreground" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleCopyJSON(offer)}
                            title="Копировать JSON"
                          >
                            <Copy className="w-4 h-4 text-foreground" />
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-96 overflow-auto text-xs">
                        <JsonView data={offer} style={defaultStyles} />
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </TooltipProvider>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddVariant}
          className="h-7 px-3"
          disabled={isBitrixLoading}
          data-pwcode="btn-add-offer"
        >
          <Plus className="w-4 h-4 mr-1" />
          Выбрать
        </Button>
        {selectedOffers.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0 hover:bg-accent hover:text-accent-foreground"
            data-pwcode="btn-toggle-offers"
          >
            {isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}
