import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Detail, CalculatorInstance } from '@/lib/types'
import { CaretDown, CaretUp, X, Pencil, Plus } from '@phosphor-icons/react'
import { CalculatorTabs } from './CalculatorTabs'

interface DetailCardProps {
  detail: Detail
  onUpdate: (updates: Partial<Detail>) => void
  onDelete: () => void
  isInBinding?: boolean
}

export function DetailCard({ detail, onUpdate, onDelete, isInBinding = false }: DetailCardProps) {
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

  return (
    <Card className={`overflow-hidden transition-all ${isInBinding ? 'ml-4' : ''}`}>
      <div className="bg-card border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-mono text-muted-foreground">
            #{detail.id.split('_')[1].slice(0, 6)}
          </span>
          {isEditingName ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 flex-1 max-w-xs"
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
            <span className="font-medium flex-1">{detail.name}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsEditingName(true)}
          >
            <Pencil className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleToggleExpand}
          >
            {detail.isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-destructive hover:text-destructive-foreground"
            onClick={onDelete}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {detail.isExpanded && (
        <div className="p-4">
          <CalculatorTabs
            calculators={detail.calculators}
            onChange={(calculators) => onUpdate({ calculators })}
          />
        </div>
      )}
    </Card>
  )
}
