import { useMemo } from 'react'
import { InitPayload } from '@/lib/postmessage-bridge'
import { ValueType } from './types'
import { ElementsStoreItem, BitrixPropertyValue } from '@/lib/types'
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
      className="w-full justify-start text-left h-auto py-1.5 px-2"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm truncate">{name}</span>
        <Badge variant="outline" className="shrink-0">
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
      className="w-full justify-start text-left h-auto py-1.5 px-2"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm truncate">{name}</span>
        <Badge variant="outline" className="shrink-0">
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
      <AccordionTrigger className="text-sm">
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
          {element.purchasingPrice !== undefined && (
            <>
              <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Цены</div>
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
        {/* Note: Product data is not directly available in InitPayload based on the types */}

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
                    <AccordionTrigger className="text-sm">
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
        {/* This would require complex tree traversal logic to find previous stages */}
        {/* Placeholder for now */}
      </Accordion>
    </div>
  )
}
