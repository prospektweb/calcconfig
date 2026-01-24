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
          onClick={() => onAddInput(item.path, item.code, item.type)}
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
  index?: number
  basePath?: string
  initPayload: InitPayload
  onAddInput: (path: string, name: string, valueType: ValueType) => void
}

function ElementSection({ title, element, elementType, index, basePath: customBasePath, initPayload, onAddInput }: ElementSectionProps) {
  if (!element) {
    return null
  }

  const basePath = customBasePath || (index !== undefined
    ? `elementsStore.${elementType}[${index}]`
    : `elementsStore.${elementType}`)

  // Collect all items to display as tags
  const tagItems: TagItem[] = []

  // Basic attributes
  tagItems.push({
    code: 'name',
    label: FIELD_LABELS.name,
    path: `${basePath}.name`,
    type: 'string'
  })
  
  tagItems.push({
    code: 'code',
    label: FIELD_LABELS.code,
    path: `${basePath}.code`,
    type: 'string'
  })

  // Dimensions - always show even if null
  tagItems.push({
    code: 'width',
    label: FIELD_LABELS.width,
    path: `${basePath}.fields.width`,
    type: 'number'
  })
  
  tagItems.push({
    code: 'length',
    label: FIELD_LABELS.length,
    path: `${basePath}.fields.length`,
    type: 'number'
  })
  
  tagItems.push({
    code: 'height',
    label: FIELD_LABELS.height,
    path: `${basePath}.fields.height`,
    type: 'number'
  })
  
  tagItems.push({
    code: 'weight',
    label: FIELD_LABELS.weight,
    path: `${basePath}.fields.weight`,
    type: 'number'
  })

  // Measure fields - always show even if null
  tagItems.push({
    code: 'measureCode',
    label: FIELD_LABELS.measureCode,
    path: `${basePath}.measure`,
    type: 'string'
  })
  
  tagItems.push({
    code: 'measureRatio',
    label: FIELD_LABELS.measureRatio,
    path: `${basePath}.measureRatio`,
    type: 'number'
  })
  
  tagItems.push({
    code: 'measureSymbol',
    label: FIELD_LABELS.measureSymbol,
    path: `${basePath}.measureSymbol`,
    type: 'string'
  })
  
  tagItems.push({
    code: 'measureTitle',
    label: FIELD_LABELS.measureTitle,
    path: `${basePath}.measureTitle`,
    type: 'string'
  })

  // Prices - always show even if null
  tagItems.push({
    code: 'purchasingPrice',
    label: FIELD_LABELS.purchasingPrice,
    path: `${basePath}.purchasingPrice`,
    type: 'number'
  })
  
  tagItems.push({
    code: 'purchasingCurrency',
    label: FIELD_LABELS.purchasingCurrency,
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
        path: `${basePath}.prices[${element.prices.indexOf(basePrice)}].currency`,
        type: 'string'
      })
      
      tagItems.push({
        code: 'basePrice',
        label: FIELD_LABELS.basePrice,
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
        <div className="pl-2.5">
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
        operation: null,
        operationVariant: null,
        equipment: null,
        material: null,
        materialVariant: null,
      }
    }

    const settingsId = currentStage.properties?.CALC_SETTINGS?.VALUE
    const operationVariantId = currentStage.properties?.OPERATION_VARIANT?.VALUE
    const equipmentId = currentStage.properties?.EQUIPMENT?.VALUE
    const materialVariantId = currentStage.properties?.MATERIAL_VARIANT?.VALUE

    const settings = settingsId
      ? initPayload.elementsStore.CALC_SETTINGS?.find(e => e.id === Number(settingsId)) ?? null
      : null

    const operationVariant = operationVariantId
      ? initPayload.elementsStore.CALC_OPERATIONS_VARIANTS?.find(e => e.id === Number(operationVariantId)) ?? null
      : null

    const operation = operationVariant?.productId
      ? initPayload.elementsStore.CALC_OPERATIONS?.find(e => e.id === operationVariant.productId) ?? null
      : null

    const equipment = equipmentId
      ? initPayload.elementsStore.CALC_EQUIPMENT?.find(e => e.id === Number(equipmentId)) ?? null
      : null

    const materialVariant = materialVariantId
      ? initPayload.elementsStore.CALC_MATERIALS_VARIANTS?.find(e => e.id === Number(materialVariantId)) ?? null
      : null

    const material = materialVariant?.productId
      ? initPayload.elementsStore.CALC_MATERIALS?.find(e => e.id === materialVariant.productId) ?? null
      : null

    return {
      settings,
      operation,
      operationVariant,
      equipment,
      material,
      materialVariant,
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
        path,
        type
      })
    })
  }

  // Build tag items for product
  const productTagItems: TagItem[] = []
  if (initPayload.product) {
    // Basic attributes
    productTagItems.push({
      code: 'name',
      label: FIELD_LABELS.name,
      path: 'product.name',
      type: 'string'
    })
    
    productTagItems.push({
      code: 'code',
      label: FIELD_LABELS.code,
      path: 'product.code',
      type: 'string'
    })

    // Dimensions
    productTagItems.push({
      code: 'width',
      label: FIELD_LABELS.width,
      path: 'product.attributes.width',
      type: 'number'
    })
    
    productTagItems.push({
      code: 'length',
      label: FIELD_LABELS.length,
      path: 'product.attributes.length',
      type: 'number'
    })
    
    productTagItems.push({
      code: 'height',
      label: FIELD_LABELS.height,
      path: 'product.attributes.height',
      type: 'number'
    })
    
    productTagItems.push({
      code: 'weight',
      label: FIELD_LABELS.weight,
      path: 'product.attributes.weight',
      type: 'number'
    })

    // Measure
    productTagItems.push({
      code: 'measureCode',
      label: FIELD_LABELS.measureCode,
      path: 'product.measure.code',
      type: 'string'
    })
    
    productTagItems.push({
      code: 'measureTitle',
      label: FIELD_LABELS.measureTitle,
      path: 'product.measure.name',
      type: 'string'
    })
    
    productTagItems.push({
      code: 'measureRatio',
      label: FIELD_LABELS.measureRatio,
      path: 'product.measureRatio',
      type: 'number'
    })

    // Prices
    productTagItems.push({
      code: 'purchasingPrice',
      label: FIELD_LABELS.purchasingPrice,
      path: 'product.purchasingPrice',
      type: 'number'
    })
    
    productTagItems.push({
      code: 'purchasingCurrency',
      label: FIELD_LABELS.purchasingCurrency,
      path: 'product.purchasingCurrency',
      type: 'string'
    })

    // Base price
    const basePriceType = initPayload.priceTypes?.find(pt => pt.base === true)
    if (basePriceType && initPayload.product.prices) {
      const basePrice = initPayload.product.prices.find(p => p.typeId === basePriceType.id)
      if (basePrice) {
        const priceIndex = initPayload.product.prices.indexOf(basePrice)
        productTagItems.push({
          code: 'baseCurrency',
          label: FIELD_LABELS.baseCurrency,
          path: `product.prices[${priceIndex}].currency`,
          type: 'string'
        })
        
        productTagItems.push({
          code: 'basePrice',
          label: FIELD_LABELS.basePrice,
          path: `product.prices[${priceIndex}].price`,
          type: 'number'
        })
      }
    }

    // Properties
    if (initPayload.product.properties) {
      Object.entries(initPayload.product.properties).forEach(([code, prop]) => {
        if (code === 'CML2_LINK') return // Ignore CML2_LINK
        
        const { path, type } = buildPropertyPath('product', code, prop)
        productTagItems.push({
          code,
          label: prop.NAME,
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
        path: currentStageIndex >= 0 ? `elementsStore.CALC_STAGES[${currentStageIndex}].properties.OPERATION_QUANTITY.VALUE` : 'elementsStore.CALC_STAGES.properties.OPERATION_QUANTITY.VALUE',
        type: 'number'
      })
    }
    
    if (currentStage.properties.MATERIAL_QUANTITY) {
      settingsCustomFieldsTagItems.push({
        code: 'MATERIAL_QUANTITY',
        label: 'Количество материалов',
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
              <div className="pl-2.5">
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
              <div className="pl-2.5">
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
                    initPayload={initPayload}
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.operationVariant && (
                  <ElementSection
                    title="Вариант операции"
                    element={stageElements.operationVariant}
                    elementType="CALC_OPERATIONS_VARIANTS"
                    initPayload={initPayload}
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.equipment && (
                  <ElementSection
                    title="Оборудование"
                    element={stageElements.equipment}
                    elementType="CALC_EQUIPMENT"
                    initPayload={initPayload}
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.material && (
                  <ElementSection
                    title="Материал"
                    element={stageElements.material}
                    elementType="CALC_MATERIALS"
                    initPayload={initPayload}
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.materialVariant && (
                  <ElementSection
                    title="Вариант материала"
                    element={stageElements.materialVariant}
                    elementType="CALC_MATERIALS_VARIANTS"
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

                  const operationVariant = operationVariantId
                    ? initPayload.elementsStore?.CALC_OPERATIONS_VARIANTS?.find(e => e.id === Number(operationVariantId)) ?? null
                    : null

                  const operation = operationVariant?.productId
                    ? initPayload.elementsStore?.CALC_OPERATIONS?.find(e => e.id === operationVariant.productId) ?? null
                    : null

                  const equipment = equipmentId
                    ? initPayload.elementsStore?.CALC_EQUIPMENT?.find(e => e.id === Number(equipmentId)) ?? null
                    : null

                  const materialVariant = materialVariantId
                    ? initPayload.elementsStore?.CALC_MATERIALS_VARIANTS?.find(e => e.id === Number(materialVariantId)) ?? null
                    : null

                  const material = materialVariant?.productId
                    ? initPayload.elementsStore?.CALC_MATERIALS?.find(e => e.id === materialVariant.productId) ?? null
                    : null

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
                              index={prevStage.stageIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          {operation && (
                            <ElementSection
                              title="Операция"
                              element={operation}
                              elementType="CALC_OPERATIONS"
                              index={prevStage.stageIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          {operationVariant && (
                            <ElementSection
                              title="Вариант операции"
                              element={operationVariant}
                              elementType="CALC_OPERATIONS_VARIANTS"
                              index={prevStage.stageIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          {equipment && (
                            <ElementSection
                              title="Оборудование"
                              element={equipment}
                              elementType="CALC_EQUIPMENT"
                              index={prevStage.stageIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          {material && (
                            <ElementSection
                              title="Материал"
                              element={material}
                              elementType="CALC_MATERIALS"
                              index={prevStage.stageIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
                          )}
                          {materialVariant && (
                            <ElementSection
                              title="Вариант материала"
                              element={materialVariant}
                              elementType="CALC_MATERIALS_VARIANTS"
                              index={prevStage.stageIndex}
                              initPayload={initPayload}
                              onAddInput={onAddInput}
                            />
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
