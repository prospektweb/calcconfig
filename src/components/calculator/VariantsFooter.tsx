import { useState, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowSquareOut, CaretDown, CaretUp, Copy } from '@phosphor-icons/react'
import { InfoMessage } from '@/lib/types'
import { toast } from 'sonner'
import { JsonView, darkStyles, defaultStyles } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import { InitPayload } from '@/lib/postmessage-bridge'
import { openBitrixAdmin, openCatalogProduct, getBitrixContext } from '@/lib/bitrix-utils'

interface VariantsFooterProps {
  selectedOffers: InitPayload['selectedOffers']
  addInfoMessage: (type: InfoMessage['type'], message: string) => void
  bitrixMeta: InitPayload | null
}

export function VariantsFooter({
  selectedOffers,
  addInfoMessage,
  bitrixMeta,
}: VariantsFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hoveredOfferId, setHoveredOfferId] = useState<number | null>(null)
  const [tooltipOpen, setTooltipOpen] = useState<number | null>(null)
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

    // Find offers iblock
    const offersIblock = bitrixMeta.iblocks.find(ib => ib.code === 'OFFERS')
    if (!offersIblock) {
      toast.error('Не найден инфоблок торговых предложений')
      return
    }

    try {
      openBitrixAdmin({
        iblockId: offersIblock.id,
        type: offersIblock.type,
        lang: context.lang,
        id: offer.id,
      })
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

    // Получить ID родительского товара из offer.productId или CML2_LINK
    const productId = offer.productId || offer.properties?.CML2_LINK?.VALUE
    if (!productId) {
      toast.error('Не найден ID родительского товара')
      return
    }

    // Найти инфоблок товаров по коду PRODUCTS или CATALOG
    let parentIblock = bitrixMeta.iblocks.find(ib => ib.code === 'PRODUCTS')
    if (!parentIblock) {
      parentIblock = bitrixMeta.iblocks.find(ib => ib.code === 'CATALOG')
    }
    // Также попробовать найти по IBLOCK_ID из CML2_LINK
    if (!parentIblock && offer.properties?.CML2_LINK?.IBLOCK_ID) {
      parentIblock = bitrixMeta.iblocks.find(ib => ib.id === offer.properties?.CML2_LINK?.IBLOCK_ID)
    }
    
    if (!parentIblock) {
      toast.error('Не найден инфоблок родительского товара')
      return
    }

    try {
      openCatalogProduct(productId, parentIblock.id, parentIblock.type, context.lang)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось открыть товар'
      toast.error(message)
      addInfoMessage('error', message)
    }
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
              return (
                <Tooltip key={offer.id} open={tooltipOpen === offer.id}>
                  <TooltipTrigger asChild>
                    <div 
                      className="group relative"
                      onMouseEnter={() => handleMouseEnterBadge(offer.id)}
                      onMouseLeave={() => handleMouseLeaveBadge(offer.id)}
                    >
                      <Badge
                        variant="secondary"
                        className="px-2 py-1 flex items-center gap-1.5 cursor-pointer transition-colors text-xs hover:bg-accent hover:text-accent-foreground"
                        title={offer.name}
                        data-pwcode="offer-badge"
                      >
                        <span className="font-mono">{offer.id}</span>
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
