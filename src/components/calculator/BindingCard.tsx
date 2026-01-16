import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Binding, Detail } from '@/lib/types'
import { CaretDown, CaretUp, X, Link as LinkIcon, ArrowSquareOut, DotsSixVertical, Plus, Selection } from '@phosphor-icons/react'
import { DetailCard } from './DetailCard'
import { StageTabs } from './StageTabs'
import { InitPayload, postMessageBridge } from '@/lib/postmessage-bridge'
import { openBitrixAdmin, getBitrixContext, getIblockByCode } from '@/lib/bitrix-utils'
import { toast } from 'sonner'
import { useMemo } from 'react'

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
  onDeleteDetail?: (detailId: string) => void
  onDeleteBinding?: (bindingId: string) => void
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
  onDeleteDetail,
  onDeleteBinding,
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
  
  const handleOpenInBitrix = () => {
    // Получить bitrixId из binding
    const bindingIdNumber = binding.bitrixId ?? parseInt(binding.id.split('_')[1] || '0')
    
    if (bitrixMeta && bindingIdNumber) {
      const context = getBitrixContext()
      if (!context) {
        toast.error('Контекст Bitrix не инициализирован')
        return
      }

      // Найти инфоблок для групп скреплений (CALC_DETAILS или специальный)
      const bindingsIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_DETAILS')
      if (!bindingsIblock) {
        toast.error('Инфоблок групп скреплений не найден')
        return
      }

      try {
        openBitrixAdmin({
          iblockId: bindingsIblock.id,
          type: bindingsIblock.type,
          lang: context.lang,
          id: bindingIdNumber,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось открыть группу скрепления'
        toast.error(message)
      }
    } else {
      // Fallback для dev-режима
      window.open(`#binding-${binding.id}`, '_blank')
    }
  }
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ name: e.target.value })
  }
  
  const handleNameBlur = () => {
    // Send RENAME_DETAIL_REQUEST when binding name changes
    if (binding.bitrixId && binding.name) {
      postMessageBridge.sendRenameDetailRequest({
        detailId: binding.bitrixId,
        name: binding.name,
      })
    }
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
            onBlur={handleNameBlur}
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
            className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
            onClick={() => {
              // Send ADD_DETAIL_TO_BINDING_REQUEST
              if (binding.bitrixId && bitrixMeta) {
                const detailsIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_DETAILS')
                if (detailsIblock) {
                  postMessageBridge.sendAddDetailToBindingRequest({
                    parentId: binding.bitrixId,
                    iblockId: detailsIblock.id,
                    iblockType: detailsIblock.type,
                  })
                }
              }
            }}
            data-pwcode="btn-create-detail-in-binding"
            title="Создать деталь в скреплении"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
            onClick={() => {
              // Send SELECT_DETAILS_TO_BINDING_REQUEST
              if (binding.bitrixId && bitrixMeta) {
                const detailsIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_DETAILS')
                if (detailsIblock) {
                  postMessageBridge.sendSelectDetailsToBindingRequest({
                    parentId: binding.bitrixId,
                    iblockId: detailsIblock.id,
                    iblockType: detailsIblock.type,
                  })
                }
              }
            }}
            data-pwcode="btn-select-details-to-binding"
            title="Выбрать детали для скрепления"
          >
            <Selection className="w-4 h-4" />
          </Button>
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
          {/* Unified list of details and bindings */}
          {(() => {
            // Use childrenOrder to maintain proper order from DETAILS property
            // Memoize maps to avoid recreating on every render
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const detailMap = useMemo(() => new Map(details.map(d => [d.id, d])), [details.map(d => d.id).join(',')])
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const bindingMap = useMemo(() => new Map(bindings.map(b => [b.id, b])), [bindings.map(b => b.id).join(',')])
            
            const childrenOrder = binding.childrenOrder || []
            const mergedItems: Array<{ type: 'detail' | 'binding', item: Detail | Binding, id: string }> = []
            
            childrenOrder.forEach(childId => {
              const detail = detailMap.get(childId)
              if (detail) {
                mergedItems.push({ type: 'detail', item: detail, id: childId })
              } else {
                const binding = bindingMap.get(childId)
                if (binding) {
                  mergedItems.push({ type: 'binding', item: binding, id: childId })
                }
              }
            })
            
            if (mergedItems.length === 0) return null
            
            return (
              <div className="space-y-2" data-pwcode="binding-children">
                {mergedItems.map((child, index) => {
                  if (child.type === 'detail') {
                    const detail = child.item as Detail
                    return (
                      <DetailCard
                        key={detail.id}
                        detail={detail}
                        onUpdate={(updates) => onUpdateDetail(detail.id, updates)}
                        onDelete={() => {
                          if (onDeleteDetail) {
                            onDeleteDetail(detail.id)
                          }
                        }}
                        isInBinding={true}
                        orderNumber={detailStartIndex + index + 1}
                        bitrixMeta={bitrixMeta}
                        onValidationMessage={onValidationMessage}
                        // Note: onDragStart could be used for drag-and-drop within bindings
                        // Full implementation would require tracking parent binding context
                      />
                    )
                  } else {
                    const nestedBinding = child.item as Binding
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
                          onDelete={() => {
                            if (onDeleteBinding) {
                              onDeleteBinding(nestedBinding.id)
                            }
                          }}
                          onUpdateDetail={onUpdateDetail}
                          onUpdateBinding={onUpdateBinding}
                          onDeleteDetail={onDeleteDetail}
                          onDeleteBinding={onDeleteBinding}
                          orderNumber={index + 1}
                          detailStartIndex={0}
                          bitrixMeta={bitrixMeta}
                          onValidationMessage={onValidationMessage}
                          // Note: onDragStart would need context about parent binding for full implementation
                        />
                      </div>
                    )
                  }
                })}
              </div>
            )
          })()}
          
          <div className="border-t border-border pt-3" data-pwcode="binding-stages-section">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Этапы скрепления</h4>
              {/* Show button only when there are no stages */}
              {(binding.stages || []).length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Send ADD_STAGE_REQUEST with detailId set to binding's bitrixId
                    if (binding.bitrixId && bitrixMeta) {
                      console.log('[ADD_STAGE_REQUEST] Sending for binding...', { detailId: binding.bitrixId })
                      postMessageBridge.sendAddStageRequest({
                        detailId: binding.bitrixId,
                      })
                    }
                  }}
                  className="h-7 w-7 p-0"
                  data-pwcode="btn-add-binding-stage"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {(binding.stages || []).length > 0 && (
              <div data-pwcode="binding-stages">
                <StageTabs
                  calculators={binding.stages || []}
                  onChange={(calculators) => onUpdate({ stages: calculators })}
                  detailId={binding.bitrixId ?? undefined}
                  bitrixMeta={bitrixMeta}
                  onValidationMessage={onValidationMessage}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
