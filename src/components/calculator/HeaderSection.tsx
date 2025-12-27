import { Button } from '@/components/ui/button'
import { 
  List,
  Notebook,
  Package,
  Wrench,
  Printer,
  ListChecks,
  Gear
} from '@phosphor-icons/react'
import { InitPayload } from '@/lib/postmessage-bridge'
import { openIblockEditPage } from '@/lib/bitrix-utils'
import { getIblockByCode } from '@/lib/types'
import { toast } from 'sonner'

interface HeaderSectionProps {
  onOpenMenu: () => void
  bitrixMeta?: InitPayload | null
}

export function HeaderSection({ onOpenMenu, bitrixMeta }: HeaderSectionProps) {
  const handleOpenCatalog = (iblockCode: string) => {
    if (!bitrixMeta || !bitrixMeta.iblocks) {
      toast.error('Метаданные Bitrix не загружены')
      return
    }

    const iblock = getIblockByCode(bitrixMeta.iblocks, iblockCode)
    if (!iblock) {
      toast.error(`Инфоблок ${iblockCode} не найден`)
      return
    }

    try {
      openIblockEditPage(iblock.id, 'calculator', 'ru')
    } catch (error) {
      toast.error(`Не удалось открыть "${iblock.name}"`)
      console.error('[HeaderSection] Failed to open iblock', error)
    }
  }

  // Get iblock names for button labels
  const getIblockName = (code: string): string => {
    if (!bitrixMeta || !bitrixMeta.iblocks) return code
    const iblock = getIblockByCode(bitrixMeta.iblocks, code)
    return iblock?.name || code
  }

  const getIcon = (code: string) => {
    switch (code) {
      case 'CALC_DETAILS':
        return <Notebook className="w-4 h-4" />
      case 'CALC_MATERIALS':
        return <Package className="w-4 h-4" />
      case 'CALC_OPERATIONS':
        return <Wrench className="w-4 h-4" />
      case 'CALC_EQUIPMENT':
        return <Printer className="w-4 h-4" />
      case 'CALC_STAGES':
        return <ListChecks className="w-4 h-4" />
      case 'CALC_SETTINGS':
        return <Gear className="w-4 h-4" />
      default:
        return null
    }
  }

  const catalogButtons = [
    'CALC_DETAILS',
    'CALC_MATERIALS',
    'CALC_OPERATIONS',
    'CALC_EQUIPMENT',
    'CALC_STAGES',
    'CALC_SETTINGS'
  ]

  return (
    <div className="border-b border-border bg-muted/30" data-pwcode="headersection">
      <div className="flex items-center gap-1 px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenMenu}
          className="h-9 w-9 p-0 hover:bg-accent hover:text-accent-foreground flex-shrink-0"
          aria-label="Меню"
          data-pwcode="btn-menu"
        >
          <List className="w-5 h-5" />
        </Button>
        
        {catalogButtons.map(code => (
          <Button
            key={code}
            variant="ghost"
            size="sm"
            onClick={() => handleOpenCatalog(code)}
            className="h-9 px-3 hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            data-pwcode={`btn-catalog-${code.toLowerCase()}`}
          >
            {getIcon(code)}
            <span className="text-sm">{getIblockName(code)}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
