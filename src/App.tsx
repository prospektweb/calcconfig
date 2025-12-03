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
  mockWorks, 
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
import { VariantsSection } from '@/components/calculator/VariantsSection'
import { DetailCard } from '@/components/calculator/DetailCard'
import { BindingCard } from '@/components/calculator/BindingCard'
import { InfoPanel } from '@/components/calculator/InfoPanel'

function App() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([525, 526, 527])
  const [testVariantId, setTestVariantId] = useState<number | null>(525)
  const [isEditingTestId, setIsEditingTestId] = useState(false)
  
  const [headerTabs, setHeaderTabs] = useKV<AppState['headerTabs']>('calc_header_tabs', {
    materials: [],
    works: [],
    equipment: [],
    details: [],
  })
  
  const [details, setDetails] = useKV<Detail[]>('calc_details', [])
  const [bindings, setBindings] = useKV<AppState['bindings']>('calc_bindings', [])
  
  const [infoMessages, setInfoMessages] = useState<InfoMessage[]>([])
  const [isInfoPanelExpanded, setIsInfoPanelExpanded] = useState(true)
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculationProgress, setCalculationProgress] = useState(0)

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

  const handleCreateBinding = (detailIndex: number) => {
    const safeDetails = details || []
    if (detailIndex >= safeDetails.length - 1) return
    
    const detail1 = safeDetails[detailIndex]
    const detail2 = safeDetails[detailIndex + 1]
    
    const newBinding = createEmptyBinding()
    newBinding.detailIds = [detail1.id, detail2.id]
    
    setBindings(prev => [...(prev || []), newBinding])
    addInfoMessage('success', `Создано скрепление для ${detail1.name} и ${detail2.name}`)
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
            headerTabs={headerTabs || { materials: [], works: [], equipment: [], details: [] }}
            setHeaderTabs={setHeaderTabs}
            addInfoMessage={addInfoMessage}
          />
        </header>

        <main className="flex-1 p-4 overflow-auto">
          <VariantsSection
            selectedVariantIds={selectedVariantIds}
            testVariantId={testVariantId}
            isEditingTestId={isEditingTestId}
            setIsEditingTestId={setIsEditingTestId}
            setTestVariantId={setTestVariantId}
            addInfoMessage={addInfoMessage}
          />

          <div className="mt-4 space-y-2">
            {(details || []).map((detail, index) => {
              const isInBinding = (bindings || []).some(b => b.detailIds.includes(detail.id))
              
              return (
                <div key={detail.id}>
                  <DetailCard
                    detail={detail}
                    onUpdate={(updates) => handleUpdateDetail(detail.id, updates)}
                    onDelete={() => handleDeleteDetail(detail.id)}
                    isInBinding={isInBinding}
                  />
                  
                  {index < (details || []).length - 1 && !isInBinding && (
                    <div className="flex justify-center -my-1 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full h-8 w-8 p-0"
                        onClick={() => handleCreateBinding(index)}
                      >
                        <LinkIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
            
            {(bindings || []).map(binding => (
              <BindingCard
                key={binding.id}
                binding={binding}
                details={(details || []).filter(d => binding.detailIds.includes(d.id))}
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
              />
            ))}
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

        <footer className="border-t border-border bg-card p-4">
          <div className="max-w-[1920px] mx-auto flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleAddDetail}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить деталь
              </Button>
              <Button variant="outline" onClick={() => toast.info('Расчёт габаритов (заглушка)')}>
                Габариты
              </Button>
              <Button variant="outline" onClick={() => toast.info('Расчёт веса (заглушка)')}>
                Вес
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTestCalculation} disabled={isCalculating}>
                <Calculator className="w-4 h-4 mr-2" />
                Тест
              </Button>
              <Button onClick={handleFullCalculation} disabled={isCalculating}>
                <Calculator className="w-4 h-4 mr-2" />
                Выполнить расчёт
              </Button>
              <Button variant="outline" onClick={() => toast.info('Настройки цен (заглушка)')}>
                <Gear className="w-4 h-4 mr-2" />
                Настройки цен
              </Button>
              <Button variant="outline" onClick={() => toast.info('Глобальные настройки (заглушка)')}>
                <Gear className="w-4 h-4 mr-2" />
                Глоб. настройки
              </Button>
              <Button variant="outline" onClick={() => toast.info('Закрыто (демо)')}>
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
