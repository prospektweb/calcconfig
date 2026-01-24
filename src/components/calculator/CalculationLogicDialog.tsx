import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CaretLeft, CaretRight, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { InitPayload, postMessageBridge, SaveCalcLogicRequestPayload } from '@/lib/postmessage-bridge'
import { toast } from 'sonner'
import { JsonTree } from './logic/JsonTree'
import { InputsTab } from './logic/InputsTab'
import { FormulasTab } from './logic/FormulasTab'
import { OutputsTab } from './logic/OutputsTab'
import { HelpDetailDialog } from './logic/HelpDetailDialog'
import { InputParam, FormulaVar, StageLogic, ValidationIssue, ValueType, ResultsHL, WritePlanItem, AdditionalResult } from './logic/types'
import { saveLogic, loadLogic } from './logic/storage'
import { validateAll, inferType, inferTypeFromSourcePath } from './logic/validator'
import { getDraftKey, extractLogicJsonString } from '@/lib/stage-utils'

/**
 * Recursively nullify all values in an object/array, preserving structure
 * - Primitives (string/number/bool) => null
 * - null/undefined => null
 * - Arrays: empty => [], non-empty => [deepNullifyShape(first element)]
 * - Objects: recursively nullify all values
 */
function deepNullifyShape(obj: any): any {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return null
  }

  // Handle primitives
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return null
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return []
    }
    // Return array with single nullified template element
    return [deepNullifyShape(obj[0])]
  }

  // Handle objects
  if (typeof obj === 'object') {
    const result: Record<string, any> = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = deepNullifyShape(obj[key])
      }
    }
    return result
  }

  // Fallback
  return null
}

/**
 * Build logic context for the context tree panel
 * Shows full INIT payload except:
 * - selectedOffers is transformed to offer (first element with nullified values, prices removed)
 */
function buildLogicContext(initPayload: InitPayload | null | undefined): any {
  if (!initPayload) return null

  // Copy entire initPayload
  const logicContext: any = { ...initPayload }

  // Transform selectedOffers[0] → offer
  if (initPayload.selectedOffers?.[0]) {
    const offer0 = initPayload.selectedOffers[0]
    const offerModel = deepNullifyShape(offer0)
    
    // Remove prices from offer model
    if (offerModel && typeof offerModel === 'object') {
      delete offerModel.prices
    }
    
    logicContext.offer = offerModel
  }

  // Remove selectedOffers from context (replaced by offer)
  delete logicContext.selectedOffers

  return logicContext
}

// Helper to create empty ResultsHL
function createEmptyResultsHL(): ResultsHL {
  return {
    width: { sourceKind: null, sourceRef: '' },
    length: { sourceKind: null, sourceRef: '' },
    height: { sourceKind: null, sourceRef: '' },
    weight: { sourceKind: null, sourceRef: '' },
    purchasingPrice: { sourceKind: null, sourceRef: '' },
    basePrice: { sourceKind: null, sourceRef: '' },
  }
}

/**
 * Build inputs from CALC_SETTINGS.PARAMS and CALC_STAGES.INPUTS
 * Following new protocol spec section 3.1
 */
function buildInputsFromInit(
  paramsValue: string[] | undefined,
  paramsDesc: string[] | undefined,
  inputsValue: string[] | undefined,
  inputsDesc: string[] | undefined
): InputParam[] {
  if (!paramsValue || !Array.isArray(paramsValue)) {
    return []
  }
  
  // Build wiring map: paramName -> initPath
  const wiringMap = new Map<string, string>()
  if (inputsValue && Array.isArray(inputsValue)) {
    inputsValue.forEach((paramName, i) => {
      wiringMap.set(paramName, inputsDesc?.[i] || '')
    })
  }
  
  // Valid ValueTypes
  const VALID_VALUE_TYPES: ValueType[] = ['number', 'string', 'bool', 'array', 'any', 'unknown']
  
  // Create InputParam[] for UI
  return paramsValue.map((name, i) => {
    const typeStr = paramsDesc?.[i] || 'unknown'
    const valueType = VALID_VALUE_TYPES.includes(typeStr as ValueType) 
      ? (typeStr as ValueType) 
      : 'unknown'
    
    return {
      id: `input_${name}`,
      name,
      valueType,
      sourcePath: wiringMap.get(name) || '',
      sourceType: 'string',  // default, will be inferred
      typeSource: 'auto'
    }
  })
}

