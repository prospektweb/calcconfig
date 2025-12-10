import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, ArrowSquareOut, X, CaretDown, CaretUp } from '@phosphor-icons/react'
import { ProductVariant } from '@/lib/types'
import { InfoMessage } from '@/lib/types'
import { toast } from 'sonner'

interface VariantsFooterProps {
  variants: ProductVariant[]
  testVariantId: number | null
  setTestVariantId: (id: number | null) => void
  addInfoMessage: (type: InfoMessage['type'], message: string) => void
  onRemoveVariant: (id: number) => void
  onSelectVariants: () => void
}

export function VariantsFooter({
  variants,
  testVariantId,
  setTestVariantId,
  addInfoMessage,
  onRemoveVariant,
  onSelectVariants,
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
    onSelectVariants()
  }

  const handleOpenVariant = (variant: ProductVariant, e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(variant.editUrl, '_blank')
    addInfoMessage('info', `Открыт вариант: ${variant.name}`)
  }

  const handleRemoveVariant = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    onRemoveVariant(id)
  }

  return (
    <div className="border-t border-border bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium whitespace-nowrap">Торговые предложения:</span>
        <div className={`flex gap-2 flex-wrap flex-1 ${!isExpanded && variants.length > 5 ? 'max-h-8 overflow-hidden' : ''}`}>
          {variants.map(variant => {
            const isTest = testVariantId === variant.id
            
            return (
              <div key={variant.id} className="group relative">
                <Badge
                  variant={isTest ? "default" : "secondary"}
                  className={`
                    px-2 py-1 flex items-center gap-1.5 cursor-pointer transition-colors text-xs
                    ${isTest ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'}
                  `}
                  onClick={() => handleVariantClick(variant.id)}
                  title={variant.name}
                >
                  <span className="font-mono">{variant.id}</span>
                  {isTest && <span className="text-[10px]">TEST</span>}
                  <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-accent hover:text-accent-foreground"
                      onClick={(e) => handleOpenVariant(variant, e)}
                    >
                      <ArrowSquareOut className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => handleRemoveVariant(variant.id, e)}
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
          className="h-7 px-3"
        >
          <Plus className="w-4 h-4 mr-1" />
          Выбрать
        </Button>
        {variants.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0 hover:bg-accent hover:text-accent-foreground"
          >
            {isExpanded ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}
