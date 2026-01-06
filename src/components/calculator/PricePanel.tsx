import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Tag, Plus, Trash, CaretDown, CaretUp } from '@phosphor-icons/react'
import { 
  SalePricesSettings, 
  PriceTypeCode, 
  PriceTypeSettings, 
  CorrectionBase, 
  MarkupUnit,
  PriceRange 
} from '@/lib/types'

// Currency constants for price markup
const CURRENCY_RUB = 'RUB'
const CURRENCY_PERCENT = 'PRC'

// Measure codes
const MEASURE_CODE_PIECES = '796'  // pieces (show 'cost')
const MEASURE_CODE_SERVICE = '999' // service (show 'run')

interface PricePanelProps {
  settings: SalePricesSettings
  onSettingsChange: (settings: SalePricesSettings) => void
  priceTypes?: Array<{ id: number; name: string; base: boolean; sort: number }>
  presetPrices?: Array<{
    typeId: number
    price: number
    currency: string  // "RUB" or "PRC" (percent)
    quantityFrom: number | null
    quantityTo: number | null
  }>
  presetMeasure?: {
    code: string  // "796" = pieces (show 'cost'), "999" = service (show 'run')
    name: string
  }
}

const PRICE_TYPE_OPTIONS: Array<{ value: PriceTypeCode; label: string }> = [
  { value: 'BASE_PRICE', label: 'Розничная цена' },
  { value: 'TRADE_PRICE', label: 'Оптовая цена' },
]

const CORRECTION_BASE_OPTIONS: Array<{ value: CorrectionBase; label: string }> = [
  { value: 'RUN', label: 'Тираж' },
  { value: 'COST', label: 'Стоимость' },
]

const MARKUP_UNIT_OPTIONS: Array<{ value: MarkupUnit; label: string }> = [
  { value: '%', label: '%' },
  { value: 'RUB', label: 'RUB' },
]

const createDefaultPriceTypeSettings = (): PriceTypeSettings => ({
  correctionBase: 'RUN',
  ranges: [
    {
      from: 0,
      markupValue: 0,
      markupUnit: '%',
    }
  ],
})

