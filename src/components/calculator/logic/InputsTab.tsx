import { useState, useEffect, useRef } from 'react'
import { Pencil, Trash2, AlertCircle, Info, Copy, FileCode } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { InputParam, ValueType, ValidationIssue } from './types'
import { inferTypeFromSourcePath } from './validator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface InputsTabProps {
  inputs: InputParam[]
  onChange: (inputs: InputParam[]) => void
  issues?: ValidationIssue[]
  activeInputId?: string | null
  onInputSelect?: (id: string | null) => void
  newlyAddedId?: string | null
  onNewlyAddedIdChange?: (id: string | null) => void
}

export function InputsTab({ inputs, onChange, issues = [], activeInputId, onInputSelect, newlyAddedId, onNewlyAddedIdChange }: InputsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const newlyAddedRef = useRef<HTMLDivElement>(null)

  // Handle scroll and animation for newly added input
  useEffect(() => {
    if (newlyAddedId && newlyAddedRef.current) {
      // Scroll to element
      newlyAddedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      
      // Clear the newlyAddedId after 2 seconds
      const timer = setTimeout(() => {
        if (onNewlyAddedIdChange) {
          onNewlyAddedIdChange(null)
        }
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [newlyAddedId, onNewlyAddedIdChange])

  const handleStartEdit = (input: InputParam) => {
    setEditingId(input.id)
    setEditName(input.name)
  }

  const handleSaveEdit = (id: string) => {
    const trimmedName = editName.trim()
    
    // Validate name
    if (!trimmedName) {
      toast.error('Имя параметра не может быть пустым')
      return
    }
    
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
      toast.error('Имя должно содержать только латиницу, цифры и _')
      return
    }
    
    // Check uniqueness
    if (inputs.some(inp => inp.id !== id && inp.name === trimmedName)) {
      toast.error('Параметр с таким именем уже существует')
      return
    }
    
    // Update
    onChange(inputs.map(inp => 
      inp.id === id ? { ...inp, name: trimmedName } : inp
    ))
    setEditingId(null)
    setEditName('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleDelete = (id: string) => {
    onChange(inputs.filter(inp => inp.id !== id))
    toast.success('Параметр удалён')
  }

  const handleTypeChange = (id: string, valueType: ValueType) => {
    onChange(inputs.map(inp => 
      inp.id === id ? { ...inp, valueType, typeSource: 'manual' } : inp
    ))
  }

  const getInputIssues = (inputId: string) => {
    return issues.filter(i => i.scope === 'input' && i.refId === inputId)
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(id)
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name)
    toast.success('Имя параметра скопировано в буфер обмена')
  }

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path)
    toast.success('Путь скопирован в буфер обмена')
  }

  return (
    <div className="p-4 space-y-4" data-pwcode="logic-inputs">
      {inputs.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>Входные параметры пока не добавлены</p>
          <p className="mt-2">Кликните на поле в дереве Контекста слева, чтобы добавить параметр</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inputs.map((input) => {
            const inputIssues = getInputIssues(input.id)
            const hasError = inputIssues.some(i => i.severity === 'error')
            const hasWarning = inputIssues.some(i => i.severity === 'warning')
            const inferred = inferTypeFromSourcePath(input.sourcePath)
            
            // Determine tooltip message
            let typeTooltip = ''
            if (input.typeSource === 'manual') {
              typeTooltip = 'Тип задан вручную администратором'
            } else if (input.autoTypeReason) {
              typeTooltip = `Тип определён автоматически по пути: ${input.autoTypeReason}`
            } else {
              // Fallback for older inputs without autoTypeReason
              typeTooltip = inferred.type !== 'unknown' 
                ? `Тип определён автоматически по пути: ${inferred.reason}`
                : 'Тип не удалось определить автоматически → unknown'
            }
            
            const isActive = activeInputId === input.id
            const isNewlyAdded = newlyAddedId === input.id
            
            return (
              <div 
                key={input.id}
                ref={isNewlyAdded ? newlyAddedRef : null}
                className={cn(
                  "flex flex-col gap-2 p-2 border rounded-md bg-card cursor-pointer transition-colors",
                  hasError && "border-destructive",
                  hasWarning && !hasError && "border-yellow-500",
                  isActive && "border-primary bg-primary/5 shadow-md",
                  !isActive && !hasError && !hasWarning && "hover:border-accent",
                  isNewlyAdded && "animate-highlight-pulse"
                )}
                onClick={() => onInputSelect?.(isActive ? null : input.id)}
              >
                {isActive && (
                  <div className="text-xs text-primary font-medium">
                    📍 Укажите новый путь в Контексте
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2">
                    {editingId === input.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, input.id)}
                          onBlur={() => handleSaveEdit(input.id)}
                          autoFocus
                          className="h-7 text-sm flex-1 max-w-xs"
                          placeholder="Имя параметра"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-muted-foreground">=</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{input.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEdit(input)
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <span className="text-sm text-muted-foreground">=</span>
                      </div>
                    )}
                    
                    <span className="text-sm text-muted-foreground font-mono flex-1 truncate">
                      {input.sourcePath}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {input.sourceType}
                    </Badge>
                  </div>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyName(input.name)
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Копировать имя</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyPath(input.sourcePath)
                          }}
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Копировать путь</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(input.id)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Тип:</span>
                  <Select
                    value={input.valueType || 'unknown'}
                    onValueChange={(value) => handleTypeChange(input.id, value as ValueType)}
                  >
                    <SelectTrigger size="sm" className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="bool">bool</SelectItem>
                      <SelectItem value="array">array</SelectItem>
                      <SelectItem value="any">any</SelectItem>
                      <SelectItem value="unknown">unknown</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{typeTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {(hasError || hasWarning) && (
                    <div className="ml-auto flex items-center gap-1">
                      <AlertCircle className={cn(
                        "w-4 h-4",
                        hasError ? "text-destructive" : "text-yellow-500"
                      )} />
                    </div>
                  )}
                </div>
                
                {inputIssues.length > 0 && (
                  <div className="space-y-1">
                    {inputIssues.map((issue, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "text-xs flex items-start gap-1 p-2 rounded-md",
                          issue.severity === 'error' ? "bg-destructive/10 text-destructive" : "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                        )}
                      >
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <span>{issue.message}</span>
                          {issue.hint && <p className="text-xs opacity-80 mt-1">{issue.hint}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
