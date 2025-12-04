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
import { Plus, X } from '@phosphor-icons/react'
import { CalculatorInstance, createEmptyCalculator } from '@/lib/types'
import { mockCalculators, mockCalculatorGroups, mockOperations, mockEquipment, mockMaterials } from '@/lib/mock-data'

interface CalculatorTabsProps {
  calculators: CalculatorInstance[]
  onChange: (calculators: CalculatorInstance[]) => void
}

export function CalculatorTabs({ calculators, onChange }: CalculatorTabsProps) {
  const [activeTab, setActiveTab] = useState(0)

  const handleAddCalculator = () => {
    const newCalc = createEmptyCalculator()
    onChange([...calculators, newCalc])
    setActiveTab(calculators.length)
  }

  const handleRemoveCalculator = (index: number) => {
    const newCalculators = calculators.filter((_, i) => i !== index)
    onChange(newCalculators)
    if (activeTab >= newCalculators.length) {
      setActiveTab(Math.max(0, newCalculators.length - 1))
    }
  }

  const handleUpdateCalculator = (index: number, updates: Partial<CalculatorInstance>) => {
    const newCalculators = calculators.map((calc, i) => 
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
    if (!operation) return []
    return mockEquipment.filter(e => operation.equipmentIds.includes(e.id))
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab.toString()} onValueChange={(v) => setActiveTab(parseInt(v))}>
        <div className="flex items-center gap-2">
          <TabsList className="flex-1">
            {calculators.map((calc, index) => (
              <div key={calc.id} className="relative flex items-center">
                <TabsTrigger value={index.toString()} className="pr-7">
                  Калькулятор #{index + 1}
                </TabsTrigger>
                {calculators.length > 1 && (
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
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddCalculator}
            className="flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {calculators.map((calc, index) => {
          const calculatorDef = getCalculatorByCode(calc.calculatorCode)
          const availableEquipment = getAvailableEquipment(calc.operationId)

          return (
            <TabsContent key={calc.id} value={index.toString()} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor={`calc-${calc.id}`}>Калькулятор</Label>
                <Select
                  value={calc.calculatorCode || ''}
                  onValueChange={(value) => handleUpdateCalculator(index, { 
                    calculatorCode: value,
                    operationId: null,
                    equipmentId: null,
                    materialId: null,
                  })}
                >
                  <SelectTrigger id={`calc-${calc.id}`}>
                    <SelectValue placeholder="Выберите калькулятор..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCalculatorGroups.map(group => {
                      const groupCalcs = mockCalculators.filter(c => c.group === group.id)
                      if (groupCalcs.length === 0) return null
                      
                      return (
                        <SelectGroup key={group.id}>
                          <SelectLabel>{group.title}</SelectLabel>
                          {groupCalcs.map(c => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.title}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {calculatorDef && (
                <>
                  {calculatorDef.fields.operation?.visible && (
                    <div className="space-y-2">
                      <Label>Операция</Label>
                      <div className="flex gap-2">
                        {calculatorDef.fields.operation?.quantityField && (
                          <Input
                            type="number"
                            min="1"
                            value={calc.operationQuantity}
                            onChange={(e) => handleUpdateCalculator(index, { 
                              operationQuantity: parseInt(e.target.value) || 1 
                            })}
                            className="w-20"
                          />
                        )}
                        <Select
                          value={calc.operationId?.toString() || ''}
                          onValueChange={(value) => handleUpdateCalculator(index, { 
                            operationId: parseInt(value),
                            equipmentId: null,
                          })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Выберите операцию..." />
                          </SelectTrigger>
                          <SelectContent>
                            {mockOperations.map(operation => (
                              <SelectItem key={operation.id} value={operation.id.toString()}>
                                [{operation.id}] {operation.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {calculatorDef.fields.equipment?.visible && (
                    <div className="space-y-2">
                      <Label>Оборудование</Label>
                      <Select
                        value={calc.equipmentId?.toString() || ''}
                        onValueChange={(value) => handleUpdateCalculator(index, { 
                          equipmentId: parseInt(value) 
                        })}
                        disabled={!calc.operationId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите оборудование..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableEquipment.map(equip => (
                            <SelectItem key={equip.id} value={equip.id.toString()}>
                              [{equip.id}] {equip.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {calculatorDef.fields.material?.visible && (
                    <div className="space-y-2">
                      <Label>Материал</Label>
                      <div className="flex gap-2">
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
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {calculatorDef.fields.material?.quantityUnit || 'шт.'}
                            </span>
                          </div>
                        )}
                        <Select
                          value={calc.materialId?.toString() || ''}
                          onValueChange={(value) => handleUpdateCalculator(index, { 
                            materialId: parseInt(value) 
                          })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Выберите материал..." />
                          </SelectTrigger>
                          <SelectContent>
                            {mockMaterials.map(material => (
                              <SelectItem key={material.id} value={material.id.toString()}>
                                [{material.id}] {material.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {calculatorDef.extraOptions.length > 0 && (
                    <div className="space-y-3 border-t border-border pt-3">
                      {calculatorDef.extraOptions.map(option => (
                        <div key={option.code} className="space-y-2">
                          <Label>{option.label}</Label>
                          {option.type === 'checkbox' ? (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`${calc.id}-${option.code}`}
                                checked={calc.extraOptions[option.code] ?? option.default}
                                onCheckedChange={(checked) => handleUpdateCalculator(index, {
                                  extraOptions: {
                                    ...calc.extraOptions,
                                    [option.code]: checked,
                                  }
                                })}
                              />
                              <label htmlFor={`${calc.id}-${option.code}`} className="text-sm">
                                {option.label}
                              </label>
                            </div>
                          ) : (
                            <Input
                              type="number"
                              min={option.min}
                              max={option.max}
                              value={calc.extraOptions[option.code] ?? option.default}
                              onChange={(e) => handleUpdateCalculator(index, {
                                extraOptions: {
                                  ...calc.extraOptions,
                                  [option.code]: parseFloat(e.target.value) || option.default,
                                }
                              })}
                            />
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
