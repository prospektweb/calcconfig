import { useMemo } from 'react'
import { InitPayload } from '@/lib/postmessage-bridge'
import { ValueType } from './types'
import { ElementsStoreItem, BitrixPropertyValue, CalcDetailElement } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

  // Find the current detail
  const currentDetail = elementsStore.CALC_DETAILS.find(
    (detail: CalcDetailElement) => detail.id === currentDetailId
  )

  if (!currentDetail) {
    return []
  }

  // Get stage IDs from the detail
  const detailStageIds = currentDetail.properties?.CALC_STAGES?.VALUE
  if (!Array.isArray(detailStageIds)) {
    return []
  }

  // Find all stages before current stage in this detail
  const previousStages: StageHierarchyItem[] = []
  
  for (let i = 0; i < detailStageIds.length; i++) {
    const stageId = Number(detailStageIds[i])
    
    // Stop when we reach the current stage
    if (stageId === currentStageId) {
      break
    }

    // Find the stage element
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

interface PropertyItemProps {
  name: string
  code: string
  property: BitrixPropertyValue
  basePath: string
  onAddInput: (path: string, name: string, valueType: ValueType) => void
}

function PropertyItem({ name, code, property, basePath, onAddInput }: PropertyItemProps) {
  const { path, type } = buildPropertyPath(basePath, code, property)
  const propType = property.PROPERTY_TYPE as PropertyTypeCode

  const handleClick = () => {
    onAddInput(path, code, type)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="w-full justify-start text-left h-auto py-1 px-2"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs truncate">{name}</span>
        <Badge variant="outline" className="shrink-0 text-xs">
          {type}
        </Badge>
        {property.MULTIPLE === 'Y' && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            []
          </Badge>
        )}
      </div>
    </Button>
  )
}

interface AttributeItemProps {
  name: string
  code: string
  basePath: string
  valueType: ValueType
  onAddInput: (path: string, name: string, valueType: ValueType) => void
}

function AttributeItem({ name, code, basePath, valueType, onAddInput }: AttributeItemProps) {
  const path = `${basePath}.${code}`

  const handleClick = () => {
    onAddInput(path, code, valueType)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="w-full justify-start text-left h-auto py-1 px-2"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs truncate">{name}</span>
        <Badge variant="outline" className="shrink-0 text-xs">
          {valueType}
        </Badge>
      </div>
    </Button>
  )
}

interface ElementSectionProps {
  title: string
  element: ElementsStoreItem | null
  elementType: string
  index?: number
  onAddInput: (path: string, name: string, valueType: ValueType) => void
}

