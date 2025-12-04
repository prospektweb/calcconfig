import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, ArrowSquareOut, X, CaretDown, CaretUp } from '@phosphor-icons/react'
import { mockProductVariants } from '@/lib/mock-data'
import { InfoMessage } from '@/lib/types'
import { toast } from 'sonner'

interface VariantsFooterProps {
  selectedVariantIds: number[]
  testVariantId: number | null
  setTestVariantId: (id: number | null) => void
  addInfoMessage: (type: InfoMessage['type'], message: string) => void
}

export function VariantsFooter({
  selectedVariantIds,
  testVariantId,
  setTestVariantId,
  addInfoMessage,
}: VariantsFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleVariantClick = (id: number) => {
    if (testVariantId === id) {
      setTestVariantId(null)
      addInfoMessage('info', `Снята метка теста с варианта ID: ${id}`)
    } else {
      setTestVariantId(id)
      addInfoMessage('success', `Установлена метка теста на вариант ID: ${id}`)
    }
  }

  const handleAddVariant = () => {
    toast.info('Открытие меню выбора торговых предложений Битрикс (заглушка)')
    addInfoMessage('info', 'Открыто меню выбора торговых предложений')
  }

  const handleOpenVariant = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`#variant-${id}`, '_blank')
    addInfoMessage('info', `Открыт вариант ID: ${id}`)
  }

  const handleRemoveVariant = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    toast.info(`Удаление варианта ID: ${id} (заглушка)`)
    addInfoMessage('warning', `Запрос на удаление варианта ID: ${id}`)
  }

  const getVariantName = (id: number) => {
    const variant = mockProductVariants.find(v => v.id === id)
    return variant?.name || `Неизвестный вариант ${id}`
  }

  return (
    <div className="border-t border-border bg-card px-4 py-2">
      <div className="max-w-[1920px] mx-auto">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium whitespace-nowrap">Торговые предложения:</span>
          <div className={`flex gap-2 flex-wrap flex-1 ${!isExpanded && selectedVariantIds.length > 5 ? 'max-h-8 overflow-hidden' : ''}`}>
            {selectedVariantIds.map(id => {
              const isTest = testVariantId === id
              const variantName = getVariantName(id)
              
              return (
                <div key={id} className="group relative">
                  <Badge
                    variant={isTest ? "default" : "secondary"}
                    className={`
                      px-2 py-1 flex items-center gap-1.5 cursor-pointer transition-colors text-xs
                      ${isTest ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}
                    `}
                    onClick={() => handleVariantClick(id)}
                    title={variantName}
                  >
                    <span className="font-mono">{id}</span>
                    {isTest && <span className="text-[10px]">TEST</span>}
                    <div className="hidden group-hover:flex items-center gap-1 ml-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-3 w-3 p-0"
                        onClick={(e) => handleOpenVariant(id, e)}
                      >
                        <ArrowSquareOut className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-3 w-3 p-0 hover:text-destructive"
                        onClick={(e) => handleRemoveVariant(id, e)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </Badge>
                </div>
              )
            })}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAddVariant}
            className="h-7"
          >
            <Plus className="w-3 h-3 mr-1" />
            Выбрать
          </Button>
          {selectedVariantIds.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 w-7 p-0"
            >
              {isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