export function PricePanel({ settings, onSettingsChange, priceTypes, presetPrices, presetMeasure }: PricePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Determine correctionBase from presetMeasure
  const defaultCorrectionBase: CorrectionBase = presetMeasure?.code === MEASURE_CODE_PIECES ? 'COST' : 'RUN'
  
  // Transform priceTypes from props to options, fallback to hardcoded if not provided
  const priceTypeOptions = priceTypes && priceTypes.length > 0
    ? priceTypes.map(pt => ({
        value: pt.name as PriceTypeCode,
        label: pt.name,
        id: pt.id,
        isBase: pt.base,
      }))
    : PRICE_TYPE_OPTIONS

  // Find base price type
  const basePriceType = priceTypeOptions.find(pt => pt.isBase)
  
  // Helper function to initialize ranges from presetPrices for a given priceTypeId
  const initializeRangesFromPreset = (priceTypeId: number): PriceRange[] => {
    const pricesForType = (presetPrices || []).filter(p => p.typeId === priceTypeId)
    
    if (pricesForType.length === 0) {
      return createDefaultPriceTypeSettings().ranges
    }
    
    // Sort by quantityFrom
    const sortedPrices = pricesForType.sort((a, b) => (a.quantityFrom || 0) - (b.quantityFrom || 0))
    
    return sortedPrices.map(p => ({
      from: p.quantityFrom || 0,
      to: p.quantityTo,
      markupValue: p.price,
      markupUnit: (p.currency === CURRENCY_PERCENT ? '%' : 'RUB') as MarkupUnit,
    }))
  }
  
  // Initialize base price type and auto-select types from presetPrices on mount
  useEffect(() => {
    if (!basePriceType || !priceTypes) return
    
    const newTypes = { ...settings.types }
    const newSelectedTypes = [...settings.selectedTypes]
    let hasChanges = false
    
    // Initialize base price type if not already selected
    if (!newSelectedTypes.includes(basePriceType.value)) {
      hasChanges = true
      newSelectedTypes.push(basePriceType.value)
      
      if (!newTypes[basePriceType.value]) {
        const baseRanges = initializeRangesFromPreset(basePriceType.id)
        newTypes[basePriceType.value] = {
          correctionBase: defaultCorrectionBase,
          ranges: baseRanges,
        }
      }
    }
    
    // Auto-select price types that have data in presetPrices
    const activePriceTypeIds = new Set(presetPrices?.map(p => p.typeId) || [])
    
    priceTypeOptions.forEach(option => {
      if (option.isBase) return // Skip base, already handled
      
      if (activePriceTypeIds.has(option.id) && !newSelectedTypes.includes(option.value)) {
        hasChanges = true
        newSelectedTypes.push(option.value)
        
        if (!newTypes[option.value]) {
          const ranges = initializeRangesFromPreset(option.id)
          newTypes[option.value] = {
            correctionBase: defaultCorrectionBase,
            ranges,
          }
        }
      }
    })
    
    if (hasChanges) {
      console.log('[PRICE_PANEL] Auto-initializing price types from preset', { 
        selectedTypes: newSelectedTypes,
        types: Object.keys(newTypes)
      })
      
      onSettingsChange({
        ...settings,
        selectedTypes: newSelectedTypes,
        types: newTypes,
      })
    }
  }, [basePriceType, priceTypes, presetPrices]) // Only run when these change
  
  const handleTypeSelection = (priceType: PriceTypeCode, checked: boolean) => {
    console.log('[PRICE_PANEL] Price type selection changed', { priceType, checked })
    
    // Don't allow unchecking base price type
    if (!checked && basePriceType?.value === priceType) {
      return
    }
    
    const newSelectedTypes = checked
      ? [...settings.selectedTypes, priceType]
      : settings.selectedTypes.filter(t => t !== priceType)
    
    const newTypes = { ...settings.types }
    if (checked && !newTypes[priceType]) {
      // Get markupUnit from presetPrices for this type
      const priceTypeOption = priceTypeOptions.find(pt => pt.value === priceType)
      const presetPrice = presetPrices?.find(p => p.typeId === priceTypeOption?.id)
      const markupUnit: MarkupUnit = presetPrice?.currency === CURRENCY_PERCENT ? '%' : 'RUB'
      
      // Copy ranges from base type if available
      const baseSettings = basePriceType ? newTypes[basePriceType.value] : null
      const ranges = baseSettings?.ranges?.map(r => ({
        ...r,
        markupUnit,
      })) || createDefaultPriceTypeSettings().ranges
      
      newTypes[priceType] = {
        correctionBase: defaultCorrectionBase,
        ranges,
      }
    }
    
    onSettingsChange({
      ...settings,
      selectedTypes: newSelectedTypes,
      types: newTypes,
    })
  }

  // Sync ranges to all active types when base type ranges change
  const syncRangesToAllTypes = (baseRanges: PriceRange[]) => {
    if (!basePriceType) return
    
    const newTypes = { ...settings.types }
    
    for (const priceType of settings.selectedTypes) {
      if (priceType !== basePriceType.value && newTypes[priceType]) {
        const priceTypeOption = priceTypeOptions.find(pt => pt.value === priceType)
        const presetPrice = presetPrices?.find(p => p.typeId === priceTypeOption?.id)
        const defaultMarkupUnit: MarkupUnit = presetPrice?.currency === CURRENCY_PERCENT ? '%' : 'RUB'
        
        newTypes[priceType] = {
          ...newTypes[priceType],
          ranges: baseRanges.map(r => {
            const existingRange = newTypes[priceType].ranges.find(
              existingRange => existingRange.from === r.from
            )
            return {
              from: r.from,
              markupValue: existingRange?.markupValue ?? r.markupValue,
              markupUnit: existingRange?.markupUnit ?? defaultMarkupUnit,
            }
          })
        }
      }
    }
    
    onSettingsChange({ ...settings, types: newTypes })
  }

  const updatePriceTypeSettings = (priceType: PriceTypeCode, updates: Partial<PriceTypeSettings>) => {
    onSettingsChange({
      ...settings,
      types: {
        ...settings.types,
        [priceType]: {
          ...settings.types[priceType],
          ...updates,
        }
      }
    })
  }

  const calculateTo = (ranges: PriceRange[], index: number): number | null => {
    if (index >= ranges.length - 1) {
      return null
    }
    return ranges[index + 1].from - 1
  }

  const addRange = (priceType: PriceTypeCode, currentIndex: number) => {
    console.log('[ADD_PRICE_RANGE] Adding price range', { priceType, currentIndex })
    
    const typeSettings = settings.types[priceType]
    if (!typeSettings) return
    
    const ranges = typeSettings.ranges
    const currentRange = ranges[currentIndex]
    const to = calculateTo(ranges, currentIndex)
    
    let newFrom: number
    
    if (to === null) {
      // Last range - add range after current
      if (currentRange.from === 0) {
        newFrom = 10
      } else {
        newFrom = currentRange.from * 2
      }
    } else {
      // Middle range - find midpoint between current and next
      newFrom = Math.ceil((currentRange.from + to + 1) / 2)
      
      if (newFrom <= currentRange.from || newFrom >= ranges[currentIndex + 1].from) {
        console.warn('[ADD_PRICE_RANGE] Cannot add range, no space between current and next')
        return
      }
    }
    
    const newRange: PriceRange = {
      from: newFrom,
      markupValue: 0,
      markupUnit: currentRange.markupUnit || '%',
    }
    
    const newRanges = [
      ...ranges.slice(0, currentIndex + 1),
      newRange,
      ...ranges.slice(currentIndex + 1),
    ]
    
    updatePriceTypeSettings(priceType, { ranges: newRanges })
    
    console.log('[ADD_PRICE_RANGE] Range added', { priceType, newRange, totalRanges: newRanges.length })
    
    // If this is base type, sync to all other types
    if (basePriceType?.value === priceType) {
      syncRangesToAllTypes(newRanges)
    }
  }

  const removeRange = (priceType: PriceTypeCode, index: number) => {
    console.log('[DELETE_PRICE_RANGE] Removing price range', { priceType, index })
    
    if (index === 0) return
    
    const typeSettings = settings.types[priceType]
    if (!typeSettings) return
    
    const newRanges = typeSettings.ranges.filter((_, i) => i !== index)
    updatePriceTypeSettings(priceType, { ranges: newRanges })
    
    console.log('[DELETE_PRICE_RANGE] Range removed', { priceType, totalRanges: newRanges.length })
    
    // If this is base type, sync to all other types
    if (basePriceType?.value === priceType) {
      syncRangesToAllTypes(newRanges)
    }
  }

  const updateRange = (priceType: PriceTypeCode, index: number, updates: Partial<PriceRange>) => {
    const typeSettings = settings.types[priceType]
    if (!typeSettings) return
    
    const newRanges = typeSettings.ranges.map((range, i) => 
      i === index ? { ...range, ...updates } : range
    )
    updatePriceTypeSettings(priceType, { ranges: newRanges })
    
    // If this is base type and 'from' was updated, sync to all other types
    if (basePriceType?.value === priceType && 'from' in updates) {
      syncRangesToAllTypes(newRanges)
    }
  }

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
            <div className="space-y-2">
              <Label>Типы цен</Label>
              <div className="flex items-center gap-4" data-pwcode="price-types-select">
                {priceTypeOptions.map(option => {
                  const isBase = option.isBase
                  const isChecked = settings.selectedTypes.includes(option.value)
                  
                  return (
                    <div key={option.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`price-type-${option.value}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => handleTypeSelection(option.value, checked as boolean)}
                        disabled={isBase}
                        data-pwcode="checkbox-pricetype"
                      />
                      <Label htmlFor={`price-type-${option.value}`} className="cursor-pointer">
                        {option.label} {isBase && '(базовый)'}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>

            {settings.selectedTypes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="global-correction-base" className="whitespace-nowrap">Коррекция на основе</Label>
                <Select 
                  value={basePriceType && settings.types[basePriceType.value]?.correctionBase || defaultCorrectionBase} 
                  onValueChange={(value: CorrectionBase) => {
                    // Update correctionBase for all selected types
                    const newTypes = { ...settings.types }
                    settings.selectedTypes.forEach(priceType => {
                      if (newTypes[priceType]) {
                        newTypes[priceType] = {
                          ...newTypes[priceType],
                          correctionBase: value,
                        }
                      }
                    })
                    onSettingsChange({ ...settings, types: newTypes })
                  }}
                >
                  <SelectTrigger id="global-correction-base" className="w-32" data-pwcode="select-correction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CORRECTION_BASE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {settings.selectedTypes.map(priceType => {
              const typeSettings = settings.types[priceType]
              if (!typeSettings) return null

              const priceTypeLabel = priceTypeOptions.find(o => o.value === priceType)?.label || priceType
              const isBaseType = basePriceType?.value === priceType

              return (
                <div key={priceType} className="border border-border rounded-lg p-3 space-y-3 bg-muted/20" data-pwcode="price-type-block">
                  <h3 className="font-medium text-sm">{priceTypeLabel}</h3>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Диапазоны наценки</Label>
                    <div className="space-y-2">
                      {typeSettings.ranges.map((range, index) => {
                        const to = calculateTo(typeSettings.ranges, index)
                        const isFirst = index === 0
                        const priceTypeOption = priceTypeOptions.find(pt => pt.value === priceType)
                        const presetPrice = presetPrices?.find(p => p.typeId === priceTypeOption?.id)

                        return (
                          <div key={index} className="flex items-center gap-2 flex-wrap text-sm" data-pwcode="price-range">
                            <span className="text-muted-foreground">от</span>
                            <Input
                              type="number"
                              value={range.from}
                              onChange={(e) => {
                                const newValue = parseFloat(e.target.value) || 0
                                updateRange(priceType, index, { from: newValue })
                              }}
                              onBlur={(e) => {
                                const newValue = parseFloat(e.target.value) || 0
                                if (index > 0 && newValue >= 1) {
                                  const prevFrom = typeSettings.ranges[index - 1]?.from || 0
                                  if (newValue <= prevFrom) {
                                    updateRange(priceType, index, { from: prevFrom + 1 })
                                  }
                                }
                              }}
                              disabled={isFirst || !isBaseType}
                              className="w-24"
                              min={1}
                              data-pwcode="input-range-from"
                            />

                            <span className="text-muted-foreground">до</span>
                            <Input
                              type="text"
                              value={to === null ? '∞' : to.toString()}
                              disabled
                              className="w-24"
                              data-pwcode="input-range-to"
                            />

                            <span className="text-muted-foreground">применить наценку</span>
                            <Input
                              type="number"
                              value={range.markupValue}
                              onChange={(e) => 
                                updateRange(priceType, index, { 
                                  markupValue: parseFloat(e.target.value) || 0 
                                })
                              }
                              className="w-24"
                              min={0}
                              step={0.1}
                              data-pwcode="input-markup-value"
                            />

                            <Select 
                              value={range.markupUnit} 
                              onValueChange={(value: MarkupUnit) => 
                                updateRange(priceType, index, { markupUnit: value })
                              }
                              disabled={presetPrice?.currency === CURRENCY_PERCENT}
                            >
                              <SelectTrigger className="w-20" data-pwcode="select-markup-unit">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MARKUP_UNIT_OPTIONS.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {isBaseType && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => addRange(priceType, index)}
                                className="h-8 w-8 p-0"
                                title="Добавить диапазон"
                                data-pwcode="btn-add-range"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}

                            {!isFirst && isBaseType && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeRange(priceType, index)}
                                className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                title="Удалить диапазон"
                                data-pwcode="btn-remove-range"
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
