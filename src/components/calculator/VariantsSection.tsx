import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { InfoMessage } from '@/lib/types'
import { Pencil } from '@phosphor-icons/react'

interface VariantsSectionProps {
  selectedVariantIds: number[]
  testVariantId: number | null
  isEditingTestId: boolean
  setIsEditingTestId: (value: boolean) => void
  setTestVariantId: (id: number | null) => void
  addInfoMessage: (type: InfoMessage['type'], message: string) => void
}

export function VariantsSection({
  selectedVariantIds,
  testVariantId,
  isEditingTestId,
  setIsEditingTestId,
  setTestVariantId,
  addInfoMessage,
}: VariantsSectionProps) {
  const [editValue, setEditValue] = useState(testVariantId?.toString() || '')

  const handleSaveTestId = () => {
    const id = parseInt(editValue)
    if (selectedVariantIds.includes(id)) {
      setTestVariantId(id)
      setIsEditingTestId(false)
      addInfoMessage('success', `Установлен тестовый вариант: ${id}`)
    } else {
      addInfoMessage('error', 'ID не найден в списке выбранных вариантов')
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm font-medium">ID выбранных вариантов продукции:</span>
        <div className="flex gap-2 flex-wrap">
          {selectedVariantIds.map(id => (
            <Badge
              key={id}
              variant="secondary"
              className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => addInfoMessage('info', `Вариант ID: ${id}`)}
            >
              {id}
            </Badge>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-3">
        <span className="text-sm font-medium">ID для теста:</span>
        {isEditingTestId ? (
          <div className="flex gap-2">
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-24 h-8"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTestId()
                if (e.key === 'Escape') setIsEditingTestId(false)
              }}
              autoFocus
            />
            <Button size="sm" onClick={handleSaveTestId}>
              OK
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditingTestId(false)}
            >
              Отмена
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditingTestId(true)
              setEditValue(testVariantId?.toString() || '')
            }}
            className="h-8"
          >
            <div className="w-4 h-4 flex items-center justify-center mr-2">
              <Pencil className="w-3.5 h-3.5" />
            </div>
            {testVariantId || 'Не выбран'}
          </Button>
        )}
      </div>
    </div>
  )
}
