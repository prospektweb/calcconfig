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
import { InputParam, FormulaVar, StageOutputs, OfferPlanItem, StageLogic } from './logic/types'
import { saveLogic, loadLogic } from './logic/storage'
import { validateAll } from './logic/validator'

/**
 * Build logic context for the context tree panel
 * Removes selectedOffers and constructs offer object with properties from iblocks
 */
function buildLogicContext(initPayload: InitPayload | null | undefined): any {
  if (!initPayload) return null

  // Find offers iblock
  const offersIblock = initPayload.iblocks?.find(ib => ib.type === 'offers')
  
  if (!offersIblock && initPayload.iblocks?.length) {
    // Fallback: try to find by code
    const offersByCode = initPayload.iblocks.find(ib => 
      ib.code?.toUpperCase() === 'OFFERS' || ib.code?.toUpperCase().includes('OFFER')
    )
    if (!offersByCode) {
      console.warn('[buildLogicContext] offers iblock not found')
    }
  }
  
  const iblock = offersIblock || initPayload.iblocks?.find(ib => 
    ib.code?.toUpperCase() === 'OFFERS' || ib.code?.toUpperCase().includes('OFFER')
  )

  // Build offer.properties from iblock.properties
  const offerProperties: Record<string, any> = {}
  if (iblock?.properties) {
    for (const prop of iblock.properties) {
      if (prop.CODE) {
        // Create property descriptor with __leaf marker
        offerProperties[prop.CODE] = {
          CODE: prop.CODE,
          NAME: prop.NAME,
          PROPERTY_TYPE: prop.PROPERTY_TYPE,
          ...(prop.ENUMS ? { ENUMS: prop.ENUMS } : {}),
          // Marker for JsonTree to treat this as a clickable leaf
          __leaf: true,
          __sourcePath: `offer.properties.${prop.CODE}`,
          __sourceType: 'property'
        }
      }
    }
  }

  // Get first offer for reference data
  const firstOffer = initPayload.selectedOffers?.[0]

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

  // Add offer object (single instance, not array)
  logicContext.offer = {
    id: 0, // placeholder
    name: '',
    code: firstOffer?.name || '',
    measure: '',
    measureRatio: 1,
    prices: initPayload.priceTypes || firstOffer?.prices || [],
    properties: offerProperties
  }

  return logicContext
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
  const [outputs, setOutputs] = useState<StageOutputs>({})
  const [offerPlan, setOfferPlan] = useState<OfferPlanItem[]>([])

  // Load saved logic when dialog opens
  useEffect(() => {
    if (open && currentSettingsId !== null && currentSettingsId !== undefined && 
        currentStageId !== null && currentStageId !== undefined) {
      const saved = loadLogic(currentSettingsId, currentStageId)
      if (saved) {
        setInputs(saved.inputs)
        setVars(saved.vars)
        setOutputs(saved.outputs)
        setOfferPlan(saved.offerPlan)
      } else {
        // Reset to empty state
        setInputs([])
        setVars([])
        setOutputs({})
        setOfferPlan([])
      }
    }
  }, [open, currentSettingsId, currentStageId])

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

    const newInput: InputParam = {
      id,
      name,
      sourcePath: path,
      sourceType: type as any
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
    const result = validateAll(inputs, vars, stageIndex)
    if (result.valid) {
      toast.success('Проверка пройдена')
    } else {
      // Show first error in toast for visibility
      const firstError = result.errors[0]
      if (firstError) {
        toast.error(firstError.error)
      } else {
        toast.error('Есть ошибки в формулах')
      }
      
      // Update vars with errors
      const varsWithErrors = vars.map(v => {
        const error = result.errors.find(e => e.varId === v.id)
        return error ? { ...v, error: error.error } : { ...v, error: null }
      })
      setVars(varsWithErrors)
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
      outputs,
      offerPlan
    }

    try {
      saveLogic(currentSettingsId, currentStageId, logic)
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
            <div className="w-80 border-r border-border flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
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
                    <InputsTab inputs={inputs} onChange={setInputs} />
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="formulas" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <FormulasTab 
                      inputs={inputs} 
                      vars={vars} 
                      onChange={setVars}
                      stageIndex={stageIndex}
                    />
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="outputs" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <OutputsTab 
                      vars={vars}
                      outputs={outputs}
                      offerPlan={offerPlan}
                      onOutputsChange={setOutputs}
                      onOfferPlanChange={setOfferPlan}
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
