import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { X, ArrowSquareOut, Trash } from '@phosphor-icons/react'
import { AppState, HeaderElement, HeaderTabType, InfoMessage } from '@/lib/types'
import { mockMaterials, mockWorks, mockEquipment, mockDetails } from '@/lib/mock-data'
import { toast } from 'sonner'

interface HeaderSectionProps {
  headerTabs: AppState['headerTabs']
  setHeaderTabs: (tabs: AppState['headerTabs'] | ((prev: AppState['headerTabs']) => AppState['headerTabs'])) => void
  addInfoMessage: (type: InfoMessage['type'], message: string) => void
}

export function HeaderSection({ headerTabs, setHeaderTabs, addInfoMessage }: HeaderSectionProps) {
  const [activeTab, setActiveTab] = useState<HeaderTabType>('materials')

  const handleSelectClick = () => {
    toast.info('Открыто окно выбора элементов (заглушка)')
    addInfoMessage('info', `Открыто окно выбора: ${activeTab}`)
  }

  const handleCatalogClick = () => {
    window.open('#catalog-placeholder', '_blank')
    addInfoMessage('info', 'Открыт каталог')
  }

  const handleResetTab = () => {
    setHeaderTabs(prev => ({
      ...prev,
      [activeTab]: []
    }))
    addInfoMessage('info', `Сброшен таб: ${activeTab}`)
  }

  const handleRemoveElement = (id: string) => {
    setHeaderTabs(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter((el: HeaderElement) => el.id !== id)
    }))
  }

  const getTabLabel = (type: HeaderTabType) => {
    switch (type) {
      case 'materials': return 'Материалы'
      case 'works': return 'Работы'
      case 'equipment': return 'Оборудование'
      case 'details': return 'Детали'
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HeaderTabType)} className="w-full">
      <TabsList className="w-full grid grid-cols-4 rounded-none h-auto">
        <TabsTrigger value="materials" className="data-[state=active]:bg-background">
          Материалы
        </TabsTrigger>
        <TabsTrigger value="works" className="data-[state=active]:bg-background">
          Работы
        </TabsTrigger>
        <TabsTrigger value="equipment" className="data-[state=active]:bg-background">
          Оборудование
        </TabsTrigger>
        <TabsTrigger value="details" className="data-[state=active]:bg-background">
          Детали
        </TabsTrigger>
      </TabsList>

      {(['materials', 'works', 'equipment', 'details'] as HeaderTabType[]).map(tabType => (
        <TabsContent key={tabType} value={tabType} className="mt-0 border-t border-border">
          <div className="px-4 py-2 bg-muted/30 flex gap-2 text-sm">
            <Button variant="link" size="sm" className="h-auto p-0" onClick={handleSelectClick}>
              Выбрать
            </Button>
            <span className="text-muted-foreground">|</span>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={handleCatalogClick}>
              Каталог
            </Button>
            <span className="text-muted-foreground">|</span>
            <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={handleResetTab}>
              Сбросить
            </Button>
          </div>

          <ScrollArea className="h-[120px] hover:h-[300px] transition-all duration-300">
            <div className="p-3 flex flex-wrap gap-2">
              {headerTabs[tabType].length === 0 ? (
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
  )
}