/**
 * Build vars from CALC_SETTINGS.LOGIC_JSON (only vars field)
 * Following new protocol spec section 3.2
 * Uses extractLogicJsonString to handle various LOGIC_JSON formats
 */
function buildVarsFromInit(logicJsonProp: any): FormulaVar[] {
  const logicJsonRaw = extractLogicJsonString(logicJsonProp)
  
  if (!logicJsonRaw) {
    return []
  }
  
  try {
    const parsed = JSON.parse(logicJsonRaw)
    return Array.isArray(parsed?.vars) ? parsed.vars : []
  } catch (e) {
    console.warn('Failed to parse LOGIC_JSON', e)
    return []
  }
}

/**
 * Build resultsHL and additionalResults from CALC_STAGES.OUTPUTS
 * Following new protocol spec section 3.3
 */
function buildResultsFromInit(
  outputsValue: string[] | undefined,
  outputsDesc: string[] | undefined
): { resultsHL: ResultsHL; additionalResults: AdditionalResult[] } {
  const REQUIRED_KEYS: Array<keyof ResultsHL> = ['width', 'length', 'height', 'weight', 'purchasingPrice', 'basePrice']
  const resultsHL: ResultsHL = createEmptyResultsHL()
  const additionalResults: AdditionalResult[] = []
  
  if (!outputsValue || !Array.isArray(outputsValue)) {
    return { resultsHL, additionalResults }
  }
  
  // Type guard for ResultsHL keys
  const isResultsHLKey = (key: string): key is keyof ResultsHL => {
    return REQUIRED_KEYS.includes(key as keyof ResultsHL)
  }
  
  outputsValue.forEach((keyValue, i) => {
    const varName = outputsDesc?.[i] || ''
    
    if (isResultsHLKey(keyValue)) {
      // Обязательный результат
      resultsHL[keyValue] = {
        sourceKind: 'var',
        sourceRef: varName
      }
    } else if (keyValue.includes('|')) {
      // Дополнительный результат: "slug|title"
      const [slug, title] = keyValue.split('|', 2)
      additionalResults.push({
        id: `additional_${slug}`,
        key: slug,
        title: title || '',
        sourceKind: 'var',
        sourceRef: varName
      })
    } else {
      // Устаревшее/неизвестное правило
      console.warn(`Unknown output key: ${keyValue}`)
    }
  })
  
  return { resultsHL, additionalResults }
}

interface CalculationLogicDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stageIndex: number
  stageName?: string
  calculatorName?: string
  allStages: Array<{ index: number; name?: string }>
  initPayload?: InitPayload | null
  currentStageId?: number | null
  currentSettingsId?: number | null
  onSaveRequest?: (settingsId: number, stageId: number, json: string) => void
}