function ElementSection({ title, element, elementType, index, onAddInput }: ElementSectionProps) {
  if (!element) {
    return null
  }

  const basePath = index !== undefined
    ? `elementsStore.${elementType}[${index}]`
    : `elementsStore.${elementType}`

  return (
    <AccordionItem value={`${elementType}-${index ?? 0}`}>
      <AccordionTrigger className="text-xs">
        {title}: {element.name}
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-1 pl-2">
          {/* Basic attributes */}
          <div className="text-xs font-medium text-muted-foreground mb-1">Атрибуты</div>
          <AttributeItem
            name="Название"
            code="name"
            basePath={basePath}
            valueType="string"
            onAddInput={onAddInput}
          />
          <AttributeItem
            name="Код"
            code="code"
            basePath={basePath}
            valueType="string"
            onAddInput={onAddInput}
          />
          
          {/* Dimensions */}
          {(element.fields?.width !== undefined || element.fields?.length !== undefined || 
            element.fields?.height !== undefined || element.fields?.weight !== undefined) && (
            <>
              <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Размеры</div>
              {element.fields?.width !== undefined && (
                <AttributeItem
                  name="Ширина"
                  code="fields.width"
                  basePath={basePath}
                  valueType="number"
                  onAddInput={onAddInput}
                />
              )}
              {element.fields?.length !== undefined && (
                <AttributeItem
                  name="Длина"
                  code="fields.length"
                  basePath={basePath}
                  valueType="number"
                  onAddInput={onAddInput}
                />
              )}
              {element.fields?.height !== undefined && (
                <AttributeItem
                  name="Высота"
                  code="fields.height"
                  basePath={basePath}
                  valueType="number"
                  onAddInput={onAddInput}
                />
              )}
              {element.fields?.weight !== undefined && (
                <AttributeItem
                  name="Вес"
                  code="fields.weight"
                  basePath={basePath}
                  valueType="number"
                  onAddInput={onAddInput}
                />
              )}
            </>
          )}

          {/* Measure */}
          {element.measure && (
            <>
              <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Единица измерения</div>
              <AttributeItem
                name="Код единицы"
                code="measure"
                basePath={basePath}
                valueType="string"
                onAddInput={onAddInput}
              />
              {element.measureRatio !== undefined && (
                <AttributeItem
                  name="Коэффициент единицы"
                  code="measureRatio"
                  basePath={basePath}
                  valueType="number"
                  onAddInput={onAddInput}
                />
              )}
            </>
          )}

          {/* Prices */}
          {(element.purchasingPrice !== undefined || element.prices?.length > 0) && (
            <>
              <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Цены</div>
              {element.purchasingPrice !== undefined && (
                <>
                  <AttributeItem
                    name="Закупочная цена"
                    code="purchasingPrice"
                    basePath={basePath}
                    valueType="number"
                    onAddInput={onAddInput}
                  />
                  {element.purchasingCurrency && (
                    <AttributeItem
                      name="Валюта закупки"
                      code="purchasingCurrency"
                      basePath={basePath}
                      valueType="string"
                      onAddInput={onAddInput}
                    />
                  )}
                </>
              )}
            </>
          )}

          {/* Properties */}
          {element.properties && Object.keys(element.properties).length > 0 && (
            <>
              <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Свойства</div>
              {Object.entries(element.properties).map(([code, prop]) => (
                <PropertyItem
                  key={code}
                  name={prop.NAME}
                  code={code}
                  property={prop}
                  basePath={basePath}
                  onAddInput={onAddInput}
                />
              ))}
            </>
          )}
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

  return (
    <div className="h-full overflow-auto">
      <Accordion type="multiple" defaultValue={['offer', 'current-stage']}>
        {/* Trade Offer Section */}
        {selectedOffer && (
          <AccordionItem value="offer">
            <AccordionTrigger className="text-sm font-medium">
              Торговое предложение
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1 pl-2">
                {selectedOffer.properties && Object.entries(selectedOffer.properties).map(([code, prop]) => (
                  <PropertyItem
                    key={code}
                    name={prop.NAME}
                    code={code}
                    property={prop}
                    basePath="selectedOffers[0]"
                    onAddInput={onAddInput}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Product Section */}
        {initPayload?.product && (
          <AccordionItem value="product">
            <AccordionTrigger className="text-sm font-medium">
              Товар
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1 pl-2">
                {/* Basic attributes */}
                <div className="text-xs font-medium text-muted-foreground mb-1">Атрибуты</div>
                <AttributeItem
                  name="Название"
                  code="name"
                  basePath="product"
                  valueType="string"
                  onAddInput={onAddInput}
                />
                <AttributeItem
                  name="Код"
                  code="code"
                  basePath="product"
                  valueType="string"
                  onAddInput={onAddInput}
                />
                
                {/* Dimensions */}
                {(initPayload.product?.attributes?.width !== undefined || 
                  initPayload.product?.attributes?.length !== undefined || 
                  initPayload.product?.attributes?.height !== undefined || 
                  initPayload.product?.attributes?.weight !== undefined) && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Размеры</div>
                    {initPayload.product?.attributes?.width !== undefined && (
                      <AttributeItem
                        name="Ширина"
                        code="attributes.width"
                        basePath="product"
                        valueType="number"
                        onAddInput={onAddInput}
                      />
                    )}
                    {initPayload.product?.attributes?.length !== undefined && (
                      <AttributeItem
                        name="Длина"
                        code="attributes.length"
                        basePath="product"
                        valueType="number"
                        onAddInput={onAddInput}
                      />
                    )}
                    {initPayload.product?.attributes?.height !== undefined && (
                      <AttributeItem
                        name="Высота"
                        code="attributes.height"
                        basePath="product"
                        valueType="number"
                        onAddInput={onAddInput}
                      />
                    )}
                    {initPayload.product?.attributes?.weight !== undefined && (
                      <AttributeItem
                        name="Вес"
                        code="attributes.weight"
                        basePath="product"
                        valueType="number"
                        onAddInput={onAddInput}
                      />
                    )}
                  </>
                )}

                {/* Measure */}
                {initPayload.product?.measure && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Единица измерения</div>
                    <AttributeItem
                      name="Код единицы"
                      code="measure.code"
                      basePath="product"
                      valueType="string"
                      onAddInput={onAddInput}
                    />
                    <AttributeItem
                      name="Название единицы"
                      code="measure.name"
                      basePath="product"
                      valueType="string"
                      onAddInput={onAddInput}
                    />
                  </>
                )}
                
                {initPayload.product?.measureRatio !== undefined && initPayload.product?.measureRatio !== null && (
                  <AttributeItem
                    name="Коэффициент единицы"
                    code="measureRatio"
                    basePath="product"
                    valueType="number"
                    onAddInput={onAddInput}
                  />
                )}

                {/* Prices */}
                {(initPayload.product?.purchasingPrice !== undefined || initPayload.product?.prices?.length > 0) && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Цены</div>
                    {initPayload.product?.purchasingPrice !== undefined && initPayload.product?.purchasingPrice !== null && (
                      <>
                        <AttributeItem
                          name="Закупочная цена"
                          code="purchasingPrice"
                          basePath="product"
                          valueType="number"
                          onAddInput={onAddInput}
                        />
                        {initPayload.product?.purchasingCurrency && (
                          <AttributeItem
                            name="Валюта закупки"
                            code="purchasingCurrency"
                            basePath="product"
                            valueType="string"
                            onAddInput={onAddInput}
                          />
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Properties */}
                {initPayload.product?.properties && Object.keys(initPayload.product.properties).length > 0 && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Свойства</div>
                    {Object.entries(initPayload.product.properties).map(([code, prop]) => (
                      <PropertyItem
                        key={code}
                        name={prop.NAME}
                        code={code}
                        property={prop}
                        basePath="product"
                        onAddInput={onAddInput}
                      />
                    ))}
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Current Stage Section */}
        {currentStage && (
          <AccordionItem value="current-stage">
            <AccordionTrigger className="text-sm font-medium">
              Текущий этап
            </AccordionTrigger>
            <AccordionContent>
              <Accordion type="multiple">
                {stageElements.settings && (
                  <ElementSection
                    title="Настройки"
                    element={stageElements.settings}
                    elementType="CALC_SETTINGS"
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.operation && (
                  <ElementSection
                    title="Операция"
                    element={stageElements.operation}
                    elementType="CALC_OPERATIONS"
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.operationVariant && (
                  <ElementSection
                    title="Вариант операции"
                    element={stageElements.operationVariant}
                    elementType="CALC_OPERATIONS_VARIANTS"
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.equipment && (
                  <ElementSection
                    title="Оборудование"
                    element={stageElements.equipment}
                    elementType="CALC_EQUIPMENT"
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.material && (
                  <ElementSection
                    title="Материал"
                    element={stageElements.material}
                    elementType="CALC_MATERIALS"
                    onAddInput={onAddInput}
                  />
                )}

                {stageElements.materialVariant && (
                  <ElementSection
                    title="Вариант материала"
                    element={stageElements.materialVariant}
                    elementType="CALC_MATERIALS_VARIANTS"
                    onAddInput={onAddInput}
                  />
                )}

                {/* Additional stage parameters */}
                {currentStage.properties && (
                  <AccordionItem value="stage-params">
                    <AccordionTrigger className="text-xs">
                      Дополнительные параметры этапа
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1 pl-2">
                        {currentStage.properties.OPERATION_QUANTITY && (
                          <AttributeItem
                            name="Количество операций"
                            code="properties.OPERATION_QUANTITY.VALUE"
                            basePath={currentStageIndex >= 0 ? `elementsStore.CALC_STAGES[${currentStageIndex}]` : 'elementsStore.CALC_STAGES'}
                            valueType="number"
                            onAddInput={onAddInput}
                          />
                        )}
                        {currentStage.properties.MATERIAL_QUANTITY && (
                          <AttributeItem
                            name="Количество материалов"
                            code="properties.MATERIAL_QUANTITY.VALUE"
                            basePath={currentStageIndex >= 0 ? `elementsStore.CALC_STAGES[${currentStageIndex}]` : 'elementsStore.CALC_STAGES'}
                            valueType="number"
                            onAddInput={onAddInput}
                          />
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Previous Stages Section */}
        {previousStages.length > 0 && (
          <AccordionItem value="previous-stages">
            <AccordionTrigger className="text-sm font-medium">
              Предыдущие этапы
            </AccordionTrigger>
            <AccordionContent>
              <Accordion type="multiple">
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
                    <AccordionItem key={prevStage.stageId} value={`prev-stage-${prevStage.stageId}`}>
                      <AccordionTrigger className="text-xs">
                        {prevStage.stageName}
                      </AccordionTrigger>
                      <AccordionContent>
                        <Accordion type="multiple">
                          {settings && (
                            <ElementSection
                              title="Настройки"
                              element={settings}
                              elementType="CALC_SETTINGS"
                              index={prevStage.stageIndex}
                              onAddInput={onAddInput}
                            />
                          )}
                          {operation && (
                            <ElementSection
                              title="Операция"
                              element={operation}
                              elementType="CALC_OPERATIONS"
                              index={prevStage.stageIndex}
                              onAddInput={onAddInput}
                            />
                          )}
                          {operationVariant && (
                            <ElementSection
                              title="Вариант операции"
                              element={operationVariant}
                              elementType="CALC_OPERATIONS_VARIANTS"
                              index={prevStage.stageIndex}
                              onAddInput={onAddInput}
                            />
                          )}
                          {equipment && (
                            <ElementSection
                              title="Оборудование"
                              element={equipment}
                              elementType="CALC_EQUIPMENT"
                              index={prevStage.stageIndex}
                              onAddInput={onAddInput}
                            />
                          )}
                          {material && (
                            <ElementSection
                              title="Материал"
                              element={material}
                              elementType="CALC_MATERIALS"
                              index={prevStage.stageIndex}
                              onAddInput={onAddInput}
                            />
                          )}
                          {materialVariant && (
                            <ElementSection
                              title="Вариант материала"
                              element={materialVariant}
                              elementType="CALC_MATERIALS_VARIANTS"
                              index={prevStage.stageIndex}
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
