import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { List, Plus, FolderOpen } from '@phosphor-icons/react'
import { InitPayload } from '@/lib/postmessage-bridge'
import { openIblockEditPage } from '@/lib/bitrix-utils'
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

// Коды инфоблоков для отображения в меню
const CATALOG_CODES = [
  'CALC_DETAILS',
  'CALC_MATERIALS',
  'CALC_OPERATIONS',
  'CALC_EQUIPMENT',
  'CALC_STAGES',
]

export function HeaderSection({
  onOpenMenu,
  bitrixMeta,
  onCreateDetail,
  onSelectDetail,
}: HeaderSectionProps) {

  // Получаем инфоблоки для кнопок каталогов
  const catalogButtons = useMemo(() => {
    const iblocks = bitrixMeta?.iblocks as Iblock[] | undefined
    if (!iblocks || ! Array.isArray(iblocks)) return []

    return CATALOG_CODES
      .map(code => iblocks.find(ib => ib.code === code))
      .filter((ib): ib is Iblock => ib !== undefined)
  }, [bitrixMeta?.iblocks])

  // Открытие каталога инфоблока в новой вкладке
  const handleOpenCatalog = (iblock: Iblock) => {
    try {
      const lang = bitrixMeta?.context?.lang || 'ru'
      openIblockEditPage(iblock.id, iblock.type, lang)
    } catch (error) {
      toasterror(`Не удалось открыть "${iblock.name}"`)
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

          {/* Разделитель */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Кнопки каталогов */}
          {catalogButtons.map((catalog) => (
            <Button
              key={catalog.code}
              variant="ghost"
              size="sm"
              onClick={() => handleOpenCatalog(catalog)}
              className="h-9 px-3 text-sm hover:bg-accent hover:text-accent-foreground"
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
