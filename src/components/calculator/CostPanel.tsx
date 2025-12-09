import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CaretDown, CaretUp, CurrencyDollar } from '@phosphor-icons/react'
import { CostingSettings, CostingBasedOn, RoundingStep, MarkupUnit } from '@/lib/types'

interface CostMessage {
  id: string
  timestamp: number
  message: string
}

interface CostPanelProps {
  messages: CostMessage[]
  isExpanded: boolean
  onToggle: () => void
  settings: CostingSettings
  onSettingsChange: (settings: CostingSettings) => void
}

const COSTING_BASED_ON_OPTIONS: Array<{ value: CostingBasedOn; label: string }> = [
  { value: 'COMPONENT_PURCHASE', label: 'Закупочной цены составляющих' },
  { value: 'COMPONENT_PURCHASE_PLUS_MARKUP', label: 'Закупочной цены составляющих + наценка' },
  { value: 'COMPONENT_BASE', label: 'Базовой цены составляющих' },
]

const ROUNDING_STEP_OPTIONS: Array<{ value: RoundingStep; label: string }> = [
  { value: 0, label: 'Не округлять' },
  { value: 0.1, label: '0.1' },
  { value: 1, label: '1' },
  { value: 10, label: '10' },
  { value: 100, label: '100' },
]

const MARKUP_UNIT_OPTIONS: Array<{ value: MarkupUnit; label: string }> = [
  { value: 'RUB', label: 'RUB' },
  { value: '%', label: '%' },
]

export function CostPanel({ messages, isExpanded, onToggle, settings, onSettingsChange }: CostPanelProps) {
  const handleBasedOnChange = (value: CostingBasedOn) => {
    onSettingsChange({ ...settings, basedOn: value })
  }

  const handleRoundingStepChange = (value: string) => {
    onSettingsChange({ ...settings, roundingStep: parseFloat(value) as RoundingStep })
  }

  const handleMarkupValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0
    onSettingsChange({ ...settings, markupValue: value })
  }

  const handleMarkupUnitChange = (value: MarkupUnit) => {
    onSettingsChange({ ...settings, markupUnit: value })
  }

  const showMarkupFields = settings.basedOn === 'COMPONENT_PURCHASE_PLUS_MARKUP'

  return (
    <div id="panel-costing" className="border-t border-border bg-card">
      <div className="max-w-[1920px] mx-auto">
        <button
          onClick={onToggle}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <span className="text-sm font-medium flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <CurrencyDollar className="w-4 h-4" />
            </div>
            Себестоимость
          </span>
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            {isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
          </div>
        </button>
        
        {isExpanded && (
          <div className="border-t border-border overflow-y-scroll scrollbar-gutter-stable" style={{ maxHeight: '400px' }}>
            <div className="px-4 py-3 space-y-4">
              <div className="flex items-end gap-2">
                <div className="space-y-2">
                  <Label htmlFor="costing-based-on">Считать на основании</Label>
                  <Select value={settings.basedOn} onValueChange={handleBasedOnChange}>
                    <SelectTrigger id="costing-based-on" className="w-[400px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COSTING_BASED_ON_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {showMarkupFields && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="markup-value">Наценка</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="markup-value"
                          type="number"
                          min="0"
                          step="0.1"
                          value={settings.markupValue || 0}
                          onChange={handleMarkupValueChange}
                          className="w-24"
                        />
                        <Select 
                          value={settings.markupUnit || 'RUB'} 
                          onValueChange={handleMarkupUnitChange}
                        >
                          <SelectTrigger className="w-24">
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
                      </div>
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="rounding-step">Шаг округления</Label>
                  <Select value={settings.roundingStep.toString()} onValueChange={handleRoundingStepChange}>
                    <SelectTrigger id="rounding-step" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUNDING_STEP_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {messages.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <Label className="text-xs text-muted-foreground mb-2 block">Сообщения</Label>
                  <ScrollArea className="h-[100px]">
                    <div className="space-y-1">
                      {messages.map(msg => (
                        <div key={msg.id} className="flex items-start gap-2 py-1">
                          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                            <Badge className="bg-accent text-accent-foreground">
                              <CurrencyDollar className="w-3.5 h-3.5" />
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
