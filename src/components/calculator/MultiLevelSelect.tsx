import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CaretDown, CaretRight, Check, ArrowSquareOut } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface MultiLevelItem {
  id: string
  label: string
  value?: string
  children?: MultiLevelItem[]
  // New fields for Bitrix integration
  iblockId?: number
  iblockType?: string
  itemType?: 'section' | 'element'
}

interface MultiLevelSelectProps {
  items: MultiLevelItem[]
  value: string | null
  onValueChange: (value: string, label?: string) => void
  placeholder?: string
  disabled?: boolean
}

export function MultiLevelSelect({ items, value, onValueChange, placeholder = 'Выберите...', disabled = false }: MultiLevelSelectProps) {
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

  const findPath = (items: MultiLevelItem[], targetValue: string, path: string[] = []): string[] | null => {
    for (const item of items) {
      if (item.value === targetValue) {
        return [...path, item.label]
      }
      if (item.children) {
        const found = findPath(item.children, targetValue, [...path, item.label])
        if (found) return found
      }
    }
    return null
  }

  const getFullPath = (items: MultiLevelItem[], targetValue: string): string => {
    const path = findPath(items, targetValue)
    return path ? path.join(' → ') : ''
  }

  const selectedLabel = value ? getFullPath(items, value) : null

  const handleOpenBitrixItem = (item: MultiLevelItem, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!item.iblockId || !item.iblockType || !item.itemType) {
      console.warn('[MultiLevelSelect] Missing Bitrix metadata for item:', item)
      return
    }

    // Send postMessage to parent window (Bitrix)
    window.parent.postMessage({
      action: 'openBitrixItem',
      type: item.itemType,
      id: item.id,
      iblockId: item.iblockId,
      iblockType: item.iblockType
    }, '*')
  }

  const renderItem = (item: MultiLevelItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedIds.has(item.id)
    const isSelected = item.value === value

    return (
      <div key={item.id}>
        <div
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors group',
            isSelected && 'bg-accent text-accent-foreground'
          )}
          style={{ marginLeft: `${level * 16}px` }}
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
          {item.iblockId && item.iblockType && item.itemType && (
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 rounded hover:bg-primary/10"
              onClick={(e) => handleOpenBitrixItem(item, e)}
              data-pwcode={`btn-open-${item.itemType}-bitrix`}
              title="Открыть в Bitrix"
            >
              <ArrowSquareOut className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
            </button>
          )}
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
          disabled={disabled}
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
