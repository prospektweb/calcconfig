import { useMemo } from 'react'
import { InitPayload } from '@/lib/postmessage-bridge'
import { ValueType } from './types'
import { ElementsStoreItem, BitrixPropertyValue, CalcDetailElement } from '@/lib/types'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface ContextExplorerProps {
  initPayload: InitPayload | null | undefined
  currentStageId: number | null | undefined
  currentDetailId: number | null | undefined
  onAddInput: (path: string, name: string, valueType: ValueType) => void
}

type PropertyTypeCode = 'S' | 'N' | 'L' | 'E' | 'F'

// Helper function to generate parameter name based on section/subsection/code
// Format: {Section}{Subsection}{Code}
function generateParamName(section: string, subsection: string | null, code: string): string {
  // Capitalize first letter of code
  const capitalizedCode = code.charAt(0).toUpperCase() + code.slice(1)
  
  if (subsection) {
    return `${section}${subsection}${capitalizedCode}`
  }
  return `${section}${capitalizedCode}`
}

// Field labels for human-readable display
const FIELD_LABELS: Record<string, string> = {
  width: 'Ширина',
  length: 'Длина',
  height: 'Высота',
  weight: 'Вес',
  measureCode: 'Код единицы',
  measureRatio: 'Коэффициент',
  measureSymbol: 'Символ единицы',
  measureTitle: 'Название единицы',
  purchasingPrice: 'Закупочная цена',
  purchasingCurrency: 'Валюта закупки',
  basePrice: 'Базовая цена',
  baseCurrency: 'Валюта базовой цены',
  name: 'Название',
  code: 'Код'
}

// Standard result slugs to Russian labels mapping
const RESULT_LABELS: Record<string, string> = {
  width: 'Ширина',
  length: 'Длина',
  height: 'Высота',
  weight: 'Вес',
  purchasingPrice: 'Закупочная цена',
  basePrice: 'Базовая цена'
}

// Helper to find previous stages
interface StageHierarchyItem {
  stageId: number
  stageName: string
  stageIndex: number
}

function findPreviousStages(
  currentStageId: number,
  currentDetailId: number | null | undefined,
  elementsStore: any
): StageHierarchyItem[] {
  if (!elementsStore?.CALC_DETAILS || !elementsStore?.CALC_STAGES || !currentDetailId) {
    return []
  }

  const currentDetail = elementsStore.CALC_DETAILS.find(
    (detail: CalcDetailElement) => detail.id === currentDetailId
  )

  if (!currentDetail) {
    return []
  }

  const detailStageIds = currentDetail.properties?.CALC_STAGES?.VALUE
  if (!Array.isArray(detailStageIds)) {
    return []
  }

  const previousStages: StageHierarchyItem[] = []
  
  for (let i = 0; i < detailStageIds.length; i++) {
    const stageId = Number(detailStageIds[i])
    
    if (stageId === currentStageId) {
      break
    }

    const stage = elementsStore.CALC_STAGES.find((s: any) => s.id === stageId)
    if (stage) {
      previousStages.push({
        stageId,
        stageName: stage.name,
        stageIndex: elementsStore.CALC_STAGES.findIndex((s: any) => s.id === stageId)
      })
    }
  }

  return previousStages
}

function getValueTypeFromPropertyType(propType: PropertyTypeCode): ValueType {
  switch (propType) {
    case 'S': return 'string'
    case 'N': return 'number'
    case 'L': return 'string'
    case 'E': return 'number'
    case 'F': return 'number'
    default: return 'string'
  }
}

function buildPropertyPath(
  basePath: string,
  propCode: string,
  property: BitrixPropertyValue
): { path: string; type: ValueType } {
  const propType = property.PROPERTY_TYPE as PropertyTypeCode
  const multiple = property.MULTIPLE === 'Y'
  const withDescription = property.DESCRIPTION !== undefined && property.DESCRIPTION !== null

  let suffix = '.VALUE'
  let valueType = getValueTypeFromPropertyType(propType)

  if (propType === 'L') {
    suffix = '.VALUE_XML_ID'
  } else if (withDescription) {
    suffix = '.DESCRIPTION'
  }

  const path = `${basePath}.properties.${propCode}${suffix}`

  if (multiple) {
    return { path, type: 'array' }
  }

  return { path, type: valueType }
}

