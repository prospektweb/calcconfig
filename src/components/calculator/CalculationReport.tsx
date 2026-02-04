import type { MouseEvent } from 'react'
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle, Info, XCircle } from '@phosphor-icons/react'
import { InfoMessage } from '@/lib/types'
import type { InitPayload } from '@/lib/postmessage-bridge'
import { getBitrixContext, getIblockByCode, openBitrixAdmin, openCatalogProduct } from '@/lib/bitrix-utils'
import { toast } from 'sonner'

interface CalculationReportProps {
  message: InfoMessage
  bitrixMeta?: InitPayload | null
}

/**
 * Format price with currency
 */
function formatPrice(price: number, currency: string): string {
  return `${price.toFixed(2)} ${currency}`
}

/**
 * Generate BBCode format for a calculation report
 */
export function buildFullReportText(message: InfoMessage): string {
  const data = message.calculationData
  if (!data) return message.message
  
  let bbcode = ''
  
  if (data.offerName) {
    bbcode += `[b]Торговое предложение:[/b] ${data.offerName} | ${message.offerId || ''}\n`
    
    if (data.productId && data.productName) {
      bbcode += `[b]Товар:[/b] ${data.productName} | ${data.productId}\n`
    }
    
    if (data.presetId && data.presetName) {
      const modified = data.presetModified ? ` | Изменён: ${data.presetModified}` : ''
      bbcode += `[b]Пресет:[/b] ${data.presetName} | ${data.presetId}${modified}\n`
    }
    
    bbcode += '\n[b]Детали:[/b]\n'
    
    // Add children details
    if (data.children) {
      for (const child of data.children) {
        if (child.calculationData?.detailName) {
          const childData = child.calculationData
          const priceStr = childData.purchasePrice !== undefined && childData.basePrice !== undefined
            ? ` (${formatPrice(childData.purchasePrice, childData.currency || 'RUB')} > ${formatPrice(childData.basePrice, childData.currency || 'RUB')})`
            : ''
          bbcode += `  - деталь ${childData.detailName}${priceStr}\n`
        }
      }
    }
    
    bbcode += '\n[b]Итоги расчёта:[/b]\n'
    if (data.purchasePrice !== undefined) {
      bbcode += `  - Закупочная цена: ${formatPrice(data.purchasePrice, data.currency || 'RUB')}\n`
      if (data.directPurchasePrice !== undefined) {
        bbcode += `    (прямые затраты: ${formatPrice(data.directPurchasePrice, data.currency || 'RUB')})\n`
      }
    }
    if (data.priceRangesWithMarkup && data.priceRangesWithMarkup.length > 0) {
      bbcode += '\n[b]Наценки по диапазонам:[/b]\n'
      for (const range of data.priceRangesWithMarkup) {
        const toValue = range.quantityTo ?? '∞'
        bbcode += `  - ${range.quantityFrom ?? 0}–${toValue}:\n`
        for (const price of range.prices) {
          bbcode += `    • ${price.typeName}: ${formatPrice(price.basePrice, price.currency)}\n`
        }
      }
    }
  }
  
  return bbcode
}

/**
 * Render a single stage within detail
 */
/**
 * Render a single detail or binding
 */
