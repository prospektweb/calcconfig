import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Gear, Info } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { AboutDialog } from './AboutDialog'
import { getAppMode } from '@/services/configStore'

interface SidebarMenuProps {
  isOpen: boolean
  onClose: () => void
  offersSource?: 'DEMO' | 'INIT'
}

export function SidebarMenu({ isOpen, onClose, offersSource = 'DEMO' }: SidebarMenuProps) {
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false)
  const appMode = getAppMode()

  const handleSettings = () => {
    toast.info('Глобальные настройки (заглушка)')
    onClose()
  }

  const handleAbout = () => {
    setIsAboutDialogOpen(true)
    onClose()
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-[300px] flex flex-col" data-pwcode="sidebar-menu">
          <SheetHeader>
            <SheetTitle>Меню</SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 mt-6 space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleSettings}
              data-pwcode="btn-settings"
            >
              <Gear className="w-4 h-4 mr-2" />
              Настройки
            </Button>
            
            <Separator />
            
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleAbout}
              data-pwcode="btn-about"
            >
              <Info className="w-4 h-4 mr-2" />
              О программе
            </Button>
          </div>
          
          <div className="mt-auto pt-4 border-t border-border">
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Режим:</span>
                <Badge variant={appMode === 'BITRIX' ? 'default' : 'secondary'}>
                  {appMode}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Источник ТП:</span>
                <Badge variant={offersSource === 'INIT' ? 'default' : 'secondary'}>
                  {offersSource}
                </Badge>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AboutDialog 
        isOpen={isAboutDialogOpen} 
        onClose={() => setIsAboutDialogOpen(false)} 
      />
    </>
  )
}
