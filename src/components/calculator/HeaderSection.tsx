import { useState, useRef, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  X, 
  ArrowSquareOut, 
  Trash, 
  DotsNine, 
  List,
  Package,
  Wrench,
  Printer,
  Notebook
} from '@phosphor-icons/react'
import { AppState, HeaderElement, HeaderTabType, InfoMessage } from '@/lib/types'
import { mockMaterials, mockOperations, mockEquipment, mockDetails } from '@/lib/mock-data'
import { toast } from 'sonner'

interface HeaderSectionProps {
  headerTabs: AppState['headerTabs']
  setHeaderTabs: (tabs: AppState['headerTabs'] | ((prev: AppState['headerTabs']) => AppState['headerTabs'])) => void
  addInfoMessage: (type: InfoMessage['type'], message: string) => void
  onOpenMenu: () => void
}

const MIN_HEIGHT = 80
const MAX_HEIGHT = 250

export function HeaderSection({ headerTabs, setHeaderTabs, addInfoMessage, onOpenMenu }: HeaderSectionProps) {
  const [activeTab, setActiveTab] = useState<HeaderTabType>('materials')
  const [headerHeight, setHeaderHeight] = useState(() => {
    const stored = localStorage.getItem('calc_header_height')
    return stored ? parseInt(stored) : MIN_HEIGHT
  })
  const [isResizing, setIsResizing] = useState(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const deltaY = e.clientY - startYRef.current
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + deltaY))
      setHeaderHeight(newHeight)
    }

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false)
        localStorage.setItem('calc_header_height', headerHeight.toString())
      }
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, headerHeight])

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startYRef.current = e.clientY
    startHeightRef.current = headerHeight
  }

  const handleSelectClick = () => {
    toast.info('Открыто окно выбора элементов (заглушка)')
    addInfoMessage('info', `Открыто окно выбора: ${activeTab}`)
  }

  const handleCatalogClick = () => {
    window.open('#catalog-placeholder', '_blank')
    addInfoMessage('info', 'Открыт каталог')
  }
  
  const handleCreateClick = () => {
    toast.info('Создание нового элемента (заглушка)')
    addInfoMessage('info', `Создание нового: ${activeTab}`)
  }

  const handleResetTab = () => {
    setHeaderTabs(prev => {
      const safePrev = prev || { materials: [], operations: [], equipment: [], details: [] }
      return {
        ...safePrev,
        [activeTab]: []
      }
    })
    addInfoMessage('info', `Сброшен таб: ${activeTab}`)
  }

  const handleRemoveElement = (id: string) => {
    setHeaderTabs(prev => {
      const safePrev = prev || { materials: [], operations: [], equipment: [], details: [] }
      const currentTab = safePrev[activeTab] || []
      return {
        ...safePrev,
        [activeTab]: currentTab.filter((el: HeaderElement) => el.id !== id)
      }
    })
  }

  const getTabLabel = (type: HeaderTabType) => {
    switch (type) {
      case 'materials': return 'Материалы'
      case 'operations': return 'Операции'
      case 'equipment': return 'Оборудование'
      case 'details': return 'Детали'
    }
  }
  
  const getTabIcon = (type: HeaderTabType) => {
    switch (type) {
      case 'materials': return <Package className="w-4 h-4" />
      case 'operations': return <Wrench className="w-4 h-4" />
      case 'equipment': return <Printer className="w-4 h-4" />
      case 'details': return <Notebook className="w-4 h-4" />
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center border-b border-border bg-card px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenMenu}
          className="mr-2"
        >
          <List className="w-5 h-5" />
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HeaderTabType)} className="w-full">
        <TabsList className="w-full grid grid-cols-4 rounded-none h-auto bg-muted/30">
          <TabsTrigger value="materials" className="data-[state=active]:bg-card gap-2">
            {getTabIcon('materials')}
            Материалы
          </TabsTrigger>
          <TabsTrigger value="operations" className="data-[state=active]:bg-card gap-2">
            {getTabIcon('operations')}
            Операции
          </TabsTrigger>
          <TabsTrigger value="equipment" className="data-[state=active]:bg-card gap-2">
            {getTabIcon('equipment')}
            Оборудование
          </TabsTrigger>
          <TabsTrigger value="details" className="data-[state=active]:bg-card gap-2">
            {getTabIcon('details')}
            Детали
          </TabsTrigger>
        </TabsList>

        {(['materials', 'operations', 'equipment', 'details'] as HeaderTabType[]).map(tabType => (
          <TabsContent key={tabType} value={tabType} className="mt-0 border-t border-border">
            <div className="px-4 py-2 bg-muted/30 flex gap-2">
              <Button variant="link" size="sm" className="h-auto p-0 text-[10px]" onClick={handleSelectClick}>
                Выбрать
              </Button>
              <span className="text-muted-foreground text-[10px]">|</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-[10px]" onClick={handleCatalogClick}>
                Каталог
              </Button>
              <span className="text-muted-foreground text-[10px]">|</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-[10px]" onClick={handleCreateClick}>
                Создать
              </Button>
              <span className="text-muted-foreground text-[10px]">|</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-destructive text-[10px]" onClick={handleResetTab}>
                Сбросить
              </Button>
            </div>

            <ScrollArea style={{ height: `${headerHeight - 80}px` }}>
              <div className="p-3 flex flex-wrap gap-2">
                {(!headerTabs || !headerTabs[tabType] || headerTabs[tabType].length === 0) ? (
                  <p className="text-sm text-muted-foreground">Нет элементов. Нажмите "Выбрать" для добавления.</p>
                ) : (
                  headerTabs[tabType].map((element: HeaderElement) => (
                    <Badge
                      key={element.id}
                      variant="secondary"
                      className="px-3 py-1.5 flex items-center gap-2 cursor-grab max-w-[250px]"
                      draggable
                    >
                      <span className="font-mono text-xs">[{element.itemId}]</span>
                      <span className="truncate flex-1" title={element.name}>
                        {element.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-accent"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`#item-${element.itemId}`, '_blank')
                        }}
                      >
                        <ArrowSquareOut className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveElement(element.id)
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
      
      <div 
        className="absolute bottom-0 left-0 right-0 h-3 bg-muted/50 hover:bg-accent/20 cursor-ns-resize flex items-center justify-center transition-colors border-t border-border"
        onMouseDown={handleResizeStart}
      >
        <DotsNine className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  )
}
