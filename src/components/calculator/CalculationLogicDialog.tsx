import { Component, ReactNode, useState, useEffect, useMemo, useRef } from 'react'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CaretLeft, CaretRight, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { InitPayload, postMessageBridge, SaveCalcLogicRequestPayload } from '@/lib/postmessage-bridge'
import { toast } from 'sonner'
import { JsonTree } from './logic/JsonTree'
import { ContextExplorer } from './logic/ContextExplorer'
import { InputsTab } from './logic/InputsTab'
import { FormulasTab } from './logic/FormulasTab'
import { OutputsTab } from './logic/OutputsTab'
import { HelpDetailDialog } from './logic/HelpDetailDialog'
import { InputParam, FormulaVar, StageLogic, ValidationIssue, ValueType, ResultsHL, WritePlanItem, AdditionalResult, ParametrValuesSchemeEntry } from './logic/types'
import { saveLogic, loadLogic } from './logic/storage'
import { validateAll, inferType, inferTypeFromSourcePath } from './logic/validator'
import { getDraftKey, extractLogicJsonString } from '@/lib/stage-utils'

/**
 * Build logic context for the context tree panel
 * Shows full INIT payload as-is without modifications
 */
function buildLogicContext(initPayload: InitPayload | null | undefined): any {
  if (!initPayload) return null
  
  // Return initPayload as-is
  return initPayload
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
  outputsDesc: string[] | undefined,
  inputNames: string[] = []
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
    
    // Определяем sourceKind на основе списка inputs
    const sourceKind = inputNames.includes(varName) ? 'input' : 'var'
    
    if (isResultsHLKey(keyValue)) {
      // Обязательный результат
      resultsHL[keyValue] = {
        sourceKind,
        sourceRef: varName
      }
    } else if (keyValue.includes('|')) {
      // Дополнительный результат: "slug|title"
      const [slug, title] = keyValue.split('|', 2)
      additionalResults.push({
        id: `additional_${slug}`,
        key: slug,
        title: title || '',
        sourceKind,
        sourceRef: varName
      })
    } else {
      // Устаревшее/неизвестное правило
      console.warn(`Unknown output key: ${keyValue}`)
    }
  })
  
  return { resultsHL, additionalResults }
}

function buildParametrValuesSchemeFromInit(
  schemeValue: string[] | undefined,
  schemeDescription: string[] | undefined
): ParametrValuesSchemeEntry[] {
  if (!schemeValue || !Array.isArray(schemeValue)) {
    return []
  }

  return schemeValue.map((name, index) => ({
    id: `parametr_${index}`,
    name: String(name ?? ''),
    template: String(schemeDescription?.[index] ?? ''),
  }))
}

function warnOnFiltered(label: string, count: number) {
  if (count > 0) {
    console.warn(`[calcconfig] Filtered ${count} invalid ${label} entries`)
  }
}

function safeRenderString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function sanitizeInputs(rawInputs: InputParam[], label: string): InputParam[] {
  let filteredCount = 0
  const sanitized = rawInputs
    .filter(input => {
      if (typeof input?.name !== 'string') {
        filteredCount += 1
        return false
      }
      return true
    })
    .map(input => ({
      ...input,
      name: String(input.name),
      sourcePath: String(input.sourcePath ?? ''),
    }))

  warnOnFiltered(label, filteredCount)
  return sanitized
}

function sanitizeVars(rawVars: FormulaVar[], label: string): FormulaVar[] {
  let filteredCount = 0
  const sanitized = rawVars
    .filter(formulaVar => {
      if (typeof formulaVar?.name !== 'string') {
        filteredCount += 1
        return false
      }
      return true
    })
    .map(formulaVar => ({
      ...formulaVar,
      name: String(formulaVar.name),
      formula: String(formulaVar.formula ?? ''),
    }))

  warnOnFiltered(label, filteredCount)
  return sanitized
}

function sanitizeResultsHL(rawResults: ResultsHL): ResultsHL {
  const safeResults = createEmptyResultsHL()

  Object.keys(safeResults).forEach(key => {
    const resultKey = key as keyof ResultsHL
    const entry = rawResults?.[resultKey]
    if (entry) {
      safeResults[resultKey] = {
        ...entry,
        sourceRef: typeof entry.sourceRef === 'string' ? entry.sourceRef : '',
      }
    }
  })

  return safeResults
}

function sanitizeAdditionalResults(rawResults: AdditionalResult[], label: string): AdditionalResult[] {
  let filteredCount = 0
  const sanitized = rawResults
    .filter(result => {
      if (typeof result?.id !== 'string' || typeof result?.key !== 'string' || typeof result?.sourceRef !== 'string') {
        filteredCount += 1
        return false
      }
      return true
    })
    .map(result => ({
      ...result,
      key: String(result.key),
      title: String(result.title ?? ''),
      sourceRef: String(result.sourceRef),
    }))

  warnOnFiltered(label, filteredCount)
  return sanitized
}

function sanitizeParametrValuesScheme(
  rawEntries: ParametrValuesSchemeEntry[],
  label: string
): ParametrValuesSchemeEntry[] {
  let filteredCount = 0
  const sanitized = rawEntries
    .filter(entry => {
      if (typeof entry?.id !== 'string') {
        filteredCount += 1
        return false
      }
      return true
    })
    .map(entry => ({
      ...entry,
      name: String(entry.name ?? ''),
      template: String(entry.template ?? ''),
    }))

  warnOnFiltered(label, filteredCount)
  return sanitized
}

function sanitizeIssues(rawIssues: ValidationIssue[], label: string): ValidationIssue[] {
  let filteredCount = 0
  const sanitized = rawIssues
    .filter(issue => {
      if (typeof issue?.message !== 'string') {
        filteredCount += 1
        return false
      }
      return true
    })
    .map(issue => ({
      ...issue,
      hint: typeof issue.hint === 'string' ? issue.hint : undefined,
    }))

  warnOnFiltered(label, filteredCount)
  return sanitized
}

function sanitizeInputsForRender(rawInputs: InputParam[]): InputParam[] {
  return rawInputs
    .filter(input => typeof input?.name === 'string')
    .map(input => ({
      ...input,
      name: String(input.name),
      sourcePath: String(input.sourcePath ?? ''),
    }))
}

function sanitizeVarsForRender(rawVars: FormulaVar[]): FormulaVar[] {
  return rawVars
    .filter(formulaVar => typeof formulaVar?.name === 'string')
    .map(formulaVar => ({
      ...formulaVar,
      name: String(formulaVar.name),
      formula: String(formulaVar.formula ?? ''),
    }))
}

function sanitizeResultsHLForRender(rawResults: ResultsHL): ResultsHL {
  const safeResults = createEmptyResultsHL()

  Object.keys(safeResults).forEach(key => {
    const resultKey = key as keyof ResultsHL
    const entry = rawResults?.[resultKey]
    if (entry) {
      safeResults[resultKey] = {
        ...entry,
        sourceRef: typeof entry.sourceRef === 'string' ? entry.sourceRef : '',
      }
    }
  })

  return safeResults
}

function sanitizeAdditionalResultsForRender(rawResults: AdditionalResult[]): AdditionalResult[] {
  return rawResults
    .filter(result => typeof result?.id === 'string')
    .map(result => ({
      ...result,
      key: typeof result.key === 'string' ? result.key : '',
      title: typeof result.title === 'string' ? result.title : String(result.title ?? ''),
      sourceRef: typeof result.sourceRef === 'string' ? result.sourceRef : '',
    }))
}

