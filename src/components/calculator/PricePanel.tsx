import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { CaretDown, CaretUp, Tag, Plus, Trash } from '@phosphor-icons/react'
import { 
  SalePricesSettings, 
  PriceTypeCode, 
  PriceTypeSettings, 
  CorrectionBase, 
  MarkupUnit,
  PriceRange 
} from '@/lib/types'

interface PriceMessage {
  id: string
  timestamp: number
  message: string
}

interface PricePanelProps {
  messages: PriceMessage[]
  isExpanded: boolean
  onToggle: () => void
  settings: SalePricesSettings
  onSettingsChange: (settings: SalePricesSettings) => void
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
  prettyPriceEnabled: false,
  prettyPriceCommonLimitEnabled: false,
  prettyPriceCommonLimitRub: 100,
  ranges: [
    {
      from: 0,
      markupValue: 0,
      markupUnit: '%',
      prettyPriceLimitRub: 100,
    }
  ],
})

export function PricePanel({ messages, isExpanded, onToggle, settings, onSettingsChange }: PricePanelProps) {
  const handleTypeSelection = (priceType: PriceTypeCode, checked: boolean) => {
    const newSelectedTypes = checked
      ? [...settings.selectedTypes, priceType]
      : settings.selectedTypes.filter(t => t !== priceType)
    
    const newTypes = { ...settings.types }
    if (checked && !newTypes[priceType]) {
      newTypes[priceType] = createDefaultPriceTypeSettings()
    }
    
    onSettingsChange({
      ...settings,
      selectedTypes: newSelectedTypes,
      types: newTypes,
    })
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
    const typeSettings = settings.types[priceType]
    if (!typeSettings) return
    
    const ranges = typeSettings.ranges
    const currentRange = ranges[currentIndex]
    const to = calculateTo(ranges, currentIndex)
    
    let newFrom: number
    
    if (to === null) {
      newFrom = currentRange.from * 2
    } else {
      newFrom = Math.ceil((currentRange.from + to + 1) / 2)
      
      if (newFrom <= currentRange.from || newFrom >= ranges[currentIndex + 1].from) {
        return
      }
    }
    
    const newRange: PriceRange = {
      from: newFrom,
      markupValue: 0,
      markupUnit: '%',
      prettyPriceLimitRub: typeSettings.prettyPriceCommonLimitEnabled 
        ? typeSettings.prettyPriceCommonLimitRub 
        : 100,
    }
    
    const newRanges = [
      ...ranges.slice(0, currentIndex + 1),
      newRange,
      ...ranges.slice(currentIndex + 1),
    ]
    
    updatePriceTypeSettings(priceType, { ranges: newRanges })
  }

  const removeRange = (priceType: PriceTypeCode, index: number) => {
    if (index === 0) return
    
    const typeSettings = settings.types[priceType]
    if (!typeSettings) return
    
    const newRanges = typeSettings.ranges.filter((_, i) => i !== index)
    updatePriceTypeSettings(priceType, { ranges: newRanges })
  }

  const updateRange = (priceType: PriceTypeCode, index: number, updates: Partial<PriceRange>) => {
    const typeSettings = settings.types[priceType]
    if (!typeSettings) return
    
    const newRanges = typeSettings.ranges.map((range, i) => 
      i === index ? { ...range, ...updates } : range
    )
    updatePriceTypeSettings(priceType, { ranges: newRanges })
  }

  return (
    <div id="panel-sale-prices" className="border-t border-border bg-card">
      <div className="max-w-[1920px] mx-auto">
        <button
          onClick={onToggle}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
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
          <div className="border-t border-border overflow-y-scroll scrollbar-gutter-stable" style={{ maxHeight: '500px' }}>
            <div className="px-4 py-3 space-y-4">
              <div className="space-y-2">
                <Label>Типы цен</Label>
                <div className="flex items-center gap-4">
                  {PRICE_TYPE_OPTIONS.map(option => (
                    <div key={option.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`price-type-${option.value}`}
                        checked={settings.selectedTypes.includes(option.value)}
                        onCheckedChange={(checked) => handleTypeSelection(option.value, checked as boolean)}
                      />
                      <Label htmlFor={`price-type-${option.value}`} className="cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {settings.selectedTypes.map(priceType => {
                const typeSettings = settings.types[priceType]
                if (!typeSettings) return null

                const priceTypeLabel = PRICE_TYPE_OPTIONS.find(o => o.value === priceType)?.label || priceType

                return (
                  <div key={priceType} className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
                    <h3 className="font-medium text-sm">{priceTypeLabel}</h3>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`correction-base-${priceType}`} className="whitespace-nowrap">Коррекция на основе</Label>
                        <Select 
                          value={typeSettings.correctionBase} 
                          onValueChange={(value: CorrectionBase) => 
                            updatePriceTypeSettings(priceType, { correctionBase: value })
                          }
                        >
                          <SelectTrigger id={`correction-base-${priceType}`} className="w-32">
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

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`pretty-price-${priceType}`}
                          checked={typeSettings.prettyPriceEnabled}
                          onCheckedChange={(checked) => 
                            updatePriceTypeSettings(priceType, { 
                              prettyPriceEnabled: checked as boolean,
                              prettyPriceCommonLimitEnabled: false,
                            })
                          }
                        />
                        <Label htmlFor={`pretty-price-${priceType}`} className="cursor-pointer whitespace-nowrap">
                          Подбор "красивой" цены
                        </Label>
                      </div>

                      {typeSettings.prettyPriceEnabled && (
                        <>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`common-limit-${priceType}`}
                              checked={typeSettings.prettyPriceCommonLimitEnabled}
                              onCheckedChange={(checked) => 
                                updatePriceTypeSettings(priceType, { 
                                  prettyPriceCommonLimitEnabled: checked as boolean 
                                })
                              }
                            />
                            <Label htmlFor={`common-limit-${priceType}`} className="cursor-pointer whitespace-nowrap">
                              Общее ограничение
                            </Label>
                          </div>

                          {typeSettings.prettyPriceCommonLimitEnabled && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={typeSettings.prettyPriceCommonLimitRub}
                                onChange={(e) => 
                                  updatePriceTypeSettings(priceType, { 
                                    prettyPriceCommonLimitRub: parseFloat(e.target.value) || 100 
                                  })
                                }
                                className="w-24"
                                min={0}
                                step={1}
                              />
                              <span className="text-sm text-muted-foreground">руб.</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Диапазоны наценки</Label>
                      <div className="space-y-2">
                        {typeSettings.ranges.map((range, index) => {
                          const to = calculateTo(typeSettings.ranges, index)
                          const isFirst = index === 0

                          return (
                            <div key={index} className="flex items-center gap-2 flex-wrap text-sm">
                              <span className="text-muted-foreground">от</span>
                              <Input
                                type="number"
                                value={range.from}
                                onChange={(e) => {
                                  const newValue = parseFloat(e.target.value) || 0
                                  if (index > 0 && newValue >= 1) {
                                    const prevFrom = typeSettings.ranges[index - 1]?.from || 0
                                    if (newValue > prevFrom) {
                                      updateRange(priceType, index, { from: newValue })
                                    }
                                  }
                                }}
                                disabled={isFirst}
                                className="w-24"
                                min={1}
                              />

                              <span className="text-muted-foreground">до</span>
                              <Input
                                type="text"
                                value={to === null ? '∞' : to.toString()}
                                disabled
                                className="w-24"
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
                              />

                              <Select 
                                value={range.markupUnit} 
                                onValueChange={(value: MarkupUnit) => 
                                  updateRange(priceType, index, { markupUnit: value })
                                }
                              >
                                <SelectTrigger className="w-20">
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

                              {typeSettings.prettyPriceEnabled && !typeSettings.prettyPriceCommonLimitEnabled && (
                                <>
                                  <span className="text-muted-foreground">подбор цены в рамках</span>
                                  <Input
                                    type="number"
                                    value={range.prettyPriceLimitRub}
                                    onChange={(e) => 
                                      updateRange(priceType, index, { 
                                        prettyPriceLimitRub: parseFloat(e.target.value) || 100 
                                      })
                                    }
                                    className="w-24"
                                    min={0}
                                    step={1}
                                  />
                                  <span className="text-muted-foreground">руб.</span>
                                </>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => addRange(priceType, index)}
                                className="h-8 w-8 p-0"
                                title="Добавить диапазон"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>

                              {!isFirst && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeRange(priceType, index)}
                                  className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                  title="Удалить диапазон"
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

              {messages.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <Label className="text-xs text-muted-foreground mb-2 block">Сообщения</Label>
                  <ScrollArea className="h-[100px]">
                    <div className="space-y-1">
                      {messages.map(msg => (
                        <div key={msg.id} className="flex items-start gap-2 py-1">
                          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                            <Badge className="bg-accent text-accent-foreground">
                              <Tag className="w-3.5 h-3.5" />
                            </Badge>
                          </div>
                          <span className="text-sm flex-1">{msg.message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
