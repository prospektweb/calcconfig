import { useState, useEffect, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  Calculator,
  Package,
  Link as LinkIcon,
  Cube,
  CurrencyDollar,
  Tag,
  FloppyDisk,
  X
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { 
  AppState, 
  Detail, 
  Binding,
  InfoMessage,
  CostingSettings,
  SalePricesSettings,
  createEmptyDetail,
  createEmptyBinding
} from '@/lib/types'
import { mockDetails } from '@/lib/mock-data'
import { HeaderSection } from '@/components/calculator/HeaderSection'
import { VariantsFooter } from '@/components/calculator/VariantsFooter'
import { DetailCard } from '@/components/calculator/DetailCard'
import { BindingCard } from '@/components/calculator/BindingCard'
import { InfoPanel } from '@/components/calculator/InfoPanel'
import { GabVesPanel } from '@/components/calculator/GabVesPanel'
import { CostPanel } from '@/components/calculator/CostPanel'
import { PricePanel } from '@/components/calculator/PricePanel'
import { SidebarMenu } from '@/components/calculator/SidebarMenu'
import { usePostMessage } from '@/hooks/use-postmessage'
import { CalculatorState } from '@/lib/postmessage-bridge'

type DragItem = {
  type: 'detail' | 'binding'
  index: number
  id: string
}

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [selectedVariantIds] = useState<number[]>(Array.from({ length: 15 }, (_, i) => 525 + i))
  const [testVariantId, setTestVariantId] = useState<number | null>(525)
  
  const [headerTabs, setHeaderTabs] = useKV<AppState['headerTabs']>('calc_header_tabs', {
    materials: [],
    operations: [],
    equipment: [],
    details: [],
  })
  
  const [details, setDetails] = useKV<Detail[]>('calc_details', [])
  const [bindings, setBindings] = useKV<Binding[]>('calc_bindings', [])
  
  const [infoMessages, setInfoMessages] = useState<InfoMessage[]>([])
  const [isInfoPanelExpanded, setIsInfoPanelExpanded] = useState(() => {
    const stored = localStorage.getItem('calc_info_panel_expanded')
    return stored ? stored === 'true' : false
  })
  
  useEffect(() => {
    localStorage.setItem('calc_info_panel_expanded', isInfoPanelExpanded.toString())
  }, [isInfoPanelExpanded])
  
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculationProgress, setCalculationProgress] = useState(0)
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [draggedHeaderDetail, setDraggedHeaderDetail] = useState<{id: number, name: string} | null>(null)
  const [draggedHeaderMaterial, setDraggedHeaderMaterial] = useState<{id: number, name: string} | null>(null)
  const [draggedHeaderOperation, setDraggedHeaderOperation] = useState<{id: number, name: string} | null>(null)
  const [draggedHeaderEquipment, setDraggedHeaderEquipment] = useState<{id: number, name: string} | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const [isGabVesActive, setIsGabVesActive] = useState(false)
  const [isGabVesPanelExpanded, setIsGabVesPanelExpanded] = useState(false)
  const [gabVesMessages, setGabVesMessages] = useState<Array<{id: string, timestamp: number, message: string}>>([])
  
  const [isCostActive, setIsCostActive] = useState(false)
  const [isCostPanelExpanded, setIsCostPanelExpanded] = useState(false)
  const [costMessages, setCostMessages] = useState<Array<{id: string, timestamp: number, message: string}>>([])
  
  const [isPriceActive, setIsPriceActive] = useState(false)
  const [isPricePanelExpanded, setIsPricePanelExpanded] = useState(false)
  const [priceMessages, setPriceMessages] = useState<Array<{id: string, timestamp: number, message: string}>>([])

  const [costingSettings, setCostingSettings] = useKV<CostingSettings>('calc_costing_settings', {
    basedOn: 'COMPONENT_PURCHASE',
    roundingStep: 1,
    markupValue: 0,
    markupUnit: 'RUB',
  })

  const [salePricesSettings, setSalePricesSettings] = useKV<SalePricesSettings>('calc_sale_prices_settings', {
    selectedTypes: [],
    types: {},
  })
  const getCurrentState = useCallback((): CalculatorState => {
    return {
      selectedVariantIds,
      testVariantId,
      headerTabs: headerTabs || {
        materials: [],
        operations: [],
        equipment: [],
        details: [],
      },
      details: details || [],
      bindings: bindings || [],
    }
  }, [selectedVariantIds, testVariantId, headerTabs, details, bindings])

  const handleStateResponse = useCallback((state: CalculatorState) => {
    if (state.selectedVariantIds) {
      
    }
    if (state.testVariantId !== undefined) {
      setTestVariantId(state.testVariantId)
    }
    if (state.headerTabs) {
      setHeaderTabs(state.headerTabs)
    }
    if (state.details) {
      setDetails(state.details)
    }
    if (state.bindings) {
      setBindings(state.bindings)
    }
    addInfoMessage('info', 'Состояние получено от родительского окна')
  }, [setHeaderTabs, setDetails, setBindings])

  const { syncState, syncStateImmediate, subscribe, sendMessage } = usePostMessage({
    onStateRequest: getCurrentState,
    onStateResponse: handleStateResponse,
    syncDelay: 500,
  })

  useEffect(() => {
    syncState(getCurrentState())
  }, [selectedVariantIds, testVariantId, headerTabs, details, bindings])

  useEffect(() => {
    const unsubscribe = subscribe('*', (payload) => {
      console.log('[App] Received message:', payload)
    })
    return unsubscribe
  }, [subscribe])
  const addInfoMessage = (type: InfoMessage['type'], message: string) => {
    const newMessage: InfoMessage = {
      id: `msg_${Date.now()}`,
      type,
      message,
      timestamp: Date.now(),
    }
    setInfoMessages((prev) => [...prev, newMessage])
  }
  
  const addGabVesMessage = (message: string) => {
    const newMessage = {
      id: `gabves_${Date.now()}`,
      timestamp: Date.now(),
      message,
    }
    setGabVesMessages((prev) => [...prev, newMessage])
  }
  
  const addCostMessage = (message: string) => {
    const newMessage = {
      id: `cost_${Date.now()}`,
      timestamp: Date.now(),
      message,
    }
    setCostMessages((prev) => [...prev, newMessage])
  }
  
  const addPriceMessage = (message: string) => {
    const newMessage = {
      id: `price_${Date.now()}`,
      timestamp: Date.now(),
      message,
    }
    setPriceMessages((prev) => [...prev, newMessage])
  }

  const handleAddDetail = () => {
    const newDetail = createEmptyDetail()
    setDetails(prev => [...(prev || []), newDetail])
    addInfoMessage('info', `Добавлена деталь: ${newDetail.name}`)
    sendMessage('DETAIL_ADDED', { detail: newDetail })
  }

  const handleDeleteDetail = (detailId: string) => {
    setDetails(prev => (prev || []).filter(d => d.id !== detailId))
    addInfoMessage('info', 'Деталь удалена')
    sendMessage('DETAIL_DELETED', { detailId })
  }

  const handleUpdateDetail = (detailId: string, updates: Partial<Detail>) => {
    setDetails(prev =>
      (prev || []).map(d => d.id === detailId ? { ...d, ...updates } : d)
    )
    sendMessage('DETAIL_UPDATED', { detailId, updates })
  }
  
  const handleUpdateBinding = (bindingId: string, updates: Partial<Binding>) => {
    setBindings(prev =>
      (prev || []).map(b => b.id === bindingId ? { ...b, ...updates } : b)
    )
    sendMessage('BINDING_UPDATED', { bindingId, updates })
  }
  
  const handleDragStart = (item: DragItem) => (e: React.DragEvent) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify(item))
  }
  
  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItem(null)
    setDropTarget(null)
  }
  
  const handleDragOver = (targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const dragData = e.dataTransfer.types.includes('application/json')
    if (dragData || draggedItem) {
      setDropTarget(targetIndex)
    }
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setDropTarget(null)
    }
  }
  
  const handleDrop = (targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    
    try {
      const jsonData = e.dataTransfer.getData('application/json')
      if (jsonData) {
        const data = JSON.parse(jsonData)
        
        if (data.type === 'header-detail') {
          const detail = mockDetails.find(d => d.id === data.detailId)
          if (detail) {
            const newDetail = createEmptyDetail(data.detailName)
            newDetail.width = detail.width
            newDetail.length = detail.length
            
            const allItems = getAllItemsInOrder()
            const newDetails = [...(details || [])]
            const newBindings = [...(bindings || [])]
            
            if (targetIndex === 0) {
              setDetails([newDetail, ...newDetails])
            } else if (targetIndex >= allItems.length) {
              setDetails([...newDetails, newDetail])
            } else {
              const itemsBeforeTarget: string[] = []
              const itemsAfterTarget: string[] = []
              
              allItems.forEach((item, idx) => {
                if (idx < targetIndex) {
                  if (item.type === 'detail') itemsBeforeTarget.push(item.id)
                } else {
                  if (item.type === 'detail') itemsAfterTarget.push(item.id)
                }
              })
              
              const reorderedDetails = [
                ...newDetails.filter(d => itemsBeforeTarget.includes(d.id)),
                newDetail,
                ...newDetails.filter(d => itemsAfterTarget.includes(d.id))
              ]
              setDetails(reorderedDetails)
            }
            
            addInfoMessage('success', `Добавлена деталь: ${data.detailName}`)
            setDraggedHeaderDetail(null)
            setDraggedHeaderMaterial(null)
            setDraggedHeaderOperation(null)
            setDraggedHeaderEquipment(null)
            return
          }
        }
      }
      
      if (!draggedItem) return
      
      const allItems = getAllItemsInOrder()
      const draggedIndex = allItems.findIndex(item => 
        item.type === draggedItem.type && item.id === draggedItem.id
      )
      
      if (draggedIndex === -1 || draggedIndex === targetIndex) return
      
      reorderItems(draggedIndex, targetIndex)
    } catch (error) {
      console.error('Drop error:', error)
    }
    
    setDraggedItem(null)
    setDraggedHeaderDetail(null)
    setDraggedHeaderMaterial(null)
    setDraggedHeaderOperation(null)
    setDraggedHeaderEquipment(null)
  }
  
  const handleMainAreaDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  
  const handleMainAreaDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      const jsonData = e.dataTransfer.getData('application/json')
      if (jsonData) {
        const data = JSON.parse(jsonData)
        
        if (data.type === 'header-detail') {
          const detail = mockDetails.find(d => d.id === data.detailId)
          if (detail) {
            const newDetail = createEmptyDetail(data.detailName)
            newDetail.width = detail.width
            newDetail.length = detail.length
            setDetails(prev => [...(prev || []), newDetail])
            addInfoMessage('success', `Добавлена деталь: ${data.detailName}`)
          }
        }
      }
    } catch (error) {
      console.error('Drop error:', error)
    }
    
    setDraggedHeaderDetail(null)
    setDraggedHeaderMaterial(null)
    setDraggedHeaderOperation(null)
    setDraggedHeaderEquipment(null)
  }
  
  const handleHeaderDetailDragStart = (detailId: number, detailName: string) => {
    setDraggedHeaderDetail({ id: detailId, name: detailName })
  }
  
  const handleHeaderMaterialDragStart = (materialId: number, materialName: string) => {
    setDraggedHeaderMaterial({ id: materialId, name: materialName })
  }
  
  const handleHeaderOperationDragStart = (operationId: number, operationName: string) => {
    setDraggedHeaderOperation({ id: operationId, name: operationName })
  }
  
  const handleHeaderEquipmentDragStart = (equipmentId: number, equipmentName: string) => {
    setDraggedHeaderEquipment({ id: equipmentId, name: equipmentName })
  }
  
  const getAllItemsInOrder = (): Array<{type: 'detail' | 'binding', id: string, item: Detail | Binding}> => {
    const result: Array<{type: 'detail' | 'binding', id: string, item: Detail | Binding}> = []
    const safeDetails = details || []
    const safeBindings = bindings || []
    
    safeDetails.forEach(detail => {
      const inBinding = safeBindings.some(b => b.detailIds?.includes(detail.id))
      if (!inBinding) {
        result.push({ type: 'detail', id: detail.id, item: detail })
      }
    })
    
    safeBindings.forEach(binding => {
      const inParentBinding = safeBindings.some(b => b.bindingIds?.includes(binding.id))
      if (!inParentBinding) {
        result.push({ type: 'binding', id: binding.id, item: binding })
      }
    })
    
    return result
  }
  
  const reorderItems = (fromIndex: number, toIndex: number) => {
    console.log('Reorder:', fromIndex, toIndex)
  }

  const handleCreateBinding = (index: number) => {
    const allItems = getAllItemsInOrder()
    
    if (index >= allItems.length - 1) return
    
    const item1 = allItems[index]
    const item2 = allItems[index + 1]
    
    const newBinding = createEmptyBinding()
    
    if (item1.type === 'detail') {
      newBinding.detailIds.push(item1.id)
    } else {
      newBinding.bindingIds.push(item1.id)
    }
    
    if (item2.type === 'detail') {
      newBinding.detailIds.push(item2.id)
    } else {
      newBinding.bindingIds.push(item2.id)
    }
    
    setBindings(prev => [...(prev || []), newBinding])
    addInfoMessage('success', `Создано скрепление`)
    sendMessage('BINDING_CREATED', { binding: newBinding })
  }

  const handleTestCalculation = async () => {
    setIsCalculating(true)
    setCalculationProgress(0)
    addInfoMessage('info', 'Запущен тестовый расчёт...')
    sendMessage('CALCULATION_START', { type: 'test' })
    
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200))
      setCalculationProgress(i)
      sendMessage('CALCULATION_PROGRESS', { progress: i, type: 'test' })
    }
    
    setIsCalculating(false)
    addInfoMessage('success', 'Тестовый расчёт завершён. Итого себестоимость: 1,250.00 руб')
    toast.success('Расчёт завершён успешно')
    sendMessage('CALCULATION_COMPLETE', { type: 'test', result: { cost: 1250.00 } })
  }

  const handleFullCalculation = async () => {
    setIsCalculating(true)
    setCalculationProgress(0)
    addInfoMessage('info', 'Запущен полный расчёт...')
    sendMessage('CALCULATION_START', { type: 'full' })
    
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 100))
      setCalculationProgress(i)
      sendMessage('CALCULATION_PROGRESS', { progress: i, type: 'full' })
    }
    
    setIsCalculating(false)
    addInfoMessage('success', 'Полный расчёт завершён. Итого себестоимость: 1,250.00 руб')
    toast.success('Расчёт завершён успешно')
    sendMessage('CALCULATION_COMPLETE', { type: 'full', result: { cost: 1250.00 } })
  }
  
  const handleToggleGabVes = () => {
    setIsGabVesActive(!isGabVesActive)
    if (!isGabVesActive) {
      setIsGabVesPanelExpanded(true)
      addGabVesMessage('Расчёт габаритов начат...')
      setTimeout(() => {
        addGabVesMessage('Ширина: 297мм, Длина: 420мм, Высота: 15мм')
        addGabVesMessage('Вес: 0.85 кг')
      }, 500)
    } else {
      setIsGabVesPanelExpanded(false)
    }
  }
  
  const handleToggleCost = () => {
    setIsCostActive(!isCostActive)
    if (!isCostActive) {
      setIsCostPanelExpanded(true)
      addCostMessage('Расчёт себестоимости начат...')
      setTimeout(() => {
        addCostMessage('Материалы: 450.00 руб')
        addCostMessage('Операции: 600.00 руб')
        addCostMessage('Оборудование: 200.00 руб')
        addCostMessage('Итого себестоимость: 1,250.00 руб')
      }, 500)
    } else {
      setIsCostPanelExpanded(false)
    }
  }
  
  const handleTogglePrice = () => {
    setIsPriceActive(!isPriceActive)
    if (!isPriceActive) {
      setIsPricePanelExpanded(true)
      addPriceMessage('Расчёт отпускных цен начат...')
      setTimeout(() => {
        addPriceMessage('Себестоимость: 1,250.00 руб')
        addPriceMessage('Наценка (20%): 250.00 руб')
        addPriceMessage('Итого отпускная цена: 1,500.00 руб')
      }, 500)
    } else {
      setIsPricePanelExpanded(false)
    }
  }

  const handleRefreshData = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    addInfoMessage('success', 'Данные обновлены')
  }
  
  const allItems = getAllItemsInOrder()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SidebarMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <div className="w-full flex flex-col min-h-screen">
        <header className="border-b border-border bg-card">
          <HeaderSection 
            headerTabs={headerTabs || { materials: [], operations: [], equipment: [], details: [] }}
            setHeaderTabs={setHeaderTabs}
            addInfoMessage={addInfoMessage}
            onOpenMenu={() => setIsMenuOpen(true)}
            onRefreshData={handleRefreshData}
            onDetailDragStart={handleHeaderDetailDragStart}
            onMaterialDragStart={handleHeaderMaterialDragStart}
            onOperationDragStart={handleHeaderOperationDragStart}
            onEquipmentDragStart={handleHeaderEquipmentDragStart}
          />
        </header>

        <main 
          className="flex-1 p-4 overflow-auto"
          onDragOver={handleMainAreaDragOver}
          onDrop={handleMainAreaDrop}
        >
          <div className="space-y-0">
            {allItems.length === 0 && (
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg flex items-center justify-center transition-all",
                  (draggedHeaderDetail || draggedHeaderMaterial || draggedHeaderOperation || draggedHeaderEquipment)
                    ? "border-accent bg-accent/10" 
                    : "border-border bg-muted/30"
                )}
                style={{ height: '43px' }}
              >
                <p className="text-muted-foreground text-center">
                  {(draggedHeaderDetail || draggedHeaderMaterial || draggedHeaderOperation || draggedHeaderEquipment)
                    ? "Отпустите для добавления детали" 
                    : "Перетащите деталь из шапки сюда"}
                </p>
              </div>
            )}
            
            {(draggedHeaderDetail || draggedHeaderMaterial || draggedHeaderOperation || draggedHeaderEquipment || draggedItem) && dropTarget === 0 && (
              <div 
                className="h-24 border-2 border-dashed border-accent bg-accent/10 rounded-lg flex items-center justify-center mb-2"
                onDragOver={handleDragOver(0)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop(0)}
              >
                <p className="text-accent-foreground font-medium">Вставить сюда</p>
              </div>
            )}
            
            {allItems.map((item, index) => (
              <div key={item.id}>
                {item.type === 'detail' ? (
                  <DetailCard
                    detail={item.item as Detail}
                    onUpdate={(updates) => handleUpdateDetail(item.id, updates)}
                    onDelete={() => handleDeleteDetail(item.id)}
                    isInBinding={false}
                    orderNumber={index + 1}
                    onDragStart={handleDragStart({ type: 'detail', index, id: item.id })}
                    onDragEnd={handleDragEnd}
                  />
                ) : (
                  <BindingCard
                    binding={item.item as Binding}
                    details={(details || []).filter(d => (item.item as Binding).detailIds?.includes(d.id))}
                    bindings={(bindings || []).filter(b => (item.item as Binding).bindingIds?.includes(b.id))}
                    allDetails={details || []}
                    allBindings={bindings || []}
                    onUpdate={(updates) => {
                      setBindings(prev =>
                        (prev || []).map(b => b.id === item.id ? { ...b, ...updates } : b)
                      )
                    }}
                    onDelete={() => {
                      setBindings(prev => (prev || []).filter(b => b.id !== item.id))
                      addInfoMessage('info', 'Скрепление удалено')
                    }}
                    onUpdateDetail={handleUpdateDetail}
                    onUpdateBinding={handleUpdateBinding}
                    orderNumber={index + 1}
                    detailStartIndex={0}
                    onDragStart={handleDragStart({ type: 'binding', index, id: item.id })}
                    onDragEnd={handleDragEnd}
                  />
                )}
                
                {(draggedHeaderDetail || draggedHeaderMaterial || draggedHeaderOperation || draggedHeaderEquipment || draggedItem) && dropTarget === index + 1 && (
                  <div 
                    className="h-24 border-2 border-dashed border-accent bg-accent/10 rounded-lg flex items-center justify-center my-2"
                    onDragOver={handleDragOver(index + 1)}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop(index + 1)}
                  >
                    <p className="text-accent-foreground font-medium">Вставить сюда</p>
                  </div>
                )}
                
                {index < allItems.length - 1 && !(draggedHeaderDetail || draggedHeaderMaterial || draggedHeaderOperation || draggedHeaderEquipment || draggedItem) && (
                  <div className="flex justify-center -my-3 z-10 relative" style={{ marginTop: '-12px', marginBottom: '-12px' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full h-8 w-8 p-0 bg-background hover:bg-accent hover:text-accent-foreground relative z-10 border border-border shadow-sm"
                      onClick={() => handleCreateBinding(index)}
                    >
                      <LinkIcon className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>

        {isCalculating && (
          <div className="px-4 py-2 border-t border-border bg-card">
            <div className="flex items-center gap-3">
              <Progress value={calculationProgress} className="flex-1" />
              <span className="text-sm font-medium min-w-[4rem] text-right">
                {calculationProgress}%
              </span>
            </div>
          </div>
        )}

        <VariantsFooter
          selectedVariantIds={selectedVariantIds}
          testVariantId={testVariantId}
          setTestVariantId={setTestVariantId}
          addInfoMessage={addInfoMessage}
        />

        <InfoPanel
          messages={infoMessages}
          isExpanded={isInfoPanelExpanded}
          onToggle={() => setIsInfoPanelExpanded(!isInfoPanelExpanded)}
        />
        
        {isGabVesActive && (
          <GabVesPanel
            messages={gabVesMessages}
            isExpanded={isGabVesPanelExpanded}
            onToggle={() => setIsGabVesPanelExpanded(!isGabVesPanelExpanded)}
          />
        )}
        
        {isCostActive && (
          <CostPanel
            messages={costMessages}
            isExpanded={isCostPanelExpanded}
            onToggle={() => setIsCostPanelExpanded(!isCostPanelExpanded)}
            settings={costingSettings || { basedOn: 'COMPONENT_PURCHASE', roundingStep: 1, markupValue: 0, markupUnit: 'RUB' }}
            onSettingsChange={(newSettings) => setCostingSettings(newSettings)}
          />
        )}
        
        {isPriceActive && (
          <PricePanel
            messages={priceMessages}
            isExpanded={isPricePanelExpanded}
            onToggle={() => setIsPricePanelExpanded(!isPricePanelExpanded)}
            settings={salePricesSettings || { selectedTypes: [], types: {} }}
            onSettingsChange={(newSettings) => setSalePricesSettings(newSettings)}
          />
        )}

        <footer className="border-t border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button 
                variant={isGabVesActive ? "default" : "outline"} 
                size="sm" 
                onClick={handleToggleGabVes}
                className={isGabVesActive ? "bg-accent text-accent-foreground" : ""}
              >
                <Cube className="w-4 h-4 mr-2" />
                Габариты/Вес
              </Button>
              <Button 
                variant={isCostActive ? "default" : "outline"} 
                size="sm" 
                onClick={handleToggleCost}
                className={isCostActive ? "bg-accent text-accent-foreground" : ""}
              >
                <CurrencyDollar className="w-4 h-4 mr-2" />
                Себестоимость
              </Button>
              <Button 
                variant={isPriceActive ? "default" : "outline"} 
                size="sm" 
                onClick={handleTogglePrice}
                className={isPriceActive ? "bg-accent text-accent-foreground" : ""}
              >
                <Tag className="w-4 h-4 mr-2" />
                Отпускные цены
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleTestCalculation} disabled={isCalculating}>
                <Calculator className="w-4 h-4 mr-2" />
                Тест
              </Button>
              <Button size="sm" onClick={handleFullCalculation} disabled={isCalculating}>
                <Calculator className="w-4 h-4 mr-2" />
                Рассчитать
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.success('Сохранено (демо)')}>
                <FloppyDisk className="w-4 h-4 mr-2" />
                Сохранить
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('Закрыто (демо)')}>
                <X className="w-4 h-4 mr-2" />
                Закрыть
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App
