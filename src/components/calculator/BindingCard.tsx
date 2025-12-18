import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Binding, Detail } from '@/lib/types'
import { CaretDown, CaretUp, X, Link as LinkIcon, ArrowSquareOut, DotsSixVertical } from '@phosphor-icons/react'
import { DetailCard } from './DetailCard'
import { CalculatorTabs } from './CalculatorTabs'
import { InitPayload } from '@/lib/postmessage-bridge'

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
  onDragStart?: (element: HTMLElement, e: React.MouseEvent) => void
  isDragging?: boolean
  bitrixMeta?: InitPayload | null
  onValidationMessage?: (type: 'info' | 'warning' | 'error' | 'success', message: string) => void
}

  export function BindingCard({
    binding,
    details = [],
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
  isDragging = false,
  bitrixMeta = null,
  onValidationMessage
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
    e.preventDefault()
    const card = e.currentTarget.closest('[data-binding-card]') as HTMLElement
    if (card && onDragStart) {
      onDragStart(card, e)
    }
  }

  return (
    <Card 
      data-binding-card
      data-binding-id={binding.id}
      className={`overflow-hidden border-2 border-accent/30 ${isDragging ? 'invisible' : ''}`}
      data-pwcode="binding-card"
    >
      <div className="bg-accent/10 border-b border-border px-3 py-2 flex items-center justify-between" data-pwcode="binding-header">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div 
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing"
            onMouseDown={handleDragHandleMouseDown}
            data-pwcode="binding-drag-handle"
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
            data-pwcode="input-binding-name"
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
            data-pwcode="btn-open-binding-bitrix"
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
            data-pwcode="btn-toggle-binding"
          >
            {binding.isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
            onClick={onDelete}
            data-pwcode="btn-delete-binding"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {binding.isExpanded && !isDragging && (
        <div className="px-3 py-3 space-y-3" data-pwcode="binding-content">
          <div>
            <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Этапы скрепления</h4>
            <CalculatorTabs
              calculators={binding.calculators || []}
              onChange={(calculators) => onUpdate({ calculators })}
              bitrixMeta={bitrixMeta}
              onValidationMessage={onValidationMessage}
            />
          </div>

          {details && details.length > 0 && (
            <div className="space-y-1 py-3" data-pwcode="binding-details">
              <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Детали в скреплении</h4>
              {details.map((detail, index) => (
                <DetailCard
                  key={detail.id}
                  detail={detail}
                  onUpdate={(updates) => onUpdateDetail(detail.id, updates)}
                  onDelete={() => {}}
                  isInBinding={true}
                  orderNumber={detailStartIndex + index + 1}
                  bitrixMeta={bitrixMeta}
                  onValidationMessage={onValidationMessage}
                />
              ))}
            </div>
          )}
          
          {bindings && bindings.length > 0 && (
            <div className="space-y-2" data-pwcode="binding-nested">
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
                      bitrixMeta={bitrixMeta}
                      onValidationMessage={onValidationMessage}
                    />
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-3" data-pwcode="binding-finishing-checkbox">
            <Checkbox
              id={`finishing-${binding.id}`}
              checked={binding.hasFinishing}
              onCheckedChange={handleToggleFinishing}
              data-pwcode="checkbox-finishing"
            />
            <label 
              htmlFor={`finishing-${binding.id}`}
              className="text-sm font-medium cursor-pointer"
            >
              Финишная обработка
            </label>
          </div>

          {binding.hasFinishing && (
            <div data-pwcode="binding-finishing-stages">
              <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase">Этапы финишной обработки</h4>
              <CalculatorTabs
                calculators={binding.finishingCalculators || []}
                onChange={(finishingCalculators) => onUpdate({ finishingCalculators })}
                bitrixMeta={bitrixMeta}
                onValidationMessage={onValidationMessage}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
