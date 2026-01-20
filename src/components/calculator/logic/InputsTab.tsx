import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InputParam } from './types'
import { toast } from 'sonner'

interface InputsTabProps {
  inputs: InputParam[]
  onChange: (inputs: InputParam[]) => void
}

export function InputsTab({ inputs, onChange }: InputsTabProps) {
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
          {inputs.map((input) => (
            <div 
              key={input.id}
              className="flex items-center gap-2 p-2 border border-border rounded-md bg-card"
            >
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
          ))}
        </div>
      )}
    </div>
  )
}
