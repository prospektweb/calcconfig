import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FormulaVar, StageOutputs, OfferPlanItem, ValidationIssue, InputParam } from './types'
import { OfferPathPicker } from './OfferPathPicker'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface OutputsTabProps {
  vars: FormulaVar[]
  inputs?: InputParam[]
  outputs: StageOutputs
  offerPlan: OfferPlanItem[]
  onOutputsChange: (outputs: StageOutputs) => void
  onOfferPlanChange: (offerPlan: OfferPlanItem[]) => void
  issues?: ValidationIssue[]
  offerModel?: any
}

export function OutputsTab({ 
  vars,
  inputs = [],
  outputs, 
  offerPlan, 
  onOutputsChange, 
  onOfferPlanChange,
  issues = [],
  offerModel
}: OutputsTabProps) {
  
  const handleOutputChange = (field: keyof StageOutputs, value: string) => {
    onOutputsChange({
      ...outputs,
      [field]: value || undefined
    })
  }

  const handleAddOfferPlanItem = () => {
    const newItem: OfferPlanItem = {
      id: `offer_${Date.now()}`,
      varName: '',
      sourceType: 'var'
    }
    onOfferPlanChange([...offerPlan, newItem])
  }

  const handleTargetPathChange = (id: string, path: string) => {
    onOfferPlanChange(offerPlan.map(item =>
      item.id === id ? { ...item, targetPath: path, field: undefined } : item
    ))
  }

  const handleSourceTypeChange = (id: string, sourceType: 'var' | 'input' | 'const') => {
    onOfferPlanChange(offerPlan.map(item =>
      item.id === id ? { ...item, sourceType, varName: '', constValue: undefined } : item
    ))
  }

  const handleSourceValueChange = (id: string, value: string) => {
    const item = offerPlan.find(i => i.id === id)
    if (!item) return

    if (item.sourceType === 'const') {
      // Try to parse as number, otherwise keep as string
      const numVal = parseFloat(value)
      const constValue = !isNaN(numVal) && value.trim() !== '' ? numVal : value
      onOfferPlanChange(offerPlan.map(i =>
        i.id === id ? { ...i, constValue } : i
      ))
    } else {
      onOfferPlanChange(offerPlan.map(i =>
        i.id === id ? { ...i, varName: value } : i
      ))
    }
  }

  const handleRemoveOfferPlanItem = (id: string) => {
    onOfferPlanChange(offerPlan.filter(item => item.id !== id))
  }

  const varOptions = vars.map(v => ({ value: v.name, label: v.name }))
  const inputOptions = inputs.map(i => ({ value: i.name, label: i.name }))
  const hasVars = vars.length > 0
  const hasInputs = inputs.length > 0
  
  // Get result issues grouped by refId
  const resultIssues = issues.filter(i => i.scope === 'result')
  const resultErrorCount = resultIssues.filter(i => i.severity === 'error').length
  const resultWarningCount = resultIssues.filter(i => i.severity === 'warning').length

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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Планируемые изменения ТП</h3>
            {(resultErrorCount > 0 || resultWarningCount > 0) && (
              <div className="flex items-center gap-2 text-xs">
                {resultErrorCount > 0 && (
                  <span className="text-destructive">
                    {resultErrorCount} {resultErrorCount === 1 ? 'ошибка' : resultErrorCount < 5 ? 'ошибки' : 'ошибок'}
                  </span>
                )}
                {resultWarningCount > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-500">
                    {resultWarningCount} {resultWarningCount === 1 ? 'предупреждение' : resultWarningCount < 5 ? 'предупреждения' : 'предупреждений'}
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Укажите, какие поля торгового предложения будут обновлены
          </p>
        </div>

        {offerPlan.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
            Изменения пока не добавлены
          </div>
        ) : (
          <TooltipProvider>
            <div className="space-y-2">
              {offerPlan.map(item => {
                const itemIssues = resultIssues.filter(i => i.refId === item.id)
                const hasError = itemIssues.some(i => i.severity === 'error')
                const hasWarning = itemIssues.some(i => i.severity === 'warning')
                const displayPath = item.targetPath || (item.field ? `offer.${item.field}` : '')
                const sourceType = item.sourceType || 'var'
                const sourceValue = sourceType === 'const' 
                  ? (item.constValue?.toString() || '') 
                  : item.varName

                return (
                  <div 
                    key={item.id}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-md border",
                      hasError && "bg-destructive/10 border-destructive/30",
                      hasWarning && !hasError && "bg-yellow-500/10 border-yellow-500/30",
                      !hasError && !hasWarning && "border-border"
                    )}
                  >
                    <div className="flex-1 space-y-2">
                      {/* Target path selector */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground min-w-[60px]">Целевое поле:</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className={cn(
                                "h-8 text-xs flex-1 justify-start font-mono",
                                !displayPath && "text-muted-foreground"
                              )}
                            >
                              {displayPath || 'Выберите путь...'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-96 p-0" align="start">
                            <ScrollArea className="h-80">
                              <OfferPathPicker
                                offerModel={offerModel}
                                onSelect={(path) => handleTargetPathChange(item.id, path)}
                              />
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Source selector */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground min-w-[60px]">Источник:</Label>
                        <Select
                          value={sourceType}
                          onValueChange={(val) => handleSourceTypeChange(item.id, val as any)}
                        >
                          <SelectTrigger className="h-8 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="var">Переменная</SelectItem>
                            <SelectItem value="input">Параметр</SelectItem>
                            <SelectItem value="const">Константа</SelectItem>
                          </SelectContent>
                        </Select>

                        {sourceType === 'const' ? (
                          <Input
                            value={sourceValue}
                            onChange={(e) => handleSourceValueChange(item.id, e.target.value)}
                            placeholder="Введите значение"
                            className="h-8 text-xs flex-1"
                          />
                        ) : sourceType === 'var' ? (
                          <Select
                            value={sourceValue}
                            onValueChange={(val) => handleSourceValueChange(item.id, val)}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder="Выберите переменную" />
                            </SelectTrigger>
                            <SelectContent>
                              {varOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={sourceValue}
                            onValueChange={(val) => handleSourceValueChange(item.id, val)}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder="Выберите параметр" />
                            </SelectTrigger>
                            <SelectContent>
                              {inputOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Error/Warning indicator */}
                    <div className="flex items-start gap-1 pt-1">
                      {(hasError || hasWarning) && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className={cn(
                              "w-4 h-4",
                              hasError ? "text-destructive" : "text-yellow-600 dark:text-yellow-500"
                            )} />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <div className="space-y-2">
                              {itemIssues.map((issue, idx) => (
                                <div key={idx}>
                                  <p className="text-xs">{issue.message}</p>
                                  {issue.hint && (
                                    <p className="text-xs text-muted-foreground mt-1">{issue.hint}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveOfferPlanItem(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </TooltipProvider>
        )}

        <Button
          onClick={handleAddOfferPlanItem}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Добавить изменение
        </Button>
      </div>
    </div>
  )
}
