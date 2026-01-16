import { useState, useEffect, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Tag, Plus, Trash, CaretDown, CaretUp } from '@phosphor-icons/react'
import { postMessageBridge, PriceRangeItem } from '@/lib/postmessage-bridge'

// Currency constants
const CURRENCY_RUB = 'RUB'
const CURRENCY_PRC = 'PRC'

interface PricePanelProps {
  priceTypes?: Array<{ id: number; name: string; base: boolean; sort: number }>
  presetPrices?: PriceRangeItem[]
  presetId?: number
  defaultExtraCurrency?: 'RUB' | 'PRC'
  defaultExtraValue?: number
}

export function PricePanel({ priceTypes = [], presetPrices = [], presetId, defaultExtraCurrency, defaultExtraValue }: PricePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [prices, setPrices] = useState<PriceRangeItem[]>([])
  const [activeTypeIds, setActiveTypeIds] = useState<number[]>([])
  const isInitializedRef = useRef(false)

  // Find base price type
  const basePriceType = priceTypes.find(pt => pt.base)
  
  // Sort price types by sort field
  const sortedPriceTypes = [...priceTypes].sort((a, b) => a.sort - b.sort)

  // Prepare payload for send - calculate quantityTo correctly
  const preparePayloadForSend = (currentPrices: PriceRangeItem[]): PriceRangeItem[] => {
    // Получить все уникальные quantityFrom, отсортировать
    const uniqueFroms = [...new Set(currentPrices.map(p => p.quantityFrom || 0))].sort((a, b) => a - b)
    
    return currentPrices.map(price => {
      const currentFrom = price.quantityFrom || 0
      const currentIndex = uniqueFroms.indexOf(currentFrom)
      
      // Если это последний диапазон — quantityTo = null
      if (currentIndex === uniqueFroms.length - 1) {
        return { ...price, quantityTo: null }
      }
      
      // Иначе quantityTo = следующий.quantityFrom - 1
      const nextFrom = uniqueFroms[currentIndex + 1]
      return { ...price, quantityTo: nextFrom - 1 }
    })
  }

  // Initialize from presetPrices
  useEffect(() => {
    if (isInitializedRef.current || !basePriceType) return
    
    if (presetPrices.length > 0) {
      setPrices(presetPrices)
      
      // Auto-activate price types that have data
      const activeIds = new Set(presetPrices.map(p => p.typeId))
      setActiveTypeIds(Array.from(activeIds))
    } else if (basePriceType) {
      // Initialize with default range for base type
      const defaultRange: PriceRangeItem = {
        typeId: basePriceType.id,
        price: defaultExtraValue ?? 10,
        currency: defaultExtraCurrency ?? 'PRC',
        quantityFrom: 0,
        quantityTo: null,
      }
      setPrices([defaultRange])
      setActiveTypeIds([basePriceType.id])
    }
    
    isInitializedRef.current = true
  }, [basePriceType, presetPrices])

  // Get unique ranges from base type
  const getBaseRanges = (): Array<{ quantityFrom: number | null; quantityTo: number | null }> => {
    if (!basePriceType) return []
    
    const baseTypePrices = prices.filter(p => p.typeId === basePriceType.id)
    const sortedPrices = baseTypePrices.sort((a, b) => (a.quantityFrom || 0) - (b.quantityFrom || 0))
    
    return sortedPrices.map(p => ({
      quantityFrom: p.quantityFrom,
      quantityTo: p.quantityTo,
    }))
  }

  // Get price for a specific type and range
  const getPriceForTypeAndRange = (typeId: number, quantityFrom: number | null): PriceRangeItem | undefined => {
    return prices.find(p => p.typeId === typeId && p.quantityFrom === quantityFrom)
  }

  // Toggle price type active status
  const handleTypeToggle = (typeId: number, checked: boolean) => {
    if (!basePriceType || typeId === basePriceType.id) return // Can't toggle base type
    
    if (checked) {
      // Add this type to all existing ranges
      const baseRanges = getBaseRanges()
      const newPrices = [...prices]
      
      baseRanges.forEach(range => {
        // Check if already exists
        const exists = newPrices.some(p => p.typeId === typeId && p.quantityFrom === range.quantityFrom)
        if (!exists) {
          newPrices.push({
            typeId,
            price: defaultExtraValue ?? 10,
            currency: defaultExtraCurrency ?? 'PRC',
            quantityFrom: range.quantityFrom,
            quantityTo: range.quantityTo,
          })
        }
      })
      
      setPrices(newPrices)
      const newActiveTypeIds = [...activeTypeIds, typeId]
      setActiveTypeIds(newActiveTypeIds)
      
      // Send unified update
      const payload = preparePayloadForSend(newPrices)
      postMessageBridge.sendChangePricePresetRequest(payload)
    } else {
      // Remove all ranges for this type
      const newPrices = prices.filter(p => p.typeId !== typeId)
      setPrices(newPrices)
      const newActiveTypeIds = activeTypeIds.filter(id => id !== typeId)
      setActiveTypeIds(newActiveTypeIds)
      
      // Send unified update
      const payload = preparePayloadForSend(newPrices)
      postMessageBridge.sendChangePricePresetRequest(payload)
    }
  }

  // Add a new range
  const handleAddRange = (currentIndex: number) => {
    if (!basePriceType) return
    
    const baseRanges = getBaseRanges()
    const currentRange = baseRanges[currentIndex]
    
    let newFrom: number
    
    if (currentIndex === baseRanges.length - 1) {
      // Last range - add after
      newFrom = (currentRange.quantityFrom || 0) === 0 ? 10 : (currentRange.quantityFrom || 0) * 2
    } else {
      // Middle range - split
      const nextRange = baseRanges[currentIndex + 1]
      const currentFrom = currentRange.quantityFrom || 0
      const nextFrom = nextRange.quantityFrom || 0
      
      if (nextFrom - currentFrom <= 1) {
        return // No space to split
      }
      
      newFrom = Math.ceil((currentFrom + nextFrom) / 2)
    }
    
    // Update quantityTo for existing ranges
    const newPrices = [...prices]
    
    // Add new range for all active types
    activeTypeIds.forEach(typeId => {
      newPrices.push({
        typeId,
        price: defaultExtraValue ?? 10,
        currency: defaultExtraCurrency ?? 'PRC',
        quantityFrom: newFrom,
        quantityTo: null,
      })
    })
    
    setPrices(newPrices)
    
    // Send unified update
    const payload = preparePayloadForSend(newPrices)
    postMessageBridge.sendChangePricePresetRequest(payload)
  }

  // Remove a range
  const handleRemoveRange = (rangeIndex: number) => {
    if (rangeIndex === 0) return // Can't remove first range
    
    const baseRanges = getBaseRanges()
    const rangeToRemove = baseRanges[rangeIndex]
    
    // Remove this range for all types
    const newPrices = prices.filter(p => p.quantityFrom !== rangeToRemove.quantityFrom)
    
    setPrices(newPrices)
    
    // Send unified update
    const payload = preparePayloadForSend(newPrices)
    postMessageBridge.sendChangePricePresetRequest(payload)
  }

  // Update price value
  const handlePriceChange = (typeId: number, quantityFrom: number | null, newPrice: number) => {
    const newPrices = prices.map(p => 
      p.typeId === typeId && p.quantityFrom === quantityFrom
        ? { ...p, price: newPrice }
        : p
    )
    setPrices(newPrices)
  }

  const handlePriceBlur = () => {
    // Send unified update
    const payload = preparePayloadForSend(prices)
    postMessageBridge.sendChangePricePresetRequest(payload)
  }

  // Update currency
  const handleCurrencyChange = (typeId: number, quantityFrom: number | null, newCurrency: 'RUB' | 'PRC') => {
    const newPrices = prices.map(p => 
      p.typeId === typeId && p.quantityFrom === quantityFrom
        ? { ...p, currency: newCurrency }
        : p
    )
    setPrices(newPrices)
    
    // Send unified update
    const payload = preparePayloadForSend(newPrices)
    postMessageBridge.sendChangePricePresetRequest(payload)
  }

  // Update range boundary (only for base type)
  const handleRangeFromChange = (rangeIndex: number, newFrom: number) => {
    if (!basePriceType || rangeIndex === 0) return // Can't change first range
    
    const baseRanges = getBaseRanges()
    const oldFrom = baseRanges[rangeIndex].quantityFrom
    
    // Validate: must be greater than previous range
    if (rangeIndex > 0) {
      const prevFrom = baseRanges[rangeIndex - 1].quantityFrom || 0
      if (newFrom <= prevFrom) {
        return
      }
    }
    
    // Update all types for this range
    const newPrices = prices.map(p => 
      p.quantityFrom === oldFrom
        ? { ...p, quantityFrom: newFrom }
        : p
    )
    
    setPrices(newPrices)
  }

  const handleRangeFromBlur = () => {
    // Send unified update
    const payload = preparePayloadForSend(prices)
    postMessageBridge.sendChangePricePresetRequest(payload)
  }

  // Calculate quantityTo for each range
  const calculateQuantityTo = (rangeIndex: number): number | null => {
    const baseRanges = getBaseRanges()
    if (rangeIndex >= baseRanges.length - 1) {
      return null // Last range is infinity
    }
    const nextFrom = baseRanges[rangeIndex + 1].quantityFrom || 0
    return nextFrom - 1
  }

  const baseRanges = getBaseRanges()

  return (
    <div id="panel-sale-prices" className="border-t border-border bg-card" data-pwcode="pricepanel">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        data-pwcode="btn-toggle-pricepanel"
      >
        <span className="text-sm font-medium flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <Tag className="w-4 h-4" />
          </div>
          Отпускные цены
        </span>
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
          {isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t border-border overflow-y-auto scrollbar-gutter-stable" style={{ maxHeight: '500px' }} data-pwcode="price-content">
          <div className="px-4 py-3 space-y-4">
            {/* Price type checkboxes */}
            <div className="space-y-2">
              <Label>Типы цен</Label>
              <div className="flex items-center gap-4 flex-wrap" data-pwcode="price-types-select">
                {sortedPriceTypes.map(priceType => {
                  const isBase = priceType.base
                  const isActive = activeTypeIds.includes(priceType.id)
                  
                  return (
                    <div key={priceType.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`price-type-${priceType.id}`}
                        checked={isActive}
                        onCheckedChange={(checked) => handleTypeToggle(priceType.id, checked as boolean)}
                        disabled={isBase}
                        data-pwcode="checkbox-pricetype"
                      />
                      <Label htmlFor={`price-type-${priceType.id}`} className="cursor-pointer">
                        {priceType.name} {isBase && '(базовый)'}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Price ranges table */}
            {activeTypeIds.length > 0 && baseRanges.length > 0 && (
              <div className="space-y-2">
                <Label>Диапазоны наценки</Label>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground w-12">+</th>
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">От</th>
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">До</th>
                        {sortedPriceTypes
                          .filter(pt => activeTypeIds.includes(pt.id))
                          .map(pt => (
                            <th key={pt.id} className="text-left p-2 text-xs font-medium text-muted-foreground">
                              {pt.name}
                            </th>
                          ))}
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground w-12">-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baseRanges.map((range, rangeIndex) => {
                        const isFirst = rangeIndex === 0
                        const isLast = rangeIndex === baseRanges.length - 1
                        const quantityTo = calculateQuantityTo(rangeIndex)
                        
                        return (
                          <tr key={rangeIndex} className="border-b">
                            {/* Add button column */}
                            <td className="p-2">
                              <div className="flex items-center justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddRange(rangeIndex)}
                                  className="h-7 w-7 p-0"
                                  title="Добавить диапазон"
                                  data-pwcode="btn-add-range"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                            
                            {/* From */}
                            <td className="p-2">
                              <Input
                                type="number"
                                value={range.quantityFrom || 0}
                                onChange={(e) => handleRangeFromChange(rangeIndex, parseInt(e.target.value) || 0)}
                                onBlur={handleRangeFromBlur}
                                disabled={isFirst}
                                className="w-20 h-8 text-xs"
                                min={0}
                                data-pwcode="input-range-from"
                              />
                            </td>
                            
                            {/* To */}
                            <td className="p-2">
                              <Input
                                type="text"
                                value={quantityTo === null ? '∞' : quantityTo}
                                disabled
                                className="w-20 h-8 text-xs"
                                data-pwcode="input-range-to"
                              />
                            </td>
                            
                            {/* Price cells for each active type */}
                            {sortedPriceTypes
                              .filter(pt => activeTypeIds.includes(pt.id))
                              .map(priceType => {
                                const priceItem = getPriceForTypeAndRange(priceType.id, range.quantityFrom)
                                const isBaseType = priceType.base
                                
                                return (
                                  <td key={priceType.id} className="p-2">
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        value={priceItem?.price || 0}
                                        onChange={(e) => handlePriceChange(priceType.id, range.quantityFrom, parseFloat(e.target.value) || 0)}
                                        onBlur={handlePriceBlur}
                                        className="w-20 h-8 text-xs"
                                        min={0}
                                        step={0.1}
                                        data-pwcode="input-markup-value"
                                      />
                                      <button
                                        onClick={() => {
                                          const newCurrency = priceItem?.currency === CURRENCY_PRC ? CURRENCY_RUB : CURRENCY_PRC
                                          handleCurrencyChange(priceType.id, range.quantityFrom, newCurrency)
                                        }}
                                        className="w-11 h-8 text-xs border rounded hover:bg-accent"
                                        data-pwcode="btn-toggle-currency"
                                      >
                                        {priceItem?.currency === CURRENCY_PRC ? '%' : 'RUB'}
                                      </button>
                                    </div>
                                  </td>
                                )
                              })}
                            
                            {/* Remove button column */}
                            <td className="p-2">
                              <div className="flex items-center justify-center">
                                {!isFirst && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveRange(rangeIndex)}
                                    className="h-7 w-7 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                    title="Удалить диапазон"
                                    data-pwcode="btn-remove-range"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
