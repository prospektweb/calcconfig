import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Copy, AlertCircle, CheckCircle2, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormulaVar, InputParam } from './types'
import { validateFormula } from './validator'
import { toast } from 'sonner'

interface FormulasTabProps {
  inputs: InputParam[]
  vars: FormulaVar[]
  onChange: (vars: FormulaVar[]) => void
  stageIndex: number
}

export function FormulasTab({ inputs, vars, onChange, stageIndex }: FormulasTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

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

  const errors = vars.filter(v => v.error).map(v => ({ name: v.name, error: v.error! }))

  return (
    <div className="p-4 space-y-4" data-pwcode="logic-formulas">
      <div>
        <Button onClick={handleAddVar} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Создать переменную
        </Button>
      </div>

      {vars.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>Формулы ещё не созданы</p>
          <p className="mt-2">Нажмите "Создать переменную" чтобы добавить формулу</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vars.map((v, idx) => (
            <div 
              key={v.id}
              className="p-3 border border-border rounded-md bg-card space-y-2"
            >
              <div className="flex items-center gap-2">
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
                  </div>
                )}
                
                <span className="text-sm text-muted-foreground">=</span>
                
                <div className="flex-1" />
                
                {v.error ? (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Ошибка
                  </Badge>
                ) : v.formula.trim() ? (
                  <Badge variant="default" className="text-xs gap-1 bg-green-600">
                    <CheckCircle2 className="w-3 h-3" />
                    OK
                  </Badge>
                ) : null}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDuplicate(v)}>
                      <Copy className="w-4 h-4 mr-2" />
                      Дублировать
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(v.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <Textarea
                value={v.formula}
                onChange={(e) => handleFormulaChange(v.id, e.target.value)}
                onBlur={(e) => handleFormulaBlur(v.id, e.target.value)}
                placeholder="Введите формулу..."
                className="min-h-[80px] font-mono text-xs"
              />
              
              {v.error && (
                <div className="text-xs text-destructive flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{v.error}</span>
                </div>
              )}
            </div>
          ))}
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
  )
}