function sanitizeParametrValuesSchemeForRender(rawEntries: ParametrValuesSchemeEntry[]): ParametrValuesSchemeEntry[] {
  return rawEntries
    .filter(entry => typeof entry?.id === 'string')
    .map(entry => ({
      ...entry,
      name: typeof entry.name === 'string' ? entry.name : String(entry.name ?? ''),
      template: typeof entry.template === 'string' ? entry.template : String(entry.template ?? ''),
    }))
}

function sanitizeIssuesForRender(rawIssues: ValidationIssue[]): ValidationIssue[] {
  return rawIssues
    .filter(issue => typeof issue?.message === 'string')
    .map(issue => ({
      ...issue,
      hint: typeof issue.hint === 'string' ? issue.hint : undefined,
    }))
}

function hasInvalidInputs(rawInputs: InputParam[]): boolean {
  return rawInputs.some(input => typeof input?.name !== 'string')
}

function hasInvalidVars(rawVars: FormulaVar[]): boolean {
  return rawVars.some(formulaVar => typeof formulaVar?.name !== 'string')
}

function hasInvalidResultsHL(rawResults: ResultsHL): boolean {
  return Object.values(rawResults || {}).some(entry => entry && typeof entry.sourceRef !== 'string')
}

function hasInvalidAdditionalResults(rawResults: AdditionalResult[]): boolean {
  return rawResults.some(
    result =>
      typeof result?.id !== 'string' ||
      typeof result?.key !== 'string' ||
      typeof result?.sourceRef !== 'string'
  )
}

function hasInvalidParametrValuesScheme(rawEntries: ParametrValuesSchemeEntry[]): boolean {
  return rawEntries.some(entry => typeof entry?.id !== 'string')
}

function hasInvalidIssues(rawIssues: ValidationIssue[]): boolean {
  return rawIssues.some(
    issue =>
      typeof issue?.message !== 'string' ||
      (issue.hint !== undefined && issue.hint !== null && typeof issue.hint !== 'string')
  )
}

class CalculationLogicErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[calcconfig] Calculation logic render error', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-sm text-destructive">
          Произошла ошибка при отображении логики расчёта. Попробуйте обновить страницу или
          пересоздать вкладку.
        </div>
      )
    }
    return this.props.children
  }
}

class DiagnosticErrorBoundary extends Component<
  { label: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`[calcconfig] ${this.props.label} render error`, error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-xs text-destructive">
          Ошибка рендера в секции: {this.props.label}
        </div>
      )
    }
    return this.props.children
  }
}

function findWindowPaths(value: unknown, maxDepth = 6): string[] {
  if (typeof window === 'undefined') return []
  const target = window
  const seen = new Set<unknown>()
  const results: string[] = []

  const visit = (current: unknown, path: string, depth: number) => {
    if (depth > maxDepth || results.length > 20) return
    if (current === target) {
      results.push(path)
      return
    }
    if (!current || typeof current !== 'object') return
    if (seen.has(current)) return
    seen.add(current)

    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1))
      return
    }

    Object.entries(current as Record<string, unknown>).forEach(([key, val]) => {
      visit(val, `${path}.${key}`, depth + 1)
    })
  }

  visit(value, 'root', 0)
  return results
}

function sanitizeContextValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return null
  if (typeof window !== 'undefined' && value === window) return null
  if (typeof document !== 'undefined' && value === document) return null
  if (typeof value === 'function') return null
  if (value === null || value === undefined) return value

  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') return value

  if (Array.isArray(value)) {
    return value.map(item => sanitizeContextValue(item, depth + 1)).filter(item => item !== null)
  }

  const tag = Object.prototype.toString.call(value)
  if (tag !== '[object Object]') {
    return String(value)
  }

  const sanitized: Record<string, unknown> = {}
  Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
    const next = sanitizeContextValue(val, depth + 1)
    if (next !== null) sanitized[key] = next
  })
  return sanitized
}

/**
 * Safely extracts and sanitizes the logic context for rendering in OutputsTab.
 * This function ensures that the offerModel prop receives only serializable data.
 * 
 * @param logicContext - The raw logic context that may contain non-serializable data
 * @returns An object with a safely extracted offer property, or null if invalid
 */
