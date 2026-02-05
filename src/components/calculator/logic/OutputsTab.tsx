import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { FormulaVar, ValidationIssue, InputParam, ResultsHL, AdditionalResult, ParametrValuesSchemeEntry } from './types'
import { cn } from '@/lib/utils'
import { slugify } from '@/lib/stage-utils'

interface OutputsTabProps {
  vars: FormulaVar[]
  inputs?: InputParam[]
  resultsHL?: ResultsHL
  additionalResults?: AdditionalResult[]
  onResultsHLChange?: (resultsHL: ResultsHL) => void
  onAdditionalResultsChange?: (additionalResults: AdditionalResult[]) => void
  parametrValuesScheme?: ParametrValuesSchemeEntry[]
  onParametrValuesSchemeChange?: (entries: ParametrValuesSchemeEntry[]) => void
  parametrNamesPool?: string[]
  issues?: ValidationIssue[]
  offerModel?: any
  onTemplateFocus?: (entryId: string, cursorPosition: number) => void
}

const NONE_VALUE = '__none__'
const safeRenderString = (value: unknown) => (typeof value === 'string' ? value : '')

/**
 * Ensures the input value is an array, returning an empty array if not.
 * This prevents React errors when non-array values are passed as array props.
 */
const ensureArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : [])

const sanitizeStringArray = (values: unknown[]): string[] =>
  values.filter(value => typeof value === 'string').map(value => value)

const sanitizeInputsForRender = (items: InputParam[]) =>
  items
    .filter(item => typeof item?.name === 'string')
    .map(item => ({
      ...item,
      name: String(item.name),
      sourcePath: String(item.sourcePath ?? ''),
    }))

const sanitizeVarsForRender = (items: FormulaVar[]) =>
  items
    .filter(item => typeof item?.name === 'string')
    .map(item => ({
      ...item,
      name: String(item.name),
      formula: String(item.formula ?? ''),
    }))

const sanitizeAdditionalResultsForRender = (items: AdditionalResult[]) =>
  items
    .filter(item => typeof item?.id === 'string')
    .map(item => ({
      ...item,
      key: typeof item.key === 'string' ? item.key : '',
      title: typeof item.title === 'string' ? item.title : String(item.title ?? ''),
      sourceRef: typeof item.sourceRef === 'string' ? item.sourceRef : '',
    }))

const sanitizeResultsHLForRender = (results: ResultsHL): ResultsHL => ({
  width: { sourceKind: results?.width?.sourceKind ?? null, sourceRef: typeof results?.width?.sourceRef === 'string' ? results.width.sourceRef : '' },
  length: { sourceKind: results?.length?.sourceKind ?? null, sourceRef: typeof results?.length?.sourceRef === 'string' ? results.length.sourceRef : '' },
  height: { sourceKind: results?.height?.sourceKind ?? null, sourceRef: typeof results?.height?.sourceRef === 'string' ? results.height.sourceRef : '' },
  weight: { sourceKind: results?.weight?.sourceKind ?? null, sourceRef: typeof results?.weight?.sourceRef === 'string' ? results.weight.sourceRef : '' },
  purchasingPrice: { sourceKind: results?.purchasingPrice?.sourceKind ?? null, sourceRef: typeof results?.purchasingPrice?.sourceRef === 'string' ? results.purchasingPrice.sourceRef : '' },
  basePrice: { sourceKind: results?.basePrice?.sourceKind ?? null, sourceRef: typeof results?.basePrice?.sourceRef === 'string' ? results.basePrice.sourceRef : '' },
})

const sanitizeParametrValuesSchemeForRender = (items: ParametrValuesSchemeEntry[]) =>
  items
    .filter(item => typeof item?.id === 'string')
    .map(item => ({
      ...item,
      name: typeof item.name === 'string' ? item.name : String(item.name ?? ''),
      template: typeof item.template === 'string' ? item.template : String(item.template ?? ''),
    }))

const sanitizeIssuesForRender = (items: ValidationIssue[]) =>
  items
    .filter(issue => typeof issue?.message === 'string')
    .map(issue => ({
      ...issue,
      hint: typeof issue.hint === 'string' ? issue.hint : undefined,
    }))

