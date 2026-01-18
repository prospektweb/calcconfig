import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { List, Plus, FolderOpen, ArrowClockwise } from '@phosphor-icons/react'
import { InitPayload } from '@/lib/postmessage-bridge'
import { openIblockCatalog } from '@/lib/bitrix-utils'
import { toast } from 'sonner'

interface Iblock {
  id: number
  code: string
  type: string
  name: string
  parent: number | null
}

interface HeaderSectionProps {
  onOpenMenu: () => void
  bitrixMeta?: InitPayload | null
  onCreateDetail?: () => void
  onSelectDetail?: () => void
}

export function HeaderSection({
  onOpenMenu,
  bitrixMeta,
  onCreateDetail,
  onSelectDetail,
}: HeaderSectionProps) {

  // Получаем инфоблоки для кнопок каталогов - только те, у которых parent === null
  const catalogButtons = useMemo(() => {
    const iblocks = bitrixMeta?.iblocks as Iblock[] | undefined
    if (!iblocks || ! Array.isArray(iblocks)) return []

    // Фильтруем инфоблоки с parent === null и исключаем OFFERS
    return iblocks.filter(ib => ib.parent === null && ib.code !== 'OFFERS')
  }, [bitrixMeta?.iblocks])

  // Открытие каталога инфоблока в новой вкладке
  const handleOpenCatalog = (iblock: Iblock) => {
    try {
      const lang = bitrixMeta?.context?.lang || 'ru'
      openIblockCatalog(iblock, lang)
    } catch (error) {
      toast.error(`Не удалось открыть "${iblock.name}"`)
      console.error('[HeaderSection] Failed to open catalog', error)
    }
  }

  return (
    <div className="border-b border-border bg-card" data-pwcode="headersection">
      <div className="flex items-center justify-between px-2 py-2">
        {/* Левая часть:  меню + кнопки каталогов */}
        <div className="flex items-center gap-1">
          {/* Кнопка меню */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenMenu}
            className="h-9 w-9 p-0 hover:bg-accent hover:text-accent-foreground"
            aria-label="Меню"
            data-pwcode="btn-menu"
          >
            <List className="w-5 h-5" />
          </Button>

          {/* Кнопка обновить */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
            className="h-9 w-9 p-0 hover:bg-accent hover:text-accent-foreground"
            aria-label="Обновить"
            data-pwcode="btn-refresh"
          >
            <ArrowClockwise className="w-5 h-5" />
          </Button>

          {/* Разделитель */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Кнопки каталогов */}
          {catalogButtons.map((catalog) => (
            <Button
              key={catalog.code}
              variant="ghost"
              size="sm"
              onClick={() => handleOpenCatalog(catalog)}
              className="h-9 px-3 text-[10px] hover:bg-accent hover:text-accent-foreground"
              data-pwcode={`btn-catalog-${catalog.code.toLowerCase()}`}
            >
              {catalog.name}
            </Button>
          ))}
        </div>

        {/* Правая часть: кнопки создания/выбора детали */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateDetail}
            className="h-9"
            data-pwcode="btn-create-detail"
          >
            <Plus className="w-4 h-4 mr-2" />
            Создать деталь
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectDetail}
            className="h-9"
            data-pwcode="btn-select-detail"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Выбрать деталь
          </Button>
        </div>
      </div>
    </div>
  )
}
