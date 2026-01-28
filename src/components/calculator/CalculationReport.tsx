import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { InfoMessage } from '@/lib/types'

interface CalculationReportProps {
  message: InfoMessage
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
      bbcode += `[b]Товар:[/b] ${data.productId} | ${data.productName}\n`
    }
    
    if (data.presetId && data.presetName) {
      const modified = data.presetModified ? ` | Изменён: ${data.presetModified}` : ''
      bbcode += `[b]Пресет:[/b] ${data.presetId} | ${data.presetName}${modified}\n`
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
function StageItem({ message }: { message: InfoMessage }) {
  const data = message.calculationData
  if (!data) return null
  
  const priceStr = data.purchasePrice !== undefined && data.basePrice !== undefined
    ? ` ${formatPrice(data.purchasePrice, data.currency || 'RUB')} > ${formatPrice(data.basePrice, data.currency || 'RUB')}`
    : ''
  
  return (
    <div className="pl-4 py-1 text-sm border-l-2 border-border">
      <span className="font-medium">{data.stageName || 'Этап'}</span>
      {priceStr && (
        <span
          className="text-muted-foreground ml-2"
          title="Слева закупочная цена, справа базовая цена"
        >
          {priceStr}
        </span>
      )}
    </div>
  )
}

/**
 * Render a single detail or binding
 */
function DetailItem({ message }: { message: InfoMessage }) {
  const data = message.calculationData
  if (!data) return null
  
  const priceStr = data.purchasePrice !== undefined && data.basePrice !== undefined
    ? ` ${formatPrice(data.purchasePrice, data.currency || 'RUB')} > ${formatPrice(data.basePrice, data.currency || 'RUB')}`
    : ''
  
  const stages = data.children?.filter(child => child.level === 'stage') || []
  const childDetails = data.children?.filter(child => child.level === 'detail') || []
  
  if (stages.length === 0 && childDetails.length === 0) {
    // Simple detail without nested items
    return (
      <div className="py-1 text-sm">
        <span className="font-medium">
          {data.detailType === 'binding' ? '📦 ' : '📄 '}
          {data.detailName}
        </span>
        {priceStr && (
          <span
            className="text-muted-foreground ml-2"
            title="Слева закупочная цена, справа базовая цена"
          >
            {priceStr}
          </span>
        )}
      </div>
    )
  }
  
  return (
    <AccordionItem value={message.id} className="border-none">
      <AccordionTrigger className="py-2 text-sm hover:no-underline">
        <span className="flex items-center gap-2">
          <span className="font-medium">
            {data.detailType === 'binding' ? '📦 ' : '📄 '}
            {data.detailName}
          </span>
          {priceStr && (
            <span
              className="text-muted-foreground"
              title="Слева закупочная цена, справа базовая цена"
            >
              {priceStr}
            </span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-1 pb-2">
        {/* Render child details (for bindings) */}
        {childDetails.length > 0 && (
          <Accordion type="multiple" className="space-y-1">
            {childDetails.map(child => (
              <DetailItem key={child.id} message={child} />
            ))}
          </Accordion>
        )}
        
        {/* Render stages */}
        {stages.map(stage => (
          <StageItem key={stage.id} message={stage} />
        ))}
      </AccordionContent>
    </AccordionItem>
  )
}

/**
 * Main calculation report component
 */
export function CalculationReport({ message }: CalculationReportProps) {
  const data = message.calculationData
  
  if (!data || !data.offerName) {
    return <div className="text-sm">{message.message}</div>
  }
  
  const details = data.children?.filter(child => child.level === 'detail') || []
  
  // Determine if calculation was successful
  const hasNonZeroPrices = (data.purchasePrice ?? 0) > 0
  const isSuccessful = hasNonZeroPrices && details.length > 0
  
  return (
    <div className="space-y-2">
      {/* Offer header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-sm flex-1">
            Торговое предложение: {data.offerName} | {message.offerId || ''}
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
            Товар: {data.productId} | {data.productName}
          </div>
        )}
        
        {data.presetId && data.presetName && (
          <div className="text-xs text-muted-foreground">
            Пресет: {data.presetId} | {data.presetName}
            {data.presetModified && ` | Изменён: ${data.presetModified}`}
          </div>
        )}
      </div>
      
      {/* Details accordion */}
      {details.length > 0 && (
        <div className="space-y-1">
          <Accordion type="multiple" className="space-y-1">
            {details.map(detail => (
              <DetailItem key={detail.id} message={detail} />
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
              <div className="font-medium mb-1">
                Цены торгового предложения с учётом наценок (по диапазонам):
              </div>
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
