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
import { Plus, X, DotsSixVertical, Package, Wrench, Hammer } from '@phosphor-icons/react'
import { CalculatorInstance, createEmptyCalculator } from '@/lib/types'
import { mockCalculators, mockCalculatorGroups, mockOperations, mockEquipment, mockMaterials } from '@/lib/mock-data'
import { MultiLevelSelect } from './MultiLevelSelect'
import { operationsHierarchy, materialsHierarchy, calculatorsHierarchy, equipmentHierarchy } from '@/lib/hierarchical-data'
import { useCustomDrag } from '@/hooks/use-custom-drag'
import { cn } from '@/lib/utils'

interface CalculatorTabsProps {
  calculators: CalculatorInstance[]
  onChange: (calculators: CalculatorInstance[]) => void
}

const TAB_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function CalculatorTabs({ calculators, onChange }: CalculatorTabsProps) {
  const [activeTab, setActiveTab] = useState(0)
  const { dragState, startDrag, setDropTarget, endDrag, cancelDrag } = useCustomDrag()
  const tabRefs = useRef<Map<number, HTMLElement>>(new Map())
  const dropZoneRefs = useRef<Map<number, HTMLElement>>(new Map())
  const [materialDropZoneHover, setMaterialDropZoneHover] = useState<number | null>(null)
  const [operationDropZoneHover, setOperationDropZoneHover] = useState<number | null>(null)
  const [equipmentDropZoneHover, setEquipmentDropZoneHover] = useState<number | null>(null)
  
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

  const getCalculatorByCode = (code: string | null) => {
    return mockCalculators.find(c => c.code === code)
  }

  const getAvailableEquipment = (operationId: number | null) => {
    if (!operationId) return []
    const operation = mockOperations.find(w => w.id === operationId)
    if (!operation || !operation.equipmentIds) return []
    return mockEquipment.filter(e => operation.equipmentIds.includes(e.id))
  }
  
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
                    data-pwcode={`stage-tab-${index}`}
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
                        data-pwcode={`stage-drag-handle-${index}`}
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
                        data-pwcode={`btn-remove-stage-${index}`}
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
          const calculatorDef = getCalculatorByCode(calc.calculatorCode)
          const availableEquipment = getAvailableEquipment(calc.operationId)

          return (
            <TabsContent 
              key={calc.id} 
              value={index.toString()} 
              className="space-y-4 mt-4 border rounded-lg p-2 bg-card"
              data-pwcode={`stage-content-${index}`}
            >
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <Label>Калькулятор</Label>
                  <MultiLevelSelect
                    items={calculatorsHierarchy}
                    value={calc.calculatorCode || null}
                    onValueChange={(value) => handleUpdateCalculator(index, { 
                      calculatorCode: value,
                      operationId: null,
                      equipmentId: null,
                      materialId: null,
                    })}
                    placeholder="Выберите калькулятор..."
                    data-pwcode={`select-calculator-${index}`}
                  />
                </div>

                {calculatorDef && calculatorDef.fields?.operation?.visible && (
                  <div className="flex-1 space-y-2">
                    <Label>Операция</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <MultiLevelSelect
                          items={operationsHierarchy}
                          value={calc.operationId?.toString() || null}
                          onValueChange={(value) => handleUpdateCalculator(index, { 
                            operationId: parseInt(value),
                            equipmentId: null,
                          })}
                          placeholder="Выберите операцию..."
                          data-pwcode={`select-operation-${index}`}
                        />
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
                      {calculatorDef.fields.operation?.quantityField && (
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
                            ед.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {calculatorDef && calculatorDef.fields?.equipment?.visible && (
                  <div className="flex-1 space-y-2">
                    <Label>Оборудование</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <MultiLevelSelect
                          items={equipmentHierarchy}
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
              </div>

              {calculatorDef && (
                <>

                  {calculatorDef.fields?.material?.visible && (
                    <div className="space-y-2">
                      <Label>Материал</Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <MultiLevelSelect
                            items={materialsHierarchy}
                            value={calc.materialId?.toString() || null}
                            onValueChange={(value) => handleUpdateCalculator(index, { 
                              materialId: parseInt(value) 
                            })}
                            placeholder="Выберите материал..."
                          />
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
                        {calculatorDef.fields.material?.quantityField && (
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
                              {calculatorDef.fields.material?.quantityUnit || 'шт.'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {calculatorDef.extraOptions && calculatorDef.extraOptions.length > 0 && (
                    <div className="space-y-3 border-t border-border pt-3">
                      {calculatorDef.extraOptions.map(option => (
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
                                {option.code === 'FIELD_MM' ? 'мм' : option.label.includes('%') ? '%' : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
