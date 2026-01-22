import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CaretLeft, CaretRight, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { InitPayload } from '@/lib/postmessage-bridge'
import { toast } from 'sonner'
import { JsonTree } from './logic/JsonTree'
import { InputsTab } from './logic/InputsTab'
import { FormulasTab } from './logic/FormulasTab'
import { OutputsTab } from './logic/OutputsTab'
import { InputParam, FormulaVar, StageLogic, ValidationIssue, ValueType, ResultsHL, WritePlanItem } from './logic/types'
import { saveLogic, loadLogic } from './logic/storage'
import { validateAll, inferType, inferTypeFromSourcePath } from './logic/validator'

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
 * Uses selectedOffers[0] structure but with all values nullified
 * Removes selectedOffers from context and excludes offer.prices
 */
function buildLogicContext(initPayload: InitPayload | null | undefined): any {
  if (!initPayload) return null

  // Construct logic context
  const logicContext: any = {
    context: initPayload.context,
  }

  // Add preset if exists
  if (initPayload.preset) {
    logicContext.preset = initPayload.preset
  }

  // Add elementsStore if exists
  if (initPayload.elementsStore) {
    logicContext.elementsStore = initPayload.elementsStore
  }

  // Add stages if available
  if (initPayload.preset?.properties?.CALC_STAGES || initPayload.elementsStore?.CALC_STAGES) {
    logicContext.stages = initPayload.preset?.properties?.CALC_STAGES || initPayload.elementsStore?.CALC_STAGES
  }

  // Build offer model from selectedOffers[0] if available
  if (initPayload.selectedOffers?.[0]) {
    const offer0 = initPayload.selectedOffers[0]
    const offerModel = deepNullifyShape(offer0)
    
    // Remove prices from offer model
    if (offerModel && typeof offerModel === 'object') {
      delete offerModel.prices
    }
    
    logicContext.offer = offerModel
  } else {
    // Fallback: create minimal offer structure
    logicContext.offer = {
      id: null,
      name: null,
      properties: {}
    }
  }

  return logicContext
}

