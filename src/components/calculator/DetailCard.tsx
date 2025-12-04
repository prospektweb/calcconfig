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
  const handleToggleExpand = () => {
    onUpdate({ isExpanded: !detail.isExpanded })
  }
  
  const handleOpenInBitrix = () => {
    window.open(`#detail-${detail.id}`, '_blank')
  }
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ name: e.target.value })
  }

  return (
    <Card 
      className={`overflow-hidden transition-all ${isInBinding ? 'ml-4 mb-0' : 'mb-3'}`}
      draggable={!isInBinding}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="bg-card border-b border-border px-3 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {!isInBinding && (
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
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
            className="h-6 text-sm font-medium bg-transparent border-none px-3 focus-visible:ring-1 focus-visible:ring-ring flex-1 min-w-[120px]"
            placeholder="Название детали"
          />
          <div className="flex-shrink-0">
            <span className="text-xs font-mono text-muted-foreground">
              ID:{detail.id.split('_')[1]?.slice(0, 5) || 'N/A'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 flex-shrink-0 hover:bg-accent hover:text-accent-foreground"
            onClick={handleOpenInBitrix}
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
