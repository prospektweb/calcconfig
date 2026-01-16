import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'

interface DragPosition {
  x: number
  y: number
}

export interface DragState {
  isDragging: boolean
  draggedItemId: string | null
  draggedItemType: 'detail' | 'binding' | null
  dragPosition: DragPosition
  initialPosition: DOMRect | null
  dropTargetBindingId: number | null  // The bitrixId of binding we're hovering over
  dropTargetIndex: number | null      // The index within that binding
  sourceParentBindingId: number | null // The bitrixId of the parent binding where drag started (null for top level)
}

interface DragContextValue {
  dragState: DragState
  startDrag: (
    itemId: string,
    itemType: 'detail' | 'binding',
    element: HTMLElement,
    clientX: number,
    clientY: number,
    parentBindingId: number | null
  ) => void
  setDropTarget: (bindingId: number | null, index: number | null) => void
  endDrag: (success: boolean) => void
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
}

export function DragProvider({ children }: DragProviderProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedItemId: null,
    draggedItemType: null,
    dragPosition: { x: 0, y: 0 },
    initialPosition: null,
    dropTargetBindingId: null,
    dropTargetIndex: null,
    sourceParentBindingId: null,
  })

  const dragOffset = useRef<DragPosition>({ x: 0, y: 0 })

  const startDrag = useCallback((
    itemId: string,
    itemType: 'detail' | 'binding',
    element: HTMLElement,
    clientX: number,
    clientY: number,
    parentBindingId: number | null
  ) => {
    const rect = element.getBoundingClientRect()
    
    dragOffset.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }

    setDragState({
      isDragging: true,
      draggedItemId: itemId,
      draggedItemType: itemType,
      dragPosition: {
        x: rect.left,
        y: rect.top,
      },
      initialPosition: rect,
      dropTargetBindingId: null,
      dropTargetIndex: null,
      sourceParentBindingId: parentBindingId,
    })
  }, [])

  const updateDragPosition = useCallback((clientX: number, clientY: number) => {
    setDragState(prev => ({
      ...prev,
      dragPosition: {
        x: clientX - dragOffset.current.x,
        y: clientY - dragOffset.current.y,
      },
    }))
  }, [])

  const setDropTarget = useCallback((bindingId: number | null, index: number | null) => {
    setDragState(prev => ({
      ...prev,
      dropTargetBindingId: bindingId,
      dropTargetIndex: index,
    }))
  }, [])

  const endDrag = useCallback((success: boolean) => {
    setDragState({
      isDragging: false,
      draggedItemId: null,
      draggedItemType: null,
      dragPosition: { x: 0, y: 0 },
      initialPosition: null,
      dropTargetBindingId: null,
      dropTargetIndex: null,
      sourceParentBindingId: null,
    })
    return success
  }, [])

  const cancelDrag = useCallback(() => {
    endDrag(false)
  }, [endDrag])

  useEffect(() => {
    if (!dragState.isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      updateDragPosition(e.clientX, e.clientY)
    }

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault()
      // Note: The actual drop handling is done in BindingCard components
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState.isDragging, updateDragPosition])

  const value: DragContextValue = {
    dragState,
    startDrag,
    setDropTarget,
    endDrag,
    cancelDrag,
  }

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>
}
