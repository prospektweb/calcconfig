import { useState, useEffect } from 'react'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { InitPayload } from '@/lib/postmessage-bridge'
import { MultiLevelSelect, MultiLevelItem } from './MultiLevelSelect'

interface OptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'operation' | 'material'
  stageId: number
  currentVariantId: number | null
  variantsHierarchy: any[] // List of available variants for selection
  existingOptions: string | null // JSON string from OPTIONS_OPERATION/OPTIONS_MATERIAL
  bitrixMeta: InitPayload | null
  onSave: (json: string) => void
  onClear: () => void
}

interface PropertyEnum {
  VALUE: string
  VALUE_XML_ID?: string
  XML_ID?: string
  SORT?: number
}

interface Property {
  CODE: string
  NAME: string
  PROPERTY_TYPE: string
  ENUMS?: PropertyEnum[]
}

interface MappingRow {
  values: Record<string, { value: string; xmlId: string }>
  dimensions: Record<DimensionKey, { min: string; max: string }>
  variantId: string
}

type DimensionKey = 'width' | 'length' | 'height' | 'weight'

interface DetailStageSelection {
  bindingId?: number | null
  detailId?: number | null
  stageId: number
}

const DIMENSION_OPTIONS: Array<{ key: DimensionKey; label: string; unit: string }> = [
  { key: 'width', label: 'Ширина', unit: 'мм' },
  { key: 'length', label: 'Длина', unit: 'мм' },
  { key: 'height', label: 'Высота', unit: 'мм' },
  { key: 'weight', label: 'Вес', unit: 'г' },
]

