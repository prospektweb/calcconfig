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
import { InitPayload, postMessageBridge } from '@/lib/postmessage-bridge'
import { openBitrixAdmin, getBitrixContext } from '@/lib/bitrix-utils'
import { getAppMode } from '@/services/configStore'

interface HeaderSectionProps {
  headerTabs: AppState['headerTabs']
  setHeaderTabs: (tabs: AppState['headerTabs'] | ((prev: AppState['headerTabs']) => AppState['headerTabs'])) => void
  addInfoMessage: (type: InfoMessage['type'], message: string) => void
  onOpenMenu: () => void
  onRefreshData?: () => void
  onDetailDragStart?: (detailId: number, detailName: string) => void
  onDetailDragEnd?: () => void
  onActiveTabChange?: (tab: string) => void
  bitrixMeta?: InitPayload | null
  isRefreshing?: boolean
}

const MIN_HEIGHT = 80
const MAX_HEIGHT = 250

export function HeaderSection({ headerTabs, setHeaderTabs, addInfoMessage, onOpenMenu, onRefreshData, onDetailDragStart, onDetailDragEnd, onActiveTabChange, bitrixMeta, isRefreshing: externalIsRefreshing }: HeaderSectionProps) {
  const [activeTab, setActiveTab] = useState<HeaderTabType>(() => {
    const stored = localStorage.getItem('calc_active_header_tab')
    return (stored as HeaderTabType) || 'details'
  })
  const [headerHeight, setHeaderHeight] = useState(() => {
    const stored = localStorage.getItem('calc_header_height')
    return stored ? parseInt(stored) : MIN_HEIGHT
  })
  
  const appMode = getAppMode()
  
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

  const getIblockInfoForTab = (forCatalog: boolean = false) => {
    if (!bitrixMeta) return null

    const iblockMap = {
      details: forCatalog ? bitrixMeta.iblocks.calcDetails : bitrixMeta.iblocks.calcDetailsVariants,
      materials: forCatalog ? bitrixMeta.iblocks.calcMaterials : bitrixMeta.iblocks.calcMaterialsVariants,
      operations: forCatalog ? bitrixMeta.iblocks.calcOperations : bitrixMeta.iblocks.calcOperationsVariants,
      equipment: bitrixMeta.iblocks.calcEquipment,
    }

    const iblockId = iblockMap[activeTab]
    const type = bitrixMeta.iblocksTypes[iblockId]
    const lang = bitrixMeta.context.lang

    return { iblockId, type, lang }
  }

  const handleSelectClick = () => {
    const iblockInfo = getIblockInfoForTab()
    
    if (iblockInfo) {
      postMessageBridge.sendBitrixPickerOpen(
        iblockInfo.iblockId,
        iblockInfo.type,
        iblockInfo.lang
      )
      addInfoMessage('info', `Открыто окно выбора: ${getTabLabel(activeTab)}`)
    } else {
      toast.info('Открыто окно выбора элементов (заглушка)')
      addInfoMessage('info', `Открыто окно выбора: ${activeTab}`)
    }
  }

  const handleCatalogClick = () => {
    const iblockInfo = getIblockInfoForTab(true)
    
    if (iblockInfo) {
      try {
        openBitrixAdmin({
          iblockId: iblockInfo.iblockId,
          type: iblockInfo.type,
          lang: iblockInfo.lang,
        })
        addInfoMessage('info', `Открыт каталог: ${getTabLabel(activeTab)}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось открыть каталог'
        toast.error(message)
        addInfoMessage('error', message)
      }
    } else {
      window.open('#catalog-placeholder', '_blank')
      addInfoMessage('info', 'Открыт каталог')
    }
  }

  const handleResetTab = () => {
    setHeaderTabs(prev => {
      const safePrev = prev || { materials: [], operations: [], equipment: [], details: [] }
      return {
        ...safePrev,
        [activeTab]: []
      }
    })
    
    const localStorageKey = `calc_header_tabs`
    const stored = localStorage.getItem(localStorageKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        parsed[activeTab] = []
        localStorage.setItem(localStorageKey, JSON.stringify(parsed))
      } catch (e) {
        console.error('Failed to update localStorage:', e)
      }
    }
    
    addInfoMessage('info', `Сброшен таб: ${getTabLabel(activeTab)}`)
  }

  const handleRefreshData = async () => {
    if (onRefreshData) {
      onRefreshData()
    }
  }

  const handleRemoveElement = (id: string, itemId: number) => {
    setHeaderTabs(prev => {
      const safePrev = prev || { materials: [], operations: [], equipment: [], details: [] }
      const currentTab = safePrev[activeTab] || []
      const newTabs = {
        ...safePrev,
        [activeTab]: currentTab.filter((el: HeaderElement) => el.id !== id)
      }
      
      const localStorageKey = `calc_header_tabs`
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(newTabs))
      } catch (e) {
        console.error('Failed to update localStorage:', e)
      }
      
      return newTabs
    })

    const kindMap: Record<HeaderTabType, 'detail' | 'material' | 'operation' | 'equipment'> = {
      details: 'detail',
      materials: 'material',
      operations: 'operation',
      equipment: 'equipment',
    }

    if (bitrixMeta) {
      postMessageBridge.sendHeaderItemRemove(kindMap[activeTab], itemId)
    }
    
    addInfoMessage('info', `Элемент удалён из шапки`)
  }

  const handleOpenHeaderElement = (itemId: number) => {
    const iblockInfo = getIblockInfoForTab()
    
    if (iblockInfo) {
      try {
        openBitrixAdmin({
          iblockId: iblockInfo.iblockId,
          type: iblockInfo.type,
          lang: iblockInfo.lang,
          id: itemId,
        })
        addInfoMessage('info', `Открыт элемент ID: ${itemId}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось открыть элемент'
        toast.error(message)
        addInfoMessage('error', message)
      }
    } else {
      window.open(`#element-${itemId}`, '_blank')
      addInfoMessage('info', `Открыт элемент ID: ${itemId}`)
    }
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
    <div className="relative" data-pwcode="headersection">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HeaderTabType)} className="w-full">
        <div className="flex items-center border-b border-border bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenMenu}
            className="h-10 w-10 p-0 hover:bg-accent hover:text-accent-foreground ml-2 flex-shrink-0"
            aria-label="Меню"
            data-pwcode="btn-menu"
          >
            <List className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshData}
            disabled={externalIsRefreshing}
            className="h-10 w-10 p-0 hover:bg-accent hover:text-accent-foreground flex-shrink-0"
            aria-label="Обновить данные"
            title="Обновить данные"
            data-pwcode="btn-refresh"
          >
            <ArrowsClockwise className={`w-5 h-5 ${externalIsRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <TabsList className="flex-1 grid grid-cols-4 rounded-none h-auto bg-transparent border-0" data-pwcode="header-tabs">
            <TabsTrigger value="details" className="data-[state=active]:bg-card gap-2" data-pwcode="tab-details">
              {getTabIcon('details')}
              Детали
            </TabsTrigger>
            <TabsTrigger value="materials" className="data-[state=active]:bg-card gap-2" data-pwcode="tab-materials">
              {getTabIcon('materials')}
              Материалы
            </TabsTrigger>
            <TabsTrigger value="operations" className="data-[state=active]:bg-card gap-2" data-pwcode="tab-operations">
              {getTabIcon('operations')}
              Операции
            </TabsTrigger>
            <TabsTrigger value="equipment" className="data-[state=active]:bg-card gap-2" data-pwcode="tab-equipment">
              {getTabIcon('equipment')}
              Оборудование
            </TabsTrigger>
          </TabsList>
        </div>

        {(['details', 'materials', 'operations', 'equipment'] as HeaderTabType[]).map(tabType => (
          <TabsContent key={tabType} value={tabType} className="mt-0 border-t border-border" data-pwcode="tabcontent">
            <div className="px-4 py-2 bg-muted/30 flex gap-2" data-pwcode="tab-actions">
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-[10px]" 
                onClick={handleSelectClick}
                data-pwcode="btn-select"
              >
                Выбрать
              </Button>
              <span className="text-muted-foreground text-[10px]">|</span>
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-[10px]" 
                onClick={handleCatalogClick}
                data-pwcode="btn-catalog"
              >
                Каталог
              </Button>
              <span className="text-muted-foreground text-[10px]">|</span>
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-destructive text-[10px]" 
                onClick={handleResetTab}
                data-pwcode="btn-reset"
              >
                Сбросить
              </Button>
            </div>

            <ScrollArea style={{ height: `${headerHeight - 80}px` }}>
              <div className="flex flex-wrap gap-2">
                {tabType === 'details' && appMode === 'DEMO' ? (
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
                          data-pwcode="header-detail"
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
                              handleOpenHeaderElement(detail.id)
                            }}
                            data-pwcode="btn-open-header-detail"
                          >
                            <ArrowSquareOut className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              const id = `header-detail-${detail.id}`
                              handleRemoveElement(id, detail.id)
                            }}
                            data-pwcode="btn-delete-header-detail"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : tabType === 'materials' && appMode === 'DEMO' ? (
                  <div className="w-full space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {mockMaterials.map((material) => (
                        <Badge
                          key={material.id}
                          variant="secondary"
                          className="px-3 py-2 flex items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-accent hover:text-accent-foreground transition-colors group"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'copy'
                            e.dataTransfer.setData('application/json', JSON.stringify({ 
                              type: 'header-material', 
                              materialId: material.id,
                              materialName: material.name
                            }))
                          }}
                          data-pwcode="header-material"
                        >
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <DotsSixVertical className="w-4 h-4" />
                          </div>
                          <span className="font-mono text-xs">[{material.id}]</span>
                          <span className="font-medium">{material.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/20"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenHeaderElement(material.id)
                            }}
                            data-pwcode="btn-open-material"
                          >
                            <ArrowSquareOut className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              const id = `header-material-${material.id}`
                              handleRemoveElement(id, material.id)
                            }}
                            data-pwcode="btn-delete-material"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : tabType === 'operations' && appMode === 'DEMO' ? (
                  <div className="w-full space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {mockOperations.map((operation) => (
                        <Badge
                          key={operation.id}
                          variant="secondary"
                          className="px-3 py-2 flex items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-accent hover:text-accent-foreground transition-colors group"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'copy'
                            e.dataTransfer.setData('application/json', JSON.stringify({ 
                              type: 'header-operation', 
                              operationId: operation.id,
                              operationName: operation.name
                            }))
                          }}
                          data-pwcode="header-operation"
                        >
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <DotsSixVertical className="w-4 h-4" />
                          </div>
                          <span className="font-mono text-xs">[{operation.id}]</span>
                          <span className="font-medium">{operation.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/20"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenHeaderElement(operation.id)
                            }}
                            data-pwcode="btn-open-operation"
                          >
                            <ArrowSquareOut className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              const id = `header-operation-${operation.id}`
                              handleRemoveElement(id, operation.id)
                            }}
                            data-pwcode="btn-delete-operation"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : tabType === 'equipment' && appMode === 'DEMO' ? (
                  <div className="w-full space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {mockEquipment.map((equipment) => (
                        <Badge
                          key={equipment.id}
                          variant="secondary"
                          className="px-3 py-2 flex items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-accent hover:text-accent-foreground transition-colors group"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'copy'
                            e.dataTransfer.setData('application/json', JSON.stringify({ 
                              type: 'header-equipment', 
                              equipmentId: equipment.id,
                              equipmentName: equipment.name
                            }))
                          }}
                          data-pwcode="header-equipment"
                        >
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <DotsSixVertical className="w-4 h-4" />
                          </div>
                          <span className="font-mono text-xs">[{equipment.id}]</span>
                          <span className="font-medium">{equipment.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/20"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenHeaderElement(equipment.id)
                            }}
                            data-pwcode="btn-open-equipment"
                          >
                            <ArrowSquareOut className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              const id = `header-equipment-${equipment.id}`
                              handleRemoveElement(id, equipment.id)
                            }}
                            data-pwcode="btn-delete-equipment"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
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
                          handleRemoveElement(element.id, element.itemId)
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
