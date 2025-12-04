import { useState } from 'react'
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
import { Plus, X, DotsSixVertical } from '@phosphor-icons/react'
import { CalculatorInstance, createEmptyCalculator } from '@/lib/types'
import { mockCalculators, mockCalculatorGroups, mockOperations, mockEquipment, mockMaterials } from '@/lib/mock-data'
import { MultiLevelSelect } from './MultiLevelSelect'
import { operationsHierarchy, materialsHierarchy, calculatorsHierarchy, equipmentHierarchy } from '@/lib/hierarchical-data'

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
    <div className="space-y-4">
      <Tabs value={activeTab.toString()} onValueChange={(v) => setActiveTab(parseInt(v))}>
        <div className="flex items-center gap-2">
          <TabsList className="flex-1 justify-start overflow-x-auto bg-muted/30">
            {safeCalculators.map((calc, index) => (
              <div key={calc.id} className="relative flex items-center">
                <TabsTrigger 
                  value={index.toString()} 
                  className="pr-8 gap-1 data-[state=active]:bg-muted-foreground/80 data-[state=active]:text-primary-foreground"
                >
                  <DotsSixVertical className="w-3 h-3" />
                  Калькулятор #{index + 1}
                </TabsTrigger>
                {safeCalculators.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 h-4 w-4 p-0 rounded-full hover:bg-destructive hover:text-destructive-foreground z-10"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveCalculator(index)
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCalculator}
              className="flex-shrink-0 ml-1"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </TabsList>
        </div>

        {safeCalculators.map((calc, index) => {
          const calculatorDef = getCalculatorByCode(calc.calculatorCode)
          const availableEquipment = getAvailableEquipment(calc.operationId)

          return (
            <TabsContent 
              key={calc.id} 
              value={index.toString()} 
              className="space-y-4 mt-4 border rounded-lg p-4 bg-card"
            >
              <div className="space-y-2">
                <Label htmlFor={`calc-${calc.id}`}>Калькулятор</Label>
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
                />
              </div>

              {calculatorDef && (
                <>
                  {calculatorDef.fields?.operation?.visible && (
                    <div className="space-y-2">
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
                          />
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
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground w-[40px] text-right">
                              ед.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {calculatorDef.fields?.equipment?.visible && (
                    <div className="space-y-2">
                      <Label>Оборудование</Label>
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
                  )}

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
                        {calculatorDef.fields.material?.quantityField && (
                          <div className="flex gap-1 items-center">
                            <Input
                              type="number"
                              min="1"
                              value={calc.materialQuantity}
                              onChange={(e) => handleUpdateCalculator(index, { 
                                materialQuantity: parseInt(e.target.value) || 1 
                              })}
                              className="w-20"
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
                                className="flex-1"
                              />
                              <span className="text-sm text-muted-foreground w-[40px] text-right">
                                {option.label.includes('мм') ? 'мм' : option.label.includes('%') ? '%' : ''}
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
