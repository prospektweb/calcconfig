import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Binding, Detail } from '@/lib/types'
import { CaretDown, CaretUp, X, Link as LinkIcon } from '@phosphor-icons/react'
import { DetailCard } from './DetailCard'
import { CalculatorTabs } from './CalculatorTabs'

interface BindingCardProps {
  binding: Binding
  details: Detail[]
  onUpdate: (updates: Partial<Binding>) => void
  onDelete: () => void
  onUpdateDetail: (detailId: string, updates: Partial<Detail>) => void
}

export function BindingCard({ binding, details, onUpdate, onDelete, onUpdateDetail }: BindingCardProps) {
  const handleToggleExpand = () => {
    onUpdate({ isExpanded: !binding.isExpanded })
  }

  const handleToggleFinishing = (checked: boolean) => {
    onUpdate({ 
      hasFinishing: checked,
      finishingCalculators: checked ? binding.finishingCalculators : []
    })
  }

  return (
    <Card className="overflow-hidden border-2 border-accent/30">
      <div className="bg-accent/10 border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-accent" weight="bold" />
          <span className="font-medium">{binding.name} #{binding.id.split('_')[1].slice(0, 6)}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleToggleExpand}
          >
            {binding.isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-destructive hover:text-destructive-foreground"
            onClick={onDelete}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {binding.isExpanded && (
        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Калькуляторы скрепления</h4>
            <CalculatorTabs
              calculators={binding.calculators}
              onChange={(calculators) => onUpdate({ calculators })}
            />
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-medium mb-2">Детали в скреплении</h4>
            {details.map(detail => (
              <DetailCard
                key={detail.id}
                detail={detail}
                onUpdate={(updates) => onUpdateDetail(detail.id, updates)}
                onDelete={() => {}}
                isInBinding={true}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Checkbox
              id={`finishing-${binding.id}`}
              checked={binding.hasFinishing}
              onCheckedChange={handleToggleFinishing}
            />
            <label 
              htmlFor={`finishing-${binding.id}`}
              className="text-sm font-medium cursor-pointer"
            >
              Финишная обработка
            </label>
          </div>

          {binding.hasFinishing && (
            <div>
              <h4 className="text-sm font-medium mb-2">Калькуляторы финишной обработки</h4>
              <CalculatorTabs
                calculators={binding.finishingCalculators}
                onChange={(finishingCalculators) => onUpdate({ finishingCalculators })}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
