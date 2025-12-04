import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  X, 
  ArrowsOut, 
  CaretDown, 
  CaretUp,
  Calculator,
  Gear,
  Package,
  Link as LinkIcon
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { 
  mockProductVariants, 
  mockMaterials, 
  mockOperations, 
  mockEquipment, 
  mockDetails 
} from '@/lib/mock-data'
import { 
  AppState, 
  HeaderElement, 
  Detail, 
  InfoMessage,
  createEmptyDetail,
  createEmptyBinding
} from '@/lib/types'
import { HeaderSection } from '@/components/calculator/HeaderSection'
import { VariantsFooter } from '@/components/calculator/VariantsFooter'
import { DetailCard } from '@/components/calculator/DetailCard'
import { BindingCard } from '@/components/calculator/BindingCard'
import { InfoPanel } from '@/components/calculator/InfoPanel'

function App() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([525, 526, 527])
  const [testVariantId, setTestVariantId] = useState<number | null>(525)
  
  const [headerTabs, setHeaderTabs] = useKV<AppState['headerTabs']>('calc_header_tabs', {
    materials: [],
    operations: [],
    equipment: [],
    details: [],
  })
  
  const [details, setDetails] = useKV<Detail[]>('calc_details', [])
  const [bindings, setBindings] = useKV<AppState['bindings']>('calc_bindings', [])
  
  const [infoMessages, setInfoMessages] = useState<InfoMessage[]>([])
  const [isInfoPanelExpanded, setIsInfoPanelExpanded] = useState(true)
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculationProgress, setCalculationProgress] = useState(0)
  const [draggedDetailIndex, setDraggedDetailIndex] = useState<number | null>(null)

  const addInfoMessage = (type: InfoMessage['type'], message: string) => {
    const newMessage: InfoMessage = {
      id: `msg_${Date.now()}`,
      type,
      message,
      timestamp: Date.now(),
    }
    setInfoMessages((prev) => [...prev, newMessage])
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
  
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedDetailIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragEnd = () => {
    setDraggedDetailIndex(null)
  }
  
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedDetailIndex === null || draggedDetailIndex === index) return
    
    const items = [...(details || [])]
    const draggedItem = items[draggedDetailIndex]
    items.splice(draggedDetailIndex, 1)
    items.splice(index, 0, draggedItem)
    
    setDetails(items)
    setDraggedDetailIndex(index)
  }

  const handleCreateBinding = (detailIndex: number) => {
    const safeDetails = details || []
    if (detailIndex >= safeDetails.length - 1) return
    
    const detail1 = safeDetails[detailIndex]
    const detail2 = safeDetails[detailIndex + 1]
    
    const existingBinding = (bindings || []).find(b => 
      b.detailIds.includes(detail1.id) || b.detailIds.includes(detail2.id)
    )
    
    if (existingBinding) {
      if (!existingBinding.detailIds.includes(detail1.id)) {
        setBindings(prev => 
          (prev || []).map(b => 
            b.id === existingBinding.id 
              ? { ...b, detailIds: [...b.detailIds, detail1.id] }
              : b
          )
        )
        addInfoMessage('success', `Деталь ${detail1.name} добавлена в существующее скрепление`)
      } else if (!existingBinding.detailIds.includes(detail2.id)) {
        setBindings(prev => 
          (prev || []).map(b => 
            b.id === existingBinding.id 
              ? { ...b, detailIds: [...b.detailIds, detail2.id] }
              : b
          )
        )
        addInfoMessage('success', `Деталь ${detail2.name} добавлена в существующее скрепление`)
      } else {
        addInfoMessage('warning', 'Обе детали уже в скреплении')
      }
    } else {
      const newBinding = createEmptyBinding()
      newBinding.detailIds = [detail1.id, detail2.id]
      
      setBindings(prev => [...(prev || []), newBinding])
      addInfoMessage('success', `Создано скрепление для ${detail1.name} и ${detail2.name}`)
    }
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

  const handleReset = () => {
    setDetails([])
    setBindings([])
    setInfoMessages([])
    addInfoMessage('info', 'Калькулятор сброшен')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-[1920px] mx-auto w-full flex flex-col min-h-screen">
        <header className="border-b border-border bg-card">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <h1 className="text-xl font-semibold">Калькулятор себестоимости</h1>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(prev => !prev)}
              >
                <ArrowsOut className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toast.info('Окно закрыто (демо)')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <HeaderSection 
            headerTabs={headerTabs || { materials: [], operations: [], equipment: [], details: [] }}
            setHeaderTabs={setHeaderTabs}
            addInfoMessage={addInfoMessage}
          />
        </header>

        <main className="flex-1 p-4 overflow-auto">
          <div className="space-y-2">
            {(details || []).filter(d => !(bindings || []).some(b => b.detailIds.includes(d.id))).map((detail, index) => {
              const actualIndex = (details || []).indexOf(detail)
              
              return (
                <div 
                  key={detail.id}
                  onDragOver={handleDragOver(actualIndex)}
                >
                  <DetailCard
                    detail={detail}
                    onUpdate={(updates) => handleUpdateDetail(detail.id, updates)}
                    onDelete={() => handleDeleteDetail(detail.id)}
                    isInBinding={false}
                    orderNumber={actualIndex + 1}
                    onDragStart={handleDragStart(actualIndex)}
                    onDragEnd={handleDragEnd}
                  />
                  
                  {actualIndex < (details || []).length - 1 && (
                    <div className="flex justify-center -my-1 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full h-8 w-8 p-0"
                        onClick={() => handleCreateBinding(actualIndex)}
                      >
                        <LinkIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
            
            {(bindings || []).map((binding, bindingIndex) => {
              const bindingDetails = (details || []).filter(d => binding.detailIds.includes(d.id))
              const detailStartIndex = (details || []).findIndex(d => d.id === binding.detailIds[0])
              
              return (
                <BindingCard
                  key={binding.id}
                  binding={binding}
                  details={bindingDetails}
                  onUpdate={(updates) => {
                    setBindings(prev =>
                      (prev || []).map(b => b.id === binding.id ? { ...b, ...updates } : b)
                    )
                  }}
                  onDelete={() => {
                    setBindings(prev => (prev || []).filter(b => b.id !== binding.id))
                    addInfoMessage('info', 'Скрепление удалено')
                  }}
                  onUpdateDetail={handleUpdateDetail}
                  orderNumber={bindingIndex + 1}
                  detailStartIndex={detailStartIndex}
                />
              )
            })}
          </div>
          
          {((details || []).length === 0 && (bindings || []).length === 0) && (
            <Card className="p-8 text-center mt-8">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Нет деталей</h3>
              <p className="text-muted-foreground mb-4">
                Добавьте первую деталь для начала работы
              </p>
              <Button onClick={handleAddDetail}>
                <Plus className="w-4 h-4 mr-2" />
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

        <InfoPanel
          messages={infoMessages}
          isExpanded={isInfoPanelExpanded}
          onToggle={() => setIsInfoPanelExpanded(!isInfoPanelExpanded)}
        />
        
        <VariantsFooter
          selectedVariantIds={selectedVariantIds}
          testVariantId={testVariantId}
          setTestVariantId={setTestVariantId}
          addInfoMessage={addInfoMessage}
        />

        <footer className="border-t border-border bg-card p-3">
          <div className="max-w-[1920px] mx-auto flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleAddDetail}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить деталь
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('Расчёт габаритов (заглушка)')}>
                Габариты
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('Расчёт веса (заглушка)')}>
                Вес
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleTestCalculation} disabled={isCalculating}>
                <Calculator className="w-4 h-4 mr-2" />
                Тест
              </Button>
              <Button size="sm" onClick={handleFullCalculation} disabled={isCalculating}>
                <Calculator className="w-4 h-4 mr-2" />
                Выполнить расчёт
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('Настройки цен (заглушка)')}>
                <Gear className="w-4 h-4 mr-2" />
                Настройки цен
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('Глобальные настройки (заглушка)')}>
                <Gear className="w-4 h-4 mr-2" />
                Глоб. настройки
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