// Tag item for rendering elements as tags
interface TagItem {
  code: string
  label: string
  name: string  // Generated parameter name (e.g., offerWidth, stageOperationWidth)
  path: string
  type: ValueType
}

interface TagCloudProps {
  items: TagItem[]
  onAddInput: (path: string, name: string, valueType: ValueType) => void
}

function TagCloud({ items, onAddInput }: TagCloudProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <button 
          key={item.code}
          onClick={() => onAddInput(item.path, item.name, item.type)}
          className="px-2 py-0.5 text-xs rounded-md bg-muted hover:bg-accent whitespace-nowrap cursor-pointer"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

interface ElementSectionProps {
  title: string
  element: ElementsStoreItem | null
  elementType: string
  section: string  // e.g., "stage", "prevStage"
  subsection: string  // e.g., "Settings", "Operation", "Operationvariant"
  index?: number
  basePath?: string
  initPayload: InitPayload
  onAddInput: (path: string, name: string, valueType: ValueType) => void
}

function ElementSection({ title, element, elementType, section, subsection, index, basePath: customBasePath, initPayload, onAddInput }: ElementSectionProps) {
  if (!element) {
    return null
  }

  const basePath = customBasePath || (index !== undefined && index >= 0
    ? `elementsStore.${elementType}[${index}]`
    : `elementsStore.${elementType}`)

  // Collect all items to display as tags
  const tagItems: TagItem[] = []

  // Basic attributes
  tagItems.push({
    code: 'name',
    label: FIELD_LABELS.name,
    name: generateParamName(section, subsection, 'name'),
    path: `${basePath}.name`,
    type: 'string'
  })
  
  tagItems.push({
    code: 'code',
    label: FIELD_LABELS.code,
    name: generateParamName(section, subsection, 'code'),
    path: `${basePath}.code`,
    type: 'string'
  })

  // Dimensions - use 'attributes' instead of 'fields'
  tagItems.push({
    code: 'width',
    label: FIELD_LABELS.width,
    name: generateParamName(section, subsection, 'width'),
    path: `${basePath}.attributes.width`,
    type: 'number'
  })
  
  tagItems.push({
    code: 'length',
    label: FIELD_LABELS.length,
    name: generateParamName(section, subsection, 'length'),
    path: `${basePath}.attributes.length`,
    type: 'number'
  })
  
  tagItems.push({
    code: 'height',
    label: FIELD_LABELS.height,
    name: generateParamName(section, subsection, 'height'),
    path: `${basePath}.attributes.height`,
    type: 'number'
  })
  
  tagItems.push({
    code: 'weight',
    label: FIELD_LABELS.weight,
    name: generateParamName(section, subsection, 'weight'),
    path: `${basePath}.attributes.weight`,
    type: 'number'
  })

  // Measure fields - always show even if null
  tagItems.push({
    code: 'measureCode',
    label: FIELD_LABELS.measureCode,
    name: generateParamName(section, subsection, 'measureCode'),
    path: `${basePath}.measure`,
    type: 'string'
  })
  
  tagItems.push({
    code: 'measureRatio',
    label: FIELD_LABELS.measureRatio,
    name: generateParamName(section, subsection, 'measureRatio'),
    path: `${basePath}.measureRatio`,
    type: 'number'
  })
  
  tagItems.push({
    code: 'measureSymbol',
    label: FIELD_LABELS.measureSymbol,
    name: generateParamName(section, subsection, 'measureSymbol'),
    path: `${basePath}.measureSymbol`,
    type: 'string'
  })
  
  tagItems.push({
    code: 'measureTitle',
    label: FIELD_LABELS.measureTitle,
    name: generateParamName(section, subsection, 'measureTitle'),
    path: `${basePath}.measureTitle`,
    type: 'string'
  })

  // Prices - always show even if null
  tagItems.push({
    code: 'purchasingPrice',
    label: FIELD_LABELS.purchasingPrice,
    name: generateParamName(section, subsection, 'purchasingPrice'),
    path: `${basePath}.purchasingPrice`,
    type: 'number'
  })
  
  tagItems.push({
    code: 'purchasingCurrency',
    label: FIELD_LABELS.purchasingCurrency,
    name: generateParamName(section, subsection, 'purchasingCurrency'),
    path: `${basePath}.purchasingCurrency`,
    type: 'string'
  })

  // Base price - find from priceTypes
  const basePriceType = initPayload.priceTypes?.find(pt => pt.base === true)
  if (basePriceType && element.prices) {
    const basePrice = element.prices.find(p => p.typeId === basePriceType.id)
    if (basePrice) {
      tagItems.push({
        code: 'baseCurrency',
        label: FIELD_LABELS.baseCurrency,
        name: generateParamName(section, subsection, 'baseCurrency'),
        path: `${basePath}.prices[${element.prices.indexOf(basePrice)}].currency`,
        type: 'string'
      })
      
      tagItems.push({
        code: 'basePrice',
        label: FIELD_LABELS.basePrice,
        name: generateParamName(section, subsection, 'basePrice'),
        path: `${basePath}.prices[${element.prices.indexOf(basePrice)}].price`,
        type: 'number'
      })
    }
  }

  // Properties - exclude CML2_LINK
  if (element.properties) {
    Object.entries(element.properties).forEach(([code, prop]) => {
      if (code === 'CML2_LINK') return // Ignore CML2_LINK
      
      const { path, type } = buildPropertyPath(basePath, code, prop)
      tagItems.push({
        code,
        label: prop.NAME,
        name: generateParamName(section, subsection, code),
        path,
        type
      })
    })
  }

  return (
    <AccordionItem value={`${elementType}-${index ?? 0}`} className="border-none">
      <AccordionTrigger className="text-xs hover:no-underline py-2 [&[data-state=open]>svg]:rotate-90">
        {title}
      </AccordionTrigger>
      <AccordionContent className="pb-2">
        <div>
          <TagCloud items={tagItems} onAddInput={onAddInput} />
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export function ContextExplorer({
  initPayload,
  currentStageId,
  currentDetailId,
  onAddInput,
}: ContextExplorerProps) {
  const currentStage = useMemo(() => {
    if (!initPayload?.elementsStore?.CALC_STAGES || !currentStageId) return null
    return initPayload.elementsStore.CALC_STAGES.find(s => s.id === currentStageId) ?? null
  }, [initPayload, currentStageId])
  
  const currentStageIndex = useMemo(() => {
    if (!initPayload?.elementsStore?.CALC_STAGES || !currentStageId) return -1
    return initPayload.elementsStore.CALC_STAGES.findIndex(s => s.id === currentStageId)
  }, [initPayload, currentStageId])

  const stageElements = useMemo(() => {
    if (!currentStage || !initPayload?.elementsStore) {
      return {
        settings: null,
        settingsIndex: -1,
        operation: null,
        operationIndex: -1,
        operationVariant: null,
        operationVariantIndex: -1,
        equipment: null,
        equipmentIndex: -1,
        material: null,
        materialIndex: -1,
        materialVariant: null,
        materialVariantIndex: -1,
      }
    }

    const settingsId = currentStage.properties?.CALC_SETTINGS?.VALUE
    const operationVariantId = currentStage.properties?.OPERATION_VARIANT?.VALUE
    const equipmentId = currentStage.properties?.EQUIPMENT?.VALUE
    const materialVariantId = currentStage.properties?.MATERIAL_VARIANT?.VALUE

    const settings = settingsId
      ? initPayload.elementsStore.CALC_SETTINGS?.find(e => e.id === Number(settingsId)) ?? null
      : null
    
    const settingsIndex = settings && initPayload.elementsStore.CALC_SETTINGS
      ? initPayload.elementsStore.CALC_SETTINGS.findIndex(e => e.id === settings.id)
      : -1

    const operationVariant = operationVariantId
      ? initPayload.elementsStore.CALC_OPERATIONS_VARIANTS?.find(e => e.id === Number(operationVariantId)) ?? null
      : null
    
    const operationVariantIndex = operationVariant && initPayload.elementsStore.CALC_OPERATIONS_VARIANTS
      ? initPayload.elementsStore.CALC_OPERATIONS_VARIANTS.findIndex(e => e.id === operationVariant.id)
      : -1

    const operation = operationVariant?.productId
      ? initPayload.elementsStore.CALC_OPERATIONS?.find(e => e.id === operationVariant.productId) ?? null
      : null
    
    const operationIndex = operation && initPayload.elementsStore.CALC_OPERATIONS
      ? initPayload.elementsStore.CALC_OPERATIONS.findIndex(e => e.id === operation.id)
      : -1

    const equipment = equipmentId
      ? initPayload.elementsStore.CALC_EQUIPMENT?.find(e => e.id === Number(equipmentId)) ?? null
      : null
    
    const equipmentIndex = equipment && initPayload.elementsStore.CALC_EQUIPMENT
      ? initPayload.elementsStore.CALC_EQUIPMENT.findIndex(e => e.id === equipment.id)
      : -1

    const materialVariant = materialVariantId
      ? initPayload.elementsStore.CALC_MATERIALS_VARIANTS?.find(e => e.id === Number(materialVariantId)) ?? null
      : null
    
    const materialVariantIndex = materialVariant && initPayload.elementsStore.CALC_MATERIALS_VARIANTS
      ? initPayload.elementsStore.CALC_MATERIALS_VARIANTS.findIndex(e => e.id === materialVariant.id)
      : -1

    const material = materialVariant?.productId
      ? initPayload.elementsStore.CALC_MATERIALS?.find(e => e.id === materialVariant.productId) ?? null
      : null
    
    const materialIndex = material && initPayload.elementsStore.CALC_MATERIALS
      ? initPayload.elementsStore.CALC_MATERIALS.findIndex(e => e.id === material.id)
      : -1

    return {
      settings,
      settingsIndex,
      operation,
      operationIndex,
      operationVariant,
      operationVariantIndex,
      equipment,
      equipmentIndex,
      material,
      materialIndex,
      materialVariant,
      materialVariantIndex,
    }
  }, [currentStage, initPayload])

  // Find previous stages
  const previousStages = useMemo(() => {
    if (!currentStageId || !currentDetailId || !initPayload?.elementsStore) {
      return []
    }
    return findPreviousStages(currentStageId, currentDetailId, initPayload.elementsStore)
  }, [currentStageId, currentDetailId, initPayload])

  const selectedOffer = initPayload?.selectedOffers?.[0]

  if (!initPayload) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Загрузка данных контекста...
      </div>
    )
  }

  // Build tag items for offer properties
  const offerTagItems: TagItem[] = []
  if (selectedOffer?.properties) {
    Object.entries(selectedOffer.properties).forEach(([code, prop]) => {
      if (code === 'CML2_LINK') return // Ignore CML2_LINK
      
      const { path: originalPath, type } = buildPropertyPath('selectedOffers[0]', code, prop)
      // Replace selectedOffers[0] with offer
      const path = originalPath.replace('selectedOffers[0]', 'offer')
      
      offerTagItems.push({
        code,
        label: prop.NAME,
        name: generateParamName('offer', null, code),
        path,
        type
      })
    })
  }

  // Build tag items for product
  const productTagItems: TagItem[] = []
  if (initPayload.product) {
    // Properties only
    if (initPayload.product.properties) {
      Object.entries(initPayload.product.properties).forEach(([code, prop]) => {
        if (code === 'CML2_LINK') return // Ignore CML2_LINK
        
        const { path, type } = buildPropertyPath('product', code, prop)
        productTagItems.push({
          code,
          label: prop.NAME,
          name: generateParamName('product', null, code),
          path,
          type
        })
      })
    }
  }

  // Build tag items for settings custom fields (moved from "Дополнительные параметры этапа")
  const settingsCustomFieldsTagItems: TagItem[] = []
  if (currentStage?.properties) {
    if (currentStage.properties.OPERATION_QUANTITY) {
      settingsCustomFieldsTagItems.push({
        code: 'OPERATION_QUANTITY',
        label: 'Количество операций',
        name: generateParamName('stage', 'Settings', 'OPERATION_QUANTITY'),
        path: currentStageIndex >= 0 ? `elementsStore.CALC_STAGES[${currentStageIndex}].properties.OPERATION_QUANTITY.VALUE` : 'elementsStore.CALC_STAGES.properties.OPERATION_QUANTITY.VALUE',
        type: 'number'
      })
    }
    
    if (currentStage.properties.MATERIAL_QUANTITY) {
      settingsCustomFieldsTagItems.push({
        code: 'MATERIAL_QUANTITY',
        label: 'Количество материалов',
        name: generateParamName('stage', 'Settings', 'MATERIAL_QUANTITY'),
        path: currentStageIndex >= 0 ? `elementsStore.CALC_STAGES[${currentStageIndex}].properties.MATERIAL_QUANTITY.VALUE` : 'elementsStore.CALC_STAGES.properties.MATERIAL_QUANTITY.VALUE',
        type: 'number'
      })
    }
  }

  return (
    <div className="h-full overflow-auto">
      <Accordion type="multiple" defaultValue={['offer', 'current-stage']} className="space-y-1">
        {/* Trade Offer Section */}
        {selectedOffer && (
          <AccordionItem value="offer" className="border-none">
            <AccordionTrigger className="text-sm font-medium hover:no-underline py-2 [&[data-state=open]>svg]:rotate-90">
              Торговое предложение
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <div>
                <TagCloud items={offerTagItems} onAddInput={onAddInput} />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Product Section */}
        {initPayload?.product && (
          <AccordionItem value="product" className="border-none">
            <AccordionTrigger className="text-sm font-medium hover:no-underline py-2 [&[data-state=open]>svg]:rotate-90">
              Товар
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <div>
                <TagCloud items={productTagItems} onAddInput={onAddInput} />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Current Stage Section */}
        {currentStage && (
          <AccordionItem value="current-stage" className="border-none">
            <AccordionTrigger className="text-sm font-medium hover:no-underline py-2 [&[data-state=open]>svg]:rotate-90">
              Текущий этап
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <Accordion type="multiple" className="pl-2.5 space-y-1">
                {stageElements.settings && (
                  <ElementSection
                    title="Настройки"
                    element={stageElements.settings}
                    elementType="CALC_SETTINGS"
                    section="stage"
                    subsection="Settings"
                    index={stageElements.settingsIndex}
                    initPayload={initPayload}
                    onAddInput={onAddInput}
                  />
                )}
                
                {/* Add custom fields to settings section */}
                {settingsCustomFieldsTagItems.length > 0 && stageElements.settings && (
                  <div className="pl-2.5 pt-1">
                    <TagCloud items={settingsCustomFieldsTagItems} onAddInput={onAddInput} />
                  </div>
                )}

                {stageElements.operation && (
                  <ElementSection
                    title="Операция"
                    element={stageElements.operation}
                    elementType="CALC_OPERATIONS"
                    section="stage"
                    subsection="Operation"
                    index={stageElements.operationIndex}
                    initPayload={initPayload}
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.operationVariant && (
                  <ElementSection
                    title="Вариант операции"
                    element={stageElements.operationVariant}
                    elementType="CALC_OPERATIONS_VARIANTS"
                    section="stage"
                    subsection="Operationvariant"
                    index={stageElements.operationVariantIndex}
                    initPayload={initPayload}
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.equipment && (
                  <ElementSection
                    title="Оборудование"
                    element={stageElements.equipment}
                    elementType="CALC_EQUIPMENT"
                    section="stage"
                    subsection="Equipment"
                    index={stageElements.equipmentIndex}
                    initPayload={initPayload}
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.material && (
                  <ElementSection
                    title="Материал"
                    element={stageElements.material}
                    elementType="CALC_MATERIALS"
                    section="stage"
                    subsection="Material"
                    index={stageElements.materialIndex}
                    initPayload={initPayload}
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.materialVariant && (
                  <ElementSection
                    title="Вариант материала"
                    element={stageElements.materialVariant}
                    elementType="CALC_MATERIALS_VARIANTS"
                    section="stage"
                    subsection="Materialvariant"
                    index={stageElements.materialVariantIndex}
                    initPayload={initPayload}
                    onAddInput={onAddInput}
                  />
                )}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Previous Stages Section */}
        {previousStages.length > 0 && (
          <AccordionItem value="previous-stages" className="border-none">
            <AccordionTrigger className="text-sm font-medium hover:no-underline py-2 [&[data-state=open]>svg]:rotate-90">
              Предыдущие этапы
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <Accordion type="multiple" className="pl-2.5 space-y-1">
                {previousStages.map((prevStage) => {
                  const stage = initPayload.elementsStore?.CALC_STAGES?.find(s => s.id === prevStage.stageId)
                  if (!stage) return null

                  const settingsId = stage.properties?.CALC_SETTINGS?.VALUE
                  const operationVariantId = stage.properties?.OPERATION_VARIANT?.VALUE
                  const equipmentId = stage.properties?.EQUIPMENT?.VALUE
                  const materialVariantId = stage.properties?.MATERIAL_VARIANT?.VALUE

                  const settings = settingsId
                    ? initPayload.elementsStore?.CALC_SETTINGS?.find(e => e.id === Number(settingsId)) ?? null
                    : null
                  
                  const settingsIndex = settings && initPayload.elementsStore?.CALC_SETTINGS
                    ? initPayload.elementsStore.CALC_SETTINGS.findIndex(e => e.id === settings.id)
                    : -1

                  const operationVariant = operationVariantId
                    ? initPayload.elementsStore?.CALC_OPERATIONS_VARIANTS?.find(e => e.id === Number(operationVariantId)) ?? null
                    : null
                  
                  const operationVariantIndex = operationVariant && initPayload.elementsStore?.CALC_OPERATIONS_VARIANTS
                    ? initPayload.elementsStore.CALC_OPERATIONS_VARIANTS.findIndex(e => e.id === operationVariant.id)
                    : -1

                  const operation = operationVariant?.productId
                    ? initPayload.elementsStore?.CALC_OPERATIONS?.find(e => e.id === operationVariant.productId) ?? null
                    : null
                  
                  const operationIndex = operation && initPayload.elementsStore?.CALC_OPERATIONS
                    ? initPayload.elementsStore.CALC_OPERATIONS.findIndex(e => e.id === operation.id)
                    : -1

                  const equipment = equipmentId
                    ? initPayload.elementsStore?.CALC_EQUIPMENT?.find(e => e.id === Number(equipmentId)) ?? null
                    : null
                  
                  const equipmentIndex = equipment && initPayload.elementsStore?.CALC_EQUIPMENT
                    ? initPayload.elementsStore.CALC_EQUIPMENT.findIndex(e => e.id === equipment.id)
                    : -1

                  const materialVariant = materialVariantId
                    ? initPayload.elementsStore?.CALC_MATERIALS_VARIANTS?.find(e => e.id === Number(materialVariantId)) ?? null
                    : null
                  
                  const materialVariantIndex = materialVariant && initPayload.elementsStore?.CALC_MATERIALS_VARIANTS
                    ? initPayload.elementsStore.CALC_MATERIALS_VARIANTS.findIndex(e => e.id === materialVariant.id)
                    : -1

                  const material = materialVariant?.productId
                    ? initPayload.elementsStore?.CALC_MATERIALS?.find(e => e.id === materialVariant.productId) ?? null
                    : null
                  
                  const materialIndex = material && initPayload.elementsStore?.CALC_MATERIALS
                    ? initPayload.elementsStore.CALC_MATERIALS.findIndex(e => e.id === material.id)
                    : -1

                  return (
                    <AccordionItem key={prevStage.stageId} value={`prev-stage-${prevStage.stageId}`} className="border-none">
                      <AccordionTrigger className="text-xs hover:no-underline py-2 [&[data-state=open]>svg]:rotate-90">
                        {prevStage.stageName}
                      </AccordionTrigger>
                      <AccordionContent className="pb-2">
                        <Accordion type="multiple" className="pl-2.5 space-y-1">
                          {settings && (
                            <ElementSection
                              title="Настройки"
                              element={settings}
                              elementType="CALC_SETTINGS"
                              section="prevStage"
                              subsection="Settings"
                              index={settingsIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          {operation && (
                            <ElementSection
                              title="Операция"
                              element={operation}
                              elementType="CALC_OPERATIONS"
                              section="prevStage"
                              subsection="Operation"
                              index={operationIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          {operationVariant && (
                            <ElementSection
                              title="Вариант операции"
                              element={operationVariant}
                              elementType="CALC_OPERATIONS_VARIANTS"
                              section="prevStage"
                              subsection="Operationvariant"
                              index={operationVariantIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          {equipment && (
                            <ElementSection
                              title="Оборудование"
                              element={equipment}
                              elementType="CALC_EQUIPMENT"
                              section="prevStage"
                              subsection="Equipment"
                              index={equipmentIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          {material && (
                            <ElementSection
                              title="Материал"
                              element={material}
                              elementType="CALC_MATERIALS"
                              section="prevStage"
                              subsection="Material"
                              index={materialIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          {materialVariant && (
                            <ElementSection
                              title="Вариант материала"
                              element={materialVariant}
                              elementType="CALC_MATERIALS_VARIANTS"
                              section="prevStage"
                              subsection="Materialvariant"
                              index={materialVariantIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          
                          {/* Stage Results Section */}
                          {stage.properties?.OUTPUTS && (
                            <AccordionItem value={`prev-stage-${prevStage.stageId}-results`} className="border-none">
                              <AccordionTrigger className="text-xs hover:no-underline py-2 [&[data-state=open]>svg]:rotate-90">
                                Итоги этапа
                              </AccordionTrigger>
                              <AccordionContent className="pb-2">
                                <div>
                                  <TagCloud items={(() => {
                                    const resultsTagItems: TagItem[] = []
                                    const outputsValue = stage.properties?.OUTPUTS?.VALUE
                                    
                                    if (Array.isArray(outputsValue) && outputsValue.length > 0) {
                                      // Standard result slugs
                                      const standardResults = ['width', 'length', 'height', 'weight', 'purchasingPrice', 'basePrice']
                                      
                                      outputsValue.forEach((outputStr, outputIndex) => {
                                        // Parse the output format: either "slug" or "slug|title"
                                        const parts = String(outputStr).split('|')
                                        const slug = parts[0]
                                        const customTitle = parts.length > 1 ? parts[1] : null
                                        
                                        // Get label: use customTitle if available, otherwise use RESULT_LABELS for standard, or slug as fallback
                                        const label = customTitle || RESULT_LABELS[slug] || slug
                                        
                                        // Generate parameter name: prevStageResults{CapitalizedSlug}
                                        const capitalizedSlug = slug.charAt(0).toUpperCase() + slug.slice(1)
                                        const paramName = `prevStageResults${capitalizedSlug}`
                                        
                                        resultsTagItems.push({
                                          code: slug,
                                          label: label,
                                          name: paramName,
                                          path: `elementsStore.CALC_STAGES[${prevStage.stageIndex}].properties.OUTPUTS[${outputIndex}].VALUE`,
                                          type: 'unknown' // Results can be any type
                                        })
                                      })
                                    }
                                    
                                    return resultsTagItems
                                  })()} onAddInput={onAddInput} />
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  )
}
