import { createPortal } from 'react-dom'
import { useDragContext } from '@/contexts/DragContext'
import { Card } from '@/components/ui/card'

export function DragOverlay() {
  const { dragState } = useDragContext()
  
  if (!dragState.active || !dragState.item) return null
  
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(${dragState.x}px, ${dragState.y}px, 0)`,
        zIndex: 99999,
        pointerEvents: 'none',
        opacity: 0.8,
        width: dragState.initialRect ? `${dragState.initialRect.width}px` : 'auto',
      }}
    >
      <Card className="p-3 bg-card border-2 border-accent shadow-lg">
        <div className="text-sm font-medium">
          {dragState.item.kind === 'detail' ? '📄 Detail' : '🔗 Binding'}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {dragState.item.id}
        </div>
      </Card>
    </div>,
    document.body
  )
}
