import { useState, useRef, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, X, DotsSixVertical, Package, Wrench, Hammer, ArrowSquareOut } from '@phosphor-icons/react'
import { CalculatorInstance, createEmptyCalculator } from '@/lib/types'
import { MultiLevelSelect } from './MultiLevelSelect'
import { useReferencesStore } from '@/stores/references-store'
import { useCalculatorSettingsStore, CalcSettingsItem } from '@/stores/calculator-settings-store'
import { useOperationSettingsStore } from '@/stores/operation-settings-store'
import { useMaterialSettingsStore } from '@/stores/material-settings-store'
import { useOperationVariantStore } from '@/stores/operation-variant-store'
import { useMaterialVariantStore } from '@/stores/material-variant-store'
import { useCustomDrag } from '@/hooks/use-custom-drag'
import { cn } from '@/lib/utils'
import { InitPayload, postMessageBridge } from '@/lib/postmessage-bridge'
import { getBitrixContext, openBitrixAdmin } from '@/lib/bitrix-utils'
import { toast } from 'sonner'
import { BitrixProperty } from '@/lib/bitrix-transformers'

interface CalculatorTabsProps {
  calculators: CalculatorInstance[]
  onChange: (calculators: CalculatorInstance[]) => void
  bitrixMeta?: InitPayload | null
  onValidationMessage?: (type: 'info' | 'warning' | 'error' | 'success', message: string) => void
}

const TAB_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

// Вспомогательные функции для безопасного доступа к свойствам

// Безопасное получение свойства
const getProperty = (settings: CalcSettingsItem | undefined, key: string): BitrixProperty | undefined => {
  return settings?.properties?.[key]
}

// Проверка активности свойства (USE_OPERATION_VARIANT, USE_MATERIAL_VARIANT, CAN_BE_FIRST и т.д.)
const isPropertyEnabled = (prop: BitrixProperty | undefined): boolean => {
  if (!prop) return false
  
  // VALUE_XML_ID имеет приоритет
  const xmlId = prop.VALUE_XML_ID
  if (typeof xmlId === 'string') {
    return xmlId === 'Y' || xmlId === 'yes' || xmlId === '1'
  }
  // Затем проверяем VALUE
  const value = prop.VALUE
  if (typeof value === 'string') {
    return value === 'Y' || value === 'Да' || value === '1'
  }
  return false
}

// Получение строкового значения свойства
const getPropertyStringValue = (prop: BitrixProperty | undefined): string | null => {
  if (!prop) return null
  const value = prop.VALUE_XML_ID ?? prop.VALUE
  return typeof value === 'string' ? value : null
}

// Получение массива значений свойства
const getPropertyArrayValue = (prop: BitrixProperty | undefined): string[] => {
  if (!prop) return []
  const value = prop.VALUE
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value) return [value]
  return []
}

// Парсинг extraOptions из OTHER_OPTIONS
interface ExtraOption {
  code: string
  label: string
  type: 'checkbox' | 'number'
  default: boolean | number
  min?: number
  max?: number
  unit?: string
}

const getExtraOptions = (settings: CalcSettingsItem | undefined): ExtraOption[] => {
  if (!settings) return []
  
  const defaultOptions = getProperty(settings, 'OTHER_OPTIONS')
  const optionsValue = getPropertyStringValue(defaultOptions)
  
  if (!optionsValue) return []
  
  try {
    // Предполагается, что OTHER_OPTIONS содержит JSON массив опций
    const parsed = JSON.parse(optionsValue)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to parse OTHER_OPTIONS:', error)
    return []
  }
}

