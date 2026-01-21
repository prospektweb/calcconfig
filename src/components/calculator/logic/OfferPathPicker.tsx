import { useState } from 'react'
import { ChevronRight, ChevronDown, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface OfferPathPickerProps {
  offerModel: any
  onSelect: (path: string) => void
}

// Available leafs for properties with their types
const PROPERTY_LEAFS = [
  { name: 'VALUE', type: 'unknown', label: 'VALUE (тип зависит от свойства)' },
  { name: 'VALUE_XML_ID', type: 'string', label: 'VALUE_XML_ID (string)' },
  { name: 'ENUM_ID', type: 'number', label: 'ENUM_ID (number)' },
  { name: 'VALUE_ENUM_ID', type: 'number', label: 'VALUE_ENUM_ID (number)' },
  { name: 'DESCRIPTION', type: 'string', label: 'DESCRIPTION (string)' },
  { name: 'NAME', type: 'string', label: 'NAME (string)' },
  { name: 'CODE', type: 'string', label: 'CODE (string)' },
]

// Common offer fields with types
const COMMON_FIELDS = [
  { name: 'PRICE', type: 'number', label: 'PRICE (number)' },
  { name: 'WEIGHT', type: 'number', label: 'WEIGHT (number)' },
  { name: 'DIM_W', type: 'number', label: 'DIM_W (number)' },
  { name: 'DIM_H', type: 'number', label: 'DIM_H (number)' },
  { name: 'DIM_D', type: 'number', label: 'DIM_D (number)' },
  { name: 'id', type: 'number', label: 'id (number)' },
  { name: 'name', type: 'string', label: 'name (string)' },
  { name: 'code', type: 'string', label: 'code (string)' },
]

interface TreeNodeProps {
  label: string
  path: string
  value: any
  isExpanded: boolean
  onToggle: () => void
  onSelect: (path: string) => void
  level: number
}

function TreeNode({ label, path, value, isExpanded, onToggle, onSelect, level }: TreeNodeProps) {
  const isLeaf = value === null || typeof value !== 'object' || Array.isArray(value)
  const isProperties = label === 'properties'
  
  // For properties object, show property codes
  if (isProperties && typeof value === 'object' && !Array.isArray(value)) {
    return (
      <div>
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center gap-1 text-xs py-1 px-2 hover:bg-accent rounded w-full text-left",
            "font-medium"
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="text-blue-600 dark:text-blue-400">{label}</span>
        </button>
        {isExpanded && (
          <div>
            {Object.keys(value).map((propCode) => (
              <PropertyNode
                key={propCode}
                code={propCode}
                path={`${path}.${propCode}`}
                onSelect={onSelect}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }
  
  // Regular object node
  if (!isLeaf) {
    return (
      <div>
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center gap-1 text-xs py-1 px-2 hover:bg-accent rounded w-full text-left"
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="text-blue-600 dark:text-blue-400">{label}</span>
        </button>
        {isExpanded && (
          <div>
            {Object.keys(value).map((key) => (
              <TreeNodeWrapper
                key={key}
                label={key}
                path={`${path}.${key}`}
                value={value[key]}
                onSelect={onSelect}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }
  
  // Leaf node - clickable
  return (
    <button
      onClick={() => onSelect(path)}
      className={cn(
        "flex items-center gap-1 text-xs py-1 px-2 hover:bg-accent rounded w-full text-left"
      )}
      style={{ paddingLeft: `${level * 12 + 8}px` }}
    >
      <Circle className="w-2 h-2 fill-current text-muted-foreground" />
      <span className="text-green-600 dark:text-green-400">{label}</span>
      <span className="text-muted-foreground ml-1">
        = {typeof value === 'string' ? `"${value}"` : String(value)}
      </span>
    </button>
  )
}

function PropertyNode({ code, path, onSelect, level }: { code: string; path: string; onSelect: (path: string) => void; level: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-1 text-xs py-1 px-2 hover:bg-accent rounded w-full text-left",
          "font-medium"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="text-purple-600 dark:text-purple-400">{code}</span>
      </button>
      {isExpanded && (
        <div>
          {PROPERTY_LEAFS.map((leaf) => (
            <button
              key={leaf.name}
              onClick={() => onSelect(`${path}.${leaf.name}`)}
              className={cn(
                "flex items-center gap-1 text-xs py-1 px-2 hover:bg-accent rounded w-full text-left"
              )}
              style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
            >
              <Circle className="w-2 h-2 fill-current text-muted-foreground" />
              <span className="text-green-600 dark:text-green-400">{leaf.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TreeNodeWrapper({ label, path, value, onSelect, level }: Omit<TreeNodeProps, 'isExpanded' | 'onToggle'>) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <TreeNode
      label={label}
      path={path}
      value={value}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      onSelect={onSelect}
      level={level}
    />
  )
}

export function OfferPathPicker({ offerModel, onSelect }: OfferPathPickerProps) {
  const [expandedOffer, setExpandedOffer] = useState(true)
  
  if (!offerModel) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Модель offer не доступна
      </div>
    )
  }
  
  return (
    <div className="p-2">
      <div className="mb-2 px-2">
        <h4 className="text-xs font-semibold mb-1">Общие поля offer</h4>
        <div className="space-y-0.5">
          {COMMON_FIELDS.map((field) => (
            <button
              key={field.name}
              onClick={() => onSelect(`offer.${field.name}`)}
              className={cn(
                "flex items-center gap-1 text-xs py-1 px-2 hover:bg-accent rounded w-full text-left"
              )}
            >
              <Circle className="w-2 h-2 fill-current text-muted-foreground" />
              <span className="text-green-600 dark:text-green-400">{field.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="border-t pt-2">
        <button
          onClick={() => setExpandedOffer(!expandedOffer)}
          className={cn(
            "flex items-center gap-1 text-xs py-1 px-2 hover:bg-accent rounded w-full text-left font-semibold"
          )}
        >
          {expandedOffer ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="text-blue-600 dark:text-blue-400">offer (из контекста)</span>
        </button>
        {expandedOffer && (
          <div>
            {Object.keys(offerModel)
              .filter(key => key !== 'prices') // Exclude prices
              .map((key) => (
                <TreeNodeWrapper
                  key={key}
                  label={key}
                  path={`offer.${key}`}
                  value={offerModel[key]}
                  onSelect={onSelect}
                  level={1}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
