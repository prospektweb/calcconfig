import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CaretLeft, CaretRight, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface CalculationLogicDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stageIndex: number
  stageName?: string
  calculatorName?: string
  allStages: Array<{ index: number; name?: string }>
}

export function CalculationLogicDialog({
  open,
  onOpenChange,
  stageIndex,
  stageName,
  calculatorName,
  allStages,
}: CalculationLogicDialogProps) {
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true)
  const [activeTab, setActiveTab] = useState('inputs')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Show current and previous stages only
  const visibleStages = allStages.slice(0, stageIndex + 1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "p-0 gap-0 flex flex-col",
          isFullscreen 
            ? "w-screen h-screen max-w-full max-h-full" 
            : "min-w-[1024px] w-fit max-w-[90vw] max-h-[90vh]"
        )}
        data-pwcode="calculation-logic-dialog"
      >
        {/* Fixed Header */}
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">
                Логика расчёта
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Этап #{stageIndex + 1}{stageName ? `: ${stageName}` : ''} • Калькулятор: {calculatorName || 'Не выбран'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
            >
              {isFullscreen ? <ArrowsIn className="w-4 h-4" /> : <ArrowsOut className="w-4 h-4" />}
            </Button>
          </div>
        </DialogHeader>

        {/* Body - Three Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Context (Collapsible) */}
          {!leftPanelCollapsed && (
            <div className="w-80 border-r border-border flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-sm">Контекст</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setLeftPanelCollapsed(true)}
                >
                  <CaretLeft className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <Accordion type="multiple" defaultValue={[`stage-${stageIndex}`]}>
                  {visibleStages.map((stage) => (
                    <AccordionItem key={stage.index} value={`stage-${stage.index}`}>
                      <AccordionTrigger className="text-sm">
                        Этап #{stage.index + 1}{stage.name ? `: ${stage.name}` : ''}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pl-4">
                          <div>
                            <h4 className="text-xs font-medium mb-2">Входные параметры</h4>
                            <p className="text-xs text-muted-foreground">
                              Здесь будут отображаться переменные этапа
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-medium mb-2">Переменные</h4>
                            <p className="text-xs text-muted-foreground">
                              Здесь будут отображаться переменные этапа
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-medium mb-2">Итоги</h4>
                            <p className="text-xs text-muted-foreground">
                              Здесь будут отображаться переменные этапа
                            </p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </ScrollArea>
            </div>
          )}

          {/* Collapsed Left Panel Toggle */}
          {leftPanelCollapsed && (
            <div className="w-10 border-r border-border flex items-start justify-center pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setLeftPanelCollapsed(false)}
              >
                <CaretRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Center Panel - Editor (Main, Not Collapsible) */}
          <div className="flex-1 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="px-4 py-3 border-b border-border">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="inputs" className="flex-1">
                    Входные параметры
                  </TabsTrigger>
                  <TabsTrigger value="formulas" className="flex-1">
                    Формулы
                  </TabsTrigger>
                  <TabsTrigger value="outputs" className="flex-1">
                    Итоги этапа
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="flex-1 overflow-hidden">
                <TabsContent value="inputs" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground">
                        Placeholder: Здесь будет редактор входных параметров
                      </p>
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="formulas" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground">
                        Placeholder: Здесь будет редактор формул
                      </p>
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="outputs" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground">
                        Placeholder: Здесь будет редактор итогов этапа
                      </p>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Right Panel - Help (Collapsible, Collapsed by Default) */}
          {!rightPanelCollapsed && (
            <div className="w-80 border-l border-border flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-sm">Справка</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setRightPanelCollapsed(true)}
                >
                  <CaretRight className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <Accordion type="single" collapsible>
                  <AccordionItem value="functions">
                    <AccordionTrigger className="text-sm">Функции</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-xs text-muted-foreground">
                        Контент будет добавлен позже
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="syntax">
                    <AccordionTrigger className="text-sm">Синтаксис</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-xs text-muted-foreground">
                        Контент будет добавлен позже
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="errors">
                    <AccordionTrigger className="text-sm">Ошибки</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-xs text-muted-foreground">
                        Контент будет добавлен позже
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </ScrollArea>
            </div>
          )}

          {/* Collapsed Right Panel Toggle */}
          {rightPanelCollapsed && (
            <div className="w-10 border-l border-border flex items-start justify-center pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setRightPanelCollapsed(false)}
              >
                <CaretLeft className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Проверить
              </Button>
              <Button variant="ghost" size="sm" disabled className="hidden">
                Сбросить
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button size="sm" disabled>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