function sanitizeLogicContextForRender(logicContext: unknown): { offer: unknown } | null {
  if (!logicContext || typeof logicContext !== 'object') {
    return null
  }
  
  // Safely access the offer property
  const contextObj = logicContext as Record<string, unknown>
  if (!('offer' in contextObj)) {
    return null
  }
  
  const offer = contextObj.offer
  
  // Validate that offer is a plain object or null/undefined
  if (offer === null || offer === undefined) {
    return { offer: null }
  }
  
  if (typeof offer !== 'object') {
    return null
  }
  
  // Additional check to ensure offer is a plain object and not a DOM node or other non-serializable object
  const tag = Object.prototype.toString.call(offer)
  if (tag !== '[object Object]') {
    return null
  }
  
  // Sanitize the offer object to remove non-serializable properties
  const sanitizedOffer = sanitizeContextValue(offer)
  
  return { offer: sanitizedOffer }
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
  currentDetailId?: number | null
  currentBindingId?: number | null
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
  currentDetailId,
  currentBindingId,
  onSaveRequest,
}: CalculationLogicDialogProps) {
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true)
  const [helpAccordionValues, setHelpAccordionValues] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('inputs')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showJsonTree, setShowJsonTree] = useState(false) // false = ContextExplorer, true = JsonTree

  // State for help dialog
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [helpPlaceCode, setHelpPlaceCode] = useState('')
  const [helpTitle, setHelpTitle] = useState('')

  // State for active input selection (for path editing)
  const [activeInputId, setActiveInputId] = useState<string | null>(null)
  
  // State for newly added input animation
  const [newlyAddedInputId, setNewlyAddedInputId] = useState<string | null>(null)
  
  // State for cursor position tracking (for formula insertion)
  const [lastTextareaFocus, setLastTextareaFocus] = useState<{
    varId: string
    cursorPosition: number
  } | null>(null)
  const [lastTemplateFocus, setLastTemplateFocus] = useState<{
    entryId: string
    cursorPosition: number
  } | null>(null)

  // State for logic editing
  const [inputs, setInputs] = useState<InputParam[]>([])
  const [vars, setVars] = useState<FormulaVar[]>([])
  const [resultsHL, setResultsHL] = useState<ResultsHL>(createEmptyResultsHL())
  const [writePlan, setWritePlan] = useState<WritePlanItem[]>([])
  const [additionalResults, setAdditionalResults] = useState<AdditionalResult[]>([])
  const [parametrValuesScheme, setParametrValuesScheme] = useState<ParametrValuesSchemeEntry[]>([])
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const previousInputsRef = useRef<InputParam[]>([])
  const previousVarsRef = useRef<FormulaVar[]>([])

  const globalParametrNames = useMemo(() => {
    const names = new Set<string>()
    const stages = initPayload?.elementsStore?.CALC_STAGES || []
    stages.forEach(stage => {
      const schemeValues = stage?.properties?.SCHEME_PARAMETR_VALUES?.VALUE
      if (Array.isArray(schemeValues)) {
        schemeValues.forEach((value: unknown) => {
          const name = String(value ?? '').trim()
          if (name) names.add(name)
        })
      }
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [initPayload])

  const logicContext = useMemo(() => buildLogicContext(initPayload), [initPayload])


  const inputsForRender = useMemo(() => sanitizeInputsForRender(inputs), [inputs])
  const varsForRender = useMemo(() => sanitizeVarsForRender(vars), [vars])
  const resultsHLForRender = useMemo(() => sanitizeResultsHLForRender(resultsHL), [resultsHL])
  const additionalResultsForRender = useMemo(
    () => sanitizeAdditionalResultsForRender(additionalResults),
    [additionalResults]
  )
  const parametrValuesSchemeForRender = useMemo(
    () => sanitizeParametrValuesSchemeForRender(parametrValuesScheme),
    [parametrValuesScheme]
  )
  const validationIssuesForRender = useMemo(
    () => sanitizeIssuesForRender(validationIssues),
    [validationIssues]
  )

  const logicContextForRender = useMemo(
    () => sanitizeContextValue(logicContext),
    [logicContext]
  )

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
      setParametrValuesScheme([])
      return
    }
    
    const draftKey = getDraftKey(currentStageId, currentSettingsId)
    
    // Load data from INIT first
    const settingsElement = initPayload?.elementsStore?.CALC_SETTINGS?.find(
      s => s.id === currentSettingsId
    )
    const stageElement = initPayload?.elementsStore?.CALC_STAGES?.find(
      s => s.id === currentStageId
    )
    
    let savedInputs: InputParam[] = []
    let savedVars: FormulaVar[] = []
    let savedResultsHL: ResultsHL = createEmptyResultsHL()
    let savedAdditionalResults: AdditionalResult[] = []
    let savedParametrValuesScheme: ParametrValuesSchemeEntry[] = []
    
    if (settingsElement || stageElement) {
      // Build inputs from PARAMS + INPUTS
      const paramsValue = settingsElement?.properties?.PARAMS?.VALUE as string[] | undefined
      const paramsDesc = settingsElement?.properties?.PARAMS?.DESCRIPTION as string[] | undefined
      const inputsValue = stageElement?.properties?.INPUTS?.VALUE as string[] | undefined
      const inputsDesc = stageElement?.properties?.INPUTS?.DESCRIPTION as string[] | undefined
      savedInputs = sanitizeInputs(
        buildInputsFromInit(paramsValue, paramsDesc, inputsValue, inputsDesc),
        'init inputs'
      )
      
      // Build vars from LOGIC_JSON (pass entire property object for proper parsing)
      const logicJsonProp = settingsElement?.properties?.LOGIC_JSON
      savedVars = sanitizeVars(buildVarsFromInit(logicJsonProp), 'init vars')
      
      // Build results from OUTPUTS
      const outputsValue = stageElement?.properties?.OUTPUTS?.VALUE as string[] | undefined
      const outputsDesc = stageElement?.properties?.OUTPUTS?.DESCRIPTION as string[] | undefined
      const inputNames = savedInputs.map(inp => inp.name)
      const results = buildResultsFromInit(outputsValue, outputsDesc, inputNames)
      savedResultsHL = sanitizeResultsHL(results.resultsHL)
      savedAdditionalResults = sanitizeAdditionalResults(results.additionalResults, 'init additionalResults')

      const schemeValue = stageElement?.properties?.SCHEME_PARAMETR_VALUES?.VALUE as string[] | undefined
      const schemeDescription = stageElement?.properties?.SCHEME_PARAMETR_VALUES?.DESCRIPTION as string[] | undefined
      savedParametrValuesScheme = sanitizeParametrValuesScheme(
        buildParametrValuesSchemeFromInit(schemeValue, schemeDescription),
        'init parametrValuesScheme'
      )
    }
    
    // Try localStorage draft
    const draftJson = localStorage.getItem(draftKey)
    if (draftJson) {
      try {
        const parsed = JSON.parse(draftJson)
        const rawDraftInputs = Array.isArray(parsed?.inputs) ? parsed.inputs : []
        const rawDraftVars = Array.isArray(parsed?.vars) ? parsed.vars : []
        const rawDraftResultsHL = parsed?.resultsHL || createEmptyResultsHL()
        const rawDraftAdditionalResults = Array.isArray(parsed?.additionalResults) ? parsed.additionalResults : []
        const rawDraftParametrValuesScheme = Array.isArray(parsed?.parametrValuesScheme) ? parsed.parametrValuesScheme : []
        const rawDraftIssues = Array.isArray(parsed?.issues) ? parsed.issues : []

        const hasInvalidDraft =
          hasInvalidInputs(rawDraftInputs) ||
          hasInvalidVars(rawDraftVars) ||
          hasInvalidResultsHL(rawDraftResultsHL) ||
          hasInvalidAdditionalResults(rawDraftAdditionalResults) ||
          hasInvalidParametrValuesScheme(rawDraftParametrValuesScheme) ||
          hasInvalidIssues(rawDraftIssues)

        if (hasInvalidDraft) {
          console.warn('Ignoring invalid draft data for calculation logic', { draftKey })
          localStorage.removeItem(draftKey)
          setInputs(savedInputs)
          setVars(savedVars)
          setResultsHL(savedResultsHL)
          setAdditionalResults(savedAdditionalResults)
          setParametrValuesScheme(savedParametrValuesScheme)
          setWritePlan([])
          return
        }

        const draftInputs = sanitizeInputs(
          rawDraftInputs,
          'draft inputs'
        )
        const draftVars = sanitizeVars(
          rawDraftVars,
          'draft vars'
        )
        const draftResultsHL = sanitizeResultsHL(rawDraftResultsHL)
        const draftAdditionalResults = sanitizeAdditionalResults(
          rawDraftAdditionalResults,
          'draft additionalResults'
        )
        const draftParametrValuesScheme = sanitizeParametrValuesScheme(
          rawDraftParametrValuesScheme,
          'draft parametrValuesScheme'
        )
        
        // Compare draft with saved data from INIT
        const draftStateJson = JSON.stringify({
          inputs: draftInputs,
          vars: draftVars,
          resultsHL: draftResultsHL,
          additionalResults: draftAdditionalResults,
          parametrValuesScheme: draftParametrValuesScheme
        })
        const savedStateJson = JSON.stringify({
          inputs: savedInputs,
          vars: savedVars,
          resultsHL: savedResultsHL,
          additionalResults: savedAdditionalResults,
          parametrValuesScheme: savedParametrValuesScheme
        })
        
        if (draftStateJson === savedStateJson) {
          // Draft matches INIT data, remove it
          localStorage.removeItem(draftKey)
          setInputs(savedInputs)
          setVars(savedVars)
          setResultsHL(savedResultsHL)
          setAdditionalResults(savedAdditionalResults)
          setParametrValuesScheme(savedParametrValuesScheme)
          setWritePlan([])
        } else {
          // Draft has changes, use it
          setInputs(draftInputs)
          setVars(draftVars)
          setResultsHL(draftResultsHL)
          setWritePlan(Array.isArray(parsed?.writePlan) ? parsed.writePlan : [])
          setAdditionalResults(draftAdditionalResults)
          setParametrValuesScheme(draftParametrValuesScheme)
        }
        return
      } catch (e) {
        console.warn('Failed to parse draft', e)
        localStorage.removeItem(draftKey)
      }
    }
    
    // Use data from INIT
    setInputs(savedInputs)
    setVars(savedVars)
    setResultsHL(savedResultsHL)
    setAdditionalResults(savedAdditionalResults)
    setParametrValuesScheme(savedParametrValuesScheme)
    setWritePlan([])  // writePlan deprecated
  }, [open, currentStageId, currentSettingsId, initPayload])

  // Save to draft on any change - only if isDirty
  useEffect(() => {
    if (open && currentStageId !== null && currentStageId !== undefined &&
        currentSettingsId !== null && currentSettingsId !== undefined) {
      const draftKey = getDraftKey(currentStageId, currentSettingsId)
      
      // Check if there are actual changes before saving draft
        const currentState = JSON.stringify({
          version: 1,
          inputs,
          vars,
          resultsHL,
          additionalResults,
          parametrValuesScheme
        })
      
      const getSavedState = () => {
        if (!initPayload?.elementsStore) {
          return JSON.stringify({
            version: 1,
            inputs: [],
            vars: [],
            resultsHL: createEmptyResultsHL(),
            additionalResults: [],
            parametrValuesScheme: []
          })
        }
        
        const settingsElement = initPayload.elementsStore?.CALC_SETTINGS?.find(
          s => s.id === currentSettingsId
        )
        const stageElement = initPayload.elementsStore?.CALC_STAGES?.find(
          s => s.id === currentStageId
        )
        
        const paramsValue = settingsElement?.properties?.PARAMS?.VALUE as string[] | undefined
        const paramsDesc = settingsElement?.properties?.PARAMS?.DESCRIPTION as string[] | undefined
        const inputsValue = stageElement?.properties?.INPUTS?.VALUE as string[] | undefined
        const inputsDesc = stageElement?.properties?.INPUTS?.DESCRIPTION as string[] | undefined
        const savedInputs = sanitizeInputs(
          buildInputsFromInit(paramsValue, paramsDesc, inputsValue, inputsDesc),
          'init inputs'
        )
        
        const logicJsonProp = settingsElement?.properties?.LOGIC_JSON
        const savedVars = sanitizeVars(buildVarsFromInit(logicJsonProp), 'init vars')
        
        const outputsValue = stageElement?.properties?.OUTPUTS?.VALUE as string[] | undefined
        const outputsDesc = stageElement?.properties?.OUTPUTS?.DESCRIPTION as string[] | undefined
        const inputNames = savedInputs.map(inp => inp.name)
        const { resultsHL: rawResultsHL, additionalResults: rawAdditionalResults } = buildResultsFromInit(
          outputsValue,
          outputsDesc,
          inputNames
        )
        const savedResultsHL = sanitizeResultsHL(rawResultsHL)
        const savedAdditionalResults = sanitizeAdditionalResults(rawAdditionalResults, 'init additionalResults')

        const schemeValue = stageElement?.properties?.SCHEME_PARAMETR_VALUES?.VALUE as string[] | undefined
        const schemeDescription = stageElement?.properties?.SCHEME_PARAMETR_VALUES?.DESCRIPTION as string[] | undefined
        const savedParametrValuesScheme = sanitizeParametrValuesScheme(
          buildParametrValuesSchemeFromInit(schemeValue, schemeDescription),
          'init parametrValuesScheme'
        )
        
        return JSON.stringify({
          version: 1,
          inputs: savedInputs,
          vars: savedVars,
          resultsHL: savedResultsHL,
          additionalResults: savedAdditionalResults,
          parametrValuesScheme: savedParametrValuesScheme
        })
      }
      
      const savedState = getSavedState()
      
      // Only save draft if there are actual changes
      if (currentState !== savedState) {
        const draft = {
          version: 1,
          stageIndex,
          inputs,
          vars,
          resultsHL,
          writePlan,
          additionalResults,
          parametrValuesScheme
        }
        localStorage.setItem(draftKey, JSON.stringify(draft))
      } else {
        // Remove draft if no changes
        localStorage.removeItem(draftKey)
      }
    }
  }, [inputs, vars, resultsHL, writePlan, additionalResults, parametrValuesScheme, open, currentStageId, currentSettingsId, stageIndex, initPayload])

  // Handler for tab changes with automatic panel switching
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    
    if (tab === 'inputs') {
      setLeftPanelCollapsed(false)  // Open Context
      setRightPanelCollapsed(true)  // Close Help
      setHelpAccordionValues([])
      setLastTextareaFocus(null)
      setLastTemplateFocus(null)
    } else if (tab === 'formulas') {
      setLeftPanelCollapsed(true)   // Close Context
      setRightPanelCollapsed(false) // Open Help
      setHelpAccordionValues(['syntax', 'functions'])
      setLastTemplateFocus(null)
    } else if (tab === 'outputs') {
      const toType = (value: unknown) => Object.prototype.toString.call(value)
      const toKeys = (value: unknown) =>
        value && typeof value === 'object' ? Object.keys(value as Record<string, unknown>) : []

      console.groupCollapsed('[calcconfig][diagnostic] outputs tab render snapshot')
      console.log('stageIndex', stageIndex)
      console.log('stageName', toType(stageName), stageName)
      console.log('calculatorName', toType(calculatorName), calculatorName)
      console.log('inputs[0].name', toType(inputs?.[0]?.name), inputs?.[0]?.name)
      console.log('vars[0].name', toType(vars?.[0]?.name), vars?.[0]?.name)
      console.log('resultsHL', toType(resultsHL), toKeys(resultsHL))
      console.log('resultsHL.width.sourceRef', toType(resultsHL?.width?.sourceRef), resultsHL?.width?.sourceRef)
      console.log('additionalResults[0]', toType(additionalResults?.[0]), toKeys(additionalResults?.[0]))
      console.log('additionalResults[0].key', toType(additionalResults?.[0]?.key), additionalResults?.[0]?.key)
      console.log('parametrValuesScheme[0]', toType(parametrValuesScheme?.[0]), toKeys(parametrValuesScheme?.[0]))
      console.log('issues[0]', toType(validationIssues?.[0]), toKeys(validationIssues?.[0]))
      console.log('issues[0].message', toType(validationIssues?.[0]?.message), validationIssues?.[0]?.message)
      console.log('issues[0].hint', toType(validationIssues?.[0]?.hint), validationIssues?.[0]?.hint)
      console.log('logicContext', toType(logicContext), toKeys(logicContext))
      console.log('logicContext.windowPaths', findWindowPaths(logicContext))
      console.groupEnd()

      setLeftPanelCollapsed(true)   // Close Context
      setRightPanelCollapsed(false) // Open Help
      setHelpAccordionValues(['params-vars'])
      setLastTextareaFocus(null)
    }
  }

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  useEffect(() => {
    const previousInputs = previousInputsRef.current

    if (previousInputs.length === 0) {
      previousInputsRef.current = inputs
      return
    }

    const renames = inputs.reduce<Array<{ from: string; to: string }>>((acc, input) => {
      const previous = previousInputs.find(prev => prev.id === input.id)
      if (previous && previous.name !== input.name) {
        acc.push({ from: previous.name, to: input.name })
      }
      return acc
    }, [])

    if (renames.length === 0) {
      previousInputsRef.current = inputs
      return
    }

    const replaceInFormula = (formula: string) =>
      renames.reduce((current, rename) => {
        const regex = new RegExp(`\\b${escapeRegExp(rename.from)}\\b`, 'g')
        return current.replace(regex, rename.to)
      }, formula)

    setVars(prevVars => {
      let hasChanges = false
      const nextVars = prevVars.map(variable => {
        const updatedFormula = replaceInFormula(variable.formula)
        if (updatedFormula !== variable.formula) {
          hasChanges = true
          return { ...variable, formula: updatedFormula }
        }
        return variable
      })
      return hasChanges ? nextVars : prevVars
    })

    setResultsHL(prevResults => {
      let hasChanges = false
      const nextResults = { ...prevResults }
      ;(Object.keys(nextResults) as Array<keyof ResultsHL>).forEach(key => {
        const mapping = nextResults[key]
        if (mapping.sourceKind !== 'input') return
        const rename = renames.find(item => item.from === mapping.sourceRef)
        if (rename) {
          hasChanges = true
          nextResults[key] = { ...mapping, sourceRef: rename.to }
        }
      })
      return hasChanges ? nextResults : prevResults
    })

    setAdditionalResults(prevResults => {
      let hasChanges = false
      const nextResults = prevResults.map(result => {
        if (result.sourceKind !== 'input') {
          return result
        }
        const rename = renames.find(item => item.from === result.sourceRef)
        if (!rename) {
          return result
        }
        hasChanges = true
        return { ...result, sourceRef: rename.to }
      })
      return hasChanges ? nextResults : prevResults
    })

    setParametrValuesScheme(prevScheme => {
      let hasChanges = false
      const nextScheme = prevScheme.map(entry => {
        const updatedTemplate = replaceInFormula(entry.template)
        if (updatedTemplate !== entry.template) {
          hasChanges = true
          return { ...entry, template: updatedTemplate }
        }
        return entry
      })
      return hasChanges ? nextScheme : prevScheme
    })

    previousInputsRef.current = inputs
  }, [inputs])

  useEffect(() => {
    const previousVars = previousVarsRef.current

    if (previousVars.length === 0) {
      previousVarsRef.current = vars
      return
    }

    const renames = vars.reduce<Array<{ from: string; to: string }>>((acc, variable) => {
      const previous = previousVars.find(prev => prev.id === variable.id)
      if (previous && previous.name !== variable.name) {
        acc.push({ from: previous.name, to: variable.name })
      }
      return acc
    }, [])

    if (renames.length === 0) {
      previousVarsRef.current = vars
      return
    }

    const replaceInText = (text: string) =>
      renames.reduce((current, rename) => {
        const regex = new RegExp(`\\b${escapeRegExp(rename.from)}\\b`, 'g')
        return current.replace(regex, rename.to)
      }, text)

    setVars(prevVars => {
      let hasChanges = false
      const nextVars = prevVars.map(variable => {
        const updatedFormula = replaceInText(variable.formula)
        if (updatedFormula !== variable.formula) {
          hasChanges = true
          return { ...variable, formula: updatedFormula }
        }
        return variable
      })
      return hasChanges ? nextVars : prevVars
    })

    setResultsHL(prevResults => {
      let hasChanges = false
      const nextResults = { ...prevResults }
      ;(Object.keys(nextResults) as Array<keyof ResultsHL>).forEach(key => {
        const mapping = nextResults[key]
        if (mapping.sourceKind !== 'var') return
        const rename = renames.find(item => item.from === mapping.sourceRef)
        if (rename) {
          hasChanges = true
          nextResults[key] = { ...mapping, sourceRef: rename.to }
        }
      })
      return hasChanges ? nextResults : prevResults
    })

    setAdditionalResults(prevResults => {
      let hasChanges = false
      const nextResults = prevResults.map(result => {
        if (result.sourceKind !== 'var') {
          return result
        }
        const rename = renames.find(item => item.from === result.sourceRef)
        if (!rename) {
          return result
        }
        hasChanges = true
        return { ...result, sourceRef: rename.to }
      })
      return hasChanges ? nextResults : prevResults
    })

    setParametrValuesScheme(prevScheme => {
      let hasChanges = false
      const nextScheme = prevScheme.map(entry => {
        const updatedTemplate = replaceInText(entry.template)
        if (updatedTemplate !== entry.template) {
          hasChanges = true
          return { ...entry, template: updatedTemplate }
        }
        return entry
      })
      return hasChanges ? nextScheme : prevScheme
    })

    previousVarsRef.current = vars
  }, [vars])

  // Auto-update inferred types for vars when inputs or formulas change
  useEffect(() => {
    if (!open) return
    
    // Build symbol table from inputs
    const symbolTable = new Map<string, ValueType>()
    for (const input of inputs) {
      const inferred = inferTypeFromSourcePath(input.sourcePath)
      const type = input.valueType || inferred.type
      symbolTable.set(input.name, type)
    }
    
    // Update vars with inferred types
    let hasChanges = false
    const varsWithTypes = vars.map(v => {
      if (v.formula.trim()) {
        const typeResult = inferType(v.formula, symbolTable)
        symbolTable.set(v.name, typeResult.type)
        
        // Check if type changed
        if (v.inferredType !== typeResult.type) {
          hasChanges = true
          return { ...v, inferredType: typeResult.type }
        }
        return v
      }
      
      // Check if unknown type needs to be set
      if (v.inferredType !== 'unknown') {
        hasChanges = true
      }
      symbolTable.set(v.name, 'unknown')
      return { ...v, inferredType: 'unknown' as ValueType }
    })
    
    // Only update state if there were actual changes
    if (hasChanges) {
      setVars(varsWithTypes)
    }
  }, [inputs, vars, open])

  // Computed values for dirty state
  // Current state as JSON
  const currentStateJson = JSON.stringify({
    version: 1,
    inputs,
    vars,
    resultsHL,
    additionalResults
  })

  // Saved state from INIT as JSON (for comparison)
  const getSavedStateJson = (): string => {
    if (!currentSettingsId || !currentStageId || !initPayload) {
      return JSON.stringify({
        version: 1,
        inputs: [],
        vars: [],
        resultsHL: createEmptyResultsHL(),
        additionalResults: []
      })
    }
    
    const settingsElement = initPayload.elementsStore?.CALC_SETTINGS?.find(
      s => s.id === currentSettingsId
    )
    const stageElement = initPayload.elementsStore?.CALC_STAGES?.find(
      s => s.id === currentStageId
    )
    
    // Build saved state from INIT
    const paramsValue = settingsElement?.properties?.PARAMS?.VALUE as string[] | undefined
    const paramsDesc = settingsElement?.properties?.PARAMS?.DESCRIPTION as string[] | undefined
    const inputsValue = stageElement?.properties?.INPUTS?.VALUE as string[] | undefined
    const inputsDesc = stageElement?.properties?.INPUTS?.DESCRIPTION as string[] | undefined
    const savedInputs = buildInputsFromInit(paramsValue, paramsDesc, inputsValue, inputsDesc)
    
    const logicJsonProp = settingsElement?.properties?.LOGIC_JSON
    const savedVars = buildVarsFromInit(logicJsonProp)
    
    const outputsValue = stageElement?.properties?.OUTPUTS?.VALUE as string[] | undefined
    const outputsDesc = stageElement?.properties?.OUTPUTS?.DESCRIPTION as string[] | undefined
    const { resultsHL: savedResultsHL, additionalResults: savedAdditionalResults } = buildResultsFromInit(outputsValue, outputsDesc)
    
    return JSON.stringify({
      version: 1,
      inputs: savedInputs,
      vars: savedVars,
      resultsHL: savedResultsHL,
      additionalResults: savedAdditionalResults
    })
  }
  
  // Compare current state with saved state from INIT
  const isDirty = currentStateJson !== getSavedStateJson()
  const hasErrors = validationIssues.some(i => i.severity === 'error')

  // Show current and previous stages only
  const visibleStages = allStages.slice(0, stageIndex + 1)

  // Build context for the left panel (without selectedOffers)

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
    handleTabChange('inputs')
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
  
  const handleContextExplorerAddInput = (path: string, name: string, valueType: ValueType) => {
    // If there's an active input, update its path
    if (activeInputId) {
      setInputs(inputs.map(inp => {
        if (inp.id === activeInputId) {
          return {
            ...inp,
            sourcePath: path,
            sourceType: 'context' as any,
            valueType: valueType !== 'unknown' ? valueType : inp.valueType,
            typeSource: 'auto',
            autoTypeReason: 'From ContextExplorer'
          }
        }
        return inp
      }))
      setActiveInputId(null)
      toast.success('Путь параметра обновлён')
      return
    }
    
    // Ensure name is unique
    let uniqueName = name
    let counter = 1
    while (inputs.some(inp => inp.name === uniqueName)) {
      uniqueName = `${name}_${counter}`
      counter++
    }
    
    const newInput: InputParam = {
      id: `input_${Date.now()}`,
      name: uniqueName,
      sourcePath: path,
      sourceType: 'context' as any,
      valueType: valueType !== 'unknown' ? valueType : undefined,
      typeSource: 'auto',
      autoTypeReason: 'From ContextExplorer'
    }
    
    setInputs([...inputs, newInput])
    handleTabChange('inputs')
    setNewlyAddedInputId(newInput.id)
    toast.success(`Параметр "${uniqueName}" добавлен`)
  }
  
  const handleInsertIntoFormula = (text: string) => {
    if (lastTemplateFocus) {
      const { entryId, cursorPosition } = lastTemplateFocus

      setParametrValuesScheme(prevScheme =>
        prevScheme.map(entry => {
          if (entry.id !== entryId) return entry
          const before = entry.template.slice(0, cursorPosition)
          const after = entry.template.slice(cursorPosition)
          const insertText = `{${text}}`
          return { ...entry, template: before + insertText + after }
        })
      )

      setLastTemplateFocus(null)
      toast.success(`"{${text}}" вставлен в шаблон`)
      return
    }

    if (lastTextareaFocus) {
      // Insert into saved position
      const { varId, cursorPosition } = lastTextareaFocus
      
      setVars(prevVars =>
        prevVars.map(v => {
          if (v.id === varId) {
            const before = v.formula.slice(0, cursorPosition)
            const after = v.formula.slice(cursorPosition)
            const insertText = text
            return { ...v, formula: before + insertText + after }
          }
          return v
        })
      )
      
      // Reset after insertion
      setLastTextareaFocus(null)
      toast.success(`"${text}" вставлен в формулу`)
    } else {
      // Copy to clipboard without spaces
      navigator.clipboard.writeText(text)
      toast.success(`"${text}" скопирован в буфер обмена`)
    }
  }

  const handleCopyInputParams = () => {
    const text = inputs.map(input => input.name).join(', ')
    navigator.clipboard.writeText(text)
    toast.success('Названия входных параметров скопированы')
  }

  const handleCopyVars = () => {
    const text = vars.map(variable => variable.name).join(', ')
    navigator.clipboard.writeText(text)
    toast.success('Названия переменных скопированы')
  }

  const handleCopyFormulas = () => {
    const text = vars.map(variable => `${variable.name} = ${variable.formula}`).join('\n\n')
    navigator.clipboard.writeText(text)
    toast.success('Названия переменных и формулы скопированы')
  }

  const handleOpenHelp = (placeCode: string, title: string) => {
    setHelpPlaceCode(placeCode)
    setHelpTitle(title)
    setHelpDialogOpen(true)
  }

  const handleValidate = () => {
    const result = validateAll(inputs, vars, stageIndex, [], resultsHL, writePlan, additionalResults)
    setValidationIssues(sanitizeIssues(result.issues, 'validation issues'))
    
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
    setValidationIssues(sanitizeIssues(result.issues, 'validation issues'))
    
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
    
    const parametrValuesPayload = parametrValuesScheme
      .filter(entry => entry.name.trim() || entry.template.trim())
      .map(entry => ({
        name: entry.name.trim(),
        template: entry.template.trim(),
      }))
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
      },
      stageParametrValuesScheme: {
        offer: parametrValuesPayload,
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
      const logicJsonProp = settingsElement?.properties?.LOGIC_JSON
      const vars = buildVarsFromInit(logicJsonProp)
      
      // Build results from OUTPUTS
      const outputsValue = stageElement?.properties?.OUTPUTS?.VALUE as string[] | undefined
      const outputsDesc = stageElement?.properties?.OUTPUTS?.DESCRIPTION as string[] | undefined
      const inputNames = inputs.map(inp => inp.name)
      const { resultsHL, additionalResults } = buildResultsFromInit(outputsValue, outputsDesc, inputNames)

      const schemeValue = stageElement?.properties?.SCHEME_PARAMETR_VALUES?.VALUE as string[] | undefined
      const schemeDescription = stageElement?.properties?.SCHEME_PARAMETR_VALUES?.DESCRIPTION as string[] | undefined
      const savedParametrValuesScheme = buildParametrValuesSchemeFromInit(schemeValue, schemeDescription)
      
      setInputs(inputs)
      setVars(vars)
      setResultsHL(resultsHL)
      setAdditionalResults(additionalResults)
      setParametrValuesScheme(savedParametrValuesScheme)
      setWritePlan([])  // deprecated
    } else {
      // Reset to empty
      setInputs([])
      setVars([])
      setResultsHL(createEmptyResultsHL())
      setWritePlan([])
      setAdditionalResults([])
      setParametrValuesScheme([])
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
        <CalculationLogicErrorBoundary>
          {/* Fixed Header */}
          <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold">
                  Логика расчёта
                </DialogTitle>
                {(() => {
                  const safeStageName = safeRenderString(stageName)
                  const safeCalculatorName = safeRenderString(calculatorName)
                  return (
                <p className="text-sm text-muted-foreground mt-1">
                    Этап #{stageIndex + 1}{safeStageName ? `: ${safeStageName}` : ''} • Калькулятор: {safeCalculatorName || 'Не выбран'}
                </p>
                  )
                })()}
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
              <div className="w-80 border-r border-border flex flex-col h-full">
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
                
                {/* Container with content - FIXED */}
                <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
                  {/* Main content with scroll */}
                  <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                    {showJsonTree ? (
                      logicContext ? (
                        <div className="p-4" data-pwcode="logic-context-tree">
                        <JsonTree
                          data={logicContextForRender}
                            onLeafClick={handleLeafClick}
                            isPathDisabled={isPathDisabled}
                          />
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground p-4">
                          Нет данных контекста
                        </div>
                      )
                    ) : (
                      <div className="p-4" data-pwcode="logic-context-tree">
                      <ContextExplorer
                        initPayload={logicContextForRender as InitPayload}
                          currentStageId={currentStageId}
                          currentDetailId={currentDetailId}
                          currentBindingId={currentBindingId}
                          onAddInput={handleContextExplorerAddInput}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Toggle button - always at bottom */}
                  <div className="flex-shrink-0 p-2 bg-background border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setShowJsonTree(!showJsonTree)}
                    >
                      {showJsonTree ? 'Скрыть дополнительные данные' : 'Показать дополнительные данные'}
                    </Button>
                  </div>
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
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-border flex-shrink-0">
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
                <div className="flex-1 min-h-0 overflow-hidden">
                  <TabsContent value="inputs" className="h-full m-0 p-0">
                    <ScrollArea className="h-full">
                    <DiagnosticErrorBoundary label="inputs-tab">
                      <InputsTab 
                        inputs={inputsForRender} 
                        onChange={setInputs} 
                        issues={validationIssuesForRender}
                        activeInputId={activeInputId}
                        onInputSelect={setActiveInputId}
                        newlyAddedId={newlyAddedInputId}
                        onNewlyAddedIdChange={setNewlyAddedInputId}
                      />
                    </DiagnosticErrorBoundary>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="formulas" className="h-full m-0 p-0">
                    <ScrollArea className="h-full">
                    <DiagnosticErrorBoundary label="formulas-tab">
                      <FormulasTab 
                        inputs={inputsForRender} 
                        vars={varsForRender} 
                        onChange={setVars}
                        stageIndex={stageIndex}
                        issues={validationIssuesForRender}
                        onTextareaFocus={(varId, cursorPosition) => {
                          setLastTextareaFocus({ varId, cursorPosition })
                          setLastTemplateFocus(null)
                        }}
                        onTextareaBlur={() => setLastTextareaFocus(null)}
                      />
                    </DiagnosticErrorBoundary>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="outputs" className="h-full m-0 p-0">
                    <ScrollArea className="h-full">
                    <DiagnosticErrorBoundary label="outputs-tab">
                      <OutputsTab 
                        vars={varsForRender}
                        inputs={inputsForRender}
                        resultsHL={resultsHLForRender}
                        additionalResults={additionalResultsForRender}
                        onResultsHLChange={setResultsHL}
                        onAdditionalResultsChange={setAdditionalResults}
                        issues={validationIssuesForRender}
                      offerModel={sanitizeLogicContextForRender(logicContext)?.offer ?? null}
                        parametrValuesScheme={parametrValuesSchemeForRender}
                        onParametrValuesSchemeChange={setParametrValuesScheme}
                        parametrNamesPool={globalParametrNames}
                        onTemplateFocus={(entryId, cursorPosition) => {
                          setLastTemplateFocus({ entryId, cursorPosition })
                          setLastTextareaFocus(null)
                        }}
                      />
                    </DiagnosticErrorBoundary>
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* Right Panel - Help (Collapsible, Collapsed by Default) */}
            {!rightPanelCollapsed && (
              <div className="w-80 border-l border-border flex flex-col overflow-hidden h-full">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
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
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <DiagnosticErrorBoundary label="help-panel">
                      <Accordion
                        type="multiple"
                        value={helpAccordionValues}
                        onValueChange={setHelpAccordionValues}
                      >
                        {/* Syntax Section */}
                        <AccordionItem value="syntax">
                          <AccordionTrigger className="text-sm font-medium">Синтаксис</AccordionTrigger>
                          <AccordionContent>
                            <TooltipProvider delayDuration={200}>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  {
                                    label: 'number',
                                    insertText: 'number',
                                    description: 'Числовой тип данных.',
                                    example: 'Пример: 10, 3.14'
                                  },
                                  {
                                    label: 'string',
                                    insertText: 'string',
                                    description: 'Строковый тип данных.',
                                    example: 'Пример: "Привет"'
                                  },
                                  {
                                    label: 'boolean',
                                    insertText: 'boolean',
                                    description: 'Логический тип данных (true/false).',
                                    example: 'Пример: true'
                                  },
                                  {
                                    label: '==',
                                    insertText: '==',
                                    description: 'Проверка равенства.',
                                    example: 'Пример: a == b'
                                  },
                                  {
                                    label: '!=',
                                    insertText: '!=',
                                    description: 'Проверка неравенства.',
                                    example: 'Пример: a != b'
                                  },
                                  {
                                    label: '>',
                                    insertText: '>',
                                    description: 'Больше.',
                                    example: 'Пример: a > b'
                                  },
                                  {
                                    label: '<',
                                    insertText: '<',
                                    description: 'Меньше.',
                                    example: 'Пример: a < b'
                                  },
                                  {
                                    label: '>=',
                                    insertText: '>=',
                                    description: 'Больше либо равно.',
                                    example: 'Пример: a >= b'
                                  },
                                  {
                                    label: '<=',
                                    insertText: '<=',
                                    description: 'Меньше либо равно.',
                                    example: 'Пример: a <= b'
                                  },
                                  {
                                    label: '&&',
                                    insertText: '&&',
                                    description: 'Логическое И.',
                                    example: 'Пример: a && b'
                                  },
                                  {
                                    label: '||',
                                    insertText: '||',
                                    description: 'Логическое ИЛИ.',
                                    example: 'Пример: a || b'
                                  },
                                  {
                                    label: '!',
                                    insertText: '!',
                                    description: 'Логическое НЕ.',
                                    example: 'Пример: !flag'
                                  },
                                  {
                                    label: 'and',
                                    insertText: 'and',
                                    description: 'Альтернатива для &&.',
                                    example: 'Пример: a and b'
                                  },
                                  {
                                    label: 'or',
                                    insertText: 'or',
                                    description: 'Альтернатива для ||.',
                                    example: 'Пример: a or b'
                                  },
                                  {
                                    label: 'not',
                                    insertText: 'not',
                                    description: 'Альтернатива для !.',
                                    example: 'Пример: not flag'
                                  },
                                  {
                                    label: '+',
                                    insertText: '+',
                                    description: 'Сложение.',
                                    example: 'Пример: a + b'
                                  },
                                  {
                                    label: '-',
                                    insertText: '-',
                                    description: 'Вычитание.',
                                    example: 'Пример: a - b'
                                  },
                                  {
                                    label: '*',
                                    insertText: '*',
                                    description: 'Умножение.',
                                    example: 'Пример: a * b'
                                  },
                                  {
                                    label: '/',
                                    insertText: '/',
                                    description: 'Деление.',
                                    example: 'Пример: a / b'
                                  }
                                ].map(item => (
                                  <Tooltip key={item.label}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() => handleInsertIntoFormula(item.insertText)}
                                        className="px-2 py-0.5 text-xs rounded-md bg-muted hover:bg-accent cursor-pointer"
                                      >
                                        {item.label}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs text-xs">
                                      <div className="font-medium">{item.description}</div>
                                      <div className="text-muted-foreground">{item.example}</div>
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            </TooltipProvider>
                          </AccordionContent>
                        </AccordionItem>

                      {/* Functions Section */}
                      <AccordionItem value="functions">
                        <AccordionTrigger className="text-sm font-medium">Функции</AccordionTrigger>
                        <AccordionContent>
                          <TooltipProvider delayDuration={200}>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                {
                                  label: 'Условный оператор',
                                  insertText: 'if(condition, a, b)',
                                  description: 'Возвращает a или b по условию.',
                                  example: 'Пример: if(x > 0, x, 0)'
                                },
                                {
                                  label: 'round',
                                  insertText: 'round()',
                                  description: 'Округляет число до ближайшего целого.',
                                  example: 'Пример: round(3.6)'
                                },
                                {
                                  label: 'ceil',
                                  insertText: 'ceil()',
                                  description: 'Округляет вверх.',
                                  example: 'Пример: ceil(2.1)'
                                },
                                {
                                  label: 'floor',
                                  insertText: 'floor()',
                                  description: 'Округляет вниз.',
                                  example: 'Пример: floor(2.9)'
                                },
                                {
                                  label: 'min',
                                  insertText: 'min()',
                                  description: 'Возвращает минимальное значение.',
                                  example: 'Пример: min(a, b)'
                                },
                                {
                                  label: 'max',
                                  insertText: 'max()',
                                  description: 'Возвращает максимальное значение.',
                                  example: 'Пример: max(a, b)'
                                },
                                {
                                  label: 'abs',
                                  insertText: 'abs()',
                                  description: 'Абсолютное значение числа.',
                                  example: 'Пример: abs(-5)'
                                },
                                {
                                  label: 'trim',
                                  insertText: 'trim()',
                                  description: 'Удаляет пробелы по краям строки.',
                                  example: 'Пример: trim(name)'
                                },
                                {
                                  label: 'lower',
                                  insertText: 'lower()',
                                  description: 'Приводит строку к нижнему регистру.',
                                  example: 'Пример: lower(text)'
                                },
                                {
                                  label: 'upper',
                                  insertText: 'upper()',
                                  description: 'Приводит строку к верхнему регистру.',
                                  example: 'Пример: upper(text)'
                                },
                                {
                                  label: 'len',
                                  insertText: 'len()',
                                  description: 'Длина строки.',
                                  example: 'Пример: len(text)'
                                },
                                {
                                  label: 'contains',
                                  insertText: 'contains()',
                                  description: 'Проверяет наличие подстроки.',
                                  example: 'Пример: contains(text, "abc")'
                                },
                                {
                                  label: 'replace',
                                  insertText: 'replace()',
                                  description: 'Заменяет подстроку.',
                                  example: 'Пример: replace(text, "a", "b")'
                                },
                                {
                                  label: 'toNumber',
                                  insertText: 'toNumber()',
                                  description: 'Преобразует в число.',
                                  example: 'Пример: toNumber(value)'
                                },
                                {
                                  label: 'toString',
                                  insertText: 'toString()',
                                  description: 'Преобразует в строку.',
                                  example: 'Пример: toString(value)'
                                },
                                {
                                  label: 'split',
                                  insertText: 'split()',
                                  description: 'Разбивает строку в массив.',
                                  example: 'Пример: split(text, ",")'
                                },
                                {
                                  label: 'join',
                                  insertText: 'join()',
                                  description: 'Склеивает массив в строку.',
                                  example: 'Пример: join(items, ",")'
                                },
                                {
                                  label: 'get',
                                  insertText: 'get()',
                                  description: 'Получает элемент массива по индексу.',
                                  example: 'Пример: get(items, 0)'
                                },
                                {
                                  label: 'getPrice',
                                  insertText: 'getPrice()',
                                  description: 'Получает цену по параметру.',
                                  example: 'Пример: getPrice(code)'
                                },
                                {
                                  label: 'regexMatch',
                                  insertText: 'regexMatch()',
                                  description: 'Проверяет соответствие регулярному выражению.',
                                  example: 'Пример: regexMatch(text, "[0-9]+")'
                                },
                                {
                                  label: 'regexExtract',
                                  insertText: 'regexExtract()',
                                  description: 'Извлекает совпадение по регулярному выражению.',
                                  example: 'Пример: regexExtract(text, "[0-9]+")'
                                }
                              ].map(item => (
                                <Tooltip key={item.label}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => handleInsertIntoFormula(item.insertText)}
                                      className="px-2 py-0.5 text-xs rounded-md bg-muted hover:bg-accent cursor-pointer"
                                    >
                                      {item.label}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    <div className="font-medium">{item.description}</div>
                                    <div className="text-muted-foreground">{item.example}</div>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                          </TooltipProvider>
                        </AccordionContent>
                      </AccordionItem>
                      
                      {/* Parameters and Variables Section */}
                      <AccordionItem value="params-vars">
                        <AccordionTrigger className="text-sm font-medium">Параметры и переменные</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            {/* Input Parameters Group */}
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-2">Входные параметры</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {inputsForRender.length === 0 ? (
                                  <div className="text-xs text-muted-foreground italic">Нет параметров</div>
                                ) : (
                                  inputsForRender.map(input => {
                                    const inputName = safeRenderString(input.name)
                                    return (
                                    <button
                                      key={input.id}
                                      onClick={() => {
                                        if (inputName) {
                                          handleInsertIntoFormula(inputName)
                                        }
                                      }}
                                      className="px-2 py-0.5 text-xs rounded-md bg-muted hover:bg-accent cursor-pointer"
                                      title={`Кликните, чтобы вставить: ${inputName}`}
                                    >
                                      {inputName}
                                    </button>
                                  )
                                  })
                                )}
                              </div>
                            </div>
                            
                            {/* Variables Group */}
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-2">Переменные</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {varsForRender.length === 0 ? (
                                  <div className="text-xs text-muted-foreground italic">Нет переменных</div>
                                ) : (
                                  varsForRender.map(v => {
                                    const varName = safeRenderString(v.name)
                                    return (
                                    <button
                                      key={v.id}
                                      onClick={() => {
                                        if (varName) {
                                          handleInsertIntoFormula(varName)
                                        }
                                      }}
                                      className="px-2 py-0.5 text-xs rounded-md bg-muted hover:bg-accent cursor-pointer"
                                      title={`Кликните, чтобы вставить: ${varName}`}
                                    >
                                      {varName}
                                    </button>
                                  )
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      </Accordion>
                    </DiagnosticErrorBoundary>

                    {/* Errors Section - No Accordion */}
                    <div className="mt-4">
                      <button 
                        onClick={() => {
                          if (validationIssuesForRender.length > 0) {
                            // Find the first error
                            const firstError = validationIssuesForRender[0]
                            if (firstError.scope === 'input') {
                              handleTabChange('inputs')
                            } else if (firstError.scope === 'var') {
                              handleTabChange('formulas')
                            } else if (firstError.scope === 'result') {
                              handleTabChange('outputs')
                            }
                          } else {
                            handleOpenHelp('help_errors', 'Ошибки')
                          }
                        }}
                        className="w-full text-left hover:bg-muted p-2 rounded-md"
                      >
                        <div className="text-sm font-medium flex items-center gap-2">
                          Ошибки
                          {validationIssuesForRender.length > 0 && (
                            <span className="text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded">
                              {validationIssuesForRender.length}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {validationIssuesForRender.length > 0 
                            ? 'Кликните, чтобы перейти к первой ошибке' 
                            : 'Ошибок не обнаружено'}
                        </div>
                      </button>
                    </div>
                  </div>
                </ScrollArea>
              </div>
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
              {activeTab === 'inputs' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInputParams}
                  title="Названия входных параметров будут скопированы в буфер обмена"
                >
                  Скопировать параметры
                </Button>
              )}
              {activeTab === 'formulas' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyVars}
                    title="Названия переменных будут скопированы в буфер обмена"
                  >
                    Скопировать переменные
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyFormulas}
                    title="Названия переменных и формулы будут скопированы в буфер обмена"
                  >
                    Скопировать формулы
                  </Button>
                </>
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
        </CalculationLogicErrorBoundary>
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
