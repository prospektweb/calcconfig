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
import { useDragContext } from '@/contexts/DragContext'
import { DropIndicator } from '@/components/drag/DropIndicator'
import { cn } from '@/lib/utils'

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
  isTopLevel?: boolean
  parentBindingId?: number | null
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
  onValidationMessage,
  isTopLevel = false,
  parentBindingId
}: BindingCardProps) {
  // Use global drag context
  const dragContext = useDragContext()
  
  // Create memoized maps for details and bindings
  const detailMap = useMemo(() => new Map(details.map(d => [d.id, d])), [details])
  const bindingMap = useMemo(() => new Map(bindings.map(b => [b.id, b])), [bindings])
  
  // Create merged items list based on childrenOrder
  const mergedItems = useMemo(() => {
    const childrenOrder = binding.childrenOrder || []
    const items: Array<{ type: 'detail' | 'binding', item: Detail | Binding, id: string }> = []
    
    childrenOrder.forEach(childId => {
      const detail = detailMap.get(childId)
      if (detail) {
        items.push({ type: 'detail', item: detail, id: childId })
      } else {
        const nestedBinding = bindingMap.get(childId)
        if (nestedBinding) {
          items.push({ type: 'binding', item: nestedBinding, id: childId })
        }
      }
    })
    
    return items
  }, [binding.childrenOrder, detailMap, bindingMap])
  
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
  
  const handleDragHandlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const card = e.currentTarget.closest('[data-binding-card]') as HTMLElement
    if (card) {
      dragContext.startDrag(e, {
        id: binding.id,
        kind: 'binding',
        sourceBindingId: parentBindingId ?? null,
      }, card)
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
          {!isTopLevel && (
            <div 
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing"
              onPointerDown={handleDragHandlePointerDown}
              data-pwcode="binding-drag-handle"
            >
              <DotsSixVertical className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
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
          {mergedItems.length > 0 && (
            <div 
              className="space-y-2" 
              data-drop-container="1"
              data-binding-id={binding.bitrixId?.toString()}
              data-pwcode="binding-children"
            >
              {mergedItems.map((child, index) => {
                const isDraggingThis = dragContext.dragState.active && dragContext.dragState.item?.id === child.id
                
                if (isDraggingThis) {
                  return null
                }
                
                // Check if drop indicator should be shown before this item
                const showIndicatorBefore = 
                  dragContext.dragState.dropTarget?.bindingId === binding.bitrixId &&
                  dragContext.dragState.dropTarget?.position.type === 'before' &&
                  dragContext.dragState.dropTarget?.position.targetId === child.id
                
                // Check if drop indicator should be shown after this item
                const showIndicatorAfter = 
                  dragContext.dragState.dropTarget?.bindingId === binding.bitrixId &&
                  dragContext.dragState.dropTarget?.position.type === 'after' &&
                  dragContext.dragState.dropTarget?.position.targetId === child.id
                
                return (
                  <div key={child.id}>
                    {showIndicatorBefore && <DropIndicator />}
                    
                    <div data-drop-item="1" data-item-id={child.id}>
                      {child.type === 'detail' ? (
                        <DetailCard
                          detail={child.item as Detail}
                          onUpdate={(updates) => onUpdateDetail(child.id, updates)}
                          onDelete={() => {
                            if (onDeleteDetail) {
                              onDeleteDetail(child.id)
                            }
                          }}
                          isInBinding={true}
                          orderNumber={detailStartIndex + index + 1}
                          bitrixMeta={bitrixMeta}
                          onValidationMessage={onValidationMessage}
                          isDragging={isDraggingThis}
                          parentBindingId={binding.bitrixId ?? null}
                        />
                      ) : (
                        <BindingCard
                          binding={child.item as Binding}
                          details={allDetails.filter(d => (child.item as Binding).detailIds?.includes(d.id))}
                          bindings={allBindings.filter(b => (child.item as Binding).bindingIds?.includes(b.id))}
                          allDetails={allDetails}
                          allBindings={allBindings}
                          onUpdate={(updates) => {
                            if (onUpdateBinding) {
                              onUpdateBinding(child.id, updates)
                            }
                          }}
                          onDelete={() => {
                            if (onDeleteBinding) {
                              onDeleteBinding(child.id)
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
                          isDragging={isDraggingThis}
                          parentBindingId={binding.bitrixId ?? null}
                        />
                      )}
                    </div>
                    
                    {showIndicatorAfter && <DropIndicator />}
                  </div>
                )
              })}
              
              {/* Show indicator for empty container or at the end */}
              {dragContext.dragState.dropTarget?.bindingId === binding.bitrixId &&
               dragContext.dragState.dropTarget?.position.type === 'inside' &&
               <DropIndicator />}
            </div>
          )}
          
          <div className="border-t border-border pt-3" data-pwcode="binding-stages-section">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Дополнительные этапы</h4>
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
