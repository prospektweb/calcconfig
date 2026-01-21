import { useState } from 'react'
import { Pencil, Trash2, AlertCircle } from 'lucide-react'
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
import { InputParam, ValueType, ValidationIssue } from './types'
import { inferTypeFromSourcePath } from './validator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface InputsTabProps {
  inputs: InputParam[]
  onChange: (inputs: InputParam[]) => void
  issues?: ValidationIssue[]
}

export function InputsTab({ inputs, onChange, issues = [] }: InputsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

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
      inp.id === id ? { ...inp, valueType } : inp
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
            const inferredType = input.valueType || inferTypeFromSourcePath(input.sourcePath)
            
            return (
              <div 
                key={input.id}
                className={cn(
                  "flex flex-col gap-2 p-2 border rounded-md bg-card",
                  hasError && "border-destructive",
                  hasWarning && !hasError && "border-yellow-500"
                )}
              >
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
                          onClick={() => handleStartEdit(input)}
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
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(input.id)}
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
                  
                  {inferredType !== 'unknown' && (
                    <span className="text-xs text-muted-foreground">
                      (авто: {inferredType})
                    </span>
                  )}
                  
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