export function CalculatorTabs({ calculators, onChange, bitrixMeta = null, onValidationMessage }: CalculatorTabsProps) {
  const [activeTab, setActiveTab] = useState(0)
  const { dragState, startDrag, setDropTarget, endDrag, cancelDrag } = useCustomDrag()
  const tabRefs = useRef<Map<number, HTMLElement>>(new Map())
  const dropZoneRefs = useRef<Map<number, HTMLElement>>(new Map())
  const [materialDropZoneHover, setMaterialDropZoneHover] = useState<number | null>(null)
  const [operationDropZoneHover, setOperationDropZoneHover] = useState<number | null>(null)
  const [equipmentDropZoneHover, setEquipmentDropZoneHover] = useState<number | null>(null)
  const reportedValidationKeysRef = useRef<Set<string>>(new Set())

  const getEntityIblockInfo = (entity: 'calculator' | 'operation' | 'material') => {
    if (!bitrixMeta) return null

    const iblockIdMap: Record<typeof entity, number | undefined> = {
      calculator: bitrixMeta.iblocks.calcSettings,
      operation: bitrixMeta.iblocks.calcOperationsVariants,
      material: bitrixMeta.iblocks.calcMaterialsVariants,
    }

    const iblockId = iblockIdMap[entity]
    if (!iblockId) return null

    const iblockType = bitrixMeta.iblocksTypes[iblockId]
    const context = getBitrixContext()
    const lang = context?.lang || bitrixMeta.context?.lang

    if (!iblockType || !lang) return null

    return { iblockId, iblockType, lang }
  }

  const toNumber = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null

    if (typeof value === 'number') return value

    const parsed = parseInt(value, 10)
    return Number.isNaN(parsed) ? null : parsed
  }

  const openEntity = (entity: 'calculator' | 'operation' | 'material', id: number | null) => {
    if (!id) return

    const iblockInfo = getEntityIblockInfo(entity)

    if (iblockInfo) {
      try {
        openBitrixAdmin({
          iblockId: iblockInfo.iblockId,
          type: iblockInfo.iblockType,
          lang: iblockInfo.lang,
          id,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось открыть элемент Bitrix'
        toast.error(message)
      }
    } else {
      window.open(`#${entity}-${id}`, '_blank')
    }
  }

  const renderSelectedId = (id: number | null, entity: 'calculator' | 'operation' | 'material', pwcode: string) => (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="font-mono">ID:{id ?? 'N/A'}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        disabled={!id}
        onClick={() => openEntity(entity, id)}
        data-pwcode={pwcode}
      >
        <ArrowSquareOut className="w-4 h-4" />
      </Button>
    </div>
  )
  
  // Get hierarchical data from references store
  const calculatorsHierarchy = useReferencesStore(s => s.calculatorsHierarchy)
  const equipmentHierarchy = useReferencesStore(s => s.equipmentHierarchy)
  const operationsHierarchy = useReferencesStore(s => s.operationsHierarchy)
  const materialsHierarchy = useReferencesStore(s => s.materialsHierarchy)
  
  // Get calculator settings from store
  const calculatorSettings = useCalculatorSettingsStore(s => s.settings)
  const operationSettings = useOperationSettingsStore(s => s.operations)
  const materialSettings = useMaterialSettingsStore(s => s.materials)
  
  // Get variant stores for units
  const operationVariants = useOperationVariantStore(s => s.variants)
  const materialVariants = useMaterialVariantStore(s => s.variants)
  
  // Helper function to get operation unit
  const getOperationUnit = (operationId: number | null): string => {
    if (!operationId) return 'ед.'
    const variant = operationVariants[operationId.toString()]
    if (!variant?.properties?.MEASURE_UNIT) return 'ед.'
    const value = variant.properties.MEASURE_UNIT.VALUE
    return typeof value === 'string' ? value : 'ед.'
  }
  
  // Helper function to get material unit
  const getMaterialUnit = (materialId: number | null): string => {
    if (!materialId) return 'шт.'
    const variant = materialVariants[materialId.toString()]
    if (!variant?.properties?.MEASURE_UNIT) return 'шт.'
    const value = variant.properties.MEASURE_UNIT.VALUE
    return typeof value === 'string' ? value : 'шт.'
  }
  
  const safeCalculators = calculators || []

  const handleAddCalculator = () => {
    const newCalc = createEmptyCalculator()
    onChange([...safeCalculators, newCalc])
    setActiveTab(safeCalculators.length)
  }

  const handleRemoveCalculator = (index: number) => {
    const newCalculators = safeCalculators.filter((_, i) => i !== index)
    onChange(newCalculators)
    if (activeTab >= newCalculators.length) {
      setActiveTab(Math.max(0, newCalculators.length - 1))
    }
  }

  const handleUpdateCalculator = (index: number, updates: Partial<CalculatorInstance>) => {
    const newCalculators = safeCalculators.map((calc, i) => 
      i === index ? { ...calc, ...updates } : calc
    )
    onChange(newCalculators)
  }

  const reorderStages = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    
    const reorderedCalculators = [...safeCalculators]
    const [movedItem] = reorderedCalculators.splice(fromIndex, 1)
    
    const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
    reorderedCalculators.splice(adjustedToIndex, 0, movedItem)
    
    onChange(reorderedCalculators)
    setActiveTab(adjustedToIndex)
  }

  const handleStageDragStart = (element: HTMLElement, e: React.MouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    const calcId = safeCalculators[index]?.id
    if (!calcId) return
    startDrag(calcId, 'stage', element, e.clientX, e.clientY)
  }

  useEffect(() => {
    if (!dragState.isDragging || dragState.draggedItemType !== 'stage') return

    const handleMouseMove = (e: MouseEvent) => {
      let nearestDropZone: number | null = null
      let minDistance = Infinity

      tabRefs.current.forEach((element, index) => {
        const rect = element.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const distance = Math.abs(e.clientX - centerX)
        
        if (distance < minDistance && distance < 100) {
          minDistance = distance
          nearestDropZone = index
        }
      })

      setDropTarget(nearestDropZone)
    }

    const handleMouseUp = (e: MouseEvent) => {
      const draggedIndex = safeCalculators.findIndex(calc => calc.id === dragState.draggedItemId)
      
      if (dragState.dropTargetIndex !== null && draggedIndex !== -1) {
        reorderStages(draggedIndex, dragState.dropTargetIndex)
        endDrag(true)
      } else {
        cancelDrag()
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, safeCalculators, setDropTarget, endDrag, cancelDrag])

  // Handle validation and auto-selection when settings are loaded
  useEffect(() => {
    console.log('[CalculatorTabs][DEBUG] Settings validation effect triggered', {
      calculatorsCount: safeCalculators.length,
      calculatorSettingsKeys: Object.keys(calculatorSettings),
      calculatorSettings: calculatorSettings,
    })

    const previousViolations = reportedValidationKeysRef.current
    const nextViolations = new Set<string>()

    safeCalculators.forEach((calc, index) => {
      console.log('[CalculatorTabs][DEBUG] Processing calculator', {
        index,
        id: calc.id,
        calculatorCode: calc.calculatorCode,
        operationId: calc.operationId,
        materialId: calc.materialId,
        equipmentId: calc.equipmentId,
      })

      if (!calc.calculatorCode) {
        console.log('[CalculatorTabs][DEBUG] No calculatorCode, skipping')
        return
      }
      
      const settings = calculatorSettings[calc.calculatorCode]
      console.log('[CalculatorTabs][DEBUG] Found settings for code', {
        code: calc.calculatorCode,
        hasSettings: !!settings,
        settingsId: settings?.id,
        settingsName: settings?.name,
        hasProperties: !!settings?.properties,
        propertiesKeys: settings?.properties ? Object.keys(settings.properties) : [],
      })

      if (!settings?.properties) {
        console.log('[CalculatorTabs][DEBUG] No properties in settings')
        return
      }

      // Log property checks
      const useOperationVariant = getProperty(settings, 'USE_OPERATION_VARIANT')
      const useMaterialVariant = getProperty(settings, 'USE_MATERIAL_VARIANT')
      
      console.log('[CalculatorTabs][DEBUG] Property check results', {
        useOperationVariant: useOperationVariant,
        useOperationVariantEnabled: isPropertyEnabled(useOperationVariant),
        useMaterialVariant: useMaterialVariant,
        useMaterialVariantEnabled: isPropertyEnabled(useMaterialVariant),
      })
      
      // Validation: CAN_BE_FIRST
      const canBeFirst = getProperty(settings, 'CAN_BE_FIRST')
      const violationKeyBase = `${calc.id ?? calc.calculatorCode ?? 'calculator'}-${index}`

      const reportValidationOnce = (key: string, message: string) => {
        nextViolations.add(key)
        if (onValidationMessage && !previousViolations.has(key)) {
          onValidationMessage('error', message)
        }
      }

      if (index === 0 && !isPropertyEnabled(canBeFirst)) {
        reportValidationOnce(`${violationKeyBase}-cannot-be-first`, `Калькулятор ${settings.name} не может быть размещен на первом этапе`)
        return
      }
      
      // Validation: REQUIRES_BEFORE (check both for index === 0 AND index > 0)
      const requiresBefore = getProperty(settings, 'REQUIRES_BEFORE')
      const requiresBeforeValue = getPropertyStringValue(requiresBefore)
      if (requiresBeforeValue) {
        if (index === 0) {
          // Калькулятор требует предшественника, но размещен на первом этапе
          reportValidationOnce(
            `${violationKeyBase}-requires-before-first`,
            `Калькулятор ${settings.name} не может быть размещен на первом этапе (требует предшественника)`
          )
          return
        } else {
          // Проверяем, что предыдущий калькулятор соответствует требованию
          const prevCalc = safeCalculators[index - 1]
          if (!prevCalc.calculatorCode || prevCalc.calculatorCode !== requiresBeforeValue) {
            const prevSettings = prevCalc.calculatorCode ? calculatorSettings[prevCalc.calculatorCode] : null
            const prevName = prevSettings?.name || 'неизвестный калькулятор'
            reportValidationOnce(
              `${violationKeyBase}-requires-before-${requiresBeforeValue}`,
              `Калькулятор ${settings.name} не может быть размещен после калькулятора ${prevName}`
            )
            return
          }
        }
      }

      // Auto-select DEFAULT_OPERATION_VARIANT
      const defaultOperationVariant = getProperty(settings, 'DEFAULT_OPERATION_VARIANT')
      const defaultOpValue = getPropertyStringValue(defaultOperationVariant)
      if (defaultOpValue && !calc.operationId) {
        const defaultOpId = parseInt(defaultOpValue, 10)
        if (!isNaN(defaultOpId) && calc.operationId !== defaultOpId) {
          handleUpdateCalculator(index, { operationId: defaultOpId })
        }
      }
      
      // Auto-select DEFAULT_MATERIAL_VARIANT  
      const defaultMaterialVariant = getProperty(settings, 'DEFAULT_MATERIAL_VARIANT')
      const defaultMatValue = getPropertyStringValue(defaultMaterialVariant)
      if (defaultMatValue && !calc.materialId) {
        const defaultMatId = parseInt(defaultMatValue, 10)
        if (!isNaN(defaultMatId) && calc.materialId !== defaultMatId) {
          handleUpdateCalculator(index, { materialId: defaultMatId })
        }
      }
    })

    reportedValidationKeysRef.current = nextViolations
  }, [safeCalculators, calculatorSettings, onValidationMessage])
  
  // Auto-select first equipment/material when operation settings are loaded
  useEffect(() => {
    safeCalculators.forEach((calc, index) => {
      if (!calc.operationId) return
      
      const operationSettingsItem = operationSettings[calc.operationId.toString()]
      if (!operationSettingsItem) return
      
      // Auto-select first equipment if not set and list is filtered
      const supportedEquipmentList = getPropertyArrayValue(getProperty(operationSettingsItem, 'SUPPORTED_EQUIPMENT_LIST'))
      if (!calc.equipmentId && supportedEquipmentList.length > 0) {
        // Find first matching equipment in hierarchy
        for (const category of equipmentHierarchy) {
          const firstMatch = category.children?.find(item => 
            item.value && supportedEquipmentList.includes(item.value)
          )
          if (firstMatch?.value) {
            handleUpdateCalculator(index, { equipmentId: parseInt(firstMatch.value) })
            break
          }
        }
      }
      
      // Auto-select first material if not set and list is filtered
      const supportedMaterialsVariantsList = getPropertyArrayValue(getProperty(operationSettingsItem, 'SUPPORTED_MATERIALS_VARIANTS_LIST'))
      if (!calc.materialId && supportedMaterialsVariantsList.length > 0) {
        // Find first matching material in hierarchy
        for (const category of materialsHierarchy) {
          const firstMatch = category.children?.find(item => 
            item.value && supportedMaterialsVariantsList.includes(item.value)
          )
          if (firstMatch?.value) {
            handleUpdateCalculator(index, { materialId: parseInt(firstMatch.value) })
            
            // Send request for material variant data
            if (bitrixMeta) {
              const context = getBitrixContext()
              const iblockId = bitrixMeta.iblocks.calcMaterialsVariants
              if (context && iblockId) {
                const iblockType = bitrixMeta.iblocksTypes[iblockId]
                if (iblockType) {
                  postMessageBridge.sendCalcMaterialVariantRequest(
                    parseInt(firstMatch.value),
                    iblockId,
                    iblockType,
                    context.lang
                  )
                }
              }
            }
            break
          }
        }
      }
    })
  }, [safeCalculators, operationSettings, equipmentHierarchy, materialsHierarchy])
  
  const getTabColor = (index: number) => {
    return TAB_COLORS[index % TAB_COLORS.length]
  }

  return (
    <div className="space-y-4" data-pwcode="calculator-tabs">
      <Tabs value={activeTab.toString()} onValueChange={(v) => setActiveTab(parseInt(v))}>
        <div className="flex items-center gap-2">
          <TabsList className="flex-1 justify-start overflow-x-auto bg-muted/30" data-pwcode="stages-list">
            {safeCalculators.map((calc, index) => {
              const isDraggingThis = dragState.isDragging && dragState.draggedItemId === calc.id
              const isDropTarget = dragState.dropTargetIndex === index
              
              return (
                <div key={calc.id} className="relative flex items-center">
                  <div
                    data-tab-item
                    ref={(el) => { if (el) tabRefs.current.set(index, el) }}
                    className={cn(
                      "relative transition-all",
                      isDraggingThis && "opacity-30",
                      isDropTarget && "ring-2 ring-accent rounded"
                    )}
                    data-pwcode="stage-tab"
                  >
                    <TabsTrigger 
                      value={index.toString()} 
                      className="pr-8 gap-1 data-[state=active]:bg-muted-foreground/80 data-[state=active]:text-primary-foreground"
                    >
                      <div 
                        className="w-4 h-4 flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing"
                        onMouseDown={(e) => {
                          const tabElement = e.currentTarget.closest('[data-tab-item]') as HTMLElement
                          if (tabElement) {
                            handleStageDragStart(tabElement, e, index)
                          }
                        }}
                        data-pwcode="stage-drag-handle"
                      >
                        <DotsSixVertical className="w-3.5 h-3.5" />
                      </div>
                      Этап #{index + 1}
                    </TabsTrigger>
                    {safeCalculators.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 p-0 rounded-full hover:bg-destructive hover:text-destructive-foreground z-10"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveCalculator(index)
                        }}
                        data-pwcode="btn-remove-stage"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCalculator}
              className="flex-shrink-0 ml-1 h-8 w-8 p-0"
              data-pwcode="btn-add-stage"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </TabsList>
        </div>

        {dragState.isDragging && dragState.draggedItemType === 'stage' && dragState.draggedItemId && (
          <div
            style={{
              position: 'fixed',
              left: dragState.dragPosition.x,
              top: dragState.dragPosition.y,
              width: dragState.initialPosition?.width || 120,
              zIndex: 9999,
              pointerEvents: 'none',
              opacity: 0.9,
            }}
          >
            <div className="px-3 py-2 bg-muted-foreground/80 text-primary-foreground rounded flex items-center gap-1">
              <DotsSixVertical className="w-3.5 h-3.5" />
              Этап #{safeCalculators.findIndex(calc => calc.id === dragState.draggedItemId) + 1}
            </div>
          </div>
        )}

        {safeCalculators.map((calc, index) => {
          // Get settings from store if calculatorCode is set
          const settings = calc.calculatorCode ? calculatorSettings[calc.calculatorCode] : undefined
          
          // Get operation settings from store
          const operationSettingsItem = calc.operationId 
            ? operationSettings[calc.operationId.toString()]
            : undefined
          
          // Filter equipment based on SUPPORTED_EQUIPMENT_LIST from operation settings
          const supportedEquipmentList = getPropertyArrayValue(getProperty(operationSettingsItem, 'SUPPORTED_EQUIPMENT_LIST'))
          const filteredEquipmentHierarchy = supportedEquipmentList.length > 0
            ? equipmentHierarchy.map(category => ({
                ...category,
                children: category.children?.filter(item => 
                  item.value && supportedEquipmentList.includes(item.value)
                ) || []
              })).filter(category => category.children && category.children.length > 0)
            : equipmentHierarchy
          
          // Filter materials based on SUPPORTED_MATERIALS_VARIANTS_LIST from operation settings
          const supportedMaterialsVariantsList = getPropertyArrayValue(getProperty(operationSettingsItem, 'SUPPORTED_MATERIALS_VARIANTS_LIST'))
          const filteredMaterialsHierarchy = supportedMaterialsVariantsList.length > 0
            ? materialsHierarchy.map(category => ({
                ...category,
                children: category.children?.filter(item => 
                  item.value && supportedMaterialsVariantsList.includes(item.value)
                ) || []
              })).filter(category => category.children && category.children.length > 0)
            : materialsHierarchy

          return (
            <TabsContent 
              key={calc.id} 
              value={index.toString()} 
              className="space-y-4 mt-4 border rounded-lg p-2 bg-card"
              data-pwcode="stage-content"
            >
              <div className="space-y-2">
                <Label>Калькулятор</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <MultiLevelSelect
                        items={calculatorsHierarchy}
                        value={calc.calculatorCode || null}
                        onValueChange={(value) => {
                          console.log('[CalculatorTabs][DEBUG] Calculator selected', {
                            newValue: value,
                            previousCode: calc.calculatorCode,
                            index: index,
                          })

                          handleUpdateCalculator(index, {
                            calculatorCode: value,
                            operationId: null,
                            equipmentId: null,
                            materialId: null,
                          })
                          
                          // Отправить запрос настроек калькулятора в Битрикс
                          if (value && bitrixMeta) {
                            const context = getBitrixContext()
                            const iblockId = bitrixMeta.iblocks.calcSettings
                            
                            console.log('[CalculatorTabs][DEBUG] Preparing CALC_SETTINGS_REQUEST', {
                              value: value,
                              hasBitrixMeta: !!bitrixMeta,
                              hasContext: !!context,
                              iblockId: iblockId,
                              contextLang: context?.lang,
                            })
                            
                            if (context && iblockId) {
                              const iblockType = bitrixMeta.iblocksTypes[iblockId]
                              
                              console.log('[CalculatorTabs][DEBUG] Sending CALC_SETTINGS_REQUEST', {
                                id: parseInt(value, 10),
                                iblockId: iblockId,
                                iblockType: iblockType,
                                lang: context.lang,
                              })
                              
                              if (iblockType) {
                                postMessageBridge.sendCalcSettingsRequest(
                                  parseInt(value, 10),
                                  iblockId,
                                  iblockType,
                                  context.lang
                                )
                                console.log('[CalculatorTabs][DEBUG] CALC_SETTINGS_REQUEST sent')
                              } else {
                                console.warn('[CalculatorTabs][DEBUG] No iblockType found for iblockId:', iblockId)
                              }
                            } else {
                              console.warn('[CalculatorTabs][DEBUG] Missing context or iblockId', {
                                context: context,
                                iblockId: iblockId,
                              })
                            }
                          }
                        }}
                        placeholder="Выберите калькулятор..."
                        data-pwcode="select-calculator"
                      />
                  </div>
                  {renderSelectedId(toNumber(calc.calculatorCode), 'calculator', 'btn-open-calculator-bitrix')}
                </div>
              </div>

              {(() => {
                  console.log('[CalculatorTabs][DEBUG] Render check for Operation field', {
                    hasSettings: !!settings,
                    settingsId: settings?.id,
                    useOperationVariantProp: settings ? getProperty(settings, 'USE_OPERATION_VARIANT') : null,
                    isEnabled: settings ? isPropertyEnabled(getProperty(settings, 'USE_OPERATION_VARIANT')) : false,
                  })
                  return null
                })()}

              {settings && isPropertyEnabled(getProperty(settings, 'USE_OPERATION_VARIANT')) && (
                <div className="space-y-2">
                  <Label>Операция</Label>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1">
                          <MultiLevelSelect
                            items={operationsHierarchy}
                            value={calc.operationId?.toString() || null}
                            onValueChange={(value) => {
                              const newOperationId = parseInt(value)
                              
                              handleUpdateCalculator(index, {
                                operationId: newOperationId,
                                equipmentId: null,  // Сбрасываем при смене операции
                                materialId: null,   // Сбрасываем при смене операции
                              })
                              
                              // Отправить запрос данных операции
                              if (value && bitrixMeta) {
                                const context = getBitrixContext()
                                const iblockId = bitrixMeta.iblocks.calcOperations
                                
                                if (context && iblockId) {
                                  const iblockType = bitrixMeta.iblocksTypes[iblockId]
                                  
                                  if (iblockType) {
                                    postMessageBridge.sendCalcOperationVariantRequest(
                                      newOperationId,
                                      iblockId,
                                      iblockType,
                                      context.lang
                                    )
                                  }
                                }
                              }
                            }}
                            placeholder="Выберите операцию..."
                            data-pwcode="select-operation"
                          />
                        </div>
                        {renderSelectedId(toNumber(calc.operationId), 'operation', 'btn-open-operation-bitrix')}
                        
                        {/* Поле количества операции */}
                        {isPropertyEnabled(getProperty(settings, 'USE_OPERATION_QUANTITY')) && (
                          <div className="flex gap-1 items-center">
                            <Input
                              type="number"
                              min="1"
                              value={calc.operationQuantity}
                              onChange={(e) => handleUpdateCalculator(index, {
                                operationQuantity: parseInt(e.target.value) || 1
                              })}
                              className="w-20 max-w-[80px]"
                            />
                            <span className="text-sm text-muted-foreground w-[40px] text-right">
                              {getOperationUnit(calc.operationId) || 'ед.'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div
                        className={cn(
                          "w-[60px] h-10 border-2 border-dashed rounded flex items-center justify-center flex-shrink-0 transition-all",
                          operationDropZoneHover === index
                            ? "border-accent bg-accent/10"
                            : "border-border bg-muted/30"
                        )}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setOperationDropZoneHover(index)
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setOperationDropZoneHover(null)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setOperationDropZoneHover(null)

                          try {
                            const jsonData = e.dataTransfer.getData('application/json')
                            if (jsonData) {
                              const data = JSON.parse(jsonData)

                              if (data.type === 'header-operation') {
                                handleUpdateCalculator(index, {
                                  operationId: data.operationId,
                                  equipmentId: null,
                                })
                              }
                            }
                          } catch (error) {
                            console.error('Operation drop error:', error)
                          }
                        }}
                        title="Перетащите операцию из шапки сюда"
                      >
                        <Wrench className={cn(
                          "w-5 h-5",
                          operationDropZoneHover === index
                            ? "text-accent-foreground"
                            : "text-muted-foreground"
                        )} />
                    </div>
                  </div>
                </div>
              )}

              {settings && calc.operationId && (
                <div className="space-y-2">
                  <Label>Оборудование</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <MultiLevelSelect
                          items={filteredEquipmentHierarchy}
                          value={calc.equipmentId?.toString() || null}
                          onValueChange={(value) => handleUpdateCalculator(index, { 
                            equipmentId: parseInt(value) 
                          })}
                          placeholder="Выберите оборудование..."
                          disabled={!calc.operationId}
                        />
                      </div>
                      <div
                        className={cn(
                          "w-[60px] h-10 border-2 border-dashed rounded flex items-center justify-center flex-shrink-0 transition-all",
                          equipmentDropZoneHover === index
                            ? "border-accent bg-accent/10"
                            : "border-border bg-muted/30"
                        )}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setEquipmentDropZoneHover(index)
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setEquipmentDropZoneHover(null)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setEquipmentDropZoneHover(null)
                          
                          try {
                            const jsonData = e.dataTransfer.getData('application/json')
                            if (jsonData) {
                              const data = JSON.parse(jsonData)
                              
                              if (data.type === 'header-equipment') {
                                handleUpdateCalculator(index, { 
                                  equipmentId: data.equipmentId 
                                })
                              }
                            }
                          } catch (error) {
                            console.error('Equipment drop error:', error)
                          }
                        }}
                        title="Перетащите оборудование из шапки сюда"
                      >
                        <Hammer className={cn(
                          "w-5 h-5",
                          equipmentDropZoneHover === index 
                            ? "text-accent-foreground" 
                            : "text-muted-foreground"
                        )} />
                      </div>
                    </div>
                  </div>
                )}

              {settings && isPropertyEnabled(getProperty(settings, 'USE_MATERIAL_VARIANT')) && (
                <div className="space-y-2">
                  <Label>Материал</Label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1">
                        <MultiLevelSelect
                          items={filteredMaterialsHierarchy}
                          value={calc.materialId?.toString() || null}
                          onValueChange={(value) => {
                            handleUpdateCalculator(index, {
                              materialId: parseInt(value)
                            })
                            
                            // Отправить запрос данных варианта материала
                            if (value && bitrixMeta) {
                              const context = getBitrixContext()
                              const iblockId = bitrixMeta.iblocks.calcMaterialsVariants
                              
                              if (context && iblockId) {
                                const iblockType = bitrixMeta.iblocksTypes[iblockId]
                                
                                if (iblockType) {
                                  postMessageBridge.sendCalcMaterialVariantRequest(
                                    parseInt(value, 10),
                                    iblockId,
                                    iblockType,
                                    context.lang
                                  )
                                }
                              }
                            }
                          }}
                          placeholder="Выберите материал..."
                        />
                      </div>
                      {renderSelectedId(toNumber(calc.materialId), 'material', 'btn-open-material-bitrix')}
                      
                      {/* Поле количества материала */}
                      {isPropertyEnabled(getProperty(settings, 'USE_MATERIAL_QUANTITY')) && (
                        <div className="flex gap-1 items-center">
                          <Input
                            type="number"
                            min="1"
                            value={calc.materialQuantity}
                            onChange={(e) => handleUpdateCalculator(index, {
                              materialQuantity: parseInt(e.target.value) || 1
                            })}
                            className="w-20 max-w-[80px]"
                          />
                          <span className="text-sm text-muted-foreground w-[40px] text-right">
                            {getMaterialUnit(calc.materialId) || 'шт.'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div
                      className={cn(
                        "w-[60px] h-10 border-2 border-dashed rounded flex items-center justify-center flex-shrink-0 transition-all",
                        materialDropZoneHover === index
                          ? "border-accent bg-accent/10"
                          : "border-border bg-muted/30"
                      )}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMaterialDropZoneHover(index)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMaterialDropZoneHover(null)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMaterialDropZoneHover(null)

                        try {
                          const jsonData = e.dataTransfer.getData('application/json')
                          if (jsonData) {
                            const data = JSON.parse(jsonData)

                            if (data.type === 'header-material') {
                              handleUpdateCalculator(index, {
                                materialId: data.materialId
                              })
                            }
                          }
                        } catch (error) {
                          console.error('Material drop error:', error)
                        }
                      }}
                      title="Перетащите материал из шапки сюда"
                    >
                      <Package className={cn(
                        "w-5 h-5",
                        materialDropZoneHover === index
                          ? "text-accent-foreground"
                          : "text-muted-foreground"
                      )} />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Блок extraOptions */}
              {settings && getExtraOptions(settings).length > 0 && (
                <div className="space-y-3 border-t border-border pt-3">
                  {getExtraOptions(settings).map(option => (
                    <div key={option.code} className="space-y-2">
                      <Label>{option.label}</Label>
                      {option.type === 'checkbox' ? (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${calc.id}-${option.code}`}
                            checked={calc.extraOptions?.[option.code] ?? option.default}
                            onCheckedChange={(checked) => handleUpdateCalculator(index, {
                              extraOptions: {
                                ...(calc.extraOptions || {}),
                                [option.code]: checked,
                              }
                            })}
                          />
                          <label htmlFor={`${calc.id}-${option.code}`} className="text-sm">
                            {option.label}
                          </label>
                        </div>
                      ) : (
                        <div className="flex gap-1 items-center">
                          <Input
                            type="number"
                            min={option.min}
                            max={option.max}
                            value={calc.extraOptions?.[option.code] ?? option.default}
                            onChange={(e) => handleUpdateCalculator(index, {
                              extraOptions: {
                                ...(calc.extraOptions || {}),
                                [option.code]: parseFloat(e.target.value) || option.default,
                              }
                            })}
                            className="flex-1 max-w-[80px]"
                          />
                          <span className="text-sm text-muted-foreground w-[40px] text-right">
                            {option.unit || ''}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
