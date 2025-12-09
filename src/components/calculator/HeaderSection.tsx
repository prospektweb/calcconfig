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
  Notebook,
  DotsSixVertical,
  ArrowsClockwise
} from '@phosphor-icons/react'
import { AppState, HeaderElement, HeaderTabType, InfoMessage } from '@/lib/types'
import { mockMaterials, mockOperations, mockEquipment, mockDetails } from '@/lib/mock-data'
import { toast } from 'sonner'

interface HeaderSectionProps {
  headerTabs: AppState['headerTabs']
  setHeaderTabs: (tabs: AppState['headerTabs'] | ((prev: AppState['headerTabs']) => AppState['headerTabs'])) => void
  addInfoMessage: (type: InfoMessage['type'], message: string) => void
  onOpenMenu: () => void
  onRefreshData?: () => void
  onDetailDragStart?: (detailId: number, detailName: string) => void
  onDetailDragEnd?: () => void
  onActiveTabChange?: (tab: string) => void
}

const MIN_HEIGHT = 80
const MAX_HEIGHT = 250

export function HeaderSection({ headerTabs, setHeaderTabs, addInfoMessage, onOpenMenu, onRefreshData, onDetailDragStart, onDetailDragEnd, onActiveTabChange }: HeaderSectionProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<HeaderTabType>(() => {
    const stored = localStorage.getItem('calc_active_header_tab')
    return (stored as HeaderTabType) || 'details'
  })
  const [headerHeight, setHeaderHeight] = useState(() => {
    const stored = localStorage.getItem('calc_header_height')
    return stored ? parseInt(stored) : MIN_HEIGHT
  })
  
  useEffect(() => {
    localStorage.setItem('calc_active_header_tab', activeTab)
    if (onActiveTabChange) {
      onActiveTabChange(activeTab)
    }
  }, [activeTab, onActiveTabChange])
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

  const handleRefreshData = async () => {
    setIsRefreshing(true)
    addInfoMessage('info', 'Обновление данных...')
    
    try {
      if (onRefreshData) {
        await onRefreshData()
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      addInfoMessage('success', 'Данные обновлены')
      toast.success('Данные обновлены')
    } catch (error) {
      addInfoMessage('error', 'Ошибка обновления данных')
      toast.error('Не удалось обновить данные')
    } finally {
      setIsRefreshing(false)
    }
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
  
  const handleDetailDragStart = (detailId: number, detailName: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/json', JSON.stringify({ 
      type: 'header-detail', 
      detailId,
      detailName
    }))
    
    const detail = mockDetails.find(d => d.id === detailId)
    if (detail && onDetailDragStart) {
      onDetailDragStart(detailId, detailName)
    }
  }
  
  const handleDetailDragEnd = () => (e: React.DragEvent) => {
    if (onDetailDragEnd) {
      onDetailDragEnd()
    }
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
      case 'materials': return <div className="w-4 h-4 flex items-center justify-center"><Package className="w-4 h-4" /></div>
      case 'operations': return <div className="w-4 h-4 flex items-center justify-center"><Wrench className="w-4 h-4" /></div>
      case 'equipment': return <div className="w-4 h-4 flex items-center justify-center"><Printer className="w-4 h-4" /></div>
      case 'details': return <div className="w-4 h-4 flex items-center justify-center"><Notebook className="w-4 h-4" /></div>
    }
  }

  return (
    <div className="relative">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HeaderTabType)} className="w-full">
        <div className="flex items-center border-b border-border bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenMenu}
            className="h-10 w-10 p-0 hover:bg-accent hover:text-accent-foreground ml-2 flex-shrink-0"
            aria-label="Меню"
          >
            <List className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshData}
            disabled={isRefreshing}
            className="h-10 w-10 p-0 hover:bg-accent hover:text-accent-foreground flex-shrink-0"
            aria-label="Обновить данные"
            title="Обновить данные"
          >
            <ArrowsClockwise className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <TabsList className="flex-1 grid grid-cols-4 rounded-none h-auto bg-transparent border-0">
            <TabsTrigger value="details" className="data-[state=active]:bg-card gap-2">
              {getTabIcon('details')}
              Детали
            </TabsTrigger>
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
          </TabsList>
        </div>

        {(['details', 'materials', 'operations', 'equipment'] as HeaderTabType[]).map(tabType => (
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
              <Button variant="link" size="sm" className="h-auto p-0 text-destructive text-[10px]" onClick={handleResetTab}>
                Сбросить
              </Button>
            </div>

            <ScrollArea style={{ height: `${headerHeight - 80}px` }}>
              <div className="flex flex-wrap gap-2">
                {tabType === 'details' ? (
                  <div className="w-full space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {mockDetails.map((detail) => (
                        <Badge
                          key={detail.id}
                          variant="secondary"
                          className="px-3 py-2 flex items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-accent hover:text-accent-foreground transition-colors group"
                          draggable
                          onDragStart={handleDetailDragStart(detail.id, detail.name)}
                          onDragEnd={handleDetailDragEnd()}
                        >
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <DotsSixVertical className="w-4 h-4" />
                          </div>
                          <span className="font-mono text-xs">[{detail.id}]</span>
                          <span className="font-medium">{detail.name}</span>
                          <span className="text-xs font-mono">{detail.width}×{detail.length}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/20"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`#detail-${detail.id}`, '_blank')
                            }}
                          >
                            <ArrowSquareOut className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : tabType === 'materials' ? (
                  <div className="w-full space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {mockMaterials.map((material) => (
                        <Badge
                          key={material.id}
                          variant="secondary"
                          className="px-3 py-2 flex items-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors group"
                        >
                          <span className="font-mono text-xs">[{material.id}]</span>
                          <span className="font-medium">{material.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/20"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`#material-${material.id}`, '_blank')
                            }}
                          >
                            <ArrowSquareOut className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : tabType === 'operations' ? (
                  <div className="w-full space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {mockOperations.map((operation) => (
                        <Badge
                          key={operation.id}
                          variant="secondary"
                          className="px-3 py-2 flex items-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors group"
                        >
                          <span className="font-mono text-xs">[{operation.id}]</span>
                          <span className="font-medium">{operation.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/20"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`#operation-${operation.id}`, '_blank')
                            }}
                          >
                            <ArrowSquareOut className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : tabType === 'equipment' ? (
                  <div className="w-full space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {mockEquipment.map((equipment) => (
                        <Badge
                          key={equipment.id}
                          variant="secondary"
                          className="px-3 py-2 flex items-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors group"
                        >
                          <span className="font-mono text-xs">[{equipment.id}]</span>
                          <span className="font-medium">{equipment.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/20"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`#equipment-${equipment.id}`, '_blank')
                            }}
                          >
                            <ArrowSquareOut className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : tabType === 'materials' || tabType === 'operations' || tabType === 'equipment' ? (
                  <p className="text-sm text-muted-foreground">Все элементы отображаются выше</p>
                ) : (!headerTabs || !headerTabs[tabType] || (headerTabs[tabType] as HeaderElement[]).length === 0) ? (
                  <p className="text-sm text-muted-foreground">Нет элементов. Нажмите "Выбрать" для добавления.</p>
                ) : (
                  (headerTabs[tabType] as HeaderElement[]).map((element: HeaderElement) => (
                    <Badge
                      key={element.id}
                      variant="secondary"
                      className="px-3 py-2 flex items-center gap-2 cursor-grab max-w-[300px] hover:bg-accent hover:text-accent-foreground transition-colors group"
                      draggable
                    >
                      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                        <DotsSixVertical className="w-4 h-4" />
                      </div>
                      <span className="font-mono text-xs">[{element.itemId}]</span>
                      <span className="truncate flex-1" title={element.name}>
                        {element.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/20"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`#item-${element.itemId}`, '_blank')
                        }}
                      >
                        <ArrowSquareOut className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveElement(element.id)
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
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