// Helper to get session draft key
const getSessionDraftKey = (settingsId: number, stageId: number) => 
  `calcconfig_session_draft_${settingsId}_${stageId}`

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
}: CalculationLogicDialogProps) {
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true)
  const [activeTab, setActiveTab] = useState('inputs')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // State for logic editing
  const [inputs, setInputs] = useState<InputParam[]>([])
  const [vars, setVars] = useState<FormulaVar[]>([])
  const [resultsHL, setResultsHL] = useState<ResultsHL>(createEmptyResultsHL())
  const [writePlan, setWritePlan] = useState<WritePlanItem[]>([])
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])

  // Load saved logic when dialog opens (with session draft support)
  useEffect(() => {
    if (open && currentSettingsId !== null && currentSettingsId !== undefined && 
        currentStageId !== null && currentStageId !== undefined) {
      const sessionKey = getSessionDraftKey(currentSettingsId, currentStageId)
      
      // Try session draft first
      const sessionDraft = sessionStorage.getItem(sessionKey)
      if (sessionDraft) {
        try {
          const parsed = JSON.parse(sessionDraft)
          setInputs(parsed.inputs || [])
          setVars(parsed.vars || [])
          setResultsHL(parsed.resultsHL || createEmptyResultsHL())
          setWritePlan(parsed.writePlan || [])
          return
        } catch (e) {
          console.warn('Failed to parse session draft', e)
        }
      }
      
      // Fall back to localStorage (saved)
      const saved = loadLogic(currentSettingsId, currentStageId)
      if (saved) {
        setInputs(saved.inputs)
        setVars(saved.vars)
        setResultsHL(saved.resultsHL || createEmptyResultsHL())
        setWritePlan(saved.writePlan || [])
      } else {
        // Reset to empty state
        setInputs([])
        setVars([])
        setResultsHL(createEmptyResultsHL())
        setWritePlan([])
      }
    }
  }, [open, currentSettingsId, currentStageId])

  // Save to session draft on any change
  useEffect(() => {
    if (open && currentSettingsId !== null && currentSettingsId !== undefined && 
        currentStageId !== null && currentStageId !== undefined) {
      const sessionKey = getSessionDraftKey(currentSettingsId, currentStageId)
      const draft = {
        inputs,
        vars,
        resultsHL,
        writePlan
      }
      sessionStorage.setItem(sessionKey, JSON.stringify(draft))
    }
  }, [inputs, vars, resultsHL, writePlan, open, currentSettingsId, currentStageId])

  // Show current and previous stages only
  const visibleStages = allStages.slice(0, stageIndex + 1)

  // Build context for the left panel (without selectedOffers)
  const logicContext = useMemo(() => buildLogicContext(initPayload), [initPayload])

  const handleLeafClick = (path: string, value: any, type: string) => {
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

  const handleValidate = () => {
    const result = validateAll(inputs, vars, stageIndex, [], resultsHL, writePlan)
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

  const handleSave = () => {
    if (currentSettingsId === null || currentSettingsId === undefined ||
        currentStageId === null || currentStageId === undefined) {
      toast.error('Невозможно сохранить: отсутствует ID этапа или настроек')
      return
    }

    const logic: StageLogic = {
      version: 1,
      stageIndex,
      inputs,
      vars,
      outputs: {},  // deprecated, keep for backward compatibility
      offerPlan: [],  // deprecated, keep for backward compatibility
      resultsHL,
      writePlan
    }

    try {
      saveLogic(currentSettingsId, currentStageId, logic)
      
      // Clear session draft after successful save
      const sessionKey = getSessionDraftKey(currentSettingsId, currentStageId)
      sessionStorage.removeItem(sessionKey)
      
      toast.success('Логика сохранена (локально)')
      onOpenChange(false)
    } catch (error) {
      toast.error('Ошибка сохранения')
    }
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
              <div className="flex-1 p-4 overflow-hidden">
                {logicContext ? (
                  <JsonTree
                    data={logicContext}
                    onLeafClick={handleLeafClick}
                    isPathDisabled={isPathDisabled}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
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
                    <InputsTab inputs={inputs} onChange={setInputs} issues={validationIssues} />
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
                      writePlan={writePlan}
                      onResultsHLChange={setResultsHL}
                      onWritePlanChange={setWritePlan}
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
                <Accordion type="single" collapsible defaultValue="syntax">
                  <AccordionItem value="syntax">
                    <AccordionTrigger className="text-sm">Синтаксис</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-xs">
                        <div>
                          <h4 className="font-medium mb-1">Типы данных</h4>
                          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                            <li>number (число)</li>
                            <li>string (строка)</li>
                            <li>boolean (true/false)</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1">Операторы</h4>
                          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                            <li>Арифметика: + - * / ( )</li>
                            <li>Сравнение: == != &gt; &lt; &gt;= &lt;=</li>
                            <li>Логика: and or not</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1">Правила</h4>
                          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                            <li>Переменные выполняются сверху вниз</li>
                            <li>Нельзя ссылаться на переменные ниже</li>
                            <li>Нельзя ссылаться на данные будущих этапов</li>
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="types">
                    <AccordionTrigger className="text-sm">Типы данных</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-xs">
                        <div>
                          <h4 className="font-medium">Типы значений</h4>
                          <ul className="list-disc list-inside text-muted-foreground">
                            <li><strong>number</strong> — числа, арифметика, round/ceil/floor</li>
                            <li><strong>string</strong> — строки, lower/upper/contains</li>
                            <li><strong>bool</strong> — логика, if/and/or</li>
                            <li><strong>unknown</strong> — тип не определён</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mt-2">Как определяется тип</h4>
                          <ul className="list-disc list-inside text-muted-foreground">
                            <li>Автоматически по sourcePath (при добавлении из контекста)</li>
                            <li>Или вручную администратором</li>
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="functions">
                    <AccordionTrigger className="text-sm">Функции</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 text-xs">
                        <div>
                          <h4 className="font-medium">if(condition, a, b)</h4>
                          <p className="text-muted-foreground">Условный оператор</p>
                        </div>
                        <div>
                          <h4 className="font-medium">Математика</h4>
                          <p className="text-muted-foreground">round, ceil, floor, min, max, abs</p>
                        </div>
                        <div>
                          <h4 className="font-medium">Строки</h4>
                          <p className="text-muted-foreground">
                            trim, lower, upper, len, contains, replace
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium">Преобразование</h4>
                          <p className="text-muted-foreground">toNumber, toString</p>
                        </div>
                        <div>
                          <h4 className="font-medium">Массивы</h4>
                          <p className="text-muted-foreground">split, join, get</p>
                        </div>
                        <div>
                          <h4 className="font-medium">Регулярные выражения</h4>
                          <p className="text-muted-foreground">regexMatch, regexExtract</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="errors">
                    <AccordionTrigger className="text-sm">Ошибки</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div>
                          <p className="font-medium text-foreground">Неизвестная переменная: X</p>
                          <p>Переменная не определена в входных параметрах или формулах</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Ссылка на переменную ниже по списку: Y</p>
                          <p>Нельзя использовать переменные, определённые ниже текущей</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Данные следующего этапа недоступны</p>
                          <p>Нельзя ссылаться на данные этапов с большим индексом</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Несовпадение типов</p>
                          <p>Операция требует другой тип данных</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button 
                size="sm"
                onClick={handleSave}
                data-pwcode="logic-btn-save"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
