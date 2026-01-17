import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'

interface DragItem {
  id: string
  kind: 'detail' | 'binding'
  sourceBindingId: number | null
  sourceIndex: number
}

interface DropTarget {
  bindingId: number
  position: {
    type: 'before' | 'after' | 'inside'
    targetId?: string
    index: number
  }
}

export interface DragState {
  active: boolean
  pointerId: number | null
  item: DragItem | null
  x: number
  y: number
  offsetX: number
  offsetY: number
  dropTarget: DropTarget | null
  initialRect: DOMRect | null
}

interface DragContextValue {
  dragState: DragState
  startDrag: (e: React.PointerEvent, item: Omit<DragItem, 'sourceIndex'>, sourceEl: HTMLElement) => void
  endDrag: () => void
  cancelDrag: () => void
}

const DragContext = createContext<DragContextValue | null>(null)

export function useDragContext() {
  const context = useContext(DragContext)
  if (!context) {
    throw new Error('useDragContext must be used within DragProvider')
  }
  return context
}

interface DragProviderProps {
  children: ReactNode
  onDrop: (dragItem: DragItem, dropTarget: DropTarget) => void
}

export function DragProvider({ children, onDrop }: DragProviderProps) {
  const [dragState, setDragState] = useState<DragState>({
    active: false,
    pointerId: null,
    item: null,
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
    dropTarget: null,
    initialRect: null,
  })

  const dragStateRef = useRef<DragState>(dragState)
  const onDropRef = useRef(onDrop)
  const lastValidDropTargetRef = useRef<DropTarget | null>(null)

  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  useEffect(() => {
    onDropRef.current = onDrop
  }, [onDrop])

  const cleanup = useCallback(() => {
    setDragState({
      active: false,
      pointerId: null,
      item: null,
      x: 0,
      y: 0,
      offsetX: 0,
      offsetY: 0,
      dropTarget: null,
      initialRect: null,
    })
  }, [])

  const canDrop = useCallback((dragItem: DragItem, candidate: DropTarget | null): boolean => {
    if (!candidate) return false

    // Cannot drop element into itself
    if (dragItem.id === candidate.position.targetId) return false

    // Cannot drop Binding into its descendant
    if (dragItem.kind === 'binding') {
      // This will be implemented with isDescendant helper in App.tsx
      // For now, allow all drops
    }

    // Root-level drops are not allowed (candidate.bindingId should never be null for valid drops)
    if (candidate.bindingId === null) return false

    return true
  }, [])

  const updateDropTarget = useCallback((clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) {
      setDragState(prev => ({ ...prev, dropTarget: null }))
      return
    }

    const container = el.closest('[data-drop-container="1"]') as HTMLElement
    const itemEl = el.closest('[data-drop-item="1"]') as HTMLElement

    if (!container) {
      setDragState(prev => ({ ...prev, dropTarget: null }))
      return
    }

    const bindingIdStr = container.getAttribute('data-binding-id')
    const bindingId = bindingIdStr ? parseInt(bindingIdStr, 10) : null

    if (bindingId === null) {
      setDragState(prev => ({ ...prev, dropTarget: null }))
      return
    }

    let dropTarget: DropTarget | null = null

    if (itemEl) {
      // Determine before/after based on cursor position
      const rect = itemEl.getBoundingClientRect()
      const centerY = rect.top + rect.height / 2
      const isBefore = clientY < centerY
      const itemId = itemEl.getAttribute('data-item-id')

      if (itemId) {
        // Get all items in this container
        const allItems = Array.from(container.querySelectorAll('[data-drop-item="1"]'))
        const targetIndex = allItems.indexOf(itemEl)

        dropTarget = {
          bindingId,
          position: {
            type: isBefore ? 'before' : 'after',
            targetId: itemId,
            index: isBefore ? targetIndex : targetIndex + 1,
          },
        }
      }
    } else {
      // Empty container or no item found - drop inside at index 0
      dropTarget = {
        bindingId,
        position: {
          type: 'inside',
          index: 0,
        },
      }
    }

    // Validate with canDrop
    const currentItem = dragStateRef.current.item
    if (currentItem && !canDrop(currentItem, dropTarget)) {
      dropTarget = null
    } else if (dropTarget !== null) {
      // Save valid drop target for stable drop handling
      lastValidDropTargetRef.current = dropTarget
    }

    setDragState(prev => ({ ...prev, dropTarget }))
  }, [canDrop])

  const startDrag = useCallback((
    e: React.PointerEvent,
    item: Omit<DragItem, 'sourceIndex'>,
    sourceEl: HTMLElement
  ) => {
    // Only left button
    if (e.button !== 0) return

    e.preventDefault()
    e.stopPropagation()

    const rect = sourceEl.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    // Calculate source index (will be done in component)
    const fullItem: DragItem = {
      ...item,
      sourceIndex: 0, // Will be calculated by component
    }

    try {
      sourceEl.setPointerCapture(e.pointerId)
    } catch (err) {
      console.warn('Failed to capture pointer:', err)
    }

    setDragState({
      active: true,
      pointerId: e.pointerId,
      item: fullItem,
      x: rect.left,
      y: rect.top,
      offsetX,
      offsetY,
      dropTarget: null,
      initialRect: rect,
    })
  }, [])

  const endDrag = useCallback(() => {
    const currentState = dragStateRef.current
    const targetToUse = lastValidDropTargetRef.current
    
    if (currentState.active && currentState.item && targetToUse) {
      onDropRef.current(currentState.item, targetToUse)
    }
    
    lastValidDropTargetRef.current = null
    cleanup()
  }, [cleanup])

  const cancelDrag = useCallback(() => {
    cleanup()
  }, [cleanup])

  useEffect(() => {
    if (!dragState.active) return

    const onMove = (e: PointerEvent) => {
      e.preventDefault()
      setDragState(prev => ({
        ...prev,
        x: e.clientX - prev.offsetX,
        y: e.clientY - prev.offsetY,
      }))
      updateDropTarget(e.clientX, e.clientY)
    }

    const onUp = (e: PointerEvent) => {
      e.preventDefault()
      endDrag()
    }

    const onCancel = (e: PointerEvent) => {
      e.preventDefault()
      cancelDrag()
    }

    const onBlur = () => {
      cancelDrag()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelDrag()
      }
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    window.addEventListener('blur', onBlur)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [dragState.active, updateDropTarget, endDrag, cancelDrag])

  const value: DragContextValue = {
    dragState,
    startDrag,
    endDrag,
    cancelDrag,
  }

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>
}
