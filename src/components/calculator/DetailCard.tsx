import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Detail } from '@/lib/types'
import { CaretDown, CaretUp, X, DotsSixVertical, ArrowSquareOut } from '@phosphor-icons/react'
import { StageTabs } from './StageTabs'
import { InitPayload, postMessageBridge } from '@/lib/postmessage-bridge'
import { openBitrixAdmin, getBitrixContext, getIblockByCode } from '@/lib/bitrix-utils'
import { toast } from 'sonner'
import { useDragContext } from '@/contexts/DragContext'

interface DetailCardProps {
  detail: Detail
  onUpdate: (updates: Partial<Detail>) => void
  onDelete: () => void
  isInBinding?:  boolean
  orderNumber: number
  onDragStart?:  (element: HTMLElement, e: React.MouseEvent) => void
  isDragging?: boolean
  bitrixMeta?:  InitPayload | null
  onValidationMessage?: (type: 'info' | 'warning' | 'error' | 'success', message: string) => void
  isTopLevel?: boolean
  parentBindingId?: number | null
}

export function DetailCard({ detail, onUpdate, onDelete, isInBinding = false, orderNumber, onDragStart, isDragging = false, bitrixMeta, onValidationMessage, isTopLevel = false, parentBindingId }: DetailCardProps) {
  const dragContext = useDragContext()
  
  const handleToggleExpand = () => {
    onUpdate({ isExpanded: !detail.isExpanded })
  }
  
  const handleOpenInBitrix = () => {
    const detailIdNumber = detail.bitrixId ?? parseInt(detail.id.split('_')[1] || '0')

    if (bitrixMeta && detailIdNumber) {
      const context = getBitrixContext()
      if (! context) {
        toast.error('Контекст Bitrix не инициализирован')
        return
      }

      const detailsIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_DETAILS')
      if (! detailsIblock) {
        toast.error('Инфоблок CALC_DETAILS не найден')
        return
      }

      try {
        openBitrixAdmin({
          iblockId: detailsIblock.id,
          type: detailsIblock.type,
          lang: context.lang,
          id: detailIdNumber,
        })
      } catch (error) {
        const message = error instanceof Error ?  error.message : 'Не удалось открыть деталь'
        toast.error(message)
      }
    } else {
      window.open(`#detail-${detail.id}`, '_blank')
    }
  }
  
  const handleNameChange = (e:  React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ name: e.target.value })
  }
  
  const handleNameBlur = () => {
    // Send RENAME_DETAIL_REQUEST to Bitrix when name changes
    if (detail.bitrixId && detail.name) {
      console.log('[RENAME_DETAIL_REQUEST] Sending...', { detailId: detail.bitrixId, name: detail.name })
      postMessageBridge.sendRenameDetailRequest({
        detailId: detail.bitrixId,
        name: detail.name,
      })
      // UI не обновляем — ждём INIT
    }
  }
  
  const handleDragHandlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const card = e.currentTarget.closest('[data-detail-card]') as HTMLElement
    if (card) {
      // Calculate source index if in a binding
      const sourceIndex = 0 // Will be determined by binding
      dragContext.startDrag(e, {
        id: detail.id,
        kind: 'detail',
        sourceBindingId: parentBindingId,
      }, card)
    }
  }

  return (
    <Card 
      data-detail-card
      data-detail-id={detail.id}
      className={`overflow-hidden transition-all ${isDragging ?  'invisible' : ''}`}
      data-pwcode="detail-card"
    >
      <div className="bg-primary/5 border-b border-border px-3 py-2 flex items-center justify-between" data-pwcode="detail-header">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {!isTopLevel && (
            <div 
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing"
              onPointerDown={handleDragHandlePointerDown}
              data-pwcode="detail-drag-handle"
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
            <span className="text-xs font-medium text-primary-foreground px-2 py-0.5 bg-primary rounded">
              Деталь
            </span>
          </div>
          <Input
            value={detail.name}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            className="h-6 text-sm font-medium bg-transparent border-none px-3 focus-visible:ring-1 focus-visible: ring-ring flex-1 min-w-[120px]"
            placeholder="Название детали"
            data-pwcode="input-detail-name"
          />
          <div className="flex-shrink-0 flex items-center gap-1">
            <span className="text-xs font-mono text-muted-foreground" data-pwcode="detail-id">
              ID:{detail.bitrixId ?? detail.id.split('_')[1]?.slice(0, 5) ?? 'N/A'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 flex-shrink-0 hover:bg-accent hover:text-accent-foreground"
              onClick={handleOpenInBitrix}
              data-pwcode="btn-open-detail-bitrix"
            >
              <ArrowSquareOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground"
            onClick={handleToggleExpand}
            data-pwcode="btn-toggle-detail"
          >
            {detail.isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
            onClick={onDelete}
            data-pwcode="btn-delete-detail"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {detail.isExpanded && !isDragging && (
        <div className="p-3" data-pwcode="detail-content">
          <StageTabs
            calculators={detail.stages}
            onChange={(calculators) => onUpdate({ stages: calculators })}
            detailId={detail.bitrixId ?? undefined}
            bitrixMeta={bitrixMeta}
            onValidationMessage={onValidationMessage}
          />
        </div>
      )}
    </Card>
  )
}
