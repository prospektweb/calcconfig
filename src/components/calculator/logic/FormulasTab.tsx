import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Copy, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { FormulaVar, InputParam, ValidationIssue } from './types'
import { validateFormula } from './validator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FormulasTabProps {
  inputs: InputParam[]
  vars: FormulaVar[]
  onChange: (vars: FormulaVar[]) => void
  stageIndex: number
  issues?: ValidationIssue[]
  onTextareaFocus?: (varId: string, cursorPosition: number) => void
  onTextareaBlur?: () => void
}

export function FormulasTab({ inputs, vars, onChange, stageIndex, issues = [], onTextareaFocus, onTextareaBlur }: FormulasTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  // Initialize with all vars collapsed
  const [collapsedVars, setCollapsedVars] = useState<Set<string>>(() => 
    new Set(vars.map(v => v.id))
  )
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Update collapsed vars when vars list changes
  useEffect(() => {
    setCollapsedVars(prev => {
      const newSet = new Set(prev)
      // Remove IDs that no longer exist
      Array.from(newSet).forEach(id => {
        if (!vars.some(v => v.id === id)) {
          newSet.delete(id)
        }
      })
      // Add new vars as collapsed (except if they were just added - they won't be in prev)
      vars.forEach(v => {
        if (!prev.has(v.id)) {
          newSet.add(v.id)
        }
      })
      return newSet
    })
  }, [vars.length])

  const generateVarName = (): string => {
    let counter = 1
    while (vars.some(v => v.name === `var_${counter}`)) {
      counter++
    }
    return `var_${counter}`
  }

  const handleAddVar = () => {
    const newVar: FormulaVar = {
      id: `var_${Date.now()}`,
      name: generateVarName(),
      formula: '',
      error: null
    }
    onChange([...vars, newVar])
    // Do NOT add to collapsedVars so it's expanded
    toast.success('Переменная создана')
  }

  const handleDuplicate = (v: FormulaVar) => {
    const newVar: FormulaVar = {
      id: `var_${Date.now()}`,
      name: generateVarName(),
      formula: v.formula,
      error: null
    }
    onChange([...vars, newVar])
    toast.success('Переменная дублирована')
  }

  const handleDelete = (id: string) => {
    onChange(vars.filter(v => v.id !== id))
    toast.success('Переменная удалена')
  }

  const handleStartEdit = (v: FormulaVar) => {
    setEditingId(v.id)
    setEditName(v.name)
  }

  const handleSaveEdit = (id: string) => {
    const trimmedName = editName.trim()
    
    if (!trimmedName) {
      toast.error('Имя переменной не может быть пустым')
      return
    }
    
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
      toast.error('Имя должно содержать только латиницу, цифры и _')
      return
    }
    
    if (vars.some(v => v.id !== id && v.name === trimmedName)) {
      toast.error('Переменная с таким именем уже существует')
      return
    }
    
    onChange(vars.map(v => v.id === id ? { ...v, name: trimmedName } : v))
    setEditingId(null)
    setEditName('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleFormulaChange = (id: string, formula: string) => {
    onChange(vars.map(v => v.id === id ? { ...v, formula } : v))
  }

  const handleFormulaBlur = (id: string, formula: string) => {
    const idx = vars.findIndex(v => v.id === id)
    if (idx === -1) return

    const inputNames = inputs.map(inp => inp.name)
    const availableVars = vars.slice(0, idx).map(v => v.name)
    
    const result = validateFormula(formula, inputNames, availableVars, stageIndex)
    
    onChange(vars.map(v => 
      v.id === id ? { ...v, error: result.valid ? null : result.error } : v
    ))
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(id)
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const getVarIssues = (varId: string) => {
    return issues.filter(i => i.scope === 'var' && i.refId === varId)
  }
  
  const toggleCollapse = (varId: string) => {
    const newCollapsed = new Set(collapsedVars)
    if (newCollapsed.has(varId)) {
      newCollapsed.delete(varId)
    } else {
      newCollapsed.add(varId)
    }
    setCollapsedVars(newCollapsed)
  }
  
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }
  
  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newVars = [...vars]
      const [draggedVar] = newVars.splice(draggedIndex, 1)
      newVars.splice(dragOverIndex, 0, draggedVar)
      onChange(newVars)
      toast.success('Порядок переменных изменён')
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const errors = vars.filter(v => v.error).map(v => ({ name: v.name, error: v.error! }))

  return (
    <div className="relative h-full">
      {/* Main content with padding for floating button */}
      <div className="h-full overflow-y-auto p-4 space-y-3 pb-20" data-pwcode="logic-formulas">
        {vars.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <p>Формулы ещё не созданы</p>
            <p className="mt-2">Нажмите "Создать переменную" чтобы добавить формулу</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vars.map((v, idx) => {
              const varIssues = getVarIssues(v.id)
              const hasError = varIssues.some(i => i.severity === 'error') || !!v.error
              const hasWarning = varIssues.some(i => i.severity === 'warning')
              const isCollapsed = collapsedVars.has(v.id)
              const isDragging = draggedIndex === idx
              const isDragOver = dragOverIndex === idx
              
              return (
                <div 
                  key={v.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "p-3 border rounded-md bg-card space-y-2 transition-all",
                    hasError && "border-destructive",
                    hasWarning && !hasError && "border-yellow-500",
                    isDragging && "opacity-50",
                    isDragOver && "border-primary border-2"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {/* Drag handle */}
                    <div className="cursor-move text-muted-foreground hover:text-foreground">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => toggleCollapse(v.id)}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                    
                    {editingId === v.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, v.id)}
                        onBlur={() => handleSaveEdit(v.id)}
                        autoFocus
                        className="h-7 text-sm max-w-xs"
                        placeholder="Имя переменной"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{v.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleStartEdit(v)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            navigator.clipboard.writeText(v.name)
                            toast.success('Название переменной скопировано')
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  
                  <span className="text-sm text-muted-foreground">=</span>
                  
                  {v.inferredType && (
                    <Badge variant="outline" className="text-xs">
                      {v.inferredType}
                    </Badge>
                  )}
                  
                  <div className="flex-1" />
                  
                  {hasError ? (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Ошибка
                    </Badge>
                  ) : hasWarning ? (
                    <Badge variant="outline" className="text-xs gap-1 border-yellow-500 text-yellow-700 dark:text-yellow-400">
                      <AlertCircle className="w-3 h-3" />
                      Внимание
                    </Badge>
                  ) : v.formula.trim() ? (
                    <Badge variant="default" className="text-xs gap-1 bg-green-600">
                      <CheckCircle2 className="w-3 h-3" />
                      OK
                    </Badge>
                  ) : null}
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleDuplicate(v)}
                      title="Дублировать"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(v.id)}
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {!isCollapsed && (
                  <>
                    <Textarea
                      value={v.formula}
                      onChange={(e) => handleFormulaChange(v.id, e.target.value)}
                      onBlur={(e) => {
                        handleFormulaBlur(v.id, e.target.value)
                        // Save cursor position on blur
                        onTextareaFocus?.(v.id, e.target.selectionStart || 0)
                      }}
                      onSelect={(e) => {
                        // Update position on selection change
                        const target = e.target as HTMLTextAreaElement
                        onTextareaFocus?.(v.id, target.selectionStart || 0)
                      }}
                      placeholder="Введите формулу..."
                      className="min-h-[80px] font-mono text-xs"
                    />
                    
                    {v.error && (
                      <div className="text-xs text-destructive flex items-start gap-1 p-2 rounded-md bg-destructive/10">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{v.error}</span>
                      </div>
                    )}
                    
                    {varIssues.length > 0 && (
                      <div className="space-y-1">
                        {varIssues.map((issue, idx) => (
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
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {errors.length > 0 && (
        <div className="border border-destructive/50 rounded-md p-3 bg-destructive/5">
          <h4 className="text-sm font-medium text-destructive mb-2">Ошибки валидации:</h4>
          <ul className="space-y-1">
            {errors.map((err, idx) => (
              <li key={idx} className="text-xs text-destructive">
                <span className="font-medium">{err.name}:</span> {err.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
      
      {/* Floating button - bottom right */}
      <Button 
        onClick={handleAddVar} 
        size="sm" 
        className="absolute bottom-4 right-4 z-10 gap-2 shadow-lg"
        style="position:sticky;right:16px;float:right;"
      >
        <Plus className="w-4 h-4" />
        Создать переменную
      </Button>
    </div>
  )
}
