import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { FormulaVar, StageOutputs, OfferPlanItem } from './types'
import { toast } from 'sonner'

interface OutputsTabProps {
  vars: FormulaVar[]
  outputs: StageOutputs
  offerPlan: OfferPlanItem[]
  onOutputsChange: (outputs: StageOutputs) => void
  onOfferPlanChange: (offerPlan: OfferPlanItem[]) => void
}

const OFFER_FIELDS = [
  { value: 'PRICE', label: 'Цена (PRICE)' },
  { value: 'WEIGHT', label: 'Вес (WEIGHT)' },
  { value: 'DIM_W', label: 'Ширина (DIM_W)' },
  { value: 'DIM_H', label: 'Высота (DIM_H)' },
  { value: 'DIM_D', label: 'Глубина (DIM_D)' },
] as const

export function OutputsTab({ 
  vars, 
  outputs, 
  offerPlan, 
  onOutputsChange, 
  onOfferPlanChange 
}: OutputsTabProps) {
  
  const handleOutputChange = (field: keyof StageOutputs, value: string) => {
    onOutputsChange({
      ...outputs,
      [field]: value || undefined
    })
  }

  const handleAddOfferPlanItem = () => {
    // Find first unused field
    const usedFields = new Set(offerPlan.map(item => item.field))
    const availableField = OFFER_FIELDS.find(f => !usedFields.has(f.value as any))
    
    if (!availableField) {
      toast.error('Все поля уже добавлены')
      return
    }

    const newItem: OfferPlanItem = {
      id: `offer_${Date.now()}`,
      field: availableField.value as any,
      varName: ''
    }
    onOfferPlanChange([...offerPlan, newItem])
  }

  const handleOfferPlanChange = (id: string, field: 'field' | 'varName', value: string) => {
    onOfferPlanChange(offerPlan.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const handleRemoveOfferPlanItem = (id: string) => {
    onOfferPlanChange(offerPlan.filter(item => item.id !== id))
  }

  const varOptions = vars.map(v => ({ value: v.name, label: v.name }))
  const hasVars = vars.length > 0

  return (
    <div className="p-4 space-y-6" data-pwcode="logic-outputs">
      {/* Stage Outputs Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-3">Результаты этапа (для цепочки)</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Укажите переменные, которые будут использоваться в последующих этапах
          </p>
        </div>

        {!hasVars ? (
          <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
            <p>Создайте переменные на вкладке "Формулы"</p>
            <p className="mt-1">чтобы выбрать результаты этапа</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Себестоимость этапа</Label>
              <Select 
                value={outputs.costVar || ''} 
                onValueChange={(val) => handleOutputChange('costVar', val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Не выбрано" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Не выбрано</SelectItem>
                  {varOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Вес этапа</Label>
              <Select 
                value={outputs.weightVar || ''} 
                onValueChange={(val) => handleOutputChange('weightVar', val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Не выбрано" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Не выбрано</SelectItem>
                  {varOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Ширина</Label>
              <Select 
                value={outputs.widthVar || ''} 
                onValueChange={(val) => handleOutputChange('widthVar', val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Не выбрано" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Не выбрано</SelectItem>
                  {varOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Высота</Label>
              <Select 
                value={outputs.heightVar || ''} 
                onValueChange={(val) => handleOutputChange('heightVar', val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Не выбрано" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Не выбрано</SelectItem>
                  {varOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Глубина</Label>
              <Select 
                value={outputs.depthVar || ''} 
                onValueChange={(val) => handleOutputChange('depthVar', val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Не выбрано" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Не выбрано</SelectItem>
                  {varOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Offer Plan Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div>
          <h3 className="text-sm font-medium mb-3">Планируемые изменения ТП</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Укажите, какие поля торгового предложения будут обновлены
          </p>
        </div>

        {offerPlan.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
            Изменения пока не добавлены
          </div>
        ) : (
          <div className="space-y-2">
            {offerPlan.map(item => {
              const usedFields = new Set(
                offerPlan.filter(i => i.id !== item.id).map(i => i.field)
              )
              const availableFields = OFFER_FIELDS.filter(f => 
                f.value === item.field || !usedFields.has(f.value as any)
              )

              return (
                <div key={item.id} className="flex items-center gap-2">
                  <Select
                    value={item.field}
                    onValueChange={(val) => handleOfferPlanChange(item.id, 'field', val)}
                  >
                    <SelectTrigger className="h-8 text-xs w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map(field => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-sm text-muted-foreground">=</span>

                  <Select
                    value={item.varName}
                    onValueChange={(val) => handleOfferPlanChange(item.id, 'varName', val)}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Выберите переменную" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Не выбрано</SelectItem>
                      {varOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveOfferPlanItem(item.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <Button
          onClick={handleAddOfferPlanItem}
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={offerPlan.length >= OFFER_FIELDS.length}
        >
          <Plus className="w-4 h-4" />
          Добавить изменение
        </Button>
      </div>
    </div>
  )
}
