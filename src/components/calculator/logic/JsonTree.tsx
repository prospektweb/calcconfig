import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface JsonTreeProps {
  data: any
  onLeafClick?: (path: string, value: any, type: string) => void
  isPathDisabled?: (path: string) => boolean
}

interface TreeNodeProps {
  value: any
  path: string
  onLeafClick?: (path: string, value: any, type: string) => void
  isPathDisabled?: (path: string) => boolean
  searchTerm: string
}

function getValueType(value: any): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function TreeNode({ value, path, onLeafClick, isPathDisabled, searchTerm }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const type = getValueType(value)
  
  // Check if this node has __leaf marker (for property descriptors)
  const hasLeafMarker = value && typeof value === 'object' && value.__leaf === true
  
  const isObject = type === 'object' && !hasLeafMarker
  const isArray = type === 'array'
  const isLeaf = !isObject && !isArray
  const disabled = isPathDisabled?.(path) || false

  // Determine if this node or any children match search
  const matchesSearch = useMemo(() => {
    if (!searchTerm) return true
    const lowerSearch = searchTerm.toLowerCase()
    
    // Check if path contains search term
    if (path.toLowerCase().includes(lowerSearch)) return true
    
    // For leaf nodes, also check value
    if (isLeaf && String(value).toLowerCase().includes(lowerSearch)) return true
    
    return false
  }, [path, value, searchTerm, isLeaf])

  // Filter children for search
  const filteredChildren = useMemo(() => {
    if (!searchTerm || (!isObject && !isArray)) return null
    
    const children = isObject ? Object.keys(value) : Array.from({ length: value.length }, (_, i) => i)
    return children.filter(key => {
      const childPath = isArray ? `${path}[${key}]` : `${path}.${key}`
      const childValue = value[key]
      const childType = getValueType(childValue)
      const childIsLeaf = childType !== 'object' && childType !== 'array'
      
      // Check if child path or value matches
      if (childPath.toLowerCase().includes(searchTerm.toLowerCase())) return true
      if (childIsLeaf && String(childValue).toLowerCase().includes(searchTerm.toLowerCase())) return true
      
      // Recursively check nested objects/arrays
      if (!childIsLeaf) {
        // Simple check: if any nested key contains search term
        const jsonStr = JSON.stringify(childValue).toLowerCase()
        return jsonStr.includes(searchTerm.toLowerCase())
      }
      
      return false
    })
  }, [value, path, searchTerm, isObject, isArray])

  if (!matchesSearch && (!filteredChildren || filteredChildren.length === 0)) {
    return null
  }

  const handleClick = () => {
    if (isLeaf && !disabled) {
      // If node has __sourcePath marker, use it; otherwise use the path
      if (hasLeafMarker && value.__sourcePath) {
        const sourceType = value.__sourceType || type
        onLeafClick?.(value.__sourcePath, value, sourceType)
      } else {
        onLeafClick?.(path, value, type)
      }
    } else if (!isLeaf) {
      setIsExpanded(!isExpanded)
    }
  }

  const displayKey = path.split('.').pop()?.replace(/\[(\d+)\]$/, '[$1]') || path

  return (
    <div className="select-none">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-1 py-0.5 px-1 rounded text-xs hover:bg-accent/50',
                isLeaf && !disabled && 'cursor-pointer',
                isLeaf && disabled && 'cursor-not-allowed opacity-50',
                !isLeaf && 'cursor-pointer'
              )}
              onClick={handleClick}
            >
              {!isLeaf && (
                <span className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </span>
              )}
              {isLeaf && <span className="w-3 flex-shrink-0" />}
              <span className={cn('font-medium', disabled && 'text-muted-foreground')}>
                {displayKey}
              </span>
              {isLeaf && (
                <>
                  <span className="text-muted-foreground">:</span>
                  <span className={cn(
                    'text-muted-foreground truncate',
                    type === 'number' && 'text-blue-600',
                    type === 'string' && 'text-green-600',
                    type === 'boolean' && 'text-purple-600',
                    type === 'null' && 'text-gray-500'
                  )}>
                    {type === 'string' ? `"${value}"` : String(value)}
                  </span>
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-md">
            <div className="space-y-1">
              <div className="font-mono text-xs break-all">
                {hasLeafMarker && value.__sourcePath ? value.__sourcePath : path}
              </div>
              <div className="text-xs text-muted-foreground">
                Тип: {hasLeafMarker && value.__sourceType ? value.__sourceType : type}
                {disabled && ' • Данные следующих этапов недоступны'}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {!isLeaf && isExpanded && (
        <div className="ml-4 border-l border-border pl-2">
          {(searchTerm && filteredChildren ? filteredChildren : (isObject ? Object.keys(value) : Array.from({ length: value.length }, (_, i) => i))).map((key) => {
            const childPath = isArray ? `${path}[${key}]` : `${path}.${key}`
            return (
              <TreeNode
                key={childPath}
                value={value[key]}
                path={childPath}
                onLeafClick={onLeafClick}
                isPathDisabled={isPathDisabled}
                searchTerm={searchTerm}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export function JsonTree({ data, onLeafClick, isPathDisabled }: JsonTreeProps) {
  const [searchTerm, setSearchTerm] = useState('')

  if (!data) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Нет данных для отображения
      </div>
    )
  }

  return (
    <div className="space-y-2 h-full flex flex-col p-4" data-pwcode="logic-context-tree">
      <Input
        placeholder="Поиск по ключам..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="h-8 text-xs flex-shrink-0"
      />
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {Object.keys(data).map((key) => (
            <TreeNode
              key={key}
              value={data[key]}
              path={key}
              onLeafClick={onLeafClick}
              isPathDisabled={isPathDisabled}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
