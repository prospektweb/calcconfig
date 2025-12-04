import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Detail, CalculatorInstance } from '@/lib/types'
import { CaretDown, CaretUp, X, Pencil, Plus, DotsSixVertical, ArrowSquareOut } from '@phosphor-icons/react'
import { CalculatorTabs } from './CalculatorTabs'

interface DetailCardProps {
  detail: Detail
  onUpdate: (updates: Partial<Detail>) => void
  onDelete: () => void
  isInBinding?: boolean
  orderNumber: number
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
}

export function DetailCard({ detail, onUpdate, onDelete, isInBinding = false, orderNumber, onDragStart, onDragEnd }: DetailCardProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(detail.name)

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdate({ name: editName.trim() })
      setIsEditingName(false)
    }
  }

  const handleToggleExpand = () => {
    onUpdate({ isExpanded: !detail.isExpanded })
  }
  
  const handleOpenInBitrix = () => {
    window.open(`#detail-${detail.id}`, '_blank')
  }

  return (
    <Card 
      className={`overflow-hidden transition-all ${isInBinding ? 'ml-4' : ''}`}
      draggable={!isInBinding}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="bg-card border-b border-border px-3 py-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 flex-1">
          {!isInBinding && <DotsSixVertical className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-semibold text-foreground">
            #{orderNumber}
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            ID:{detail.id.split('_')[1]?.slice(0, 5) || 'N/A'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0"
            onClick={handleOpenInBitrix}
          >
            <ArrowSquareOut className="w-3 h-3 text-muted-foreground" />
          </Button>
          {isEditingName ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-6 flex-1 max-w-xs text-sm"
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName()
                if (e.key === 'Escape') {
                  setEditName(detail.name)
                  setIsEditingName(false)
                }
              }}
              autoFocus
            />
          ) : (
            <span className="font-medium flex-1 text-sm">{detail.name}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setIsEditingName(true)}
          >
            <Pencil className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleToggleExpand}
          >
            {detail.isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
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

      {detail.isExpanded && (
        <div className="p-3">
          <CalculatorTabs
            calculators={detail.calculators}
            onChange={(calculators) => onUpdate({ calculators })}
          />
        </div>
      )}
    </Card>
  )
}