/**
 * Safely sanitizes the offerModel prop to ensure it's a valid object or null.
 * This prevents React error #31 from being thrown when the prop contains non-serializable data.
 * 
 * @param offerModel - The raw offer model that may contain invalid data
 * @returns A safely sanitized offer model or null
 */
const sanitizeOfferModel = (offerModel: unknown): Record<string, unknown> | null => {
  if (offerModel === null || offerModel === undefined) {
    return null
  }
  
  if (typeof offerModel !== 'object') {
    return null
  }
  
  // Check if it's a plain object
  const tag = Object.prototype.toString.call(offerModel)
  if (tag !== '[object Object]') {
    return null
  }
  
  // Return the offer model as-is if it's a valid plain object
  // The data is already sanitized by sanitizeLogicContextForRender in the parent component
  return offerModel as Record<string, unknown>
}

export function OutputsTab({ 
  vars,
  inputs = [],
  resultsHL,
  additionalResults = [],
  onResultsHLChange,
  onAdditionalResultsChange,
  parametrValuesScheme = [],
  onParametrValuesSchemeChange,
  parametrNamesPool = [],
  issues = [],
  offerModel,
  onTemplateFocus
}: OutputsTabProps) {
  // Validate and sanitize all incoming props to prevent React errors
  const safeInputs = sanitizeInputsForRender(ensureArray<InputParam>(inputs))
  const safeVars = sanitizeVarsForRender(ensureArray<FormulaVar>(vars))
  const safeResultsHL = sanitizeResultsHLForRender(resultsHL || {
    width: { sourceKind: null, sourceRef: '' },
    length: { sourceKind: null, sourceRef: '' },
    height: { sourceKind: null, sourceRef: '' },
    weight: { sourceKind: null, sourceRef: '' },
    purchasingPrice: { sourceKind: null, sourceRef: '' },
    basePrice: { sourceKind: null, sourceRef: '' },
  })
  const safeAdditionalResults = sanitizeAdditionalResultsForRender(ensureArray<AdditionalResult>(additionalResults))
  const safeParametrValuesScheme = sanitizeParametrValuesSchemeForRender(ensureArray<ParametrValuesSchemeEntry>(parametrValuesScheme))
  const safeIssues = sanitizeIssuesForRender(ensureArray<ValidationIssue>(issues))
  const safeParametrNamesPool = sanitizeStringArray(ensureArray<string>(parametrNamesPool))
  const safeOfferModel = sanitizeOfferModel(offerModel)
  
  // Helper to create empty ResultsHL if not provided
  const currentResultsHL = safeResultsHL
  
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
  
  const hasVars = safeVars.length > 0
  const hasInputs = safeInputs.length > 0
  const offerParametrNames = Array.from(new Set([...safeParametrNamesPool, 'Название ТП']))
  
  // Get result issues grouped by refId
  const resultIssues = safeIssues.filter(i => i.scope === 'result')
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
    ...safeVars
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
    ...safeInputs
      .filter(i => i.name?.trim() && i.valueType === 'number')
      .map(i => ({ 
        kind: 'input' as const, 
        ref: i.name, 
        label: `${i.name} (вход)`
      })),
  ]

  // Sources for AdditionalResults (vars + inputs)
  const allSources = [
    ...safeVars
      .filter(v => v.name?.trim())
      .map(v => ({ kind: 'var' as const, ref: v.name, label: `${v.name} (перем.)`, type: v.inferredType })),
    ...safeInputs
      .filter(i => i.name?.trim())
      .map(i => ({ kind: 'input' as const, ref: i.name, label: `${i.name} (вход)`, type: i.valueType })),
  ]

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
                        <SelectValue placeholder="Не выбрано">
                          {mapping.sourceRef && mapping.sourceKind ? (
                            <span>
                              {safeRenderString(mapping.sourceRef)}{' '}
                              {mapping.sourceKind === 'var' ? '(переменная)' : '(вход)'}
                            </span>
                          ) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Не выбрано</SelectItem>
                        
                        <SelectGroup>
                          <SelectLabel>Переменные</SelectLabel>
                          {numberSources.filter(src => src.kind === 'var').map(src => (
                            <SelectItem key={`${src.kind}:${src.ref}`} value={`${src.kind}:${src.ref}`}>
                              {safeRenderString(src.ref)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        
                        <SelectGroup>
                          <SelectLabel>Входные параметры</SelectLabel>
                          {numberSources.filter(src => src.kind === 'input').map(src => (
                            <SelectItem key={`${src.kind}:${src.ref}`} value={`${src.kind}:${src.ref}`}>
                              {safeRenderString(src.ref)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
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
                        <SelectValue placeholder="Не выбрано">
                          {mapping.sourceRef && mapping.sourceKind ? (
                            <span>
                              {safeRenderString(mapping.sourceRef)}{' '}
                              {mapping.sourceKind === 'var' ? '(переменная)' : '(вход)'}
                            </span>
                          ) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Не выбрано</SelectItem>
                        
                        <SelectGroup>
                          <SelectLabel>Переменные</SelectLabel>
                          {numberSources.filter(src => src.kind === 'var').map(src => (
                            <SelectItem key={`${src.kind}:${src.ref}`} value={`${src.kind}:${src.ref}`}>
                              {safeRenderString(src.ref)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        
                        <SelectGroup>
                          <SelectLabel>Входные параметры</SelectLabel>
                          {numberSources.filter(src => src.kind === 'input').map(src => (
                            <SelectItem key={`${src.kind}:${src.ref}`} value={`${src.kind}:${src.ref}`}>
                              {safeRenderString(src.ref)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
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

          {safeAdditionalResults.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
              Дополнительные результаты пока не добавлены
            </div>
          ) : (
            <TooltipProvider>
              <div className="space-y-3">
                {/* Column headers */}
                <div className="grid grid-cols-2 gap-8 px-2">
                  <Label className="text-xs font-medium text-muted-foreground">Наименование результата</Label>
                  <Label className="text-xs font-medium text-muted-foreground">Значение</Label>
                </div>
                
                {safeAdditionalResults.map(item => {
                  const itemIssues = resultIssues.filter(i => i.refId === item.id)
                  const hasError = itemIssues.some(i => i.severity === 'error')
                  const hasWarning = itemIssues.some(i => i.severity === 'warning')
                  
                  return (
                    <div 
                      key={item.id}
                      className={cn(
                        "grid grid-cols-2 gap-8 items-start p-2 rounded-md border",
                        hasError && "bg-destructive/10 border-destructive/30",
                        hasWarning && !hasError && "bg-yellow-500/10 border-yellow-500/30",
                        !hasError && !hasWarning && "border-border"
                      )}
                    >
                      {/* Left column: Title input */}
                      <div className="flex flex-col gap-1">
                        <Input
                          value={item.title}
                          onChange={(e) => handleAdditionalResultUpdate(item.id, { title: e.target.value })}
                          placeholder="Название результата"
                          className="h-8 text-xs"
                        />
                        {item.key && (
                          <div className="text-xs text-muted-foreground truncate">
                            key: {safeRenderString(item.key)}
                          </div>
                        )}
                      </div>
                      
                      {/* Right column: Source selector + actions */}
                      <div className="flex items-center gap-2">
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
                          <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Выберите источник...">
                            {item.sourceRef && item.sourceKind ? (
                              <span>
                                {safeRenderString(item.sourceRef)}{' '}
                                {item.sourceKind === 'var' ? '(переменная)' : '(вход)'}
                              </span>
                            ) : null}
                          </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>Не выбрано</SelectItem>
                            
                            <SelectGroup>
                              <SelectLabel>Переменные</SelectLabel>
                              {allSources.filter(src => src.kind === 'var').map(src => (
                                <SelectItem key={`${src.kind}:${src.ref}`} value={`${src.kind}:${src.ref}`}>
                                  {safeRenderString(src.ref)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                            
                            <SelectGroup>
                              <SelectLabel>Входные параметры</SelectLabel>
                              {allSources.filter(src => src.kind === 'input').map(src => (
                                <SelectItem key={`${src.kind}:${src.ref}`} value={`${src.kind}:${src.ref}`}>
                                  {safeRenderString(src.ref)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
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
                                  <p>{safeRenderString(issue.message)}</p>
                                  {issue.hint && (
                                    <p className="text-xs text-muted-foreground">
                                      {safeRenderString(issue.hint)}
                                    </p>
                                  )}
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

      <div className="space-y-4 pt-4 border-t border-border">
        <div>
          <h3 className="text-sm font-medium mb-1">Параметры торгового предложения</h3>
          <p className="text-xs text-muted-foreground">
            Определите шаблоны, на основании которых будут формироваться данные для названия ТП и свойства PARAMETR_VALUES. Используйте {self} для вставки текущего значения.
          </p>
        </div>
        <ParametrValuesTable
          entries={safeParametrValuesScheme}
          onChange={onParametrValuesSchemeChange}
          existingNames={offerParametrNames}
          onTemplateFocus={onTemplateFocus}
        />
      </div>
    </div>
  )
}

function ParametrValuesTable({
  entries,
  onChange,
  existingNames,
  onTemplateFocus,
}: {
  entries: ParametrValuesSchemeEntry[]
  onChange?: (entries: ParametrValuesSchemeEntry[]) => void
  existingNames: string[]
  onTemplateFocus?: (entryId: string, cursorPosition: number) => void
}) {
  const showEmptyRow = entries.length === 0

  const handleChange = (id: string, updates: Partial<ParametrValuesSchemeEntry>) => {
    if (!onChange) return
    onChange(
      entries.map(entry => (entry.id === id ? { ...entry, ...updates } : entry))
    )
  }

  const handleRemove = (id: string) => {
    if (!onChange) return
    onChange(entries.filter(entry => entry.id !== id))
  }

  const handleAdd = () => {
    if (!onChange) return
    const newEntry: ParametrValuesSchemeEntry = {
      id: `parametr_${Date.now()}`,
      name: '',
      template: '',
    }
    onChange([...entries, newEntry])
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 text-xs font-medium text-muted-foreground px-2">
        <div>Название</div>
        <div>Значение</div>
      </div>
      <div className="space-y-2">
        {showEmptyRow ? (
          <div className="grid grid-cols-2 gap-4 items-start px-2">
            <Input
              placeholder="Название"
              className="h-8 text-xs"
              onFocus={handleAdd}
            />
            <Input
              placeholder="Шаблон значения"
              className="h-8 text-xs"
              onFocus={handleAdd}
            />
          </div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="grid grid-cols-2 gap-4 items-start px-2">
              <div className="flex items-center gap-2">
                <Input
                  value={entry.name}
                  onChange={(event) => handleChange(entry.id, { name: event.target.value })}
                  placeholder="Название"
                  className="h-8 text-xs flex-1"
                  list={existingNames.length > 0 ? `parametr-names-${entry.id}` : undefined}
                />
                {existingNames.length > 0 && (
                  <datalist id={`parametr-names-${entry.id}`}>
                    {existingNames.map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={() => handleRemove(entry.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Input
                value={entry.template}
                onChange={(event) => handleChange(entry.id, { template: event.target.value })}
                placeholder="Шаблон значения"
                className="h-8 text-xs"
                onFocus={(event) => {
                  const target = event.target as HTMLInputElement
                  onTemplateFocus?.(entry.id, target.selectionStart ?? target.value.length)
                }}
                onSelect={(event) => {
                  const target = event.target as HTMLInputElement
                  onTemplateFocus?.(entry.id, target.selectionStart ?? target.value.length)
                }}
                onBlur={(event) => {
                  const target = event.target as HTMLInputElement
                  onTemplateFocus?.(entry.id, target.selectionStart ?? target.value.length)
                }}
              />
            </div>
          ))
        )}
      </div>
      <Button
        onClick={handleAdd}
        size="sm"
        variant="outline"
        className="gap-2"
      >
        <Plus className="w-4 h-4" />
        Добавить параметр
      </Button>
    </div>
  )
}