export function OptionsDialog({
  open,
  onOpenChange,
  type,
  stageId,
  currentVariantId,
  variantsHierarchy,
  existingOptions,
  bitrixMeta,
  onSave,
  onClear,
}: OptionsDialogProps) {
  const [selectedPropertyCodes, setSelectedPropertyCodes] = useState<string[]>([])
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([])
  const [selectedDetailStage, setSelectedDetailStage] = useState<DetailStageSelection | null>(null)
  const [selectedDimensions, setSelectedDimensions] = useState<DimensionKey[]>([])
  const [hasInitialized, setHasInitialized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const decodeHtmlEntities = (value: string) => {
    if (!/[&](quot|#34|amp|lt|gt);/.test(value)) {
      return value
    }
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  }

  useEffect(() => {
    if (!open) return
    const elementsStoreKeys = Object.keys(bitrixMeta?.elementsStore ?? {})
    console.warn('[OptionsDialog] dialog open', {
      open,
      type,
      stageId,
      currentVariantId,
    })
    console.warn('[OptionsDialog] bitrixMeta availability', {
      hasBitrixMeta: Boolean(bitrixMeta),
      hasElementsStore: Boolean(bitrixMeta?.elementsStore),
      elementsStoreKeys,
    })
    console.warn('[OptionsDialog] CALC_STAGES_SIBLINGS snapshot', {
      value: bitrixMeta?.elementsStore?.CALC_STAGES_SIBLINGS,
      type: typeof bitrixMeta?.elementsStore?.CALC_STAGES_SIBLINGS,
    })
  }, [open, type, stageId, currentVariantId, bitrixMeta])

  // Get iblock properties based on type
  const getPropertiesList = (): Property[] => {
    if (!bitrixMeta) return []
    
    // Find the SKU (offers) iblock - торговые предложения
    const skuIblock = bitrixMeta.iblocks.find(ib => 
      ib.code === 'CATALOG_OFFERS' || 
      ib.code?.includes('OFFERS') ||
      ib.type === 'offers'
    )
    
    if (!skuIblock) {
      console.warn('[OptionsDialog] SKU iblock not found')
      return []
    }

    if (Array.isArray(skuIblock.properties)) {
      return skuIblock.properties.map((prop: any) => ({
        CODE: prop.CODE,
        NAME: prop.NAME || prop.CODE,
        PROPERTY_TYPE: prop.PROPERTY_TYPE || 'S',
        ENUMS: prop.ENUMS || [],
      }))
    }
    
    // Get properties from elementsStore if available
    if (bitrixMeta.elementsStore && skuIblock.code) {
      const skuElements = bitrixMeta.elementsStore[skuIblock.code]
      if (skuElements && skuElements.length > 0) {
        const firstElement = skuElements[0]
        if (firstElement.properties) {
          return Object.entries(firstElement.properties).map(([code, prop]: [string, any]) => ({
            CODE: code,
            NAME: prop.NAME || code,
            PROPERTY_TYPE: prop.PROPERTY_TYPE || 'S',
            ENUMS: prop.ENUMS || [],
          }))
        }
      }
    }
    
    // Fallback: try to get from selectedOffers properties
    if (bitrixMeta.selectedOffers && bitrixMeta.selectedOffers.length > 0) {
      const firstOffer = bitrixMeta.selectedOffers[0]
      if (firstOffer.properties) {
        return Object.entries(firstOffer.properties).map(([code, prop]: [string, any]) => ({
          CODE: code,
          NAME: prop.NAME || code,
          PROPERTY_TYPE: prop.PROPERTY_TYPE || 'S',
          ENUMS: prop.ENUMS || [],
        }))
      }
    }
    
    return []
  }

  const propertiesList = getPropertiesList()

  // Initialize from existing options
  useEffect(() => {
    if (open && existingOptions && !hasInitialized) {
      try {
        const decodedOptions = decodeHtmlEntities(existingOptions)
        const parsed = JSON.parse(decodedOptions)
        const parsedPropertyCodes = Array.isArray(parsed.propertyCodes)
          ? parsed.propertyCodes.map((item: any) => String(item))
          : parsed.propertyCode
            ? [String(parsed.propertyCode)]
            : []

        if (Array.isArray(parsed.mappings)) {
          setSelectedPropertyCodes(parsedPropertyCodes)
          const parsedDetailStage = parsed.detailStageSelection && typeof parsed.detailStageSelection === 'object'
            ? {
                bindingId: parsed.detailStageSelection.bindingId
                  ? Number(parsed.detailStageSelection.bindingId)
                  : null,
                detailId: parsed.detailStageSelection.detailId !== undefined && parsed.detailStageSelection.detailId !== null
                  ? Number(parsed.detailStageSelection.detailId)
                  : null,
                stageId: Number(parsed.detailStageSelection.stageId),
              }
            : null
          const parsedDimensions = Array.isArray(parsed.dimensionKeys)
            ? parsed.dimensionKeys
                .map((item: unknown) => String(item))
                .filter((item): item is DimensionKey => DIMENSION_OPTIONS.some((option) => option.key === item))
            : []
          setSelectedDetailStage(parsedDetailStage)
          setSelectedDimensions(parsedDimensions)

          setMappingRows(parsed.mappings.map((mapping: any) => {
            if (mapping.values && typeof mapping.values === 'object') {
              const normalizedValues: Record<string, { value: string; xmlId: string }> = {}
              parsedPropertyCodes.forEach((code) => {
                const rawValue = mapping.values?.[code] ?? {}
                normalizedValues[code] = {
                  value: String(rawValue.value || ''),
                  xmlId: String(rawValue.xmlId || ''),
                }
              })
              return {
                values: normalizedValues,
                dimensions: DIMENSION_OPTIONS.reduce((acc, option) => {
                  const rawDimension = mapping.dimensions?.[option.key] || {}
                  const rawMin = rawDimension.min ?? ''
                  const rawMax = rawDimension.max ?? ''
                  acc[option.key] = {
                    min: rawMin === '' ? '0' : String(rawMin),
                    max: String(rawMax),
                  }
                  return acc
                }, {} as Record<DimensionKey, { min: string; max: string }>),
                variantId: String(mapping.variantId || ''),
              }
            }

            const legacyCode = parsedPropertyCodes[0]
            return {
              values: legacyCode
                ? {
                    [legacyCode]: {
                      value: String(mapping.value || ''),
                      xmlId: String(mapping.xmlId || ''),
                    },
                  }
                : {},
              dimensions: DIMENSION_OPTIONS.reduce((acc, option) => {
                acc[option.key] = { min: '0', max: '' }
                return acc
              }, {} as Record<DimensionKey, { min: string; max: string }>),
              variantId: String(mapping.variantId || ''),
            }
          }))
        }
        setHasInitialized(true)
      } catch (error) {
        console.error('[OptionsDialog] Failed to parse existing options:', error)
      }
    }
  }, [open, existingOptions, propertiesList, hasInitialized])

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedPropertyCodes([])
      setMappingRows([])
      setSelectedDetailStage(null)
      setSelectedDimensions([])
      setHasInitialized(false)
      setIsFullscreen(false)
    }
  }, [open])

  const getEmptyRow = (codes: string[]): MappingRow => ({
    values: codes.reduce((acc, code) => {
      acc[code] = { value: '', xmlId: '' }
      return acc
    }, {} as Record<string, { value: string; xmlId: string }>),
    dimensions: DIMENSION_OPTIONS.reduce((acc, option) => {
      acc[option.key] = { min: '0', max: '' }
      return acc
    }, {} as Record<DimensionKey, { min: string; max: string }>),
    variantId: '',
  })

  const handlePropertyToggle = (code: string, checked: boolean) => {
    const nextCodes = checked
      ? [...selectedPropertyCodes, code]
      : selectedPropertyCodes.filter((item) => item !== code)

    setSelectedPropertyCodes(nextCodes)

    if (nextCodes.length === 0 && selectedDimensions.length === 0) {
      setMappingRows([])
      return
    }

    setMappingRows((prevRows) => {
      if (prevRows.length === 0) {
        return [getEmptyRow(nextCodes)]
      }

      return prevRows.map((row) => ({
        variantId: row.variantId,
        values: nextCodes.reduce((acc, propertyCode) => {
          acc[propertyCode] = row.values[propertyCode] || { value: '', xmlId: '' }
          return acc
        }, {} as Record<string, { value: string; xmlId: string }>),
        dimensions: row.dimensions,
      }))
    })
  }

  const handleDimensionToggle = (key: DimensionKey, checked: boolean) => {
    const nextDimensions = checked
      ? [...selectedDimensions, key]
      : selectedDimensions.filter((item) => item !== key)

    setSelectedDimensions(nextDimensions)

    if (checked && mappingRows.length === 0) {
      setMappingRows([getEmptyRow(selectedPropertyCodes)])
      return
    }

    if (!checked && nextDimensions.length === 0 && selectedPropertyCodes.length === 0) {
      setMappingRows([])
      return
    }

    setMappingRows((prevRows) => prevRows.map((row) => {
      const nextRow = {
        ...row,
        dimensions: { ...row.dimensions },
      }
      if (!checked) {
        nextRow.dimensions[key] = { min: '0', max: '' }
      }
      return nextRow
    }))
  }

  const handleAddRow = () => {
    if (selectedPropertyCodes.length === 0 && selectedDimensions.length === 0) return
    setMappingRows([...mappingRows, getEmptyRow(selectedPropertyCodes)])
  }

  const handleRemoveRow = (index: number) => {
    setMappingRows(mappingRows.filter((_, i) => i !== index))
  }

  const handleUpdateRow = (
    index: number,
    field: 'variantId' | 'value' | 'dimensionMin' | 'dimensionMax',
    value: string,
    propertyCode?: string,
    dimensionKey?: DimensionKey
  ) => {
    const newRows = [...mappingRows]
    if (field === 'variantId') {
      newRows[index].variantId = value
    } else if (propertyCode) {
      const currentValue = newRows[index].values[propertyCode] || { value: '', xmlId: '' }
      newRows[index].values[propertyCode] = {
        value,
        xmlId: currentValue.xmlId,
      }
    } else if (dimensionKey && (field === 'dimensionMin' || field === 'dimensionMax')) {
      const currentDimension = newRows[index].dimensions[dimensionKey] || { min: '0', max: '' }
      newRows[index].dimensions[dimensionKey] = {
        ...currentDimension,
        [field === 'dimensionMin' ? 'min' : 'max']: value,
      }
    }
    setMappingRows(newRows)
  }

  const detailsHierarchy = (): MultiLevelItem[] => {
    const details = bitrixMeta?.elementsStore?.CALC_DETAILS
    const stages = bitrixMeta?.elementsStore?.CALC_STAGES
    if (!Array.isArray(details) || !Array.isArray(stages)) return []

    const detailsById = new Map<number, any>(details.map((item: any) => [Number(item.id), item]))

    const buildStageItems = (
      source: any,
      parentId: string,
      selection: { bindingId?: number | null; detailId?: number | null }
    ): MultiLevelItem[] => {
      const stageIds = Array.isArray(source?.properties?.CALC_STAGES?.VALUE)
        ? source.properties.CALC_STAGES.VALUE.map((value: any) => Number(value)).filter((value: number) => !Number.isNaN(value))
        : []

      return stageIds
        .map((stageId: number) => stages.find((stage: any) => Number(stage.id) === stageId))
        .filter(Boolean)
        .map((stage: any) => ({
          id: `${parentId}-stage-${stage.id}`,
          label: stage.name || `Этап ${stage.id}`,
          value: JSON.stringify({
            bindingId: selection.bindingId ?? null,
            detailId: selection.detailId ?? null,
            stageId: Number(stage.id),
          }),
        }))
    }

    const buildDetailStageItems = (detail: any, parentId: string, bindingId?: number | null): MultiLevelItem | null => {
      const stageItems = buildStageItems(detail, `${parentId}-detail-${detail.id}`, {
        bindingId: bindingId ?? null,
        detailId: Number(detail.id),
      })

      if (stageItems.length === 0) return null

      return {
        id: `${parentId}-detail-${detail.id}`,
        label: detail.name || `Деталь ${detail.id}`,
        children: stageItems,
      }
    }

    const isBinding = (item: any) => String(item?.properties?.TYPE?.VALUE_XML_ID || '').toUpperCase() === 'BINDING'
    const bindingElements = details.filter((item: any) => isBinding(item))
    const childDetailIds = new Set<number>()

    const buildBindingNode = (binding: any, chain: number[] = []): MultiLevelItem | null => {
      const bindingId = Number(binding.id)
      if (chain.includes(bindingId)) return null

      const bindingStageItems = buildStageItems(binding, `binding-${bindingId}`, {
        bindingId,
        detailId: null,
      })

      const childrenRaw = Array.isArray(binding?.properties?.DETAILS?.VALUE)
        ? binding.properties.DETAILS.VALUE
        : []
      const childItems: MultiLevelItem[] = []

      childrenRaw.forEach((childIdRaw: any) => {
        const childId = Number(childIdRaw)
        if (Number.isNaN(childId)) return
        childDetailIds.add(childId)

        const child = detailsById.get(childId)
        if (!child) return

        if (isBinding(child)) {
          const childBindingNode = buildBindingNode(child, [...chain, bindingId])
          if (childBindingNode) {
            childItems.push(childBindingNode)
          }
          return
        }

        const detailNode = buildDetailStageItems(child, `binding-${bindingId}`, bindingId)
        if (detailNode) {
          childItems.push(detailNode)
        }
      })

      const children = [...bindingStageItems, ...childItems]
      if (children.length === 0) return null

      return {
        id: `binding-${bindingId}`,
        label: binding.name || `Скрепление ${bindingId}`,
        children,
      }
    }

    const parentBindingIds = new Set<number>()
    bindingElements.forEach((binding: any) => {
      const childrenRaw = Array.isArray(binding?.properties?.DETAILS?.VALUE)
        ? binding.properties.DETAILS.VALUE
        : []
      childrenRaw.forEach((childIdRaw: any) => {
        const child = detailsById.get(Number(childIdRaw))
        if (child && isBinding(child)) {
          parentBindingIds.add(Number(child.id))
        }
      })
    })

    const hierarchy = bindingElements
      .filter((binding: any) => !parentBindingIds.has(Number(binding.id)))
      .map((binding: any) => buildBindingNode(binding))
      .filter(Boolean) as MultiLevelItem[]

    const unboundDetails = details
      .filter((item: any) => !isBinding(item) && !childDetailIds.has(Number(item.id)))
      .map((detail: any) => buildDetailStageItems(detail, 'root'))
      .filter(Boolean) as MultiLevelItem[]

    if (unboundDetails.length > 0) {
      hierarchy.push(...unboundDetails)
    }

    return hierarchy
  }

  const hierarchyItems = detailsHierarchy()

  const canSave = () => {
    if (selectedPropertyCodes.length === 0 && selectedDimensions.length === 0) return false
    if (selectedDimensions.length > 0 && !selectedDetailStage) return false

    return mappingRows.some((row) => {
      if (!row.variantId) return false
      const hasPropertyValues = selectedPropertyCodes.length === 0 || selectedPropertyCodes.every((code) => {
        const propValue = row.values[code]
        return Boolean(propValue?.value)
      })
      if (!hasPropertyValues) return false

      return selectedDimensions.every((dimensionKey) => {
        const dimensionRange = row.dimensions[dimensionKey]
        return Boolean(dimensionRange?.max)
      })
    })
  }

  const handleSave = () => {
    if (!canSave()) return
    
    // Build mappings array
    const mappings = mappingRows
      .filter((row) => {
        if (!row.variantId) return false
        const hasPropertyValues = selectedPropertyCodes.length === 0 || selectedPropertyCodes.every((code) => Boolean(row.values[code]?.value))
        if (!hasPropertyValues) return false
        return selectedDimensions.every((dimensionKey) => Boolean(row.dimensions[dimensionKey]?.max))
      })
      .map(row => ({
        values: selectedPropertyCodes.reduce((acc, code) => {
          acc[code] = {
            value: row.values[code]?.value || '',
            xmlId: row.values[code]?.xmlId || '',
          }
          return acc
        }, {} as Record<string, { value: string; xmlId: string }>),
        dimensions: selectedDimensions.reduce((acc, dimensionKey) => {
          acc[dimensionKey] = {
            min: Number(row.dimensions[dimensionKey]?.min || '0'),
            max: Number(row.dimensions[dimensionKey]?.max || '0'),
          }
          return acc
        }, {} as Record<DimensionKey, { min: number; max: number }>),
        variantId: parseInt(row.variantId, 10)
      }))

    const optionsJson = JSON.stringify({
      propertyCodes: selectedPropertyCodes,
      detailStageSelection: selectedDetailStage,
      dimensionKeys: selectedDimensions,
      mappings,
    })
    
    onSave(optionsJson)
    onOpenChange(false)
  }

  const handleClear = () => {
    onClear()
    onOpenChange(false)
  }

  // Flatten hierarchy to get selectable variants
  const flattenVariants = (items: any[]): Array<{ value: string; label: string }> => {
    const result: Array<{ value: string; label: string }> = []
    
    const traverse = (items: any[], prefix = '') => {
      items.forEach(item => {
        if (item.value && (!item.children || item.children.length === 0)) {
          result.push({
            value: item.value,
            label: prefix + item.label,
          })
        }
        if (item.children && item.children.length > 0) {
          traverse(item.children, prefix + item.label + ' / ')
        }
      })
    }
    
    traverse(items)
    return result
  }

  const buildVariantOptions = (items: any[]): Array<{ value: string; label: string }> => {
    if (!Array.isArray(items)) return []

    const looksLikeElements = items.every(
      (item) => item && typeof item === 'object' && 'id' in item && 'name' in item
    )

    if (looksLikeElements) {
      return items.map((item) => ({
        value: String(item.id),
        label: String(item.name),
      }))
    }

    return flattenVariants(items)
  }

  // Get variants hierarchy from elementsSiblings if available, otherwise use passed hierarchy
  const getVariantsHierarchy = (): any[] => {
    // Try to get from elementsSiblings array first (new structure)
    const rootElementsSiblings = (bitrixMeta as any)?.elementsSiblings
    if (Array.isArray(rootElementsSiblings)) {
      const normalizedStageId = Number(stageId)
      const stageSiblings = rootElementsSiblings.find(
        (item: any) => Number(item.stageId) === normalizedStageId
      )
      if (stageSiblings) {
        if (type === 'operation' && stageSiblings.CALC_OPERATIONS_VARIANTS) {
          return stageSiblings.CALC_OPERATIONS_VARIANTS
        }
        if (type === 'material' && stageSiblings.CALC_MATERIALS_VARIANTS) {
          return stageSiblings.CALC_MATERIALS_VARIANTS
        }
        return []
      }
      return []
    }

    // Try to get from elementsSiblings array in elementsStore (legacy)
    if (bitrixMeta?.elementsStore) {
      const elementsSiblings = bitrixMeta.elementsStore['CALC_STAGES_SIBLINGS']
      if (Array.isArray(elementsSiblings)) {
        const normalizedStageId = Number(stageId)
        console.warn('[OptionsDialog] CALC_STAGES_SIBLINGS lookup', {
          stageId,
          normalizedStageId,
          type,
          availableStageIds: elementsSiblings.map((item: any) => item.stageId),
        })
        const stageSiblings = elementsSiblings.find(
          (item: any) => Number(item.stageId) === normalizedStageId
        )
        if (stageSiblings) {
          if (type === 'operation' && stageSiblings.CALC_OPERATIONS_VARIANTS) {
            console.warn('[OptionsDialog] Using stage operation variants', {
              stageId,
              variantsCount: stageSiblings.CALC_OPERATIONS_VARIANTS.length,
            })
            return stageSiblings.CALC_OPERATIONS_VARIANTS
          }
          if (type === 'material' && stageSiblings.CALC_MATERIALS_VARIANTS) {
            console.warn('[OptionsDialog] Using stage material variants', {
              stageId,
              variantsCount: stageSiblings.CALC_MATERIALS_VARIANTS.length,
            })
            return stageSiblings.CALC_MATERIALS_VARIANTS
          }
          return []
        }
        return []
      }
    }
    
    // Fallback to siblings structure (old structure)
    if (bitrixMeta?.siblings) {
      if (type === 'operation' && bitrixMeta.siblings.operationsVariants) {
        return bitrixMeta.siblings.operationsVariants
      }
      if (type === 'material' && bitrixMeta.siblings.materialsVariants) {
        return bitrixMeta.siblings.materialsVariants
      }
    }
    
    // Final fallback to passed hierarchy
    return variantsHierarchy
  }

  const flatVariants = buildVariantOptions(getVariantsHierarchy())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "p-0 gap-0 flex flex-col overflow-hidden min-h-0",
          isFullscreen 
            ? "inset-0 w-screen h-screen max-w-none max-h-none sm:max-w-none sm:max-h-none rounded-none translate-x-0 translate-y-0" 
            : "min-w-[1024px] w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[80vh] max-h-[80vh]"
        )}
        hideClose
        data-pwcode={`options-dialog-${type}`}
      >
        {/* Fixed Header */}
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">
                Настройки {type === 'operation' ? 'операции' : 'материала'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Выбор варианта {type === 'operation' ? 'операции' : 'материала'} в зависимости от свойств ТП и характеристик детали
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

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0 p-6 bg-background">
          <div className="space-y-4">
            {/* Property Selection */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <Label className="pb-[10px] inline-block">Свойства ТП</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-52 overflow-auto">
                  {propertiesList.map((prop) => (
                    <label key={prop.CODE} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedPropertyCodes.includes(prop.CODE)}
                        onCheckedChange={(checked) => handlePropertyToggle(prop.CODE, Boolean(checked))}
                      />
                      <span>{prop.NAME} ({prop.PROPERTY_TYPE})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="pb-[10px] inline-block">Скрепление → Деталь → Этап</Label>
                  <MultiLevelSelect
                    items={hierarchyItems}
                    value={selectedDetailStage
                      ? JSON.stringify({
                          bindingId: selectedDetailStage.bindingId ?? null,
                          detailId: selectedDetailStage.detailId ?? null,
                          stageId: selectedDetailStage.stageId,
                        })
                      : null}
                    onValueChange={(value) => {
                      try {
                        const parsed = JSON.parse(value)
                        setSelectedDetailStage({
                          bindingId: parsed.bindingId !== undefined && parsed.bindingId !== null
                            ? Number(parsed.bindingId)
                            : null,
                          detailId: parsed.detailId !== undefined && parsed.detailId !== null
                            ? Number(parsed.detailId)
                            : null,
                          stageId: Number(parsed.stageId),
                        })
                      } catch (_error) {
                        setSelectedDetailStage(null)
                      }
                    }}
                    placeholder="Выберите этап детали или скрепления"
                    bitrixMeta={bitrixMeta}
                  />
                </div>

                <div>
                  <Label className="pb-[10px] inline-block">Характеристики детали (мм/г)</Label>
                  <div className="border rounded-md p-3 space-y-2">
                    {DIMENSION_OPTIONS.map((dimension) => (
                      <label key={dimension.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedDimensions.includes(dimension.key)}
                          onCheckedChange={(checked) => handleDimensionToggle(dimension.key, Boolean(checked))}
                        />
                        <span>{dimension.label} ({dimension.unit})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mapping Table */}
            {(selectedPropertyCodes.length > 0 || selectedDimensions.length > 0) && (
              <div className="space-y-3">
                <Label className="pb-[10px] inline-block">
                  Сопоставление значений свойств
                </Label>
                
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        {selectedPropertyCodes.map((propertyCode) => {
                          const property = propertiesList.find((prop) => prop.CODE === propertyCode)
                          return (
                            <th key={propertyCode} className="px-4 py-2 text-left text-sm font-medium whitespace-nowrap">
                              {property?.NAME || propertyCode}
                            </th>
                          )
                        })}
                        {selectedDimensions.map((dimensionKey) => {
                          const dimensionOption = DIMENSION_OPTIONS.find((item) => item.key === dimensionKey)
                          return (
                            <th key={dimensionKey} className="px-4 py-2 text-left text-sm font-medium whitespace-nowrap">
                              {dimensionOption?.label || dimensionKey} ({dimensionOption?.unit || ''})
                            </th>
                          )
                        })}
                        <th className="px-4 py-2 text-left text-sm font-medium whitespace-nowrap">
                          Вариант {type === 'operation' ? 'операции' : 'материала'}
                        </th>
                        <th className="px-4 py-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappingRows.map((row, index) => (
                        <tr key={index} className="border-t">
                          {selectedPropertyCodes.map((propertyCode) => {
                            const property = propertiesList.find((prop) => prop.CODE === propertyCode)
                            const currentValue = row.values[propertyCode]?.value || ''
                            if (property?.PROPERTY_TYPE === 'L' && property.ENUMS) {
                              const sortedEnums = [...property.ENUMS].sort((a, b) => (a.SORT ?? 500) - (b.SORT ?? 500))
                              return (
                                <td key={propertyCode} className="px-4 py-2">
                                  <Select
                                    value={currentValue}
                                    onValueChange={(value) => {
                                      const selectedEnum = sortedEnums.find((item) => item.VALUE === value)
                                      const newRows = [...mappingRows]
                                      newRows[index].values[propertyCode] = {
                                        value,
                                        xmlId: selectedEnum?.VALUE_XML_ID || selectedEnum?.XML_ID || '',
                                      }
                                      setMappingRows(newRows)
                                    }}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="Выберите..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sortedEnums.map((enumItem) => (
                                        <SelectItem key={`${propertyCode}-${enumItem.VALUE_XML_ID || enumItem.XML_ID || enumItem.VALUE}`} value={enumItem.VALUE}>
                                          {enumItem.VALUE}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                              )
                            }

                            return (
                              <td key={propertyCode} className="px-4 py-2">
                              <Input
                                value={currentValue}
                                onChange={(e) => handleUpdateRow(index, 'value', e.target.value, propertyCode)}
                                placeholder="Введите значение..."
                                className="h-8"
                              />
                              </td>
                            )
                          })}
                          {selectedDimensions.map((dimensionKey) => (
                            <td key={dimensionKey} className="px-4 py-2">
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={row.dimensions[dimensionKey]?.min ?? '0'}
                                  onChange={(e) => handleUpdateRow(index, 'dimensionMin', e.target.value, undefined, dimensionKey)}
                                  placeholder="min"
                                  className="h-8"
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={row.dimensions[dimensionKey]?.max ?? ''}
                                  onChange={(e) => handleUpdateRow(index, 'dimensionMax', e.target.value, undefined, dimensionKey)}
                                  placeholder="max*"
                                  className="h-8"
                                />
                              </div>
                            </td>
                          ))}
                          <td className="px-4 py-2">
                            <Select
                              value={row.variantId}
                              onValueChange={(value) => handleUpdateRow(index, 'variantId', value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Выберите..." />
                              </SelectTrigger>
                              <SelectContent>
                                {flatVariants.map(variant => (
                                  <SelectItem key={variant.value} value={variant.value}>
                                    {variant.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            {mappingRows.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleRemoveRow(index)}
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить строку
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Fixed Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div>
              {existingOptions && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                >
                  Сбросить
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!canSave()}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
