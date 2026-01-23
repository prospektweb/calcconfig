import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { FormulaVar, ValidationIssue, InputParam, ResultsHL, WritePlanItem, AdditionalResult } from './types'
import { cn } from '@/lib/utils'
import { slugify } from '@/lib/stage-utils'

interface OutputsTabProps {
  vars: FormulaVar[]
  inputs?: InputParam[]
  resultsHL?: ResultsHL
  writePlan?: WritePlanItem[]
  additionalResults?: AdditionalResult[]
  onResultsHLChange?: (resultsHL: ResultsHL) => void
  onWritePlanChange?: (writePlan: WritePlanItem[]) => void
  onAdditionalResultsChange?: (additionalResults: AdditionalResult[]) => void
  issues?: ValidationIssue[]
  offerModel?: any
}

const NONE_VALUE = '__none__'

export function OutputsTab({ 
  vars,
  inputs = [],
  resultsHL,
  writePlan = [],
  additionalResults = [],
  onResultsHLChange,
  onWritePlanChange,
  onAdditionalResultsChange,
  issues = [],
  offerModel
}: OutputsTabProps) {
  
  // Helper to create empty ResultsHL if not provided
  const currentResultsHL = resultsHL || {
    width: { sourceKind: null, sourceRef: '' },
    length: { sourceKind: null, sourceRef: '' },
    height: { sourceKind: null, sourceRef: '' },
    weight: { sourceKind: null, sourceRef: '' },
    purchasingPrice: { sourceKind: null, sourceRef: '' },
    basePrice: { sourceKind: null, sourceRef: '' },
  }
  
  // Handlers for AdditionalResults
  const handleAddAdditionalResult = () => {
    if (!onAdditionalResultsChange) return
    const newResult: AdditionalResult = {
      id: `additional_${Date.now()}`,
      title: '',
      key: '',
      sourceKind: 'var',
      sourceRef: ''
    }
    onAdditionalResultsChange([...additionalResults, newResult])
  }

  const handleRemoveAdditionalResult = (id: string) => {
    if (!onAdditionalResultsChange) return
    onAdditionalResultsChange(additionalResults.filter(item => item.id !== id))
  }

  const handleAdditionalResultUpdate = (id: string, updates: Partial<AdditionalResult>) => {
    if (!onAdditionalResultsChange) return
    onAdditionalResultsChange(additionalResults.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates }
        // Auto-generate key from title if title changed
        if (updates.title !== undefined) {
          updated.key = slugify(updates.title)
        }
        return updated
      }
      return item
    }))
  }
  
  // Handlers for WritePlan
  const handleAddWritePlanItem = () => {
    if (!onWritePlanChange) return
    const newItem: WritePlanItem = {
      id: `writeplan_${Date.now()}`,
      targetPath: '',
      sourceKind: 'var',
      sourceRef: '',
      expectedType: 'string'
    }
    onWritePlanChange([...writePlan, newItem])
  }

  const handleRemoveWritePlanItem = (id: string) => {
    if (!onWritePlanChange) return
    onWritePlanChange(writePlan.filter(item => item.id !== id))
  }

  const handleWritePlanUpdate = (id: string, updates: Partial<WritePlanItem>) => {
    if (!onWritePlanChange) return
    onWritePlanChange(writePlan.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))
  }

  const hasVars = vars.length > 0
  const hasInputs = inputs.length > 0
  
  // Get result issues grouped by refId
  const resultIssues = issues.filter(i => i.scope === 'result')
  const resultErrorCount = resultIssues.filter(i => i.severity === 'error').length
  const resultWarningCount = resultIssues.filter(i => i.severity === 'warning').length

  // HL fields configuration - grouped for 2-column layout
  const HL_FIELDS_LEFT = [
    { key: 'width' as const, label: 'Ширина' },
    { key: 'length' as const, label: 'Длина' },
    { key: 'height' as const, label: 'Высота' },
  ]
  
  const HL_FIELDS_RIGHT = [
    { key: 'weight' as const, label: 'Вес' },
    { key: 'purchasingPrice' as const, label: 'Закупочная' },
    { key: 'basePrice' as const, label: 'Базовая' },
  ]

  // Filter only number sources for HL
  // Show vars with number type OR unknown type (validation will check at save)
  // and only number inputs
  const numberSources = [
    ...vars
      .filter(v => {
        if (!v.name?.trim()) return false
        const type = v.inferredType || v.declaredType
        // Include number types and unknown/undefined types
        return type === 'number' || !type || type === 'unknown'
      })
      .map(v => { 
        const type = v.inferredType || v.declaredType
        const typeLabel = type === 'number' 
          ? '' 
          : type 
            ? ` [${type}]` 
            : ' [unknown]'
        return {
          kind: 'var' as const, 
          ref: v.name, 
          label: `${v.name} (переменная${typeLabel})`
        }
      }),
    ...inputs
      .filter(i => i.name?.trim() && i.valueType === 'number')
      .map(i => ({ 
        kind: 'input' as const, 
        ref: i.name, 
        label: `${i.name} (вход)`
      })),
  ]

  // All sources for WritePlan
  const allSources = [
    ...vars
      .filter(v => v.name?.trim())
      .map(v => ({ kind: 'var' as const, ref: v.name, label: `${v.name} (перем.)`, type: v.inferredType })),
    ...inputs
      .filter(i => i.name?.trim())
      .map(i => ({ kind: 'input' as const, ref: i.name, label: `${i.name} (вход)`, type: i.valueType })),
  ]

  // Target paths for WritePlan
  const TARGET_PATH_OPTIONS = [
    { value: 'offer.code', label: 'offer.code (Код)' },
    { value: 'offer.name', label: 'offer.name (Название)' },
    { value: 'offer.previewText', label: 'offer.previewText (Анонс)' },
    { value: 'offer.detailText', label: 'offer.detailText (Описание)' },
  ]

  // Add properties from offerModel (only VALUE, not DESCRIPTION)
  const propertyPaths = offerModel?.properties 
    ? Object.keys(offerModel.properties).map(code => ({
        value: `offer.properties.${code}.VALUE`, 
        label: `${code}.VALUE`
      }))
    : []

  const allTargetPaths = [...TARGET_PATH_OPTIONS, ...propertyPaths]

  return (
    <div className="p-4 space-y-6" data-pwcode="logic-outputs">
      {/* HL Section - Required Results */}
      {onResultsHLChange && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Итоги этапа: Обязательные результаты</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Сопоставьте 6 обязательных полей этапа с числовыми источниками
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Левая колонка: Габариты */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground">Габариты</h4>
              {HL_FIELDS_LEFT.map(field => {
                const mapping = currentResultsHL[field.key]
                const fieldIssues = resultIssues.filter(i => i.refId === `hl_${field.key}`)
                const hasError = fieldIssues.some(i => i.severity === 'error')
                
                return (
                  <div key={field.key} className={cn(
                    "flex items-center gap-2",
                    hasError && "p-2 rounded-md bg-destructive/10 border border-destructive/30"
                  )}>
                    <Label className="w-24 text-xs">{field.label}</Label>
                    <Select
                      value={mapping.sourceRef && mapping.sourceKind 
                        ? `${mapping.sourceKind}:${mapping.sourceRef}` 
                        : NONE_VALUE}
                      onValueChange={(val) => {
                        if (val === NONE_VALUE) {
                          onResultsHLChange({
                            ...currentResultsHL,
                            [field.key]: { sourceKind: null, sourceRef: '' }
                          })
                        } else {
                          const [kind, ref] = val.split(':')
                          onResultsHLChange({
                            ...currentResultsHL,
                            [field.key]: { sourceKind: kind as 'var'|'input', sourceRef: ref }
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Не выбрано" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Не выбрано</SelectItem>
                        {numberSources.map(src => (
                          <SelectItem key={`${src.kind}:${src.ref}`} value={`${src.kind}:${src.ref}`}>
                            {src.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasError && (
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
            
            {/* Правая колонка: Вес и цены */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground">Вес и цены</h4>
              {HL_FIELDS_RIGHT.map(field => {
                const mapping = currentResultsHL[field.key]
                const fieldIssues = resultIssues.filter(i => i.refId === `hl_${field.key}`)
                const hasError = fieldIssues.some(i => i.severity === 'error')
                
                return (
                  <div key={field.key} className={cn(
                    "flex items-center gap-2",
                    hasError && "p-2 rounded-md bg-destructive/10 border border-destructive/30"
                  )}>
                    <Label className="w-24 text-xs">{field.label}</Label>
                    <Select
                      value={mapping.sourceRef && mapping.sourceKind 
                        ? `${mapping.sourceKind}:${mapping.sourceRef}` 
                        : NONE_VALUE}
                      onValueChange={(val) => {
                        if (val === NONE_VALUE) {
                          onResultsHLChange({
                            ...currentResultsHL,
                            [field.key]: { sourceKind: null, sourceRef: '' }
                          })
                        } else {
                          const [kind, ref] = val.split(':')
                          onResultsHLChange({
                            ...currentResultsHL,
                            [field.key]: { sourceKind: kind as 'var'|'input', sourceRef: ref }
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Не выбрано" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Не выбрано</SelectItem>
                        {numberSources.map(src => (
                          <SelectItem key={`${src.kind}:${src.ref}`} value={`${src.kind}:${src.ref}`}>
                            {src.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasError && (
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {numberSources.length === 0 && (
            <div className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
              Нет числовых источников. Создайте переменную или задайте тип входного параметра = number
            </div>
          )}
        </div>
      )}

      {/* AdditionalResults Section */}
      {onAdditionalResultsChange && (
        <div className="space-y-4 pt-4 border-t border-border">
          <div>
            <h3 className="text-sm font-medium mb-3">Дополнительные результаты</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Сохраните дополнительные рассчитанные значения этапа для дальнейшего использования
            </p>
          </div>

          {additionalResults.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
              Дополнительные результаты пока не добавлены
            </div>
          ) : (
            <TooltipProvider>
              <div className="space-y-2">
                {additionalResults.map(item => {
                  const itemIssues = resultIssues.filter(i => i.refId === item.id)
                  const hasError = itemIssues.some(i => i.severity === 'error')
                  const hasWarning = itemIssues.some(i => i.severity === 'warning')
                  
                  return (
                    <div 
                      key={item.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md border",
                        hasError && "bg-destructive/10 border-destructive/30",
                        hasWarning && !hasError && "bg-yellow-500/10 border-yellow-500/30",
                        !hasError && !hasWarning && "border-border"
                      )}
                    >
                      {/* Title input */}
                      <div className="flex-1 min-w-0">
                        <Input
                          value={item.title}
                          onChange={(e) => handleAdditionalResultUpdate(item.id, { title: e.target.value })}
                          placeholder="Название результата"
                          className="h-8 text-xs"
                        />
                        {item.key && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            key: {item.key}
                          </div>
                        )}
                      </div>
                      
                      {/* Source selector */}
                      <Select
                        value={item.sourceKind && item.sourceRef 
                          ? `${item.sourceKind}:${item.sourceRef}` 
                          : NONE_VALUE}
                        onValueChange={(val) => {
                          if (val === NONE_VALUE) {
                            handleAdditionalResultUpdate(item.id, { sourceKind: 'var', sourceRef: '' })
                          } else {
                            const [kind, ref] = val.split(':')
                            handleAdditionalResultUpdate(item.id, { 
                              sourceKind: kind as 'var' | 'input', 
                              sourceRef: ref 
                            })
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs w-56">
                          <SelectValue placeholder="Выберите источник..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>Не выбрано</SelectItem>
                          {allSources.map(src => (
                            <SelectItem key={`${src.kind}:${src.ref}`} value={`${src.kind}:${src.ref}`}>
                              {src.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Error/Warning indicator */}
                      {(hasError || hasWarning) && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className={cn(
                              "w-4 h-4 flex-shrink-0",
                              hasError ? "text-destructive" : "text-yellow-500"
                            )} />
                          </TooltipTrigger>
                          <TooltipContent>
                            {itemIssues.map((issue, idx) => (
                              <div key={idx}>
                                <p>{issue.message}</p>
                                {issue.hint && <p className="text-xs text-muted-foreground">{issue.hint}</p>}
                              </div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive flex-shrink-0"
                        onClick={() => handleRemoveAdditionalResult(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </TooltipProvider>
          )}

          <Button
            onClick={handleAddAdditionalResult}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Добавить результат
          </Button>
        </div>
      )}
    </div>
  )
}
