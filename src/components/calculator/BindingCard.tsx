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
  isDragging?: boolean
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
  onDragEnd,
  isDragging = false
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
  
  const handleDragHandleMouseDown = (e: React.MouseEvent) => {
    const card = e.currentTarget.closest('[data-binding-card]') as HTMLElement
    if (card) {
      card.setAttribute('draggable', 'true')
    }
  }
  
  const handleDragHandleMouseUp = (e: React.MouseEvent) => {
    const card = e.currentTarget.closest('[data-binding-card]') as HTMLElement
    if (card) {
      card.setAttribute('draggable', 'false')
    }
  }

  return (
    <Card 
      data-binding-card
      className={`overflow-hidden border-2 border-accent/30 ${isDragging ? 'opacity-50' : ''}`}
      draggable={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="bg-accent/10 border-b border-border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div 
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing"
            onMouseDown={handleDragHandleMouseDown}
            onMouseUp={handleDragHandleMouseUp}
          >
            <DotsSixVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            <span className="text-sm font-semibold text-foreground">
              #{orderNumber}
            </span>
          </div>
          <div className="flex-shrink-0">
            <span className="text-xs font-medium text-accent px-2 py-0.5 bg-accent/20 rounded">
              Группа
            </span>
          </div>
          <Input
            value={binding.name}
            onChange={handleNameChange}
            className="h-6 text-sm font-medium bg-transparent border-none px-3 focus-visible:ring-1 focus-visible:ring-ring flex-1 min-w-[120px]"
            placeholder="Название группы скрепления"
          />
          <div className="flex-shrink-0">
            <span className="text-xs font-mono text-muted-foreground">
              ID:{binding.id.split('_')[1]?.slice(0, 5) || 'N/A'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 flex-shrink-0 hover:bg-accent hover:text-accent-foreground"
            onClick={handleOpenInBitrix}
          >
            <ArrowSquareOut className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground"
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

      {binding.isExpanded && !isDragging && (
        <div className="px-3 py-3 space-y-3">
          <div>
            <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Этапы скрепления</h4>
            <CalculatorTabs
              calculators={binding.calculators || []}
              onChange={(calculators) => onUpdate({ calculators })}
            />
          </div>

          {details && details.length > 0 && (
            <div className="space-y-1 py-3">
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
              <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Этапы финишной обработки</h4>
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
