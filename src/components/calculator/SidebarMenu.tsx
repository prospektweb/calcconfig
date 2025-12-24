import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Info, FolderOpen, Gear, Ruler, CurrencyCircleDollar } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { AboutDialog } from './AboutDialog'
import { InitPayload } from '@/lib/postmessage-bridge'
import { openIblockEditPage } from '@/lib/bitrix-utils'

interface SidebarMenuProps {
  isOpen: boolean
  onClose: () => void
  bitrixMeta?: InitPayload | null
}

export function SidebarMenu({ isOpen, onClose, bitrixMeta }: SidebarMenuProps) {
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false)

  const formatBitrixUrl = (path: string): string => {
    const baseUrl = bitrixMeta?.context?.url || ''
    
    // Remove trailing slash if exists
    const cleanBase = baseUrl.replace(/\/$/, '')
    
    // Check if protocol already exists
    if (cleanBase.startsWith('http://') || cleanBase.startsWith('https://')) {
      return `${cleanBase}${path}`
    }
    
    // Add https:// with colon
    return `https://${cleanBase}${path}`
  }

  const handleAbout = () => {
    setIsAboutDialogOpen(true)
    onClose()
  }

  const handleOpenIblock = (iblockId: number | undefined, name: string) => {
    if (!iblockId) {
      toast.error(`ID инфоблока "${name}" не найден`)
      return
    }

    try {
      openIblockEditPage(iblockId, 'calculator', 'ru')
    } catch (error) {
      toast.error('Не удалось открыть страницу настроек')
      console.error('[SidebarMenu] Failed to open iblock', error)
    }
  }

  const iblockLinks = bitrixMeta?.iblocks ? [
    { key: 'calcSettings', label: 'Калькуляторы', id: bitrixMeta.iblocks.calcSettings },
    { key: 'calcConfig', label: 'Конфигурации', id: bitrixMeta.iblocks.calcConfig },
    { key: 'calcDetailsVariants', label: 'Варианты деталей', id: bitrixMeta.iblocks.calcDetailsVariants },
    { key: 'calcMaterialsVariants', label: 'Варианты материалов', id: bitrixMeta.iblocks.calcMaterialsVariants },
    { key: 'calcOperationsVariants', label: 'Варианты операций', id: bitrixMeta.iblocks.calcOperationsVariants },
    { key: 'calcDetails', label: 'Детали', id: bitrixMeta.iblocks.calcDetails },
    { key: 'calcMaterials', label: 'Материалы', id: bitrixMeta.iblocks.calcMaterials },
    { key: 'calcEquipment', label: 'Оборудование', id: bitrixMeta.iblocks.calcEquipment },
    { key: 'calcOperations', label: 'Операции', id: bitrixMeta.iblocks.calcOperations },
    { key: 'products', label: 'Товары', id: bitrixMeta.iblocks.products },
    { key: 'offers', label: 'Торговые предложения', id: bitrixMeta.iblocks.offers },
  ] : []

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-[300px] flex flex-col" data-pwcode="sidebar-menu">
          <SheetHeader>
            <SheetTitle>Меню</SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 mt-6 space-y-2">
            {iblockLinks.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Настройки инфоблоков
                </div>
                {iblockLinks.map(link => (
                  <Button
                    key={link.key}
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => handleOpenIblock(link.id, link.label)}
                    data-pwcode={`btn-iblock-${link.key}`}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    {link.label}
                  </Button>
                ))}
                <Separator />
              </>
            )}
            
            {bitrixMeta?.context && (
              <>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Системные настройки
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    const lang = bitrixMeta.context.lang
                    window.open(formatBitrixUrl(`/bitrix/admin/settings.php?lang=${lang}&mid=prospektweb.calc&mid_menu=1`), '_blank')
                  }}
                  data-pwcode="btn-module-settings"
                >
                  <Gear className="w-4 h-4 mr-2" />
                  Настройки модуля
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    const lang = bitrixMeta.context.lang
                    window.open(formatBitrixUrl(`/bitrix/admin/cat_measure_list.php?lang=${lang}`), '_blank')
                  }}
                  data-pwcode="btn-measure-units"
                >
                  <Ruler className="w-4 h-4 mr-2" />
                  Единицы измерения
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    const lang = bitrixMeta.context.lang
                    window.open(formatBitrixUrl(`/bitrix/admin/cat_group_admin.php?lang=${lang}`), '_blank')
                  }}
                  data-pwcode="btn-price-types"
                >
                  <CurrencyCircleDollar className="w-4 h-4 mr-2" />
                  Типы цен
                </Button>
                <Separator />
              </>
            )}
            
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