function DetailItem({
  message,
  onOpenDetail,
  onOpenStage,
}: {
  message: InfoMessage
  onOpenDetail: (detailId: string | undefined) => void
  onOpenStage: (stageId: string | undefined) => void
}) {
  const data = message.calculationData
  if (!data) return null
  
  const hasPrices = data.purchasePrice !== undefined && data.basePrice !== undefined
  
  const stages = data.children?.filter(child => child.level === 'stage') || []
  const childDetails = data.children?.filter(child => child.level === 'detail') || []
  const stageCount = stages.length
  
  if (stages.length === 0 && childDetails.length === 0) {
    // Simple detail without nested items
    return (
      <div className="py-1 text-sm">
        <button
          type="button"
          className="font-medium text-left hover:underline"
          onClick={() => onOpenDetail(message.detailId)}
        >
          {data.detailType === 'binding' ? '📦 ' : '📄 '}
          {data.detailName}
        </button>
        {hasPrices && (
          <span className="text-muted-foreground ml-2">
            <span title="Закупочная цена">
              {formatPrice(data.purchasePrice!, data.currency || 'RUB')}
            </span>
            <span className="mx-1">&gt;</span>
            <span title="Базовая цена">
              {formatPrice(data.basePrice!, data.currency || 'RUB')}
            </span>
          </span>
        )}
      </div>
    )
  }
  
  return (
    <AccordionItem value={message.id} className="border-none">
      <AccordionTrigger
        className="py-2 text-sm hover:no-underline"
        onClick={() => onOpenDetail(message.detailId)}
      >
        <span className="flex items-center gap-2">
          <button className="font-medium text-left">
            {data.detailType === 'binding' ? '📦 ' : '📄 '}
            {data.detailName}
          </button>
          {hasPrices && (
            <span className="text-muted-foreground">
              <span title="Закупочная цена">
                {formatPrice(data.purchasePrice!, data.currency || 'RUB')}
              </span>
              <span className="mx-1">&gt;</span>
              <span title="Базовая цена">
                {formatPrice(data.basePrice!, data.currency || 'RUB')}
              </span>
            </span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-1 pb-2">
        {/* Render child details (for bindings) */}
        {childDetails.length > 0 && (
          <Accordion type="multiple" className="space-y-1">
            {childDetails.map(child => (
              <DetailItem
                key={child.id}
                message={child}
                onOpenDetail={onOpenDetail}
                onOpenStage={onOpenStage}
              />
            ))}
          </Accordion>
        )}
        
        {/* Render stages */}
        {stageCount > 0 && (
          <Accordion type="multiple" className="space-y-1">
            {stages.map((stage, index) => (
              <StageLogItem
                key={stage.id}
                message={stage}
                index={index}
                onOpenStage={onOpenStage}
              />
            ))}
          </Accordion>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

function formatLogValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch (error) {
    return String(value)
  }
}

function StageLogItem({
  message,
  index,
  onOpenStage,
}: {
  message: InfoMessage
  index: number
  onOpenStage: (stageId: string | undefined, event?: MouseEvent) => void
}) {
  const data = message.calculationData
  if (!data) return null

  const hasPrices = data.purchasePrice !== undefined && data.basePrice !== undefined
  const logs = data.stageLogs || []
  const summaryEntries = logs.filter((entry) => entry.type === 'evaluatingVars' || entry.type === 'noVars')
  const variableEntries = logs.filter((entry) => entry.type === 'varFormula' || entry.type === 'varStatic')

  return (
    <AccordionItem value={message.id} className="border border-border/60 rounded-md">
      <AccordionTrigger
        className="px-3 py-2 text-sm hover:no-underline"
        onClick={() => onOpenStage(message.stageId)}
      >
        <div className="flex items-start justify-between gap-2 w-full">
          <div className="flex flex-col text-left gap-1">
            <span className="font-medium text-left">
              {index + 1}. {data.stageName || 'Этап'}
            </span>
            {hasPrices && (
              <span className="text-xs text-muted-foreground">
                <span title="Закупочная цена">
                  {formatPrice(data.purchasePrice!, data.currency || 'RUB')}
                </span>
                <span className="mx-1">&gt;</span>
                <span title="Базовая цена">
                  {formatPrice(data.basePrice!, data.currency || 'RUB')}
                </span>
              </span>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-3 text-xs text-muted-foreground space-y-3">
        {data.stageInputs && data.stageInputs.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-foreground">Входящие параметры</div>
            <ul className="list-disc list-inside space-y-1">
              {data.stageInputs.map((input, inputIndex) => (
                <li key={`${message.id}-input-${inputIndex}`}>
                  <strong>{input.name}</strong>: {formatLogValue(input.value)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {summaryEntries.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-foreground">Сводка</div>
            <ul className="list-disc list-inside space-y-1">
              {summaryEntries.map((entry, entryIndex) => (
                <li key={`${message.id}-summary-${entryIndex}`}>
                  {entry.type === 'evaluatingVars'
                    ? `Запущена обработка ${entry.count ?? 0} переменных`
                    : 'Нет переменных в логике'}
                </li>
              ))}
            </ul>
          </div>
        )}
        {variableEntries.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-foreground">Переменные</div>
            <ul className="list-disc list-inside space-y-1">
              {variableEntries.map((entry, entryIndex) => (
                <li key={`${message.id}-var-${entryIndex}`}>
                  <span className="inline-flex items-center gap-2">
                    <span>
                      <strong>{entry.name}</strong>
                      {entry.type === 'varFormula' && entry.formulaPreview ? `: ${entry.formulaPreview}` : ''}
                      {' = '}
                      {formatLogValue(entry.value)}
                    </span>
                    {entry.type === 'varFormula' && entry.formula ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center text-muted-foreground cursor-help">
                              <Info className="w-3.5 h-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            <div className="space-y-2">
                              <div>
                                <div className="font-medium text-foreground">Формула</div>
                                <code className="block bg-muted px-2 py-1 rounded text-foreground">{entry.formula}</code>
                              </div>
                              {entry.formulaValues && entry.formulaValues.length > 0 && (
                                <div>
                                  <div className="font-medium text-foreground">Значения параметров</div>
                                  <ul className="list-disc list-inside space-y-1 text-foreground">
                                    {entry.formulaValues.map((valueEntry, valueIndex) => (
                                      <li key={`${message.id}-param-${entryIndex}-${valueIndex}`}>
                                        <strong>{valueEntry.name}</strong>: {formatLogValue(valueEntry.value)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.stageOutputs && Object.keys(data.stageOutputs).length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-foreground">Итоги этапа</div>
            <ul className="list-disc list-inside space-y-1">
              {Object.entries(data.stageOutputs).map(([key, value]) => (
                <li key={`${message.id}-output-${key}`}>
                  <strong>{key}</strong>: {formatLogValue(value)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {summaryEntries.length === 0 &&
          variableEntries.length === 0 &&
          (!data.stageInputs || data.stageInputs.length === 0) &&
          (!data.stageOutputs || Object.keys(data.stageOutputs).length === 0) && (
            <div>Нет данных по этапу.</div>
          )}
      </AccordionContent>
    </AccordionItem>
  )
}

/**
 * Main calculation report component
 */
export function CalculationReport({ message, bitrixMeta }: CalculationReportProps) {
  const data = message.calculationData
  
  if (!data || !data.offerName) {
    return <div className="text-sm">{message.message}</div>
  }
  
  const details = data.children?.filter(child => child.level === 'detail') || []
  
  // Determine if calculation was successful
  const hasNonZeroPrices = (data.purchasePrice ?? 0) > 0
  const isSuccessful = hasNonZeroPrices && details.length > 0

  const openIblockElement = (iblockCode: string, id: number, label: string) => {
    if (!bitrixMeta) {
      toast.error('Метаданные Bitrix не загружены')
      return
    }

    const context = getBitrixContext()
    if (!context && !bitrixMeta?.context?.lang) {
      toast.error('Контекст Bitrix не инициализирован')
      return
    }

    const iblock = getIblockByCode(bitrixMeta.iblocks, iblockCode)
    if (!iblock) {
      toast.error(`Не найден инфоблок для ${label}`)
      return
    }

    try {
      openBitrixAdmin({
        iblockId: iblock.id,
        type: iblock.type,
        lang: context?.lang || bitrixMeta.context.lang,
        id,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : `Не удалось открыть ${label}`
      toast.error(message)
    }
  }

  const openOffer = (offerId: number | undefined, event?: MouseEvent) => {
    if (event) event.stopPropagation()
    if (!offerId) return
    openIblockElement('OFFERS', offerId, 'торгового предложения')
  }

  const openPreset = (presetId: number | undefined, event?: MouseEvent) => {
    if (event) event.stopPropagation()
    if (!presetId) return
    openIblockElement('CALC_PRESETS', presetId, 'пресета')
  }

  const openDetail = (detailId: string | undefined) => {
    const numericId = detailId ? Number(detailId) : NaN
    if (!Number.isFinite(numericId)) return
    openIblockElement('CALC_DETAILS', numericId, 'детали')
  }

  const openStage = (stageId: string | undefined) => {
    const numericId = stageId ? Number(stageId) : NaN
    if (!Number.isFinite(numericId)) return
    openIblockElement('CALC_STAGES', numericId, 'этапа')
  }

  const openProduct = (productId: number | undefined, event?: MouseEvent) => {
    if (event) event.stopPropagation()
    if (!productId || !bitrixMeta) return

    const context = getBitrixContext()
    if (!context && !bitrixMeta.context?.lang) {
      toast.error('Контекст Bitrix не инициализирован')
      return
    }

    let parentIblock = bitrixMeta.iblocks.find(ib => ib.code === 'PRODUCTS')
    if (!parentIblock) {
      parentIblock = bitrixMeta.iblocks.find(ib => ib.code === 'CATALOG')
    }
    if (!parentIblock && bitrixMeta.product?.iblockId) {
      parentIblock = bitrixMeta.iblocks.find(ib => ib.id === bitrixMeta.product?.iblockId)
    }

    if (!parentIblock) {
      toast.error('Не найден инфоблок родительского товара')
      return
    }

    try {
      openCatalogProduct(productId, parentIblock.id, parentIblock.type, context?.lang || bitrixMeta.context.lang)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось открыть товар'
      toast.error(message)
    }
  }
  
  return (
    <div className="space-y-2">
      {/* Offer header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-sm flex-1">
            Торговое предложение:{' '}
            <button
              type="button"
              className="text-left hover:underline"
              onClick={(event) => openOffer(message.offerId, event)}
            >
              {data.offerName} {message.offerId ? `| ${message.offerId}` : ''}
            </button>
          </h4>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isSuccessful ? (
              <CheckCircle 
                className="w-5 h-5 text-green-600 dark:text-green-500" 
                weight="fill"
                title="Расчёт выполнен успешно"
              />
            ) : (
              <XCircle 
                className="w-5 h-5 text-red-600 dark:text-red-500" 
                weight="fill"
                title="Проблема с расчётом: нулевые значения или отсутствуют детали"
              />
            )}
          </div>
        </div>
        
        {data.productId && data.productName && (
          <div className="text-xs text-muted-foreground">
            Товар:{' '}
            <button
              type="button"
              className="text-left hover:underline"
              onClick={(event) => openProduct(data.productId, event)}
            >
              {data.productName} | {data.productId}
            </button>
          </div>
        )}
        
        {data.presetId && data.presetName && (
          <div className="text-xs text-muted-foreground">
            Пресет:{' '}
            <button
              type="button"
              className="text-left hover:underline"
              onClick={(event) => openPreset(data.presetId, event)}
            >
              {data.presetName} | {data.presetId}
            </button>
            {data.presetModified && ` | Изменён: ${data.presetModified}`}
          </div>
        )}
      </div>
      
      {/* Details accordion */}
      {details.length > 0 && (
        <div className="space-y-1">
          <Accordion type="multiple" className="space-y-1">
            {details.map(detail => (
              <DetailItem
                key={detail.id}
                message={detail}
                onOpenDetail={openDetail}
                onOpenStage={openStage}
              />
            ))}
          </Accordion>
        </div>
      )}
      
      {/* Price summary */}
      {(data.purchasePrice !== undefined || data.priceRangesWithMarkup) && (
        <div className="border-t pt-2 space-y-2">
          {/* Base prices */}
          {data.purchasePrice !== undefined && (
            <div className="text-sm">
              <div className="font-medium mb-1">Расчетные цены торгового предложения:</div>
              <div className="pl-4 space-y-0.5 text-xs">
                <div>
                  - Закупочная цена: {formatPrice(data.purchasePrice, data.currency || 'RUB')}
                  {data.directPurchasePrice !== undefined && (
                    <> (прямые затраты: {formatPrice(data.directPurchasePrice, data.currency || 'RUB')})</>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Prices with markup */}
          {data.priceRangesWithMarkup && data.priceRangesWithMarkup.length > 0 ? (
            <div className="text-sm">
              <div className="font-medium mb-1">Формирование отпускных цен</div>
              <div className="pl-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left font-medium py-1 pr-3">От</th>
                        <th className="text-left font-medium py-1 pr-3">До</th>
                        {data.priceRangesWithMarkup[0].prices.map(price => (
                          <th key={price.typeId} className="text-left font-medium py-1 pr-3">
                            {price.typeName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.priceRangesWithMarkup.map((range, index) => (
                        <tr key={`${range.quantityFrom}-${range.quantityTo}-${index}`} className="border-b last:border-b-0">
                          <td className="py-1 pr-3">{range.quantityFrom ?? 0}</td>
                          <td className="py-1 pr-3">{range.quantityTo ?? '∞'}</td>
                          {range.prices.map(price => (
                            <td key={price.typeId} className="py-1 pr-3">
                              {formatPrice(price.basePrice, price.currency)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
