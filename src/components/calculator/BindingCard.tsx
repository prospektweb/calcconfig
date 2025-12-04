import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Binding, Detail } from '@/lib/types'
import { CaretDown, CaretUp, X, Link as LinkIcon, ArrowSquareOut, DotsSixVertical } from '@phosphor-icons/react'
import { DetailCard } from './DetailCard'
import { CalculatorTabs } from './CalculatorTabs'

interface BindingCardProps {
  binding: Binding
  details: Detail[]
  bindings?: Binding[]
  allDetails?: Detail[]
  allBindings?: Binding[]
  onUpdate: (updates: Partial<Binding>) => void
  onDelete: () => void
  onUpdateDetail: (detailId: string, updates: Partial<Detail>) => void
  onUpdateBinding?: (bindingId: string, updates: Partial<Binding>) => void
  orderNumber: number
  detailStartIndex: number
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
}

export function BindingCard({ 
  binding, 
  details, 
  bindings = [],
  allDetails = [],
  allBindings = [],
  onUpdate, 
  onDelete, 
  onUpdateDetail,
  onUpdateBinding,
  orderNumber, 
  detailStartIndex,
  onDragStart,
  onDragEnd
}: BindingCardProps) {
  const handleToggleExpand = () => {
    onUpdate({ isExpanded: !binding.isExpanded })
  }

  const handleToggleFinishing = (checked: boolean) => {
    onUpdate({ 
      hasFinishing: checked,
      finishingCalculators: checked ? (binding.finishingCalculators || []) : []
    })
  }
  
  const handleOpenInBitrix = () => {
    window.open(`#binding-${binding.id}`, '_blank')
  }
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ name: e.target.value })
  }

  return (
    <Card 
      className="overflow-hidden border-2 border-accent/30"
      draggable={true}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="bg-accent/10 border-b border-border px-3 py-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 flex-1">
          <DotsSixVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <LinkIcon className="w-4 h-4 text-accent flex-shrink-0" weight="bold" />
          <Input
            value={binding.name}
            onChange={handleNameChange}
            className="h-6 text-sm font-semibold bg-transparent border-none px-1 focus-visible:ring-1 focus-visible:ring-ring flex-1 min-w-0"
            placeholder="Название группы скрепления"
          />
          <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
            ID:{binding.id.split('_')[1]?.slice(0, 5) || 'N/A'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 flex-shrink-0"
            onClick={handleOpenInBitrix}
          >
            <ArrowSquareOut className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
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
              calculators={binding.calculators || []}
              onChange={(calculators) => onUpdate({ calculators })}
            />
          </div>

          {details && details.length > 0 && (
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
          )}
          
          {bindings && bindings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Вложенные скрепления</h4>
              {bindings.map((nestedBinding, index) => {
                const nestedDetails = allDetails.filter(d => nestedBinding.detailIds?.includes(d.id))
                const nestedBindings = allBindings.filter(b => nestedBinding.bindingIds?.includes(b.id))
                
                return (
                  <div key={nestedBinding.id} className="ml-6 border-l-4 border-accent/30 pl-3">
                    <BindingCard
                      binding={nestedBinding}
                      details={nestedDetails}
                      bindings={nestedBindings}
                      allDetails={allDetails}
                      allBindings={allBindings}
                      onUpdate={(updates) => {
                        if (onUpdateBinding) {
                          onUpdateBinding(nestedBinding.id, updates)
                        }
                      }}
                      onDelete={() => {}}
                      onUpdateDetail={onUpdateDetail}
                      onUpdateBinding={onUpdateBinding}
                      orderNumber={index + 1}
                      detailStartIndex={0}
                    />
                  </div>
                )
              })}
            </div>
          )}

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
                calculators={binding.finishingCalculators || []}
                onChange={(finishingCalculators) => onUpdate({ finishingCalculators })}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
