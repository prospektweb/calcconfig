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
        <SheetContent side="left" className="w-[300px]">
          <SheetHeader>
            <SheetTitle>Меню</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleSettings}
            >
              <Gear className="w-4 h-4 mr-2" />
              Настройки
            </Button>
            
            <Separator />
            
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleAbout}
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
