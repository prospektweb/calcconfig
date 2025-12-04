import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  Calculator,
  Package,
  Link as LinkIcon,
  Cube,
  CurrencyDollar
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { 
  AppState, 
  Detail, 
  Binding,
  InfoMessage,
  createEmptyDetail,
  createEmptyBinding
} from '@/lib/types'
import { HeaderSection } from '@/components/calculator/HeaderSection'
import { VariantsFooter } from '@/components/calculator/VariantsFooter'
import { DetailCard } from '@/components/calculator/DetailCard'
import { BindingCard } from '@/components/calculator/BindingCard'
import { InfoPanel } from '@/components/calculator/InfoPanel'
import { GabVesPanel } from '@/components/calculator/GabVesPanel'
import { SidebarMenu } from '@/components/calculator/SidebarMenu'

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
  const [isInfoPanelExpanded, setIsInfoPanelExpanded] = useState(true)
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculationProgress, setCalculationProgress] = useState(0)
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [isGabVesActive, setIsGabVesActive] = useState(false)
  const [isGabVesPanelExpanded, setIsGabVesPanelExpanded] = useState(false)
  const [gabVesMessages, setGabVesMessages] = useState<Array<{id: string, timestamp: number, message: string}>>([])

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

  const handleAddDetail = () => {
    const newDetail = createEmptyDetail()
    setDetails(prev => [...(prev || []), newDetail])
    addInfoMessage('info', `Добавлена деталь: ${newDetail.name}`)
  }

  const handleDeleteDetail = (detailId: string) => {
    setDetails(prev => (prev || []).filter(d => d.id !== detailId))
    addInfoMessage('info', 'Деталь удалена')
  }

  const handleUpdateDetail = (detailId: string, updates: Partial<Detail>) => {
    setDetails(prev =>
      (prev || []).map(d => d.id === detailId ? { ...d, ...updates } : d)
    )
  }
  
  const handleDragStart = (item: DragItem) => (e: React.DragEvent) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '')
    
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0'
    }
  }
  
  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItem(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }
  
  const handleDragOver = (targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedItem) return
    
    const allItems = getAllItemsInOrder()
    const draggedIndex = allItems.findIndex(item => 
      item.type === draggedItem.type && item.id === draggedItem.id
    )
    
    if (draggedIndex === -1 || draggedIndex === targetIndex) return
    
    reorderItems(draggedIndex, targetIndex)
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
  }

  const handleTestCalculation = async () => {
    setIsCalculating(true)
    setCalculationProgress(0)
    addInfoMessage('info', 'Запущен тестовый расчёт...')
    
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200))
      setCalculationProgress(i)
    }
    
    setIsCalculating(false)
    addInfoMessage('success', 'Тестовый расчёт завершён. Итого себестоимость: 1,250.00 руб')
    toast.success('Расчёт завершён успешно')
  }

  const handleFullCalculation = async () => {
    setIsCalculating(true)
    setCalculationProgress(0)
    addInfoMessage('info', 'Запущен полный расчёт...')
    
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 100))
      setCalculationProgress(i)
    }
    
    setIsCalculating(false)
    addInfoMessage('success', 'Полный расчёт завершён. Итого себестоимость: 1,250.00 руб')
    toast.success('Расчёт завершён успешно')
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
  
  const allItems = getAllItemsInOrder()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SidebarMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <div className="max-w-[1920px] mx-auto w-full flex flex-col min-h-screen">
        <header className="border-b border-border bg-card">
          <HeaderSection 
            headerTabs={headerTabs || { materials: [], operations: [], equipment: [], details: [] }}
            setHeaderTabs={setHeaderTabs}
            addInfoMessage={addInfoMessage}
            onOpenMenu={() => setIsMenuOpen(true)}
          />
        </header>

        <main className="flex-1 p-4 overflow-auto">
          <div className="space-y-2">
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
                    orderNumber={index + 1}
                    detailStartIndex={0}
                    onDragStart={handleDragStart({ type: 'binding', index, id: item.id })}
                    onDragEnd={handleDragEnd}
                  />
                )}
                
                {index < allItems.length - 1 && (
                  <div className="flex justify-center -my-1 z-10 relative">
                    <div 
                      className="h-8 w-full absolute top-1/2 -translate-y-1/2"
                      onDragOver={handleDragOver(index + 1)}
                      style={{ 
                        background: draggedItem ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        border: draggedItem ? '2px dashed rgb(99, 102, 241)' : 'none'
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full h-8 w-8 p-0 bg-background hover:bg-accent hover:text-accent-foreground relative z-10"
                      onClick={() => handleCreateBinding(index)}
                    >
                      <LinkIcon className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {allItems.length === 0 && (
            <Card className="p-8 text-center mt-8">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Нет деталей</h3>
              <p className="text-muted-foreground mb-4">
                Добавьте первую деталь для начала работы
              </p>
              <Button onClick={handleAddDetail}>
                <Package className="w-4 h-4 mr-2" />
                Добавить деталь
              </Button>
            </Card>
          )}
        </main>

        {isCalculating && (
          <div className="px-4 py-2 border-t border-border bg-card">
            <div className="max-w-[1920px] mx-auto">
              <div className="flex items-center gap-3">
                <Progress value={calculationProgress} className="flex-1" />
                <span className="text-sm font-medium min-w-[4rem] text-right">
                  {calculationProgress}%
                </span>
              </div>
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

        <footer className="border-t border-border bg-card p-3">
          <div className="max-w-[1920px] mx-auto flex items-center justify-between">
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
              <Button variant="outline" size="sm" onClick={() => toast.info('Настройки цен (заглушка)')}>
                <CurrencyDollar className="w-4 h-4 mr-2" />
                Цены
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('Закрыто (демо)')}>
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
