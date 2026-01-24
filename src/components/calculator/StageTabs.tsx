import { useState, useRef, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, X, DotsSixVertical, Package, Wrench, Hammer, ArrowSquareOut, Gear } from '@phosphor-icons/react'
import { StageInstance, createEmptyStage } from '@/lib/types'
import { MultiLevelSelect, MultiLevelItem } from './MultiLevelSelect'
import { CalculationLogicDialog } from './CalculationLogicDialog'
import { OptionsDialog } from './OptionsDialog'
import { useReferencesStore } from '@/stores/references-store'
import { useCalculatorSettingsStore, CalcSettingsItem } from '@/stores/calculator-settings-store'
import { useOperationSettingsStore } from '@/stores/operation-settings-store'
import { useMaterialSettingsStore } from '@/stores/material-settings-store'
import { useOperationVariantStore } from '@/stores/operation-variant-store'
import { useMaterialVariantStore } from '@/stores/material-variant-store'
import { useCustomDrag } from '@/hooks/use-custom-drag'
import { cn } from '@/lib/utils'
import { InitPayload, postMessageBridge } from '@/lib/postmessage-bridge'
import { getBitrixContext, openBitrixAdmin, getIblockByCode } from '@/lib/bitrix-utils'
import { toast } from 'sonner'
import { BitrixProperty } from '@/lib/bitrix-transformers'
import { getDraftKey, calculateStageReadiness, hasDraftForStage, extractLogicJsonString } from '@/lib/stage-utils'

interface StageTabsProps {
  calculators: StageInstance[]
  onChange: (calculators: StageInstance[]) => void
  bitrixMeta?: InitPayload | null
  onValidationMessage?: (type: 'info' | 'warning' | 'error' | 'success', message: string) => void
  detailId?: number  // ID детали (Bitrix) для отправки ADD_STAGE_REQUEST
}

const TAB_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

// Рекурсивная функция фильтрации иерархии по списку разрешённых значений
const filterHierarchyByValues = (
  items: MultiLevelItem[], 
  allowedValues: string[]
): MultiLevelItem[] => {
  return items
   .map(item => {
      // Если это конечный элемент (есть value и нет детей) — проверяем, входит ли в список
      if (item.value && (! item.children || item.children.length === 0)) {
        return allowedValues.includes(item.value) ? item : null
      }
      
      // Если это раздел с детьми — рекурсивно фильтруем детей
      if (item.children && item.children.length > 0) {
        const filteredChildren = filterHierarchyByValues(item.children, allowedValues)
        // Оставляем раздел только если в нём есть отфильтрованные дети
        if (filteredChildren.length > 0) {
          return {...item, children: filteredChildren }
        }
      }
      
      return null
    })
   .filter((item): item is MultiLevelItem => item !== null)
}

// Рекурсивный поиск первого элемента с value в иерархии
const findFirstSelectableValue = (items: MultiLevelItem[]): string | null => {
  for (const item of items) {
    // Если это конечный элемент с value
    if (item.value && (! item.children || item.children.length === 0)) {
      return item.value
    }
    // Если есть дети — ищем рекурсивно
    if (item.children && item.children.length > 0) {
      const found = findFirstSelectableValue(item.children)
      if (found) return found
    }
  }
  return null
}

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
const getPropertyStringValue = (prop:  BitrixProperty | undefined): string | null => {
  if (!prop) return null
  const value = prop.VALUE_XML_ID ??  prop.VALUE
  return typeof value === 'string' ? value : null
}

// Получение массива значений свойства
const getPropertyArrayValue = (prop:  BitrixProperty | undefined): string[] => {
  if (!prop) return []
  const value = prop.VALUE
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value) return [value]
  return []
}

/**
 * Проверка что значение является валидной строкой для фильтрации.
 * 
 * @param v - Значение для проверки
 * @returns true если это непустая строка и не "false" (которое Bitrix возвращает вместо пустого списка)
 * 
 * @remarks
 * Строка "false" специально считается невалидной, так как Bitrix возвращает её
 * когда свойство не заполнено, что должно означать "показать все элементы"
 */
const isValidStringValue = (v: unknown): v is string => {
  return typeof v === 'string' && v !== '' && v !== 'false'
}

/**
 * Безопасное получение массива значений из свойства Bitrix.
 * Обрабатывает случаи когда значение:  null, undefined, false, "false", "", пустой массив.
 * Возвращает пустой массив если значение невалидно — это означает "показать все".
 */
