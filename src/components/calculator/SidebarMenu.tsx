import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Gear, Info } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { AboutDialog } from './AboutDialog'

interface SidebarMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function SidebarMenu({ isOpen, onClose }: SidebarMenuProps) {
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false)

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
        </SheetContent>
      </Sheet>

      <AboutDialog 
        isOpen={isAboutDialogOpen} 
        onClose={() => setIsAboutDialogOpen(false)} 
      />
    </>
  )
}
