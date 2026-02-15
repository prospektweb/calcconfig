import type { MouseEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle, Info, PencilSimpleLine, XCircle } from '@phosphor-icons/react'
import { InfoMessage } from '@/lib/types'
import type { InitPayload } from '@/lib/postmessage-bridge'
import { getBitrixContext, getIblockByCode, openBitrixAdmin, openCatalogProduct } from '@/lib/bitrix-utils'
import { toast } from 'sonner'

interface CalculationReportProps {
  message: InfoMessage
  bitrixMeta?: InitPayload | null
  onChange?: (offerId: number, overrides: ReportOverrides) => void
}

type ReportOverrides = {
  priceRangesWithMarkup?: NonNullable<InfoMessage['calculationData']>['priceRangesWithMarkup']
  parametrValues?: NonNullable<InfoMessage['calculationData']>['parametrValues']
  offerName?: NonNullable<InfoMessage['calculationData']>['offerName']
}

/**
 * Format price with currency
 */
function formatPrice(price: number, currency: string): string {
  const formatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${formatter.format(price)} ${currency}`
}

/**
 * Generate BBCode format for a calculation report
 */
export function buildFullReportText(message: InfoMessage): string {
  const data = message.calculationData
  if (!data) return message.message
  
  let bbcode = ''
  
  if (data.offerName) {
    if (data.presetId && data.presetName) {
      const metaParts = [
        data.timestamp_x ? `timestamp_x: ${data.timestamp_x}` : null,
        data.modified_by ? `modified_by: ${data.modified_by}` : null,
      ].filter(Boolean)
      const meta = metaParts.length ? ` | ${metaParts.join(' | ')}` : ''
      bbcode += `[b]Пресет:[/b] ${data.presetName} | ${data.presetId}${meta}\n`
    }

    if (data.productId && data.productName) {
      bbcode += `[b]Товар:[/b] ${data.productName} | ${data.productId}\n`
    }

    bbcode += `[b]Торговое предложение:[/b] ${data.offerName} | ${message.offerId || ''}\n`
    
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
  const variableEntries = logs.filter((entry) => entry.type === 'varFormula' || entry.type === 'varStatic')
  const inputCount = data.stageInputs?.length ?? 0
  const variableCount = variableEntries.length
  const outputCount = data.stageOutputs ? Object.keys(data.stageOutputs).length : 0
  const hasAdded = Boolean(data.stageAdded)
  const defaultSections = [
    inputCount > 0 ? 'inputs' : null,
    variableCount > 0 ? 'variables' : null,
    outputCount > 0 ? 'outputs' : null,
  ].filter(Boolean) as string[]

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
        <Accordion type="multiple" defaultValue={defaultSections} className="space-y-2">
          {data.stageInputs && data.stageInputs.length > 0 && (
            <AccordionItem value="inputs" className="border border-border/60 rounded-md">
              <AccordionTrigger className="px-2 py-1.5 text-xs font-medium text-foreground hover:no-underline">
                Входящие параметры ({inputCount})
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2">
                <ul className="list-disc list-inside space-y-1">
                  {data.stageInputs.map((input, inputIndex) => (
                    <li key={`${message.id}-input-${inputIndex}`}>
                      <strong>{input.name}</strong>: {formatLogValue(input.value)}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
          {variableEntries.length > 0 && (
            <AccordionItem value="variables" className="border border-border/60 rounded-md">
              <AccordionTrigger className="px-2 py-1.5 text-xs font-medium text-foreground hover:no-underline">
                Переменные ({variableCount})
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2">
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
                              <TooltipContent className="max-w-xs text-xs bg-black text-white border border-black">
                                <div className="space-y-2">
                                  <div>
                                    <div className="font-medium text-white">Формула</div>
                                    <code className="block bg-white px-2 py-1 rounded text-black">{entry.formula}</code>
                                  </div>
                                  {entry.formulaValues && entry.formulaValues.length > 0 && (
                                    <div>
                                      <div className="font-medium text-white">Значения параметров</div>
                                      <ul className="list-disc list-inside space-y-1 text-white">
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
              </AccordionContent>
            </AccordionItem>
          )}
          {data.stageOutputs && Object.keys(data.stageOutputs).length > 0 && (
            <AccordionItem value="outputs" className="border border-border/60 rounded-md">
              <AccordionTrigger className="px-2 py-1.5 text-xs font-medium text-foreground hover:no-underline">
                Итоги этапа ({outputCount})
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2">
                <ul className="list-disc list-inside space-y-1">
                  {Object.entries(data.stageOutputs).map(([key, value]) => (
                    <li key={`${message.id}-output-${key}`}>
                      <strong>{key}</strong>: {formatLogValue(value)}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {hasAdded && data.stageAdded && (
            <AccordionItem value="added" className="border border-border/60 rounded-md">
              <AccordionTrigger className="px-2 py-1.5 text-xs font-medium text-foreground hover:no-underline">
                Добавленная стоимость
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2">
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Операции / Закупочная</strong>: {formatLogValue(data.stageAdded.operation.purchasingPrice)}</li>
                  <li><strong>Операции / Отпускная</strong>: {formatLogValue(data.stageAdded.operation.basePrice)}</li>
                  <li><strong>Материалы / Закупочная</strong>: {formatLogValue(data.stageAdded.material.purchasingPrice)}</li>
                  <li><strong>Материалы / Отпускная</strong>: {formatLogValue(data.stageAdded.material.basePrice)}</li>
                  {data.stageDelta ? (
                    <>
                      <li><strong>Δ Закупочная</strong>: {formatLogValue(data.stageDelta.purchasingPrice)}</li>
                      <li><strong>Δ Базовая</strong>: {formatLogValue(data.stageDelta.basePrice)}</li>
                    </>
                  ) : null}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
        {variableEntries.length === 0 &&
          (!data.stageInputs || data.stageInputs.length === 0) &&
          (!data.stageOutputs || Object.keys(data.stageOutputs).length === 0) && !hasAdded && (
            <div>Нет данных по этапу.</div>
          )}
      </AccordionContent>
    </AccordionItem>
  )
}

/**
 * Main calculation report component
 */
export function CalculationReport({ message, bitrixMeta, onChange }: CalculationReportProps) {
  const data = message.calculationData

  const createParametrRow = (overrides: Partial<{ id: string; name: string; value: string }> = {}) => ({
    id: `param_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    value: '',
    ...overrides,
  })

  const [parametrRows, setParametrRows] = useState<Array<{ id: string; name: string; value: string }>>([])
  const [priceRangeRows, setPriceRangeRows] = useState<NonNullable<InfoMessage['calculationData']>['priceRangesWithMarkup']>([])
  const [offerName, setOfferName] = useState(data?.offerName ?? '')
  const [isOfferNameEditing, setIsOfferNameEditing] = useState(false)
  const [isMarkupEditing, setIsMarkupEditing] = useState(false)
  const onChangeRef = useRef(onChange)
  
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

  useEffect(() => {
    if (!data) return
    const baseValues = data.parametrValues
      ?.filter(entry => entry.name !== 'Название ТП')
      .map(entry => createParametrRow({
        name: entry.name ?? '',
        value: entry.value ?? '',
      })) ?? []
    setParametrRows([...baseValues, createParametrRow()])
  }, [data])

  useEffect(() => {
    if (!data) return
    setPriceRangeRows(
      data.priceRangesWithMarkup?.map(range => ({
        ...range,
        prices: range.prices.map(price => ({ ...price })),
      })) ?? []
    )
  }, [data])

  useEffect(() => {
    if (!data) return
    setOfferName(data.offerName ?? '')
    setIsOfferNameEditing(false)
  }, [data])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!message.offerId || !onChangeRef.current) return
    const cleaned = parametrRows
      .filter(entry => entry.name.trim() || entry.value.trim())
      .map(entry => ({ name: entry.name, value: entry.value }))
    onChangeRef.current(message.offerId, {
      parametrValues: cleaned,
      priceRangesWithMarkup: priceRangeRows,
      offerName,
    })
  }, [message.offerId, parametrRows, priceRangeRows, offerName])

  const handleParametrChange = (index: number, field: 'name' | 'value', value: string) => {
    setParametrRows(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      const last = next[next.length - 1]
      if (last && (last.name.trim() || last.value.trim())) {
        next.push(createParametrRow())
      }
      return next
    })
  }

  const handlePriceChange = (rangeIndex: number, priceIndex: number, value: string) => {
    setPriceRangeRows(prev => {
      const next = prev.map(range => ({
        ...range,
        prices: range.prices.map(price => ({ ...price })),
      }))
      const parsed = Number(value)
      next[rangeIndex].prices[priceIndex].basePrice = Number.isFinite(parsed) ? parsed : 0
      return next
    })
  }
  
  return (
    <div className="space-y-2">
      {/* Header: preset -> product -> offer */}
      <div className="space-y-1">
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
            {(data.timestamp_x || data.modified_by) && ` | ${[
              data.timestamp_x ? `timestamp_x: ${data.timestamp_x}` : null,
              data.modified_by ? `modified_by: ${data.modified_by}` : null,
            ].filter(Boolean).join(' | ')}`}
          </div>
        )}

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

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h4 className="font-semibold text-sm">
              Торговое предложение:{' '}
            </h4>
            {isOfferNameEditing ? (
              <input
                value={offerName}
                onChange={(event) => setOfferName(event.target.value)}
                className="h-7 flex-1 min-w-[180px] rounded-md border border-border bg-background px-2 text-xs"
              />
            ) : (
              <button
                type="button"
                className="text-left hover:underline text-sm truncate"
                onClick={(event) => openOffer(message.offerId, event)}
              >
                {offerName}
              </button>
            )}
            {message.offerId ? (
              <span className="text-sm text-muted-foreground">| {message.offerId}</span>
            ) : null}
            <button
              type="button"
              className="h-7 w-7 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
              onClick={() => setIsOfferNameEditing(prev => !prev)}
              title={isOfferNameEditing ? 'Скрыть редактирование названия' : 'Редактировать название'}
            >
              <PencilSimpleLine className="w-4 h-4" />
            </button>
          </div>
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
      </div>

      {/* Parameters */}
      <div className="border rounded-md border-border/60">
        <div className="px-3 py-2 border-b border-border/60 text-sm font-medium">
          Параметры
        </div>
        <div className="px-3 py-2">
          <div className="grid grid-cols-2 gap-4 text-xs font-medium text-muted-foreground mb-2">
            <div>Название</div>
            <div>Значение</div>
          </div>
          <div className="space-y-2">
            {parametrRows.map((entry, index) => (
              <div key={entry.id} className="grid grid-cols-2 gap-4">
                <input
                  value={entry.name}
                  onChange={(event) => handleParametrChange(index, 'name', event.target.value)}
                  placeholder="Название"
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                />
                <input
                  value={entry.value}
                  onChange={(event) => handleParametrChange(index, 'value', event.target.value)}
                  placeholder="Значение"
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
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
          {priceRangeRows && priceRangeRows.length > 0 ? (
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="font-medium">Маркетинг отпускных цен</div>
                <button
                  type="button"
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
                  onClick={() => setIsMarkupEditing(prev => !prev)}
                  title={isMarkupEditing ? 'Скрыть редактирование цен' : 'Редактировать цены'}
                >
                  <PencilSimpleLine className="w-4 h-4" />
                </button>
              </div>
              <div className="pl-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left font-medium py-1 pr-3">От</th>
                        <th className="text-left font-medium py-1 pr-3">До</th>
                        {priceRangeRows[0].prices.map(price => (
                          <th key={price.typeId} className="text-left font-medium py-1 pr-3">
                            {price.typeName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {priceRangeRows.map((range, rangeIndex) => (
                        <tr key={`${range.quantityFrom}-${range.quantityTo}-${rangeIndex}`} className="border-b last:border-b-0">
                          <td className="py-1 pr-3">{range.quantityFrom ?? 0}</td>
                          <td className="py-1 pr-3">{range.quantityTo ?? '∞'}</td>
                          {range.prices.map((price, priceIndex) => (
                          <td key={price.typeId} className="py-1 pr-3">
                            {isMarkupEditing ? (
                              <>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={price.basePrice}
                                  onChange={(event) => handlePriceChange(rangeIndex, priceIndex, event.target.value)}
                                  className="h-7 w-24 rounded-md border border-border bg-background px-2 text-xs"
                                />
                                <span className="ml-1 text-muted-foreground">{price.currency}</span>
                              </>
                            ) : (
                              <span>{formatPrice(price.basePrice, price.currency)}</span>
                            )}
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