const getSupportedList = (value: unknown): string[] => {
  // Число — преобразуем в строку
  if (typeof value === 'number') {
    return [String(value)]
  }
  
  // Валидная строка — возвращаем как массив из одного элемента
  if (isValidStringValue(value)) {
    return [value]
  }
  
  // Массив — фильтруем пустые и невалидные элементы
  if (Array.isArray(value)) {
    return value.filter(isValidStringValue)
  }
  
  // Пустые/невалидные значения — вернуть пустой массив (показать все)
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

// Новые интерфейсы для расширенной поддержки OTHER_OPTIONS
interface OtherOptionField {
  code:  string
  name: string
  type: 'number' | 'checkbox' | 'text' | 'select'
  unit?: string
  default?:  number | boolean | string
  min?:  number
  max?:  number
  step?: number
  maxLength?: number
  required?: boolean
  options?: Array<{ value: string; label:  string }>
}

interface OtherOptionsConfig {
  fields: OtherOptionField[]
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

// Парсинг расширенных опций из OTHER_OPTIONS
const parseOtherOptions = (settings: CalcSettingsItem | undefined): OtherOptionField[] => {
  if (!settings) return []
  
  const otherOptions = settings.properties?.OTHER_OPTIONS
  if (!otherOptions) return []
  
  let jsonString = ''
  
  // Проверяем ~VALUE.TEXT (приоритет)
  const tildeValue = (otherOptions as any)['~VALUE']
  if (tildeValue && typeof tildeValue === 'object' && 'TEXT' in tildeValue) {
    jsonString = tildeValue.TEXT
  } else if (typeof otherOptions.VALUE === 'object' && otherOptions.VALUE !== null && 'TEXT' in otherOptions.VALUE) {
    jsonString = (otherOptions.VALUE as { TEXT: string }).TEXT
  } else if (typeof otherOptions.VALUE === 'string') {
    jsonString = otherOptions.VALUE
  }
  
  if (!jsonString) return []
  
  try {
    const parsed = JSON.parse(jsonString)
    if (typeof parsed !== 'object' || parsed === null || ! Array.isArray(parsed.fields)) {
      console.warn('[CalculatorTabs] OTHER_OPTIONS has invalid structure:', parsed)
      return []
    }
    return parsed.fields as OtherOptionField[]
  } catch (e) {
    console.warn('[CalculatorTabs] Failed to parse OTHER_OPTIONS:', e)
    return []
  }
}

export function StageTabs({ calculators, onChange, bitrixMeta = null, onValidationMessage, detailId }: StageTabsProps) {
  const [activeTab, setActiveTab] = useState(0)
  const { dragState, startDrag, setDropTarget, endDrag, cancelDrag } = useCustomDrag()
  const tabRefs = useRef<Map<number, HTMLElement>>(new Map())
  const dropZoneRefs = useRef<Map<number, HTMLElement>>(new Map())
  const [materialDropZoneHover, setMaterialDropZoneHover] = useState<number | null>(null)
  const [operationDropZoneHover, setOperationDropZoneHover] = useState<number | null>(null)
  const [equipmentDropZoneHover, setEquipmentDropZoneHover] = useState<number | null>(null)
  const reportedValidationKeysRef = useRef<Set<string>>(new Set())
  const [calculationLogicDialogOpen, setCalculationLogicDialogOpen] = useState(false)
  const [calculationLogicStageIndex, setCalculationLogicStageIndex] = useState<number | null>(null)
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false)
  const [optionsDialogType, setOptionsDialogType] = useState<'operation' | 'material'>('operation')
  const [optionsDialogStageIndex, setOptionsDialogStageIndex] = useState<number | null>(null)

  // Track pending save to detect when save completes using hash comparison
  const pendingSaveRef = useRef<{
    settingsId: number
    stageId: number
    sentParamsHash: string
    sentLogicJsonHash: string
    sentInputsHash: string
    sentOutputsHash: string
  } | null>(null)

  // Simple hash functions for comparing data
  const hashString = (str: string): string => str
  const hashArray = (arr: string[]): string => JSON.stringify(arr)

  // Handle INIT updates - close logic dialog and clear draft after successful save
  // This only triggers when there's a pending save (not just because LOGIC_JSON exists)
  useEffect(() => {
    // Only proceed if there's a pending save
    if (!pendingSaveRef.current) return
    if (!calculationLogicDialogOpen) return
    
    const { settingsId, stageId, sentParamsHash, sentLogicJsonHash, sentInputsHash, sentOutputsHash } = pendingSaveRef.current
    
    // Find the elements in CALC_SETTINGS and CALC_STAGES
    const settingsElement = bitrixMeta?.elementsStore?.CALC_SETTINGS?.find(
      s => s.id === settingsId
    )
    const stageElement = bitrixMeta?.elementsStore?.CALC_STAGES?.find(
      s => s.id === stageId
    )
    
    if (!settingsElement || !stageElement) return
    
    // Compare hashes
    const currentParamsValue = settingsElement.properties?.PARAMS?.VALUE
    const currentParamsHash = hashArray(Array.isArray(currentParamsValue) ? currentParamsValue : [])
    
    const currentLogicJsonProp = settingsElement.properties?.LOGIC_JSON
    const currentLogicJson = extractLogicJsonString(currentLogicJsonProp)
    const currentLogicJsonHash = hashString(currentLogicJson || '')
    
    const currentInputsValue = stageElement.properties?.INPUTS?.VALUE
    const currentInputsHash = hashArray(Array.isArray(currentInputsValue) ? currentInputsValue : [])
    
    const currentOutputsValue = stageElement.properties?.OUTPUTS?.VALUE
    const currentOutputsHash = hashArray(Array.isArray(currentOutputsValue) ? currentOutputsValue : [])
    
    const allMatch = 
      sentParamsHash === currentParamsHash &&
      sentLogicJsonHash === currentLogicJsonHash &&
      sentInputsHash === currentInputsHash &&
      sentOutputsHash === currentOutputsHash
    
    if (allMatch) {
      // SUCCESS
      pendingSaveRef.current = null
      
      // Clear draft using both stageId and settingsId
      const draftKey = getDraftKey(stageId, settingsId)
      localStorage.removeItem(draftKey)
      
      // Close popup
      setCalculationLogicDialogOpen(false)
      
      // Show success toast
      toast.success('Сохранено')
    } else if (currentLogicJson) {
      // INIT обновился, но данные не совпали - не закрываем popup
      // Оставляем pendingSaveRef.current, чтобы продолжить проверку
    }
  }, [bitrixMeta, calculationLogicDialogOpen])

  // Reset pending save when dialog closes
  useEffect(() => {
    if (!calculationLogicDialogOpen) {
      pendingSaveRef.current = null
    }
  }, [calculationLogicDialogOpen])

  // Callback for dialog to notify when save is requested
  const handleSaveRequest = useCallback((settingsId: number, stageId: number, payloadJson: string) => {
    try {
      // Parse payload to extract data for hashing
      const payload = JSON.parse(payloadJson)
      
      // Extract params names for hash
      const paramsNames = payload.calcSettings.params.map((p: any) => p.name)
      
      // Extract inputs names for hash
      const inputsNames = payload.stageWiring.inputs.map((i: any) => i.name)
      
      // Extract outputs keys for hash
      const outputsKeys = payload.stageWiring.outputs.map((o: any) => o.key)
      
      pendingSaveRef.current = {
        settingsId,
        stageId,
        sentParamsHash: hashArray(paramsNames),
        sentLogicJsonHash: hashString(payload.calcSettings.logicJson),
        sentInputsHash: hashArray(inputsNames),
        sentOutputsHash: hashArray(outputsKeys)
      }
    } catch (e) {
      console.error('Failed to parse payload for hash comparison', e)
    }
  }, [])

  const getEntityIblockInfo = (entity: 'calculator' | 'operation' | 'material' | 'stage' | 'config') => {
    if (!bitrixMeta) return null

    const iblockCodeMap: Record<typeof entity, string> = {
      calculator:  'CALC_SETTINGS',
      operation: 'CALC_OPERATIONS_VARIANTS',
      material: 'CALC_MATERIALS_VARIANTS',
      stage: 'CALC_STAGES',
      config: 'CALC_PRESETS',
    }

    const iblockCode = iblockCodeMap[entity]
    const iblock = getIblockByCode(bitrixMeta.iblocks, iblockCode)
    
    if (! iblock) return null

    const context = getBitrixContext()
    const lang = context?.lang || bitrixMeta.context?.lang

    if (!lang) return null

    return { iblockId: iblock.id, iblockType: iblock.type, lang }
  }

  const toNumber = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null

    if (typeof value === 'number') return value

    const parsed = parseInt(value, 10)
    return Number.isNaN(parsed) ? null : parsed
  }

  const openEntity = (entity: 'calculator' | 'operation' | 'material' | 'stage' | 'config', id: number | null) => {
    if (!id) return

    const iblockInfo = getEntityIblockInfo(entity)

    if (iblockInfo) {
      try {
        openBitrixAdmin({
          iblockId: iblockInfo.iblockId,
          type:  iblockInfo.iblockType,
          lang: iblockInfo.lang,
          id,
        })
      } catch (error) {
        const message = error instanceof Error ?  error.message : 'Не удалось открыть элемент Bitrix'
        toast.error(message)
      }
    } else {
      window.open(`#${entity}-${id}`, '_blank')
    }
  }

  const renderSelectedId = (id: number | null, entity: 'calculator' | 'operation' | 'material', pwcode: string) => (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="font-mono">ID:{id ??  'N/A'}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        disabled={! id}
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
  
  // Helper function to get operation unit from measure.symbol
  const getOperationUnit = (operationId: number | null): string => {
    if (!operationId) return 'ед.'
    const variant = operationVariants[operationId.toString()]
    // Сначала проверяем measure.symbol
    if (variant?.measure?.symbol) {
      return variant.measure.symbol
    }
    // Fallback на свойство MEASURE_UNIT
    if (variant?.properties?.MEASURE_UNIT?.VALUE) {
      const value = variant.properties.MEASURE_UNIT.VALUE
      return typeof value === 'string' ? value : 'ед.'
    }
    return 'ед.'
  }
  
  // Helper function to get material unit from measure.symbol
  const getMaterialUnit = (materialId: number | null): string => {
    if (! materialId) return 'шт.'
    
    // Пробуем оба варианта ключа
    const variant = materialVariants[materialId.toString()] || materialVariants[materialId]
    
    console.log('[getMaterialUnit] Debug:', {
      materialId,
      variantFound: !!variant,
      measureSymbol: variant?.measure?.symbol,
      measureUnit: variant?.properties?.MEASURE_UNIT?.VALUE,
    })
    
    // Сначала проверяем measure.symbol
    if (variant?.measure?.symbol) {
      return variant.measure.symbol
    }
    // Fallback на свойство MEASURE_UNIT
    if (variant?.properties?.MEASURE_UNIT?.VALUE) {
      const value = variant.properties.MEASURE_UNIT.VALUE
      return typeof value === 'string' ? value : 'шт.'
    }
    return 'шт.'
  }
  
  const safeCalculators = calculators || []

  const handleAddCalculator = () => {
    // Только отправить запрос с detailId, НЕ обновлять UI
    // UI обновится при получении RESPONSE
    if (bitrixMeta && detailId) {
      console.log('[ADD_STAGE_REQUEST] Sending...', { detailId })
      postMessageBridge.sendAddStageRequest({
        detailId: detailId,
      })
      // UI не обновляем — ждём INIT
    }
  }

  const handleRemoveCalculator = (index:  number) => {
    // Показываем диалог подтверждения
    if (!window.confirm('Вы уверены, что хотите удалить этот этап?')) {
      return
    }
    
    const stage = safeCalculators[index]
    // Только отправить запрос, НЕ обновлять UI
    // UI обновится при получении RESPONSE
    if (stage?.stageId && bitrixMeta && detailId) {
      const stagesIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_STAGES')
      if (stagesIblock) {
        postMessageBridge.sendDeleteStageRequest({
          stageId: stage.stageId,
          detailId: detailId,
          previousStageId: safeCalculators[index - 1]?.stageId,
          nextStageId: safeCalculators[index + 1]?.stageId,
          iblockId: stagesIblock.id,
          iblockType: stagesIblock.type,
        })
      }
    }
  }

  const handleUpdateCalculator = (index: number, updates: Partial<StageInstance>) => {
    const newCalculators = safeCalculators.map((calc, i) => 
      i === index ? {...calc,...updates } : calc
    )
    onChange(newCalculators)
  }

  const handleQuantityBlur = (index: number, field: 'operationQuantity' | 'materialQuantity') => {
    const stage = safeCalculators[index]
    if (stage?.stageId && bitrixMeta) {
      // Send specific quantity change request based on field
      if (field === 'operationQuantity') {
        postMessageBridge.sendChangeOperationQuantityRequest({
          stageId: stage.stageId,
          quantityValue: stage.operationQuantity,
        })
      } else if (field === 'materialQuantity') {
        postMessageBridge.sendChangeMaterialQuantityRequest({
          stageId: stage.stageId,
          quantityValue: stage.materialQuantity,
        })
      }
    }
  }

  const handleCustomFieldsBlur = (index: number) => {
    const stage = safeCalculators[index]
    if (stage?.stageId && bitrixMeta && stage.customFields) {
      // Convert customFields object to array format expected by Bitrix
      const customFieldsArray = Object.entries(stage.customFields).map(([code, value]) => ({
        CODE: code,
        VALUE: String(value),
      }))
      
      postMessageBridge.sendChangeCustomFieldsValueRequest({
        stageId: stage.stageId,
        customFieldsValue: customFieldsArray,
      })
    }
  }

  const reorderStages = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    
    const reorderedCalculators = [...safeCalculators]
    const [movedItem] = reorderedCalculators.splice(fromIndex, 1)
    
    // Insert at toIndex directly (no adjustment needed)
    // After splice, toIndex already represents the correct position
    // Example: Moving from 0 to 1 in [A, B, C]
    //   - After splice(0,1): [B, C]
    //   - Insert at 1: [B, A, C] ✓
    reorderedCalculators.splice(toIndex, 0, movedItem)
    
    onChange(reorderedCalculators)
    setActiveTab(toIndex)
    
    // Отправить событие сортировки в Битрикс
    if (bitrixMeta && detailId) {
      const orderedIds = reorderedCalculators
        .map(calc => calc.stageId)
        .filter((id): id is number => id !== undefined && id !== null)
      
      if (orderedIds.length > 0) {
        postMessageBridge.sendChangeSortStageRequest({
          detailId: detailId,
          sorting: orderedIds,
        })
      }
    }
  }

  const handleStageDragStart = (element: HTMLElement, e: React.MouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    const calcId = safeCalculators[index]?.id
    if (! calcId) return
    startDrag(calcId, 'stage', element, e.clientX, e.clientY)
  }

  useEffect(() => {
    if (! dragState.isDragging || dragState.draggedItemType !== 'stage') return

    const handleMouseMove = (e: MouseEvent) => {
      let nearestDropZone:  number | null = null
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
      calculatorsCount:  safeCalculators.length,
      calculatorSettingsKeys: Object.keys(calculatorSettings),
      calculatorSettings: calculatorSettings,
    })

    const previousViolations = reportedValidationKeysRef.current
    const nextViolations = new Set<string>()

    safeCalculators.forEach((calc, index) => {
      console.log('[CalculatorTabs][DEBUG] Processing calculator', {
        index,
        id: calc.id,
        settingsId: calc.settingsId,
        operationVariantId: calc.operationVariantId,
        materialVariantId: calc.materialVariantId,
        equipmentId: calc.equipmentId,
      })

      if (! calc.settingsId) {
        console.log('[CalculatorTabs][DEBUG] No calculatorCode, skipping')
        return
      }
      
      const settings = calculatorSettings[calc.settingsId]
      console.log('[CalculatorTabs][DEBUG] Found settings for code', {
        code:  calc.settingsId,
        hasSettings: !!settings,
        settingsId: settings?.id,
        settingsName: settings?.name,
        hasProperties: !!settings?.properties,
        propertiesKeys: settings?.properties ?  Object.keys(settings.properties) : [],
      })

      if (!settings?.properties) {
        console.log('[CalculatorTabs][DEBUG] No properties in settings')
        return
      }

      // Log property checks
      const useOperationVariant = getProperty(settings, 'USE_OPERATION_VARIANT')
      const useMaterialVariant = getProperty(settings, 'USE_MATERIAL_VARIANT')
      
      console.log('[CalculatorTabs][DEBUG] Property check results', {
        useOperationVariant:  useOperationVariant,
        useOperationVariantEnabled: isPropertyEnabled(useOperationVariant),
        useMaterialVariant: useMaterialVariant,
        useMaterialVariantEnabled: isPropertyEnabled(useMaterialVariant),
      })
      
      // Validation:  CAN_BE_FIRST
      const canBeFirst = getProperty(settings, 'CAN_BE_FIRST')
      const violationKeyBase = `${calc.id ??  calc.settingsId ??  'calculator'}-${index}`

      const reportValidationOnce = (key: string, message: string) => {
        nextViolations.add(key)
        if (onValidationMessage && ! previousViolations.has(key)) {
          onValidationMessage('error', message)
        }
      }

      if (index === 0 && ! isPropertyEnabled(canBeFirst)) {
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
          if (! prevCalc.settingsId || prevCalc.settingsId !== requiresBeforeValue) {
            const prevSettings = prevCalc.settingsId ? calculatorSettings[prevCalc.settingsId] : null
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
      if (defaultOpValue && !calc.operationVariantId) {
        const defaultOpId = parseInt(defaultOpValue, 10)
        if (! isNaN(defaultOpId) && calc.operationVariantId !== defaultOpId) {
          handleUpdateCalculator(index, { operationVariantId:  defaultOpId })
          
          // Send CHANGE_OPERATION_VARIANT_REQUEST if stageId exists
          if (calc.stageId && bitrixMeta) {
            postMessageBridge.sendChangeOperationVariantRequest({
              operationVariantId: defaultOpId,
              stageId: calc.stageId,
            })
          }
          
          // Send request to get operation data (to receive itemParent with filters)
          if (bitrixMeta) {
            const context = getBitrixContext()
            const operationsIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_OPERATIONS')
            
            if (context && operationsIblock) {
              postMessageBridge.sendCalcOperationVariantRequest(
                defaultOpId,
                operationsIblock.id,
                operationsIblock.type,
                context.lang
              )
            }
          }
        }
      }
      
      // Auto-select DEFAULT_MATERIAL_VARIANT  
      const defaultMaterialVariant = getProperty(settings, 'DEFAULT_MATERIAL_VARIANT')
      const defaultMatValue = getPropertyStringValue(defaultMaterialVariant)
      if (defaultMatValue && !calc.materialVariantId) {
        const defaultMatId = parseInt(defaultMatValue, 10)
        if (!isNaN(defaultMatId) && calc.materialVariantId !== defaultMatId) {
          console.log('[CalculatorTabs] Setting default material:', {
            materialVariantId: defaultMatId,
            storeHasVariant: !!materialVariants[defaultMatId?.toString()],
            allStoreKeys: Object.keys(materialVariants),
          })
          
          handleUpdateCalculator(index, { materialVariantId: defaultMatId })
          
          // Send CHANGE_MATERIAL_VARIANT_REQUEST if stageId exists
          if (calc.stageId && bitrixMeta) {
            postMessageBridge.sendChangeMaterialVariantRequest({
              materialVariantId: defaultMatId,
              stageId: calc.stageId,
            })
          }
          
          // Send request to get material variant data
          if (bitrixMeta) {
            const context = getBitrixContext()
            const materialsVariantsIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_MATERIALS_VARIANTS')
            
            if (context && materialsVariantsIblock) {
              postMessageBridge.sendCalcMaterialVariantRequest(
                defaultMatId,
                materialsVariantsIblock.id,
                materialsVariantsIblock.type,
                context.lang
              )
            }
          }
        }
      }
    })

    reportedValidationKeysRef.current = nextViolations
  }, [safeCalculators, calculatorSettings, onValidationMessage])
  
  // Auto-select first equipment/material when operation settings are loaded
  useEffect(() => {
    safeCalculators.forEach((calc, index) => {
      // Skip if no operation selected
      if (!calc.operationVariantId) return
      
      const operationSettingsItem = operationSettings[calc.operationVariantId.toString()]
      // Skip if operation settings not yet loaded
      if (! operationSettingsItem) return
      
      const parentOperation = operationSettingsItem.itemParent
      // Skip if itemParent not yet loaded
      if (!parentOperation) return
      
      // Get supported equipment list from parent operation
      const supportedEquipmentList = getSupportedList(
        parentOperation.properties?.SUPPORTED_EQUIPMENT_LIST?.VALUE
      )
      
      // Get supported materials list from parent operation
      const supportedMaterialsVariantsList = getSupportedList(
        parentOperation.properties?.SUPPORTED_MATERIALS_VARIANTS_LIST?.VALUE
      )
      
      // Auto-select equipment if not selected
      if (!calc.equipmentId) {
        const hierarchyToSearch = supportedEquipmentList.length > 0
          ? filterHierarchyByValues(equipmentHierarchy, supportedEquipmentList)
          : equipmentHierarchy
        
        const firstEquipmentValue = findFirstSelectableValue(hierarchyToSearch)
        if (firstEquipmentValue) {
          const equipmentId = parseInt(firstEquipmentValue)
          handleUpdateCalculator(index, { equipmentId })
          
          // Send CHANGE_EQUIPMENT_REQUEST if stageId exists
          if (calc.stageId && bitrixMeta) {
            postMessageBridge.sendChangeEquipmentRequest({
              equipmentId,
              stageId: calc.stageId,
            })
          }
        }
      }
      
      // Auto-select material if not selected
      if (!calc.materialVariantId) {
        const hierarchyToSearch = supportedMaterialsVariantsList.length > 0
          ? filterHierarchyByValues(materialsHierarchy, supportedMaterialsVariantsList)
          : materialsHierarchy
        
        const firstMaterialValue = findFirstSelectableValue(hierarchyToSearch)
        if (firstMaterialValue) {
          const materialVariantId = parseInt(firstMaterialValue)
          handleUpdateCalculator(index, { materialVariantId })
          
          // Send CHANGE_MATERIAL_VARIANT_REQUEST if stageId exists
          if (calc.stageId && bitrixMeta) {
            postMessageBridge.sendChangeMaterialVariantRequest({
              materialVariantId,
              stageId: calc.stageId,
            })
          }
          
          // Send request for material variant data
          if (bitrixMeta) {
            const context = getBitrixContext()
            const materialsVariantsIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_MATERIALS_VARIANTS')
            
            if (context && materialsVariantsIblock) {
              postMessageBridge.sendCalcMaterialVariantRequest(
                materialVariantId,
                materialsVariantsIblock.id,
                materialsVariantsIblock.type,
                context.lang
              )
            }
          }
        }
      }
    })
  }, [operationSettings, safeCalculators, equipmentHierarchy, materialsHierarchy, bitrixMeta])
  
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
                      className={cn(
                        "gap-1 data-[state=active]:bg-muted-foreground/80 data-[state=active]:text-primary-foreground",
                        // Adjust padding based on number of buttons:
                        // - Single stage with stageId: pr-7 (for open button)
                        // - Single stage without stageId: pr-2 (no buttons)
                        // - Multiple stages with stageId: pr-12 (for both open and delete buttons)
                        // - Multiple stages without stageId: pr-8 (for delete button only)
                        safeCalculators.length === 1 
                          ? (calc.stageId ? "pr-7" : "pr-2")
                          : (calc.stageId ? "pr-12" : "pr-8")
                      )}
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
                      <span>{calc.stageName ? `Этап #${index + 1}: ${calc.stageName}` : `Этап #${index + 1}`}</span>
                      {/* Readiness indicator */}
                      {calc.stageId && calc.settingsId && (() => {
                        const stageElement = bitrixMeta?.elementsStore?.CALC_STAGES?.find(
                          s => s.id === calc.stageId
                        )
                        const outputsValue = stageElement?.properties?.OUTPUTS?.VALUE as string[] | undefined
                        const hasDraft = hasDraftForStage(calc.stageId, calc.settingsId)
                        const readiness = calculateStageReadiness(
                          outputsValue,
                          hasDraft
                        )
                        
                        return readiness.ready ? null : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge 
                                  variant="outline" 
                                  className="ml-1 text-yellow-600 border-yellow-600 bg-yellow-50 dark:bg-yellow-950"
                                >
                                  !
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {readiness.reason}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      })()}
                    </TabsTrigger>
                    {/* Button to open stage in Bitrix */}
                    {calc.stageId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 h-5 w-5 p-0 rounded-full hover:bg-accent hover:text-accent-foreground text-primary-foreground/60 hover:text-primary-foreground z-10",
                          safeCalculators.length === 1 ? "right-1" : "right-6"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEntity('stage', calc.stageId!)
                        }}
                        data-pwcode="btn-open-stage-bitrix"
                      >
                        <ArrowSquareOut className="w-3 h-3" />
                      </Button>
                    )}
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
              position:  'fixed',
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
              {(() => {
                const draggedStageIndex = safeCalculators.findIndex(calc => calc.id === dragState.draggedItemId)
                const draggedStage = safeCalculators[draggedStageIndex]
                return draggedStage?.stageName 
                  ? `Этап #${draggedStageIndex + 1}: ${draggedStage.stageName}` 
                  : `Этап #${draggedStageIndex + 1}`
              })()}
            </div>
          </div>
        )}

        {safeCalculators.map((calc, index) => {
          // Get settings from store if calculatorCode is set
          const settings = calc.settingsId ?  calculatorSettings[calc.settingsId.toString()] : undefined
          
          // Get operation settings from store
          const operationSettingsItem = calc.operationVariantId 
            ? operationSettings[calc.operationVariantId.toString()]
            : undefined
          
          // SUPPORTED_EQUIPMENT_LIST находится в родительской операции (itemParent)
          const parentOperation = operationSettingsItem?.itemParent
          const supportedEquipmentList = getSupportedList(
            parentOperation?.properties?.SUPPORTED_EQUIPMENT_LIST?.VALUE
          )
          
          // Filter equipment based on SUPPORTED_EQUIPMENT_LIST from operation settings
          const filteredEquipmentHierarchy = supportedEquipmentList.length > 0
            ? filterHierarchyByValues(equipmentHierarchy, supportedEquipmentList)
            : equipmentHierarchy
          
          console.log('[CalculatorTabs][DEBUG] Filtering equipment', {
            rawValue: parentOperation?.properties?.SUPPORTED_EQUIPMENT_LIST?.VALUE,
            parsedList: supportedEquipmentList,
            willFilter: supportedEquipmentList.length > 0,
            originalCount: equipmentHierarchy.length,
            filteredCount: filteredEquipmentHierarchy.length,
            filteredHierarchy: filteredEquipmentHierarchy,
          })
          
          // Filter materials based on SUPPORTED_MATERIALS_VARIANTS_LIST from operation settings
          const supportedMaterialsVariantsList = getSupportedList(
            parentOperation?.properties?.SUPPORTED_MATERIALS_VARIANTS_LIST?.VALUE
          )
          const filteredMaterialsHierarchy = supportedMaterialsVariantsList.length > 0
            ? filterHierarchyByValues(materialsHierarchy, supportedMaterialsVariantsList)
            : materialsHierarchy
          
          console.log('[CalculatorTabs][DEBUG] Filtering materials', {
            rawValue: parentOperation?.properties?.SUPPORTED_MATERIALS_VARIANTS_LIST?.VALUE,
            parsedList:  supportedMaterialsVariantsList,
            willFilter: supportedMaterialsVariantsList.length > 0,
            originalCount: materialsHierarchy.length,
            filteredCount: filteredMaterialsHierarchy.length,
            filteredHierarchy: filteredMaterialsHierarchy,
          })

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
                        value={calc.settingsId?.toString() || null}
                        onValueChange={(value) => {
                          const newSettingsId = parseInt(value, 10)
                          console.log('[CHANGE_SETTINGS_REQUEST] Sending...', { 
                            settingsId: newSettingsId, 
                            stageId: calc.stageId 
                          })

                          // Send CHANGE_SETTINGS_REQUEST to Bitrix
                          if (calc.stageId && bitrixMeta) {
                            postMessageBridge.sendChangeSettingsRequest({
                              settingsId: newSettingsId,
                              stageId: calc.stageId,
                            })
                          }

                          // Also request settings data if not already loaded
                          // This is separate from CHANGE_SETTINGS_REQUEST:
                          // - CHANGE_SETTINGS_REQUEST updates the stage's calculator in Bitrix
                          // - sendCalcSettingsRequest loads the calculator's full properties for UI rendering
                          if (!calculatorSettings[newSettingsId] && bitrixMeta) {
                            const context = getBitrixContext()
                            const settingsIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_SETTINGS')
                            
                            if (context && settingsIblock) {
                              postMessageBridge.sendCalcSettingsRequest(
                                newSettingsId,
                                settingsIblock.id,
                                settingsIblock.type,
                                context.lang
                              )
                            }
                          }
                          
                          // UI не обновляем вручную — ждём INIT
                        }}
                        placeholder="Выберите калькулятор..."
                        data-pwcode="select-calculator"
                        bitrixMeta={bitrixMeta}
                      />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => {
                      setCalculationLogicStageIndex(index)
                      setCalculationLogicDialogOpen(true)
                    }}
                    data-pwcode="btn-calculator-logic"
                    title="Логика расчёта"
                  >
                    <Gear className="w-4 h-4" />
                  </Button>
                  {renderSelectedId(toNumber(calc.settingsId), 'calculator', 'btn-open-calculator-bitrix')}
                </div>
              </div>

              {(() => {
                  console.log('[CalculatorTabs][DEBUG] Render check for Operation field', {
                    hasSettings: !!settings,
                    settingsId: settings?.id,
                    useOperationVariantProp: settings ?  getProperty(settings, 'USE_OPERATION_VARIANT') : null,
                    isEnabled: settings ?  isPropertyEnabled(getProperty(settings, 'USE_OPERATION_VARIANT')) : false,
                  })
                  return null
                })()}

              {settings && isPropertyEnabled(getProperty(settings, 'USE_OPERATION_VARIANT')) && (
                <div className="space-y-2">
                  <Label>Операция</Label>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <MultiLevelSelect
                          items={operationsHierarchy}
                          value={calc.operationVariantId?.toString() || null}
                          onValueChange={(value) => {
                            const newOperationId = parseInt(value)
                            console.log('[CHANGE_OPERATION_VARIANT_REQUEST] Sending...', { 
                              operationVariantId: newOperationId, 
                              stageId: calc.stageId 
                            })
                            
                            // Send CHANGE_OPERATION_VARIANT_REQUEST to Bitrix
                            if (calc.stageId && bitrixMeta) {
                              postMessageBridge.sendChangeOperationVariantRequest({
                                operationVariantId: newOperationId,
                                stageId: calc.stageId,
                              })
                            }
                            
                            // Also request operation variant data if not already loaded
                            // This is separate from CHANGE_OPERATION_VARIANT_REQUEST:
                            // - CHANGE_OPERATION_VARIANT_REQUEST updates the stage's operation in Bitrix
                            // - sendCalcOperationVariantRequest loads the operation's full properties (including itemParent with supported equipment/materials)
                            if (!operationSettings[newOperationId.toString()] && bitrixMeta) {
                              const context = getBitrixContext()
                              const operationsIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_OPERATIONS')
                              
                              if (context && operationsIblock) {
                                postMessageBridge.sendCalcOperationVariantRequest(
                                  newOperationId,
                                  operationsIblock.id,
                                  operationsIblock.type,
                                  context.lang
                                )
                              }
                            }
                            
                            // UI не обновляем вручную — ждём INIT
                          }}
                          placeholder="Выберите операцию..."
                          data-pwcode="select-operation"
                          bitrixMeta={bitrixMeta}
                        />
                      </div>
                      {calc.operationVariantId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-9 w-9",
                            calc.optionsOperation ? "opacity-100" : "opacity-30"
                          )}
                          onClick={() => {
                            setOptionsDialogType('operation')
                            setOptionsDialogStageIndex(index)
                            setOptionsDialogOpen(true)
                          }}
                          data-pwcode="btn-operation-options"
                          title="Настройки операции"
                        >
                          <Gear className="w-4 h-4" />
                        </Button>
                      )}
                      {renderSelectedId(toNumber(calc.operationVariantId), 'operation', 'btn-open-operation-bitrix')}
                      
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
                            onBlur={() => handleQuantityBlur(index, 'operationQuantity')}
                            className="w-20 max-w-[80px]"
                          />
                          <span className="text-sm text-muted-foreground w-[40px] text-right">
                            {getOperationUnit(calc.operationVariantId) || 'ед.'}
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {settings && calc.operationVariantId && (
                <div className="space-y-2">
                  <Label>Оборудование</Label>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <MultiLevelSelect
                          items={filteredEquipmentHierarchy}
                          value={calc.equipmentId?.toString() || null}
                          onValueChange={(value) => {
                            const newEquipmentId = parseInt(value)
                            console.log('[CHANGE_EQUIPMENT_REQUEST] Sending...', { 
                              equipmentId: newEquipmentId, 
                              stageId: calc.stageId 
                            })
                            
                            // Send CHANGE_EQUIPMENT_REQUEST to Bitrix
                            if (calc.stageId && bitrixMeta) {
                              postMessageBridge.sendChangeEquipmentRequest({
                                equipmentId: newEquipmentId,
                                stageId: calc.stageId,
                              })
                            }
                            
                            // UI не обновляем вручную — ждём INIT
                          }}
                          placeholder="Выберите оборудование..."
                          disabled={!calc.operationVariantId}
                          bitrixMeta={bitrixMeta}
                        />
                      </div>
                      
                      {/* ID и кнопка открытия в Bitrix */}
                      {calc.equipmentId && (
                        <>
                          <span className="text-xs text-muted-foreground">ID:{calc.equipmentId}</span>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-9 w-9"
                            data-pwcode="btn-open-equipment-bitrix"
                            onClick={() => {
                              // Открыть элемент оборудования в Bitrix
                              const equipmentIblock = bitrixMeta ?  getIblockByCode(bitrixMeta.iblocks, 'CALC_EQUIPMENT') : null
                              if (equipmentIblock) {
                                const context = getBitrixContext()
                                const lang = context?.lang || bitrixMeta?.context?.lang
                                
                                if (lang) {
                                  try {
                                    openBitrixAdmin({
                                      iblockId: equipmentIblock.id,
                                      type: equipmentIblock.type,
                                      lang,
                                      id: calc.equipmentId! ,
                                    })
                                  } catch (error) {
                                    const message = error instanceof Error ?  error.message : 'Не удалось открыть элемент Bitrix'
                                    toast.error(message)
                                  }
                                } else {
                                  window.open(`#equipment-${calc.equipmentId}`, '_blank')
                                }
                              }
                            }}
                          >
                            <ArrowSquareOut className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

              {settings && isPropertyEnabled(getProperty(settings, 'USE_MATERIAL_VARIANT')) && (
                <div className="space-y-2">
                  <Label>Материал</Label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <MultiLevelSelect
                        items={filteredMaterialsHierarchy}
                        value={calc.materialVariantId?.toString() || null}
                        onValueChange={(value) => {
                          const newMaterialVariantId = parseInt(value)
                          console.log('[CHANGE_MATERIAL_VARIANT_REQUEST] Sending...', { 
                            materialVariantId: newMaterialVariantId, 
                            stageId: calc.stageId 
                          })
                          
                          // Send CHANGE_MATERIAL_VARIANT_REQUEST to Bitrix
                          if (calc.stageId && bitrixMeta) {
                            postMessageBridge.sendChangeMaterialVariantRequest({
                              materialVariantId: newMaterialVariantId,
                              stageId: calc.stageId,
                            })
                          }
                          
                          // Also request material variant data if not already loaded
                          // This is separate from CHANGE_MATERIAL_VARIANT_REQUEST:
                          // - CHANGE_MATERIAL_VARIANT_REQUEST updates the stage's material in Bitrix
                          // - sendCalcMaterialVariantRequest loads the material's full properties (including measure data)
                          if (!materialVariants[newMaterialVariantId.toString()] && bitrixMeta) {
                            const context = getBitrixContext()
                            const materialsVariantsIblock = getIblockByCode(bitrixMeta.iblocks, 'CALC_MATERIALS_VARIANTS')
                            
                            if (context && materialsVariantsIblock) {
                              postMessageBridge.sendCalcMaterialVariantRequest(
                                newMaterialVariantId,
                                materialsVariantsIblock.id,
                                materialsVariantsIblock.type,
                                context.lang
                              )
                            }
                          }
                          
                          // UI не обновляем вручную — ждём INIT
                        }}
                        placeholder="Выберите материал..."
                        bitrixMeta={bitrixMeta}
                      />
                    </div>
                    {calc.materialVariantId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-9 w-9",
                          calc.optionsMaterial ? "opacity-100" : "opacity-30"
                        )}
                        onClick={() => {
                          setOptionsDialogType('material')
                          setOptionsDialogStageIndex(index)
                          setOptionsDialogOpen(true)
                        }}
                        data-pwcode="btn-material-options"
                        title="Настройки материала"
                      >
                        <Gear className="w-4 h-4" />
                      </Button>
                    )}
                    {renderSelectedId(toNumber(calc.materialVariantId), 'material', 'btn-open-material-bitrix')}
                    
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
                          onBlur={() => handleQuantityBlur(index, 'materialQuantity')}
                          className="w-20 max-w-[80px]"
                        />
                        <span className="text-sm text-muted-foreground w-[40px] text-right">
                          {getMaterialUnit(calc.materialVariantId) || 'шт.'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Дополнительные поля из CUSTOM_FIELDS */}
              {(() => {
                const customFieldsConfig = settings?.customFields || []
                if (customFieldsConfig.length === 0) return null
                  
                return (
                  <div className="space-y-3 pt-3 border-t">
                    <Label className="text-sm font-medium">Дополнительные параметры</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {customFieldsConfig.map((field) => (
                        <div key={field.code} className="space-y-1">
                          <Label className="text-xs">
                            {field.name}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          
                          {field.type === 'number' && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={calc.customFields?.[field.code] !== undefined 
                                  ? calc.customFields[field.code] 
                                  : (field.default ??  '')}
                                onChange={(e) => handleUpdateCalculator(index, {
                                  customFields: {
                                    ...calc.customFields,
                                    [field.code]: e.target.value
                                  }
                                })}
                                onBlur={() => handleCustomFieldsBlur(index)}
                                min={field.min}
                                max={field.max}
                                step={field.step}
                                className="w-24"
                              />
                              {field.unit && (
                                <span className="text-xs text-muted-foreground">{field.unit}</span>
                              )}
                            </div>
                          )}
                          
                          {field.type === 'checkbox' && (
                            <Checkbox
                              checked={
                                calc.customFields?.[field.code] === 'Y' || 
                                calc.customFields?.[field.code] === true ||
                                calc.customFields?.[field.code] === '1' ||
                                (calc.customFields?.[field.code] === undefined && field.default === true)
                              }
                              onCheckedChange={(checked) => {
                                handleUpdateCalculator(index, {
                                  customFields: {
                                    ...calc.customFields,
                                    [field.code]: checked ?  'Y' :  'N'
                                  }
                                })
                                // Send immediately on change for checkboxes
                                setTimeout(() => handleCustomFieldsBlur(index), 0)
                              }}
                            />
                          )}
                          
                          {field.type === 'text' && (
                            <Input
                              type="text"
                              value={String(calc.customFields?.[field.code] ??  field.default ?? '')}
                              onChange={(e) => handleUpdateCalculator(index, {
                                customFields: {
                                  ...calc.customFields,
                                  [field.code]:  e.target.value
                                }
                              })}
                              onBlur={() => handleCustomFieldsBlur(index)}
                              maxLength={field.maxLength}
                            />
                          )}
                          
                          {field.type === 'select' && field.options && (
                            <Select
                              value={String(calc.customFields?.[field.code] ?? field.default ?? '')}
                              onValueChange={(value) => {
                                handleUpdateCalculator(index, {
                                  customFields: {
                                    ...calc.customFields,
                                    [field.code]: value
                                  }
                                })
                                // Send immediately on change for selects
                                setTimeout(() => handleCustomFieldsBlur(index), 0)
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Выберите..." />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Calculation Logic Dialog */}
      {calculationLogicStageIndex !== null && (
        <CalculationLogicDialog
          open={calculationLogicDialogOpen}
          onOpenChange={setCalculationLogicDialogOpen}
          stageIndex={calculationLogicStageIndex}
          stageName={safeCalculators[calculationLogicStageIndex]?.stageName}
          calculatorName={
            safeCalculators[calculationLogicStageIndex]?.settingsId
              ? calculatorSettings[safeCalculators[calculationLogicStageIndex].settingsId!.toString()]?.name
              : undefined
          }
          allStages={safeCalculators.map((calc, idx) => ({
            index: idx,
            name: calc.stageName,
          }))}
          initPayload={bitrixMeta}
          currentStageId={safeCalculators[calculationLogicStageIndex]?.stageId ?? null}
          currentSettingsId={safeCalculators[calculationLogicStageIndex]?.settingsId ?? null}
          currentDetailId={
            bitrixMeta?.elementsStore?.CALC_DETAILS?.find(
              detail => detail.properties?.CALC_STAGES?.VALUE?.includes(
                String(safeCalculators[calculationLogicStageIndex]?.stageId)
              )
            )?.id ?? null
          }
          onSaveRequest={handleSaveRequest}
        />
      )}

      {/* Options Dialog */}
      {optionsDialogStageIndex !== null && safeCalculators[optionsDialogStageIndex] && (
        <OptionsDialog
          open={optionsDialogOpen}
          onOpenChange={setOptionsDialogOpen}
          type={optionsDialogType}
          stageId={safeCalculators[optionsDialogStageIndex].stageId!}
          currentVariantId={
            optionsDialogType === 'operation'
              ? safeCalculators[optionsDialogStageIndex].operationVariantId
              : safeCalculators[optionsDialogStageIndex].materialVariantId
          }
          variantsHierarchy={
            optionsDialogType === 'operation' ? operationsHierarchy : materialsHierarchy
          }
          existingOptions={
            optionsDialogType === 'operation'
              ? safeCalculators[optionsDialogStageIndex].optionsOperation || null
              : safeCalculators[optionsDialogStageIndex].optionsMaterial || null
          }
          bitrixMeta={bitrixMeta}
          onSave={(json) => {
            const stage = safeCalculators[optionsDialogStageIndex]
            if (stage.stageId) {
              if (optionsDialogType === 'operation') {
                postMessageBridge.sendChangeOptionsOperation({
                  stageId: stage.stageId,
                  json,
                })
              } else {
                postMessageBridge.sendChangeOptionsMaterial({
                  stageId: stage.stageId,
                  json,
                })
              }
              toast.success('Настройки сохранены')
            }
          }}
          onClear={() => {
            const stage = safeCalculators[optionsDialogStageIndex]
            if (stage.stageId) {
              if (optionsDialogType === 'operation') {
                postMessageBridge.sendClearOptionsOperation({
                  stageId: stage.stageId,
                })
              } else {
                postMessageBridge.sendClearOptionsMaterial({
                  stageId: stage.stageId,
                })
              }
              toast.success('Настройки сброшены')
            }
          }}
        />
      )}
    </div>
  )
}
