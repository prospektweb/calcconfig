import { useState, useCallback, useRef, useEffect } from 'react'

interface DragPosition {
  x: number
  y: number
}

interface DragState {
  isDragging: boolean
  draggedItemId: string | null
  draggedItemType: 'detail' | 'binding' | 'stage' | null
  dragPosition: DragPosition
  initialPosition: DOMRect | null
  dropTargetIndex: number | null
}

export function useCustomDrag() {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedItemId: null,
    draggedItemType: null,
    dragPosition: { x: 0, y: 0 },
    initialPosition: null,
    dropTargetIndex: null,
  })

  const dragStartPos = useRef<DragPosition>({ x: 0, y: 0 })
  const dragOffset = useRef<DragPosition>({ x: 0, y: 0 })

  const startDrag = useCallback((
    itemId: string,
    itemType: 'detail' | 'binding' | 'stage',
    element: HTMLElement,
    clientX: number,
    clientY: number
  ) => {
    const rect = element.getBoundingClientRect()
    
    dragStartPos.current = { x: clientX, y: clientY }
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
      dropTargetIndex: null,
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

  const setDropTarget = useCallback((index: number | null) => {
    setDragState(prev => ({
      ...prev,
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
      dropTargetIndex: null,
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
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState.isDragging, updateDragPosition])

  return {
    dragState,
    startDrag,
    updateDragPosition,
    setDropTarget,
    endDrag,
    cancelDrag,
  }
}
