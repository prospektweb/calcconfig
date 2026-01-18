import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
import { X, Plus, Trash } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { InitPayload } from '@/lib/postmessage-bridge'

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
}

interface Property {
  CODE: string
  NAME: string
  PROPERTY_TYPE: string
  ENUMS?: PropertyEnum[]
}

interface MappingRow {
  key: string
  variantId: string
}

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
  const [selectedPropertyCode, setSelectedPropertyCode] = useState<string>('')
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([])
  const [hasInitialized, setHasInitialized] = useState(false)

  // Get iblock properties based on type
  const getPropertiesList = (): Property[] => {
    if (!bitrixMeta) return []
    
    // Use SKU properties from siblings if available
    if (bitrixMeta.siblings?.skuProperties) {
      return Object.values(bitrixMeta.siblings.skuProperties).map(prop => ({
        CODE: prop.CODE,
        NAME: prop.NAME,
        PROPERTY_TYPE: prop.PROPERTY_TYPE,
        ENUMS: prop.ENUMS || [],
      }))
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
        const parsed = JSON.parse(existingOptions)
        if (parsed.propertyCode && parsed.mapping) {
          setSelectedPropertyCode(parsed.propertyCode)
          
          // Find the property
          const prop = propertiesList.find(p => p.CODE === parsed.propertyCode)
          if (prop) {
            setSelectedProperty(prop)
            setMappingRows(Object.entries(parsed.mapping).map(([key, variantId]) => ({
              key,
              variantId: String(variantId),
            })))
          }
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
      setSelectedPropertyCode('')
      setSelectedProperty(null)
      setMappingRows([])
      setHasInitialized(false)
    }
  }, [open])

  const handlePropertySelect = (code: string) => {
    setSelectedPropertyCode(code)
    const prop = propertiesList.find(p => p.CODE === code)
    setSelectedProperty(prop || null)
    
    // Initialize rows based on property type
    if (prop && prop.PROPERTY_TYPE === 'L' && prop.ENUMS) {
      // For list type, create rows for each enum value
      setMappingRows(prop.ENUMS.map(enumItem => ({
        key: enumItem.VALUE,
        variantId: '',
      })))
    } else {
      // For other types, start with one empty row
      setMappingRows([{ key: '', variantId: '' }])
    }
  }

  const handleAddRow = () => {
    setMappingRows([...mappingRows, { key: '', variantId: '' }])
  }

  const handleRemoveRow = (index: number) => {
    setMappingRows(mappingRows.filter((_, i) => i !== index))
  }

  const handleUpdateRow = (index: number, field: 'key' | 'variantId', value: string) => {
    const newRows = [...mappingRows]
    newRows[index][field] = value
    setMappingRows(newRows)
    
    // For non-list types, auto-add a new row when the last row is filled
    if (selectedProperty && selectedProperty.PROPERTY_TYPE !== 'L') {
      if (index === mappingRows.length - 1 && field === 'variantId' && value) {
        const lastRow = newRows[index]
        if (lastRow.key && lastRow.variantId) {
          setMappingRows([...newRows, { key: '', variantId: '' }])
        }
      }
    }
  }

  const canSave = () => {
    if (!selectedPropertyCode) return false
    
    if (selectedProperty && selectedProperty.PROPERTY_TYPE === 'L') {
      // For list type, all rows must have a variant selected
      return mappingRows.every(row => row.variantId)
    } else {
      // For other types, at least one complete row
      return mappingRows.some(row => row.key && row.variantId)
    }
  }

  const handleSave = () => {
    if (!canSave()) return
    
    // Build mapping object
    const mapping: Record<string, number> = {}
    mappingRows.forEach(row => {
      if (row.key && row.variantId) {
        mapping[row.key] = parseInt(row.variantId, 10)
      }
    })
    
    const optionsJson = JSON.stringify({
      propertyCode: selectedPropertyCode,
      mapping,
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

  // Get variants hierarchy from siblings if available, otherwise use passed hierarchy
  const getVariantsHierarchy = (): any[] => {
    if (bitrixMeta?.siblings) {
      if (type === 'operation' && bitrixMeta.siblings.operationsVariants) {
        return bitrixMeta.siblings.operationsVariants
      }
      if (type === 'material' && bitrixMeta.siblings.materialsVariants) {
        return bitrixMeta.siblings.materialsVariants
      }
    }
    // Fallback to passed hierarchy
    return variantsHierarchy
  }

  const flatVariants = flattenVariants(getVariantsHierarchy())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="min-w-[1024px] w-fit max-w-[90vw] max-h-[80vh] p-0 gap-0 flex flex-col"
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
                Сопоставление свойств ТП с вариантами {type === 'operation' ? 'операций' : 'материалов'}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            {/* Property Selection */}
            <div>
              <Label className="pb-[10px] inline-block">Свойство ТП</Label>
              <Select value={selectedPropertyCode} onValueChange={handlePropertySelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите свойство..." />
                </SelectTrigger>
                <SelectContent>
                  {propertiesList.map(prop => (
                    <SelectItem key={prop.CODE} value={prop.CODE}>
                      {prop.NAME}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mapping Table */}
            {selectedProperty && (
              <div className="space-y-3">
                <Label className="pb-[10px] inline-block">
                  Сопоставление{' '}
                  {selectedProperty.PROPERTY_TYPE === 'L' && '(тип: список)'}
                </Label>
                
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium whitespace-nowrap">
                          {selectedProperty.PROPERTY_TYPE === 'L' 
                            ? 'Значение свойства' 
                            : 'Произвольное значение'}
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium whitespace-nowrap">
                          Вариант {type === 'operation' ? 'операции' : 'материала'}
                        </th>
                        {selectedProperty.PROPERTY_TYPE !== 'L' && (
                          <th className="px-4 py-2 w-12"></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {mappingRows.map((row, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-4 py-2">
                            {selectedProperty.PROPERTY_TYPE === 'L' ? (
                              <span className="text-sm">{row.key}</span>
                            ) : (
                              <Input
                                value={row.key}
                                onChange={(e) => handleUpdateRow(index, 'key', e.target.value)}
                                placeholder="Введите значение..."
                                className="h-8"
                              />
                            )}
                          </td>
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
                          {selectedProperty.PROPERTY_TYPE !== 'L' && (
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
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedProperty.PROPERTY_TYPE !== 'L' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddRow}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить строку
                  </Button>
                )}
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
