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
import { useMemo, useEffect, useRef } from 'react'
import { useDragContext } from '@/contexts/DragContext'
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
  const dropZoneRefs = useRef<Map<number, HTMLElement>>(new Map())
  
  // Constants for drag behavior
  const DROP_ZONE_DETECTION_THRESHOLD = 100 // pixels
  
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
  
  const handleDragHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const card = e.currentTarget.closest('[data-binding-card]') as HTMLElement
    if (card) {
      dragContext.startDrag(binding.id, 'binding', card, e.clientX, e.clientY, parentBindingId ?? null)
    }
  }

  // Monitor drag position and update drop target
  useEffect(() => {
    if (!dragContext.dragState.isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      let minDistance = Infinity
      let nearestDropZone: number | null = null

      dropZoneRefs.current.forEach((dropZone, index) => {
        const rect = dropZone.getBoundingClientRect()
        const centerY = rect.top + rect.height / 2
        const distance = Math.abs(e.clientY - centerY)

        if (distance < minDistance && distance < DROP_ZONE_DETECTION_THRESHOLD) {
          minDistance = distance
          nearestDropZone = index
        }
      })

      dragContext.setDropTarget(binding.bitrixId ?? null, nearestDropZone)
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [dragContext.dragState.isDragging, dragContext, binding.bitrixId, DROP_ZONE_DETECTION_THRESHOLD])

  // Handle drop within this binding
  const handleDrop = (dropIndex: number) => {
    const { draggedItemId, draggedItemType, sourceParentBindingId, dropTargetBindingId } = dragContext.dragState
    
    if (!draggedItemId || !draggedItemType) return
    
    // Check if this binding is the drop target
    if (dropTargetBindingId !== binding.bitrixId) return
    
    // Don't allow drops from top level (sourceParentBindingId === null) into bindings
    if (sourceParentBindingId === null) {
      if (onValidationMessage) {
        onValidationMessage('warning', 'Невозможно переместить элементы верхнего уровня в скрепление')
      }
      dragContext.endDrag(false)
      return
    }
    
    // Find dragged item's bitrixId
    let draggedItemBitrixId: number | null = null
    if (draggedItemType === 'detail') {
      const detail = allDetails.find(d => d.id === draggedItemId)
      draggedItemBitrixId = detail?.bitrixId ?? null
    } else {
      const childBinding = allBindings.find(b => b.id === draggedItemId)
      draggedItemBitrixId = childBinding?.bitrixId ?? null
    }
    
    if (!draggedItemBitrixId || !binding.bitrixId) return
    
    // Same binding - reorder
    if (sourceParentBindingId === binding.bitrixId) {
      const fromIndex = mergedItems.findIndex(item => item.id === draggedItemId)
      if (fromIndex === -1) return
      
      const reorderedItems = [...mergedItems]
      const [movedItem] = reorderedItems.splice(fromIndex, 1)
      
      const adjustedToIndex = fromIndex < dropIndex ? dropIndex - 1 : dropIndex
      reorderedItems.splice(adjustedToIndex, 0, movedItem)
      
      // Update childrenOrder
      const newChildrenOrder = reorderedItems.map(item => item.id)
      onUpdate({ childrenOrder: newChildrenOrder })
      
      // Send CHANGE_DETAIL_SORT_REQUEST
      const sortingBitrixIds = reorderedItems.map(item => {
        if (item.type === 'detail') {
          const detail = item.item as Detail
          return detail.bitrixId || parseInt(detail.id.split('_')[1] || '0')
        } else {
          const childBinding = item.item as Binding
          return childBinding.bitrixId || parseInt(childBinding.id.split('_')[1] || '0')
        }
      }).filter(id => id > 0)
      
      postMessageBridge.sendChangeDetailSortRequest({
        parentId: binding.bitrixId,
        sorting: sortingBitrixIds
      })
    } else {
      // Different binding - move
      // Build sorting array for target binding including the new item
      const newSortingItems = [...mergedItems]
      newSortingItems.splice(dropIndex, 0, { 
        type: draggedItemType, 
        id: draggedItemId, 
        item: draggedItemType === 'detail' 
          ? (allDetails.find(d => d.id === draggedItemId) as Detail)
          : (allBindings.find(b => b.id === draggedItemId) as Binding)
      })
      
      const sortingBitrixIds = newSortingItems.map(item => {
        if (item.type === 'detail') {
          const detail = item.item as Detail
          return detail.bitrixId || parseInt(detail.id.split('_')[1] || '0')
        } else {
          const childBinding = item.item as Binding
          return childBinding.bitrixId || parseInt(childBinding.id.split('_')[1] || '0')
        }
      }).filter(id => id > 0)
      
      // Send CHANGE_DETAIL_LEVEL_REQUEST
      postMessageBridge.sendChangeDetailLevelRequest({
        fromParentId: sourceParentBindingId,
        detailId: draggedItemBitrixId,
        toParentId: binding.bitrixId,
        sorting: sortingBitrixIds
      })
    }
    
    dragContext.endDrag(true)
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
              onMouseDown={handleDragHandleMouseDown}
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
            <div className="space-y-2" data-pwcode="binding-children">
              {/* First drop zone */}
              {dragContext.dragState.isDragging && (
                <div 
                  ref={(el) => { if (el) dropZoneRefs.current.set(0, el) }}
                  className={cn(
                    "border-2 border-dashed rounded-lg flex items-center justify-center mb-2 transition-all h-8",
                    dragContext.dragState.dropTargetBindingId === binding.bitrixId && dragContext.dragState.dropTargetIndex === 0 
                      ? "border-accent bg-accent/10" 
                      : "border-border bg-muted/30"
                  )}
                  onMouseUp={() => handleDrop(0)}
                >
                  <p className={cn(
                    "text-center text-xs",
                    dragContext.dragState.dropTargetBindingId === binding.bitrixId && dragContext.dragState.dropTargetIndex === 0 
                      ? "text-accent-foreground font-medium" 
                      : "text-muted-foreground"
                  )}>
                    Перетащите сюда
                  </p>
                </div>
              )}
              
              {mergedItems.map((child, index) => {
                const isDraggingThis = dragContext.dragState.isDragging && dragContext.dragState.draggedItemId === child.id
                
                if (isDraggingThis) {
                  return null
                }
                
                return (
                  <div key={child.id}>
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
                
                {/* Drop zone after each item */}
                {dragContext.dragState.isDragging && (
                  <div 
                    ref={(el) => { if (el) dropZoneRefs.current.set(index + 1, el) }}
                    className={cn(
                      "border-2 border-dashed rounded-lg flex items-center justify-center my-2 transition-all h-8",
                      dragContext.dragState.dropTargetBindingId === binding.bitrixId && dragContext.dragState.dropTargetIndex === index + 1 
                        ? "border-accent bg-accent/10" 
                        : "border-border bg-muted/30"
                    )}
                    onMouseUp={() => handleDrop(index + 1)}
                  >
                    <p className={cn(
                      "text-center text-xs",
                      dragContext.dragState.dropTargetBindingId === binding.bitrixId && dragContext.dragState.dropTargetIndex === index + 1 
                        ? "text-accent-foreground font-medium" 
                        : "text-muted-foreground"
                    )}>
                      Перетащите сюда
                    </p>
                  </div>
                )}
              </div>
            )
              })}
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
