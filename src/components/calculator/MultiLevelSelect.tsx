import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CaretDown, CaretRight, Check } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface MultiLevelItem {
  id: string
  label: string
  value?: string
  children?: MultiLevelItem[]
}

interface MultiLevelSelectProps {
  items: MultiLevelItem[]
  value: string | null
  onValueChange: (value: string, label: string) => void
  placeholder?: string
}

export function MultiLevelSelect({ items, value, onValueChange, placeholder = 'Выберите...' }: MultiLevelSelectProps) {
  const [open, setOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const findLabel = (items: MultiLevelItem[], targetValue: string): string | null => {
    for (const item of items) {
      if (item.value === targetValue) {
        return item.label
      }
      if (item.children) {
        const found = findLabel(item.children, targetValue)
        if (found) return found
      }
    }
    return null
  }

  const selectedLabel = value ? findLabel(items, value) : null

  const renderItem = (item: MultiLevelItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedIds.has(item.id)
    const isSelected = item.value === value

    return (
      <div key={item.id}>
        <div
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors',
            isSelected && 'bg-accent text-accent-foreground',
            level > 0 && 'ml-4'
          )}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(item.id)
            } else if (item.value) {
              onValueChange(item.value, item.label)
              setOpen(false)
            }
          }}
        >
          {hasChildren ? (
            <span className="w-4 h-4 flex items-center justify-center">
              {isExpanded ? <CaretDown className="w-3 h-3" /> : <CaretRight className="w-3 h-3" />}
            </span>
          ) : (
            <span className="w-4 h-4" />
          )}
          <span className="flex-1 text-sm">{item.label}</span>
          {isSelected && <Check className="w-4 h-4" />}
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {item.children!.map(child => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-2" align="start">
        <ScrollArea className="h-[300px]">
          <div className="space-y-1">
            {items.map(item => renderItem(item))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