export function CalculationLogicDialog({
  open,
  onOpenChange,
  stageIndex,
  stageName,
  calculatorName,
  allStages,
  initPayload,
  currentStageId,
  currentSettingsId,
  onSaveRequest,
}: CalculationLogicDialogProps) {
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true)
  const [activeTab, setActiveTab] = useState('inputs')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // State for help dialog
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [helpPlaceCode, setHelpPlaceCode] = useState('')
  const [helpTitle, setHelpTitle] = useState('')

  // State for active input selection (for path editing)
  const [activeInputId, setActiveInputId] = useState<string | null>(null)

  // State for logic editing
  const [inputs, setInputs] = useState<InputParam[]>([])
  const [vars, setVars] = useState<FormulaVar[]>([])
  const [resultsHL, setResultsHL] = useState<ResultsHL>(createEmptyResultsHL())
  const [writePlan, setWritePlan] = useState<WritePlanItem[]>([])
  const [additionalResults, setAdditionalResults] = useState<AdditionalResult[]>([])
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])

  // State for save/draft management
  const [savedJson, setSavedJson] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveTimeoutId, setSaveTimeoutId] = useState<number | null>(null)

  // Clear timeout when dialog closes
  useEffect(() => {
    if (!open && saveTimeoutId) {
      clearTimeout(saveTimeoutId)
      setSaveTimeoutId(null)
      setIsSaving(false)
    }
  }, [open, saveTimeoutId])

  // Load savedJson from INIT using ~VALUE from CALC_SETTINGS
  useEffect(() => {
    if (open && initPayload?.elementsStore?.CALC_SETTINGS && currentSettingsId) {
      const settingsElement = initPayload.elementsStore.CALC_SETTINGS.find(
        s => s.id === currentSettingsId
      )
      
      // ВАЖНО: использовать ~VALUE, не VALUE
      const logicJsonRaw = settingsElement?.properties?.LOGIC_JSON?.['~VALUE']
      setSavedJson(typeof logicJsonRaw === 'string' ? logicJsonRaw : null)
    }
  }, [open, initPayload, currentSettingsId])

  // Load saved logic when dialog opens (with draft support)
  useEffect(() => {
    // If no settingsId or stageId, clear all data
    if (!open || !currentSettingsId || !currentStageId) {
      setInputs([])
      setVars([])
      setResultsHL(createEmptyResultsHL())
      setWritePlan([])
      setAdditionalResults([])
      return
    }
    
    const draftKey = getDraftKey(currentStageId, currentSettingsId)
    
    // Try localStorage draft first
    const draftJson = localStorage.getItem(draftKey)
    if (draftJson) {
      try {
        const parsed = JSON.parse(draftJson)
        setInputs(Array.isArray(parsed?.inputs) ? parsed.inputs : [])
        setVars(Array.isArray(parsed?.vars) ? parsed.vars : [])
        setResultsHL(parsed?.resultsHL || createEmptyResultsHL())
        setWritePlan(Array.isArray(parsed?.writePlan) ? parsed.writePlan : [])
        setAdditionalResults(Array.isArray(parsed?.additionalResults) ? parsed.additionalResults : [])
        return
      } catch (e) {
        console.warn('Failed to parse draft', e)
      }
    }
    
    // Fall back to loading from INIT using new protocol
    const settingsElement = initPayload?.elementsStore?.CALC_SETTINGS?.find(
      s => s.id === currentSettingsId
    )
    const stageElement = initPayload?.elementsStore?.CALC_STAGES?.find(
      s => s.id === currentStageId
    )
    
    if (settingsElement || stageElement) {
      // Build inputs from PARAMS + INPUTS
      const paramsValue = settingsElement?.properties?.PARAMS?.VALUE as string[] | undefined
      const paramsDesc = settingsElement?.properties?.PARAMS?.DESCRIPTION as string[] | undefined
      const inputsValue = stageElement?.properties?.INPUTS?.VALUE as string[] | undefined
      const inputsDesc = stageElement?.properties?.INPUTS?.DESCRIPTION as string[] | undefined
      const inputs = buildInputsFromInit(paramsValue, paramsDesc, inputsValue, inputsDesc)
      
      // Build vars from LOGIC_JSON (pass entire property object for proper parsing)
      const logicJsonProp = settingsElement?.properties?.LOGIC_JSON
      const vars = buildVarsFromInit(logicJsonProp)
      
      // Build results from OUTPUTS
      const outputsValue = stageElement?.properties?.OUTPUTS?.VALUE as string[] | undefined
      const outputsDesc = stageElement?.properties?.OUTPUTS?.DESCRIPTION as string[] | undefined
      const { resultsHL, additionalResults } = buildResultsFromInit(outputsValue, outputsDesc)
      
      setInputs(inputs)
      setVars(vars)
      setResultsHL(resultsHL)
      setAdditionalResults(additionalResults)
      setWritePlan([])  // writePlan deprecated
      return
    }
    
    // Reset to empty state if no data
    setInputs([])
    setVars([])
    setResultsHL(createEmptyResultsHL())
    setWritePlan([])
    setAdditionalResults([])
  }, [open, currentStageId, currentSettingsId, initPayload])

  // Save to draft on any change
  useEffect(() => {
    if (open && currentStageId !== null && currentStageId !== undefined &&
        currentSettingsId !== null && currentSettingsId !== undefined) {
      const draftKey = getDraftKey(currentStageId, currentSettingsId)
      const draft = {
        version: 1,
        stageIndex,
        inputs,
        vars,
        resultsHL,
        writePlan,
        additionalResults
      }
      localStorage.setItem(draftKey, JSON.stringify(draft))
    }
  }, [inputs, vars, resultsHL, writePlan, additionalResults, open, currentStageId, currentSettingsId, stageIndex])

  // Computed values for dirty state
  const currentJson = JSON.stringify({
    version: 1,
    stageIndex,
    inputs,
    vars,
    resultsHL,
    writePlan,
    additionalResults
  })

  const draftKey = (currentStageId !== null && currentStageId !== undefined && 
                    currentSettingsId !== null && currentSettingsId !== undefined)
    ? getDraftKey(currentStageId, currentSettingsId) 
    : null
  const hasDraft = draftKey !== null && localStorage.getItem(draftKey) !== null
  
  // Helper to check if there's any content
  const hasAnyContent = (): boolean => {
    return inputs.length > 0 || 
           vars.length > 0 || 
           writePlan.length > 0 ||
           Object.values(resultsHL).some(m => m.sourceRef)
  }
  
  const isDirty = hasDraft || (savedJson === null && hasAnyContent())
  const hasErrors = validationIssues.some(i => i.severity === 'error')

  // Show current and previous stages only
  const visibleStages = allStages.slice(0, stageIndex + 1)

  // Build context for the left panel (without selectedOffers)
  const logicContext = useMemo(() => buildLogicContext(initPayload), [initPayload])

  const handleLeafClick = (path: string, value: any, type: string) => {
    // If there's an active input, update its path
    if (activeInputId) {
      setInputs(inputs.map(inp => {
        if (inp.id === activeInputId) {
          // Infer type from new path
          const inferred = inferTypeFromSourcePath(path)
          return {
            ...inp,
            sourcePath: path,
            sourceType: type as any,
            valueType: inferred.type !== 'unknown' ? inferred.type : inp.valueType,
            typeSource: 'auto',
            autoTypeReason: inferred.reason
          }
        }
        return inp
      }))
      setActiveInputId(null)
      toast.success('Путь параметра обновлён')
      return
    }

    // Generate unique ID and name
    const id = `input_${Date.now()}`
    let baseName = path.split('.').pop()?.replace(/\[(\d+)\]$/, '_$1') || 'param'
    baseName = baseName.replace(/[^a-zA-Z0-9_]/g, '_')
    
    // Ensure uniqueness
    let name = baseName
    let counter = 1
    while (inputs.some(inp => inp.name === name)) {
      name = `${baseName}_${counter}`
      counter++
    }

    // Infer type from path
    const inferred = inferTypeFromSourcePath(path)

    const newInput: InputParam = {
      id,
      name,
      sourcePath: path,
      sourceType: type as any,
      valueType: inferred.type !== 'unknown' ? inferred.type : undefined,
      typeSource: 'auto',
      autoTypeReason: inferred.reason
    }

    setInputs([...inputs, newInput])
    setActiveTab('inputs')
    toast.success(`Параметр "${name}" добавлен`)
  }

  const isPathDisabled = (path: string): boolean => {
    // Disable paths that reference future stages
    // Format: stages[N] or stages.N
    const stageMatch = path.match(/^stages[\.\[](\d+)/)
    if (stageMatch) {
      const stageNum = parseInt(stageMatch[1])
      return stageNum > stageIndex
    }
    return false
  }

  const handleOpenHelp = (placeCode: string, title: string) => {
    setHelpPlaceCode(placeCode)
    setHelpTitle(title)
    setHelpDialogOpen(true)
  }

  const handleValidate = () => {
    const result = validateAll(inputs, vars, stageIndex, [], resultsHL, writePlan, additionalResults)
    setValidationIssues(result.issues)
    
    // Also update vars with inferred types
    const symbolTable = new Map<string, ValueType>()
    
    // Add inputs to symbol table
    for (const input of inputs) {
      const inferred = inferTypeFromSourcePath(input.sourcePath)
      const type = input.valueType || inferred.type
      symbolTable.set(input.name, type)
    }
    
    // Update vars with inferred types
    const varsWithTypes = vars.map(v => {
      if (v.formula.trim()) {
        const typeResult = inferType(v.formula, symbolTable)
        symbolTable.set(v.name, typeResult.type)
        return { ...v, inferredType: typeResult.type }
      }
      symbolTable.set(v.name, 'unknown')
      return { ...v, inferredType: 'unknown' as ValueType }
    })
    setVars(varsWithTypes)
    
    // Count errors and warnings
    const errors = result.issues.filter(i => i.severity === 'error')
    const warnings = result.issues.filter(i => i.severity === 'warning')
    
    if (errors.length > 0) {
      toast.error(`Проверка не пройдена: ${errors.length} ${errors.length === 1 ? 'ошибка' : errors.length < 5 ? 'ошибки' : 'ошибок'}`)
    } else if (warnings.length > 0) {
      toast.warning(`Проверка пройдена с предупреждениями: ${warnings.length}`)
    } else {
      toast.success('Проверка пройдена')
    }
  }

  const handleSave = async () => {
    // Финальная проверка
    const result = validateAll(inputs, vars, stageIndex, [], resultsHL, writePlan, additionalResults)
    setValidationIssues(result.issues)
    
    if (!result.valid) {
      toast.error('Исправьте ошибки перед сохранением')
      return
    }
    
    if (!currentSettingsId) {
      toast.error('Не указан ID калькулятора')
      return
    }
    
    if (!currentStageId) {
      toast.error('Не указан ID этапа')
      return
    }
    
    setIsSaving(true)
    
    // Build params array from inputs
    const params = inputs.map(inp => ({
      name: inp.name,
      type: inp.valueType || 'unknown'
    }))
    
    // Build logicJson (vars only, no inputs/resultsHL/writePlan/additionalResults)
    const logicJson = JSON.stringify({
      version: 1,
      vars: vars
    })
    
    // Build inputs wiring array
    const inputsWiring = inputs.map(inp => ({
      name: inp.name,
      path: inp.sourcePath
    }))
    
    // Build outputs array
    const outputs: Array<{ key: string; var: string }> = []
    
    // Add required results (6 fixed keys)
    const requiredKeys: Array<keyof ResultsHL> = ['width', 'length', 'height', 'weight', 'purchasingPrice', 'basePrice']
    for (const key of requiredKeys) {
      const mapping = resultsHL[key]
      outputs.push({
        key,
        var: mapping.sourceRef || ''
      })
    }
    
    // Add additional results (key format: "slug|title")
    for (const additional of additionalResults) {
      outputs.push({
        key: `${additional.key}|${additional.title}`,
        var: additional.sourceRef || ''
      })
    }
    
    // Construct new payload format
    const payload: SaveCalcLogicRequestPayload = {
      settingsId: currentSettingsId,
      stageId: currentStageId,
      calcSettings: {
        params,
        logicJson
      },
      stageWiring: {
        inputs: inputsWiring,
        outputs
      }
    }
    
    // Notify parent about pending save with payload data for hash comparison
    onSaveRequest?.(currentSettingsId, currentStageId, JSON.stringify(payload))
    
    // Таймаут на случай если ответ не придёт
    const timeout = setTimeout(() => {
      setIsSaving(false)
      toast.error('Таймаут сохранения. Попробуйте ещё раз.')
    }, 15000)
    setSaveTimeoutId(timeout)
    
    try {
      postMessageBridge.sendSaveCalcLogicRequest(payload)
      // Popup закроется после получения нового INIT
      // Draft будет очищен в StageTabs.tsx при обработке нового INIT
    } catch (error) {
      clearTimeout(timeout)
      setSaveTimeoutId(null)
      toast.error('Ошибка отправки запроса')
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (!currentStageId || !currentSettingsId) {
      return
    }

    // Удалить draft из localStorage
    const draftKey = getDraftKey(currentStageId, currentSettingsId)
    localStorage.removeItem(draftKey)
    
    // Восстановить из INIT используя новый протокол
    const settingsElement = initPayload?.elementsStore?.CALC_SETTINGS?.find(
      s => s.id === currentSettingsId
    )
    const stageElement = initPayload?.elementsStore?.CALC_STAGES?.find(
      s => s.id === currentStageId
    )
    
    if (settingsElement || stageElement) {
      // Build inputs from PARAMS + INPUTS
      const paramsValue = settingsElement?.properties?.PARAMS?.VALUE as string[] | undefined
      const paramsDesc = settingsElement?.properties?.PARAMS?.DESCRIPTION as string[] | undefined
      const inputsValue = stageElement?.properties?.INPUTS?.VALUE as string[] | undefined
      const inputsDesc = stageElement?.properties?.INPUTS?.DESCRIPTION as string[] | undefined
      const inputs = buildInputsFromInit(paramsValue, paramsDesc, inputsValue, inputsDesc)
      
      // Build vars from LOGIC_JSON
      const logicJsonRaw = settingsElement?.properties?.LOGIC_JSON?.['~VALUE']
      const vars = buildVarsFromInit(logicJsonRaw)
      
      // Build results from OUTPUTS
      const outputsValue = stageElement?.properties?.OUTPUTS?.VALUE as string[] | undefined
      const outputsDesc = stageElement?.properties?.OUTPUTS?.DESCRIPTION as string[] | undefined
      const { resultsHL, additionalResults } = buildResultsFromInit(outputsValue, outputsDesc)
      
      setInputs(inputs)
      setVars(vars)
      setResultsHL(resultsHL)
      setAdditionalResults(additionalResults)
      setWritePlan([])  // deprecated
    } else {
      // Reset to empty
      setInputs([])
      setVars([])
      setResultsHL(createEmptyResultsHL())
      setWritePlan([])
      setAdditionalResults([])
    }
    
    // Очистить ошибки
    setValidationIssues([])
    
    toast.success('Изменения сброшены')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "p-0 gap-0 flex flex-col overflow-hidden min-h-0",
          isFullscreen 
            ? "inset-0 w-screen h-screen max-w-none max-h-none sm:max-w-none sm:max-h-none rounded-none translate-x-0 translate-y-0" 
            : "min-w-[1024px] w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[90vh] max-h-[90vh]"
        )}
        hideClose
        data-pwcode="calculation-logic-dialog"
      >
        {/* Fixed Header */}
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">
                Логика расчёта
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Этап #{stageIndex + 1}{stageName ? `: ${stageName}` : ''} • Калькулятор: {calculatorName || 'Не выбран'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
              >
                {isFullscreen ? <ArrowsIn className="w-4 h-4" /> : <ArrowsOut className="w-4 h-4" />}
              </Button>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="Закрыть"
                >
                  <span className="sr-only">Close</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                    <path
                      d="M18 6 6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        {/* Body - Three Column Layout */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Panel - Context (Collapsible) */}
          {!leftPanelCollapsed && (
            <div className="w-80 border-r border-border flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <h3 className="font-medium text-sm">Контекст</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setLeftPanelCollapsed(true)}
                >
                  <CaretLeft className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                {logicContext ? (
                  <div className="h-full">
                    <JsonTree
                      data={logicContext}
                      onLeafClick={handleLeafClick}
                      isPathDisabled={isPathDisabled}
                    />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-4">
                    Нет данных контекста
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapsed Left Panel Toggle */}
          {leftPanelCollapsed && (
            <div className="w-10 border-r border-border flex items-start justify-center pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setLeftPanelCollapsed(false)}
              >
                <CaretRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Center Panel - Editor (Main, Not Collapsible) */}
          <div className="flex-1 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-border">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="inputs" className="flex-1">
                    Входные параметры
                  </TabsTrigger>
                  <TabsTrigger value="formulas" className="flex-1">
                    Формулы
                  </TabsTrigger>
                  <TabsTrigger value="outputs" className="flex-1">
                    Итоги этапа
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="flex-1 overflow-hidden">
                <TabsContent value="inputs" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <InputsTab 
                      inputs={inputs} 
                      onChange={setInputs} 
                      issues={validationIssues}
                      activeInputId={activeInputId}
                      onInputSelect={setActiveInputId}
                    />
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="formulas" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <FormulasTab 
                      inputs={inputs} 
                      vars={vars} 
                      onChange={setVars}
                      stageIndex={stageIndex}
                      issues={validationIssues}
                    />
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="outputs" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <OutputsTab 
                      vars={vars}
                      inputs={inputs}
                      resultsHL={resultsHL}
                      additionalResults={additionalResults}
                      onResultsHLChange={setResultsHL}
                      onAdditionalResultsChange={setAdditionalResults}
                      issues={validationIssues}
                      offerModel={logicContext?.offer}
                    />
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Right Panel - Help (Collapsible, Collapsed by Default) */}
          {!rightPanelCollapsed && (
            <div className="w-80 border-l border-border flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-sm">Справка</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setRightPanelCollapsed(true)}
                >
                  <CaretRight className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm font-normal"
                    onClick={() => handleOpenHelp('help_syntax', 'Синтаксис')}
                  >
                    Синтаксис
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm font-normal"
                    onClick={() => handleOpenHelp('help_types', 'Типы данных')}
                  >
                    Типы данных
                  </Button>
                  <div className="pl-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">Функции</p>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs font-normal"
                      onClick={() => handleOpenHelp('help_functions_conditional', 'Функция if(condition, a, b)')}
                    >
                      if(condition, a, b)
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs font-normal"
                      onClick={() => handleOpenHelp('help_functions_arithmetic', 'Арифметические функции')}
                    >
                      Арифметические
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs font-normal"
                      onClick={() => handleOpenHelp('help_functions_string', 'Строковые функции')}
                    >
                      Строки
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs font-normal"
                      onClick={() => handleOpenHelp('help_functions_conversion', 'Функции преобразования')}
                    >
                      Преобразование
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs font-normal"
                      onClick={() => handleOpenHelp('help_functions_array', 'Функции для массивов')}
                    >
                      Массивы
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs font-normal"
                      onClick={() => handleOpenHelp('help_functions_regex', 'Регулярные выражения')}
                    >
                      Регулярные выражения
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm font-normal"
                    onClick={() => handleOpenHelp('help_errors', 'Ошибки')}
                  >
                    Ошибки
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm font-normal"
                    onClick={() => handleOpenHelp('about', 'О программе')}
                    data-pwcode="btn-about"
                  >
                    О программе
                  </Button>
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Collapsed Right Panel Toggle */}
          {rightPanelCollapsed && (
            <div className="w-10 border-l border-border flex items-start justify-center pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setRightPanelCollapsed(false)}
              >
                <CaretLeft className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleValidate}
                data-pwcode="logic-btn-validate"
              >
                Проверить
              </Button>
              {isDirty && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleReset}
                  disabled={isSaving}
                  data-pwcode="logic-btn-reset"
                >
                  Сбросить изменения
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button 
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !isDirty || hasErrors}
                data-pwcode="logic-btn-save"
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Help Detail Dialog */}
      <HelpDetailDialog
        isOpen={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
        placeCode={helpPlaceCode}
        title={helpTitle}
      />
    </Dialog>
  )
}
