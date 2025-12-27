import { useState, useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Info, FolderOpen, Gear, Ruler, CurrencyCircleDollar, CaretRight } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { AboutDialog } from './AboutDialog'
import { InitPayload } from '@/lib/postmessage-bridge'
import { openIblockEditPage } from '@/lib/bitrix-utils'

interface Iblock {
  id: number
  code: string
  type: string
  name: string
  parent:  number | null
}

interface SidebarMenuProps {
  isOpen: boolean
  onClose: () => void
  bitrixMeta?:  InitPayload | null
}

// Форматирование типа в читаемый заголовок
const formatTypeLabel = (type: string): string => {
  return type
    .split('_')
    .map(word => word. charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function SidebarMenu({ isOpen, onClose, bitrixMeta }: SidebarMenuProps) {
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false)

  // Группируем инфоблоки по типу и строим иерархию
  const groupedIblocks = useMemo(() => {
    const iblocks = bitrixMeta?. iblocks as Iblock[] | undefined
    if (!iblocks || ! Array.isArray(iblocks)) return []

    // Группируем по типу
    const groups = new Map<string, { parent:  Iblock; children: Iblock[] }[]>()

    // Сначала находим все родительские элементы (parent === null)
    const parentIblocks = iblocks.filter(ib => ib. parent === null)
    
    parentIblocks.forEach(parent => {
      const type = parent.type
      if (!groups.has(type)) {
        groups.set(type, [])
      }
      
      // Находим детей этого родителя
      const children = iblocks.filter(ib => ib.parent === parent. id)
      
      groups.get(type)! .push({ parent, children })
    })

    // Преобразуем в массив для рендеринга
    return Array.from(groups.entries()).map(([type, items]) => ({
      type,
      label: formatTypeLabel(type),
      items,
    }))
  }, [bitrixMeta?.iblocks])

  const formatBitrixUrl = (path: string): string => {
    const baseUrl = bitrixMeta?.context?.url || ''
    const cleanBase = baseUrl.replace(/\/$/, '')
    
    if (cleanBase.startsWith('http://') || cleanBase.startsWith('https://')) {
      return `${cleanBase}${path}`
    }
    
    return `https://${cleanBase}${path}`
  }

  const handleAbout = () => {
    setIsAboutDialogOpen(true)
    onClose()
  }

  const handleOpenIblock = (iblock:  Iblock) => {
    try {
      openIblockEditPage(iblock.id, 'calculator', 'ru')
    } catch (error) {
      toast.error(`Не удалось открыть "${iblock.name}"`)
      console.error('[SidebarMenu] Failed to open iblock', error)
    }
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-[300px] flex flex-col overflow-y-auto" data-pwcode="sidebar-menu">
          <SheetHeader>
            <SheetTitle>Меню</SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 mt-6 space-y-2">
            {groupedIblocks. map((group, groupIndex) => (
              <div key={group.type}>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  {group.label}
                </div>
                {group.items.map(({ parent, children }) => (
                  <div key={parent.id}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => handleOpenIblock(parent)}
                      data-pwcode={`btn-iblock-${parent. code. toLowerCase()}`}
                    >
                      <FolderOpen className="w-4 h-4 mr-2" />
                      {parent.name}
                    </Button>
                    {children.length > 0 && (
                      <div className="ml-4">
                        {children.map(child => (
                          <Button
                            key={child.id}
                            variant="ghost"
                            className="w-full justify-start text-sm"
                            onClick={() => handleOpenIblock(child)}
                            data-pwcode={`btn-iblock-${child.code.toLowerCase()}`}
                          >
                            <CaretRight className="w-3 h-3 mr-2 text-muted-foreground" />
                            {child. name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {groupIndex < groupedIblocks.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
            
            {groupedIblocks.length > 0 && <Separator />}
            
            {bitrixMeta?. context && (
              <>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  Системные настройки
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    const lang = bitrixMeta.context. lang
                    window. open(formatBitrixUrl(`/bitrix/admin/settings.php?lang=${lang}&mid=prospektweb. calc&mid_menu=1`), '_blank')
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
                    const lang = bitrixMeta.context. lang
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
                    window. open(formatBitrixUrl(`/bitrix/admin/cat_group_admin. php?lang=${lang}`), '_blank')
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
