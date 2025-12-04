import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Binding, Detail } from '@/lib/types'
import { CaretDown, CaretUp, X, Link as LinkIcon, ArrowSquareOut } from '@phosphor-icons/react'
import { DetailCard } from './DetailCard'
import { CalculatorTabs } from './CalculatorTabs'

interface BindingCardProps {
  binding: Binding
  details: Detail[]
  onUpdate: (updates: Partial<Binding>) => void
  onDelete: () => void
  onUpdateDetail: (detailId: string, updates: Partial<Detail>) => void
  orderNumber: number
  detailStartIndex: number
}

export function BindingCard({ binding, details, onUpdate, onDelete, onUpdateDetail, orderNumber, detailStartIndex }: BindingCardProps) {
  const handleToggleExpand = () => {
    onUpdate({ isExpanded: !binding.isExpanded })
  }

  const handleToggleFinishing = (checked: boolean) => {
    onUpdate({ 
      hasFinishing: checked,
      finishingCalculators: checked ? binding.finishingCalculators : []
    })
  }
  
  const handleOpenInBitrix = () => {
    window.open(`#binding-${binding.id}`, '_blank')
  }

  return (
    <Card className="overflow-hidden border-2 border-accent/30">
      <div className="bg-accent/10 border-b border-border px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-accent" weight="bold" />
          <span className="text-sm font-semibold text-foreground">
            Скрепление #{orderNumber}
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            ID:{binding.id.split('_')[1]?.slice(0, 5) || 'N/A'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0"
            onClick={handleOpenInBitrix}
          >
            <ArrowSquareOut className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleToggleExpand}
          >
            {binding.isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
            onClick={onDelete}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {binding.isExpanded && (
        <div className="p-3 space-y-3">
          <div>
            <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Калькуляторы скрепления</h4>
            <CalculatorTabs
              calculators={binding.calculators}
              onChange={(calculators) => onUpdate({ calculators })}
            />
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Детали в скреплении</h4>
            {details.map((detail, index) => (
              <DetailCard
                key={detail.id}
                detail={detail}
                onUpdate={(updates) => onUpdateDetail(detail.id, updates)}
                onDelete={() => {}}
                isInBinding={true}
                orderNumber={detailStartIndex + index + 1}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-3">
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
              <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Калькуляторы финишной обработки</h4>
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
