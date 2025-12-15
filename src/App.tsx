import { useState, useEffect, useCallback, useRef } from 'react'
import { useConfigKV } from '@/hooks/use-config-kv'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  Calculator,
  Package,
  Link as LinkIcon,
  Cube,
  CurrencyDollar,
  Tag,
  FloppyDisk,
  X
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { 
  AppState, 
  Detail, 
  Binding,
  InfoMessage,
  CostingSettings,
  SalePricesSettings,
  createEmptyDetail,
  createEmptyBinding,
  HeaderTabsState,
  HeaderTabType
} from '@/lib/types'
import { mockDetails, mockMaterials, mockOperations, mockEquipment } from '@/lib/mock-data'
import { HeaderSection } from '@/components/calculator/HeaderSection'
import { VariantsFooter } from '@/components/calculator/VariantsFooter'
import { DetailCard } from '@/components/calculator/DetailCard'
import { BindingCard } from '@/components/calculator/BindingCard'
import { InfoPanel } from '@/components/calculator/InfoPanel'
import { GabVesPanel } from '@/components/calculator/GabVesPanel'
import { CostPanel } from '@/components/calculator/CostPanel'
import { PricePanel } from '@/components/calculator/PricePanel'
import { SidebarMenu } from '@/components/calculator/SidebarMenu'
import { useCustomDrag } from '@/hooks/use-custom-drag'
import { initializeBitrixStore, getBitrixStore, getDeployTarget, getAppMode, getDemoOffers, AppMode, OffersSource, setAppMode, clearDemoStorage, resetBitrixStore } from '@/services/configStore'
import { postMessageBridge, InitPayload } from '@/lib/postmessage-bridge'
import { setBitrixContext } from '@/lib/bitrix-utils'
import { createEmptyHeaderTabs, normalizeHeaderTabs } from '@/lib/header-tabs'

type DragItem = {
  type: 'detail' | 'binding'
  index: number
  id: string
}

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([])
  const [testVariantId, setTestVariantId] = useState<number | null>(null)
  const [bitrixMeta, setBitrixMeta] = useState<InitPayload | null>(null)
  
  const [appMode, setAppModeState] = useState<AppMode>(getAppMode())
  const [offersSource, setOffersSource] = useState<OffersSource>('DEMO')
  const [selectedOffers, setSelectedOffers] = useState<InitPayload['selectedOffers']>(() => {
    const deployTarget = getDeployTarget()
    return deployTarget === 'spark' ? getDemoOffers() : []
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pendingRequestsRef = useRef<Map<string, { pwcode: 'btn-select' | 'btn-add-offer', tab?: HeaderTabType }>>(new Map())
  const [isBitrixLoading, setIsBitrixLoading] = useState(false)
  
  const [storedHeaderTabs, setStoredHeaderTabs] = useConfigKV<HeaderTabsState>('calc_header_tabs', createEmptyHeaderTabs())
  const [headerTabs, setHeaderTabsState] = useState<HeaderTabsState>(() => normalizeHeaderTabs(storedHeaderTabs))
  const lastHeaderTabsSnapshotRef = useRef<string>('')
  const hasHydratedHeaderTabsRef = useRef(false)
  
  useEffect(() => {
    const normalized = normalizeHeaderTabs(storedHeaderTabs)
    setHeaderTabsState(normalized)

    const serializedStored = JSON.stringify(storedHeaderTabs ?? createEmptyHeaderTabs())
    const serializedNormalized = JSON.stringify(normalized)

    if (serializedStored !== serializedNormalized) {
      setStoredHeaderTabs(normalized)
    }

    if (hasHydratedHeaderTabsRef.current) {
      const snapshot = JSON.stringify(normalized)
      lastHeaderTabsSnapshotRef.current = snapshot

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('calc_header_tabs', snapshot)
        } catch (error) {
          console.error('[HeaderTabs] Failed to persist snapshot', error)
        }
      }
    }
  }, [storedHeaderTabs, setStoredHeaderTabs])

  const updateHeaderTabs = useCallback((value: HeaderTabsState | ((current: HeaderTabsState) => HeaderTabsState)) => {
    setHeaderTabsState((current) => {
      const normalizedCurrent = normalizeHeaderTabs(current)
      const nextValue = typeof value === 'function'
        ? (value as (current: HeaderTabsState) => HeaderTabsState)(normalizedCurrent)
        : value
      const normalizedNext = normalizeHeaderTabs(nextValue)
      setStoredHeaderTabs(normalizedNext)

      hasHydratedHeaderTabsRef.current = true
      const snapshot = JSON.stringify(normalizedNext)
      lastHeaderTabsSnapshotRef.current = snapshot

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('calc_header_tabs', snapshot)
        } catch (error) {
          console.error('[HeaderTabs] Failed to persist snapshot', error)
        }
      }
      return normalizedNext
    })
  }, [setStoredHeaderTabs])

  const [details, setDetails] = useConfigKV<Detail[]>('calc_details', [])
  const [bindings, setBindings] = useConfigKV<Binding[]>('calc_bindings', [])
  
  const [infoMessages, setInfoMessages] = useState<InfoMessage[]>([])
  const [isInfoPanelExpanded, setIsInfoPanelExpanded] = useState(() => {
    const stored = localStorage.getItem('calc_info_panel_expanded')
    return stored ? stored === 'true' : false
  })
  
  useEffect(() => {
    localStorage.setItem('calc_info_panel_expanded', isInfoPanelExpanded.toString())
  }, [isInfoPanelExpanded])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return

    const applyFromStorage = (rawValue: string | null) => {
      const snapshot = rawValue ?? ''

      if (snapshot === lastHeaderTabsSnapshotRef.current) return

      if (!rawValue) {
        hasHydratedHeaderTabsRef.current = true
        lastHeaderTabsSnapshotRef.current = snapshot
        return
      }

      try {
        const parsed = JSON.parse(rawValue)
        const normalized = normalizeHeaderTabs(parsed)
        updateHeaderTabs(() => normalized)

        const normalizedSnapshot = JSON.stringify(normalized)
        lastHeaderTabsSnapshotRef.current = normalizedSnapshot

        hasHydratedHeaderTabsRef.current = true

        console.info('[HeaderTabs] updated from localStorage')
      } catch (error) {
        console.error('[HeaderTabs] Failed to parse calc_header_tabs from localStorage', error)
        hasHydratedHeaderTabsRef.current = true
        lastHeaderTabsSnapshotRef.current = snapshot
      }
    }

    applyFromStorage(localStorage.getItem('calc_header_tabs'))

    const interval = setInterval(() => {
      applyFromStorage(localStorage.getItem('calc_header_tabs'))
    }, 1000)

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'calc_header_tabs') {
        applyFromStorage(event.newValue ?? localStorage.getItem('calc_header_tabs'))
      }
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorage)
    }
  }, [updateHeaderTabs])

  // Initialize headerTabs from mock data in DEMO mode
  useEffect(() => {
    const deployTarget = getDeployTarget()
    
    // In DEMO mode, populate headerTabs from mock data on first run
    if (deployTarget === 'spark' && appMode === 'DEMO') {
      const currentTabs = headerTabs || createEmptyHeaderTabs()
      
      // Check if tabs are empty (not filled before)
      const isEmpty = 
        currentTabs.detailsVariants.length === 0 &&
        currentTabs.materialsVariants.length === 0 &&
        currentTabs.operationsVariants.length === 0 &&
        currentTabs.equipment.length === 0
      
      if (isEmpty) {
        // Convert mock data to HeaderElement format
        const demoHeaderTabs: HeaderTabsState = {
          detailsVariants: mockDetails.map(detail => ({
            id: `header-detailsVariants-${detail.id}`,
            type: 'detailsVariants' as HeaderTabType,
            itemId: detail.id,
            name: detail.name,
          })),
          materialsVariants: mockMaterials.map(material => ({
            id: `header-materialsVariants-${material.id}`,
            type: 'materialsVariants' as HeaderTabType,
            itemId: material.id,
            name: material.name,
          })),
          operationsVariants: mockOperations.map(operation => ({
            id: `header-operationsVariants-${operation.id}`,
            type: 'operationsVariants' as HeaderTabType,
            itemId: operation.id,
            name: operation.name,
          })),
          equipment: mockEquipment.map(eq => ({
            id: `header-equipment-${eq.id}`,
            type: 'equipment' as HeaderTabType,
            itemId: eq.id,
            name: eq.name,
          })),
        }
        
        updateHeaderTabs(demoHeaderTabs)
        console.info('[DEMO] Initialized headerTabs from mock data')
      }
    }
  }, [appMode, headerTabs, updateHeaderTabs])
  
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculationProgress, setCalculationProgress] = useState(0)
  const [draggedHeaderDetail, setDraggedHeaderDetail] = useState<{id: number, name: string} | null>(null)
  const [activeHeaderTab, setActiveHeaderTab] = useState<HeaderTabType>('detailsVariants')
  const [isGabVesActive, setIsGabVesActive] = useState(false)
  const [isGabVesPanelExpanded, setIsGabVesPanelExpanded] = useState(false)
  const [gabVesMessages, setGabVesMessages] = useState<Array<{id: string, timestamp: number, message: string}>>([])
  
  const [isCostActive, setIsCostActive] = useState(false)
  const [isCostPanelExpanded, setIsCostPanelExpanded] = useState(false)
  const [costMessages, setCostMessages] = useState<Array<{id: string, timestamp: number, message: string}>>([])
  
  const [isPriceActive, setIsPriceActive] = useState(false)
  const [isPricePanelExpanded, setIsPricePanelExpanded] = useState(false)
  const [priceMessages, setPriceMessages] = useState<Array<{id: string, timestamp: number, message: string}>>([])
  
  const [headerDropZoneHover, setHeaderDropZoneHover] = useState<number | null>(null)

  const { dragState, startDrag, setDropTarget, endDrag, cancelDrag } = useCustomDrag()
  const dropZoneRefs = useRef<Map<number, HTMLElement>>(new Map())

  const [costingSettings, setCostingSettings] = useConfigKV<CostingSettings>('calc_costing_settings', {
    basedOn: 'COMPONENT_PURCHASE',
    roundingStep: 1,
    markupValue: 0,
    markupUnit: 'RUB',
  })

  const [salePricesSettings, setSalePricesSettings] = useConfigKV<SalePricesSettings>('calc_sale_prices_settings', {
    selectedTypes: [],
    types: {},
  })

  const dedupeById = useCallback(<T extends { id: number | string }>(items: T[]): T[] => {
    const seen = new Set<number | string>()
    const result: T[] = []

    items.forEach((item) => {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        result.push(item)
      }
    })

    return result
  }, [])

  const mergeUniqueById = useCallback(<T extends { id: number | string }>(existing: T[], incoming: T[]) => {
    const base = existing || []
    const result = [...base]
    const seen = new Set(base.map(item => item.id))

    incoming.forEach((item) => {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        result.push(item)
      }
    })

    return result
  }, [])

  useEffect(() => {
    return () => {
      pendingRequestsRef.current.clear()
      setIsBitrixLoading(false)
    }
  }, [])
  
  useEffect(() => {
    const deployTarget = getDeployTarget()
    
    if (deployTarget === 'bitrix') {
      const unsubscribe = postMessageBridge.on('INIT', (message) => {
        const bitrixStore = getBitrixStore()
        if (bitrixStore && message.payload) {
          const initPayload = message.payload as InitPayload
          
          console.info('[INIT] received')
          console.info('[INIT] applied offers=', (initPayload.selectedOffers || []).length)
          
          setAppMode('BITRIX')
          setAppModeState('BITRIX')
          
          clearDemoStorage()
          resetBitrixStore()
          
          // Do not reset headerTabs here - preserve data from localStorage
          // The data is already loaded on app startup and should persist
          
          setBitrixMeta(initPayload)
          setSelectedOffers(initPayload.selectedOffers || [])
          setSelectedVariantIds(initPayload.selectedOffers?.map(o => o.id) || [])
          setOffersSource('INIT')
          
          if (initPayload.context?.url && initPayload.context?.lang) {
            setBitrixContext({
              baseUrl: initPayload.context.url,
              lang: initPayload.context.lang,
            })
          }
          
          initializeBitrixStore(message.payload)
          
          if (message.payload.config?.data) {
            const configData = message.payload.config.data
            if (configData.details) {
              setDetails(configData.details)
            }
            if (configData.bindings) {
              setBindings(configData.bindings)
            }
            if (configData.costingSettings) {
              setCostingSettings(configData.costingSettings)
            }
            if (configData.salePricesSettings) {
              setSalePricesSettings(configData.salePricesSettings)
            }
          }
          
          postMessageBridge.sendInitDone(
            message.payload.mode || 'NEW_CONFIG',
            message.payload.selectedOffers?.length || 0
          )
          
          console.info('[INIT_DONE] sent')
        }
      })
      
      const unsubscribeRefresh = postMessageBridge.on('REFRESH_RESULT', (message) => {
        if (message.payload) {
          console.info('[REFRESH] received')

          const refreshPayload = message.payload as InitPayload
          
          setSelectedOffers(refreshPayload.selectedOffers || [])
          setSelectedVariantIds(refreshPayload.selectedOffers?.map(o => o.id) || [])
          
          console.info('[REFRESH] applied offers=', (refreshPayload.selectedOffers || []).length)
          
          setIsRefreshing(false)
          toast.success('Данные обновлены')
        }
      })

      return () => {
        unsubscribe()
        unsubscribeRefresh()
      }
    }
  }, [])

  useEffect(() => {
    const deployTarget = getDeployTarget()

    if (deployTarget !== 'bitrix') return

    const unsubscribeSelectDone = postMessageBridge.on('SELECT_DONE', (message) => {
      console.info('[FROM_BITRIX] SELECT_DONE', message)

      const { requestId } = message
      const items = Array.isArray(message.payload?.items) ? dedupeById(message.payload.items) : []

      if (!requestId) {
        setIsBitrixLoading(pendingRequestsRef.current.size > 0)
        return
      }

      const pending = pendingRequestsRef.current.get(requestId)
      pendingRequestsRef.current.delete(requestId)

      if (!pending) {
        setIsBitrixLoading(pendingRequestsRef.current.size > 0)
        return
      }

      if (items.length === 0) {
        setIsBitrixLoading(pendingRequestsRef.current.size > 0)
        return
      }

      if (pending.pwcode === 'btn-select' && pending.tab) {
        updateHeaderTabs((prev) => {
          const safePrev = prev || createEmptyHeaderTabs()

          const nextElements = items.map((item: any) => ({
            id: `header-${pending.tab}-${item.id}`,
            type: pending.tab!,
            itemId: item.id,
            name: item.name || `Элемент ${item.id}`,
            ...(typeof item.deleted !== 'undefined' ? { deleted: item.deleted } : {}),
          }))

          return {
            ...safePrev,
            [pending.tab]: nextElements,
          }
        })
      }

      if (pending.pwcode === 'btn-add-offer') {
        const uniqueOffers = items as InitPayload['selectedOffers']
        setSelectedOffers((prev) => {
          const merged = mergeUniqueById(prev || [], uniqueOffers)
          setSelectedVariantIds(merged.map(o => o.id))
          return merged
        })
      }

      setIsBitrixLoading(pendingRequestsRef.current.size > 0)
    })

    return () => {
      unsubscribeSelectDone()
    }
  }, [dedupeById, mergeUniqueById, updateHeaderTabs])
  
  const addInfoMessage = (type: InfoMessage['type'], message: string) => {
    const newMessage: InfoMessage = {
      id: `msg_${Date.now()}`,
      type,
      message,
      timestamp: Date.now(),
    }
    setInfoMessages((prev) => [...prev, newMessage])
  }
  
  const addGabVesMessage = (message: string) => {
    const newMessage = {
      id: `gabves_${Date.now()}`,
      timestamp: Date.now(),
      message,
    }
    setGabVesMessages((prev) => [...prev, newMessage])
  }
  
  const addCostMessage = (message: string) => {
    const newMessage = {
      id: `cost_${Date.now()}`,
      timestamp: Date.now(),
      message,
    }
    setCostMessages((prev) => [...prev, newMessage])
  }

  const addPriceMessage = (message: string) => {
    const newMessage = {
      id: `price_${Date.now()}`,
      timestamp: Date.now(),
      message,
    }
    setPriceMessages((prev) => [...prev, newMessage])
  }

  const handleSelectRequestPending = (requestId: string, tab: HeaderTabType) => {
    pendingRequestsRef.current.set(requestId, { pwcode: 'btn-select', tab })
    setIsBitrixLoading(true)
  }

  const handleAddOfferRequestPending = (requestId: string) => {
    pendingRequestsRef.current.set(requestId, { pwcode: 'btn-add-offer' })
    setIsBitrixLoading(true)
  }

  const handleAddDetail = () => {
    const newDetail = createEmptyDetail()
    setDetails(prev => [...(prev || []), newDetail])
    addInfoMessage('info', `Добавлена деталь: ${newDetail.name}`)
  }

  const handleDeleteDetail = (detailId: string) => {
    setDetails(prev => (prev || []).filter(d => d.id !== detailId))
    addInfoMessage('info', 'Деталь удалена')
  }

  const handleUpdateDetail = (detailId: string, updates: Partial<Detail>) => {
    setDetails(prev =>
      (prev || []).map(d => d.id === detailId ? { ...d, ...updates } : d)
    )
  }
  
  const handleUpdateBinding = (bindingId: string, updates: Partial<Binding>) => {
    setBindings(prev =>
      (prev || []).map(b => b.id === bindingId ? { ...b, ...updates } : b)
    )
  }

  useEffect(() => {
    if (!dragState.isDragging) return

    const handleMouseUp = (e: MouseEvent) => {
      const allItems = getAllItemsInOrder()
      const draggedItemIndex = dragState.draggedItemId 
        ? allItems.findIndex(item => 
            item.type === dragState.draggedItemType && item.id === dragState.draggedItemId
          )
        : -1

      if (dragState.dropTargetIndex !== null && draggedItemIndex !== -1) {
        reorderItems(draggedItemIndex, dragState.dropTargetIndex)
        endDrag(true)
        addInfoMessage('success', 'Порядок элементов изменён')
      } else {
        cancelDrag()
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [dragState])

  useEffect(() => {
    if (!dragState.isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      let nearestDropZone: number | null = null
      let minDistance = Infinity

      dropZoneRefs.current.forEach((element, index) => {
        const rect = element.getBoundingClientRect()
        const centerY = rect.top + rect.height / 2
        const distance = Math.abs(e.clientY - centerY)
        
        if (distance < minDistance && distance < 100) {
          minDistance = distance
          nearestDropZone = index
        }
      })

      setDropTarget(nearestDropZone)
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [dragState.isDragging, setDropTarget])
  
  const handleDetailDragStart = (element: HTMLElement, e: React.MouseEvent) => {
    const detailId = element.getAttribute('data-detail-id')
    if (!detailId) return

    const detail = (details || []).find(d => d.id === detailId)
    if (detail && detail.isExpanded) {
      handleUpdateDetail(detailId, { isExpanded: false })
    }

    startDrag(detailId, 'detail', element, e.clientX, e.clientY)
  }
  
  const handleBindingDragStart = (element: HTMLElement, e: React.MouseEvent) => {
    const bindingId = element.getAttribute('data-binding-id')
    if (!bindingId) return

    const binding = (bindings || []).find(b => b.id === bindingId)
    if (binding && binding.isExpanded) {
      handleUpdateBinding(bindingId, { isExpanded: false })
    }

    startDrag(bindingId, 'binding', element, e.clientX, e.clientY)
  }
  
  const handleMainAreaDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  
  const handleMainAreaDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      const jsonData = e.dataTransfer.getData('application/json')
      if (jsonData) {
        const data = JSON.parse(jsonData)
        
        if (data.type === 'header-detail' && activeHeaderTab === 'detailsVariants') {
          // Try to find in mockDetails for demo mode
          const mockDetail = mockDetails.find(d => d.id === data.detailId)
          
          // Create detail with data from drag event
          const newDetail = createEmptyDetail(data.detailName)
          
          if (mockDetail) {
            // If found in mockDetails - use dimensions from there
            newDetail.width = mockDetail.width
            newDetail.length = mockDetail.length
          }
          // If not found in mockDetails - detail is created with default dimensions
          // Real data can be retrieved later via REFRESH
          
          setDetails(prev => [...(prev || []), newDetail])
          addInfoMessage('success', `Добавлена деталь: ${data.detailName}`)
        }
      }
    } catch (error) {
      console.error('Drop error:', error)
    }
    
    setDraggedHeaderDetail(null)
    setHeaderDropZoneHover(null)
  }
  
  const handleHeaderDetailDragStart = (detailId: number, detailName: string) => {
    setDraggedHeaderDetail({ id: detailId, name: detailName })
  }
  
  const handleHeaderDetailDragEnd = () => {
    setDraggedHeaderDetail(null)
    setHeaderDropZoneHover(null)
  }
  
  const getAllItemsInOrder = (): Array<{type: 'detail' | 'binding', id: string, item: Detail | Binding}> => {
    const result: Array<{type: 'detail' | 'binding', id: string, item: Detail | Binding}> = []
    const safeDetails = details || []
    const safeBindings = bindings || []
    
    safeDetails.forEach(detail => {
      const inBinding = safeBindings.some(b => b.detailIds?.includes(detail.id))
      if (!inBinding) {
        result.push({ type: 'detail', id: detail.id, item: detail })
      }
    })
    
    safeBindings.forEach(binding => {
      const inParentBinding = safeBindings.some(b => b.bindingIds?.includes(binding.id))
      if (!inParentBinding) {
        result.push({ type: 'binding', id: binding.id, item: binding })
      }
    })
    
    return result
  }
  
  const reorderItems = (fromIndex: number, toIndex: number) => {
    const allItems = getAllItemsInOrder()
    
    if (fromIndex === toIndex) return
    
    const reorderedItems = [...allItems]
    const [movedItem] = reorderedItems.splice(fromIndex, 1)
    
    const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
    reorderedItems.splice(adjustedToIndex, 0, movedItem)
    
    const newDetails: Detail[] = []
    const newBindings: Binding[] = []
    
    reorderedItems.forEach((item) => {
      if (item.type === 'detail') {
        const detail = (details || []).find(d => d.id === item.id)
        if (detail) newDetails.push(detail)
      } else {
        const binding = (bindings || []).find(b => b.id === item.id)
        if (binding) newBindings.push(binding)
      }
    })
    
    setDetails(newDetails)
    setBindings(newBindings)
    addInfoMessage('success', 'Порядок элементов изменён')
  }

  const handleCreateBinding = (index: number) => {
    const allItems = getAllItemsInOrder()
    
    if (index >= allItems.length - 1) return
    
    const item1 = allItems[index]
    const item2 = allItems[index + 1]
    
    const newBinding = createEmptyBinding()
    
    if (item1.type === 'detail') {
      newBinding.detailIds.push(item1.id)
    } else {
      newBinding.bindingIds.push(item1.id)
    }
    
    if (item2.type === 'detail') {
      newBinding.detailIds.push(item2.id)
    } else {
      newBinding.bindingIds.push(item2.id)
    }
    
    setBindings(prev => [...(prev || []), newBinding])
    addInfoMessage('success', `Создано скрепление`)
  }

  const handleTestCalculation = async () => {
    setIsCalculating(true)
    setCalculationProgress(0)
    
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200))
      setCalculationProgress(i)
    }
    
    setIsCalculating(false)
  }

  const handleFullCalculation = async () => {
    setIsCalculating(true)
    setCalculationProgress(0)
    
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 100))
      setCalculationProgress(i)
    }
    
    setIsCalculating(false)
  }
  
  const handleToggleGabVes = () => {
    setIsGabVesActive(!isGabVesActive)
    if (!isGabVesActive) {
      setIsGabVesPanelExpanded(true)
    } else {
      setIsGabVesPanelExpanded(false)
    }
  }
  
  const handleToggleCost = () => {
    setIsCostActive(!isCostActive)
    if (!isCostActive) {
      setIsCostPanelExpanded(true)
    } else {
      setIsCostPanelExpanded(false)
    }
  }
  
  const handleTogglePrice = () => {
    setIsPriceActive(!isPriceActive)
    if (!isPriceActive) {
      setIsPricePanelExpanded(true)
    } else {
      setIsPricePanelExpanded(false)
    }
  }

  const handleRefreshData = async () => {
    if (appMode === 'DEMO') {
      toast.info('REFRESH доступен только в Bitrix')
      return
    }
    
    if (isRefreshing) return
    
    setIsRefreshing(true)
    console.info('[REFRESH] request sent')
    
    const offerIds = selectedOffers.map(o => o.id)
    postMessageBridge.sendRefreshRequest(offerIds)
    
    const timeout = setTimeout(() => {
      if (isRefreshing) {
        setIsRefreshing(false)
        toast.error('Не удалось обновить данные')
      }
    }, 10000)
    
    return () => clearTimeout(timeout)
  }
  
  const allItems = getAllItemsInOrder()
  
  const getDraggedElement = () => {
    if (!dragState.isDragging || !dragState.draggedItemId || !dragState.initialPosition) return null
    
    const item = allItems.find(i => i.id === dragState.draggedItemId)
    if (!item) return null
    
    return (
      <div
        style={{
          position: 'fixed',
          left: dragState.dragPosition.x,
          top: dragState.dragPosition.y,
          width: dragState.initialPosition.width,
          zIndex: 9999,
          pointerEvents: 'none',
          opacity: 0.9,
        }}
      >
        {item.type === 'detail' ? (
          <DetailCard
            detail={item.item as Detail}
            onUpdate={() => {}}
            onDelete={() => {}}
            isInBinding={false}
            orderNumber={allItems.findIndex(i => i.id === item.id) + 1}
            isDragging={false}
            bitrixMeta={bitrixMeta}
          />
        ) : (
          <BindingCard
            binding={item.item as Binding}
            details={(details || []).filter(d => (item.item as Binding).detailIds?.includes(d.id))}
            bindings={(bindings || []).filter(b => (item.item as Binding).bindingIds?.includes(b.id))}
            allDetails={details || []}
            allBindings={bindings || []}
            onUpdate={() => {}}
            onDelete={() => {}}
            onUpdateDetail={() => {}}
            onUpdateBinding={() => {}}
            orderNumber={allItems.findIndex(i => i.id === item.id) + 1}
            detailStartIndex={0}
            isDragging={false}
          />
        )}
      </div>
    )
  }

  const handleSimulateInit = () => {
    const mockInitPayload: InitPayload = {
      mode: "NEW_CONFIG",
      context: {
        siteId: "s1",
        userId: "1",
        lang: "ru",
        timestamp: Date.now(),
        url: "https://prospektprint.ru/"
      },
      iblocks: {
        products: 16,
        offers: 17,
        calcDetails: 99,
        calcDetailsVariants: 100,
        calcMaterials: 94,
        calcMaterialsVariants: 95,
        calcOperations: 96,
        calcOperationsVariants: 97,
        calcEquipment: 98
      },
      iblocksTypes: {
        "16": "catalog",
        "17": "offers",
        "94": "calculator_catalog",
        "95": "calculator_catalog",
        "96": "calculator_catalog",
        "97": "calculator_catalog",
        "98": "calculator_catalog",
        "99": "calculator_catalog",
        "100": "calculator_catalog"
      },
      selectedOffers: [
        {
          id: 215,
          productId: 213,
          name: "Визитки: 50 экз., A7 74×105мм, 1+0",
          fields: { width: 74, height: 8, length: 105, weight: 70 },
          prices: [{ type: "BASE", value: 1152, currency: "RUB" }],
          properties: {
            VOLUME: "50 экз.",
            FORMAT: "A7 74×105мм",
            COLOR_SCHEME: "1+0",
            CML2_LINK: "213"
          }
        }
      ]
    }
    
    console.info('[INIT] Simulated')
    console.info('[INIT] applied offers=', mockInitPayload.selectedOffers.length)
    
    setAppMode('BITRIX')
    setAppModeState('BITRIX')
    
    clearDemoStorage()
    resetBitrixStore()
    
    updateHeaderTabs(createEmptyHeaderTabs())
    
    setBitrixMeta(mockInitPayload)
    setSelectedOffers(mockInitPayload.selectedOffers)
    setSelectedVariantIds(mockInitPayload.selectedOffers.map(o => o.id))
    setOffersSource('INIT')
    
    if (mockInitPayload.context?.url && mockInitPayload.context?.lang) {
      setBitrixContext({
        baseUrl: mockInitPayload.context.url,
        lang: mockInitPayload.context.lang,
      })
    }
    
    toast.success('INIT симуляция применена')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SidebarMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} offersSource={offersSource} />
      
      {dragState.isDragging && getDraggedElement()}
      
      <div className="w-full flex flex-col min-h-screen">
        <header className="border-b border-border bg-card" pwcode="header">
          <HeaderSection
            headerTabs={headerTabs || createEmptyHeaderTabs()}
            setHeaderTabs={updateHeaderTabs}
            addInfoMessage={addInfoMessage}
            onOpenMenu={() => setIsMenuOpen(true)}
            onRefreshData={handleRefreshData}
            onDetailDragStart={handleHeaderDetailDragStart}
            onDetailDragEnd={handleHeaderDetailDragEnd}
            onActiveTabChange={setActiveHeaderTab}
            bitrixMeta={bitrixMeta}
            isRefreshing={isRefreshing}
            onSelectRequest={handleSelectRequestPending}
            isBitrixLoading={isBitrixLoading}
          />
        </header>

        <main 
          className="flex-1 p-4 overflow-auto"
          onDragOver={handleMainAreaDragOver}
          onDrop={handleMainAreaDrop}
          pwcode="mainarea"
        >
          <div className="space-y-0">
            {allItems.length === 0 && draggedHeaderDetail && activeHeaderTab === 'detailsVariants' && (
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg flex items-center justify-center transition-all",
                  headerDropZoneHover === 0 
                    ? "border-accent bg-accent/10" 
                    : "border-border bg-muted/30"
                )}
                style={{ height: '43px' }}
                onDragEnter={() => setHeaderDropZoneHover(0)}
                onDragLeave={() => setHeaderDropZoneHover(null)}
              >
                <p className={cn(
                  "text-center",
                  headerDropZoneHover === 0 ? "text-accent-foreground font-medium" : "text-muted-foreground"
                )}>
                  {headerDropZoneHover === 0
                    ? "Отпустите для добавления детали" 
                    : "Перетащите деталь из шапки сюда"}
                </p>
              </div>
            )}
            
            {dragState.isDragging && allItems.length > 0 && (
              <div 
                ref={(el) => { if (el) dropZoneRefs.current.set(0, el) }}
                className={cn(
                  "border-2 border-dashed rounded-lg flex items-center justify-center mb-2 transition-all",
                  dragState.dropTargetIndex === 0 ? "border-accent bg-accent/10" : "border-border bg-muted/30"
                )}
                style={{ height: '43px' }}
              >
                <p className={cn(
                  "text-center text-sm",
                  dragState.dropTargetIndex === 0 ? "text-accent-foreground font-medium" : "text-muted-foreground"
                )}>
                  Перетащите деталь сюда
                </p>
              </div>
            )}
            
            {draggedHeaderDetail && activeHeaderTab === 'detailsVariants' && allItems.length > 0 && (
              <div 
                className={cn(
                  "border-2 border-dashed rounded-lg flex items-center justify-center mb-2 transition-all",
                  headerDropZoneHover === -1 ? "border-accent bg-accent/10" : "border-border bg-muted/30"
                )}
                style={{ height: '43px' }}
                onDragEnter={() => setHeaderDropZoneHover(-1)}
                onDragLeave={() => setHeaderDropZoneHover(null)}
              >
                <p className={cn(
                  "text-center text-sm",
                  headerDropZoneHover === -1 ? "text-accent-foreground font-medium" : "text-muted-foreground"
                )}>
                  {headerDropZoneHover === -1 ? "Отпустите для добавления детали" : "Перетащите деталь из шапки сюда"}
                </p>
              </div>
            )}
            
            {allItems.map((item, index) => {
              const isDraggingThis = dragState.isDragging && dragState.draggedItemId === item.id
              
              if (isDraggingThis) {
                return null
              }
              
              return (
              <div key={item.id}>
                {item.type === 'detail' ? (
                  <DetailCard
                    detail={item.item as Detail}
                    onUpdate={(updates) => handleUpdateDetail(item.id, updates)}
                    onDelete={() => handleDeleteDetail(item.id)}
                    isInBinding={false}
                    orderNumber={index + 1}
                    onDragStart={handleDetailDragStart}
                    isDragging={isDraggingThis}
                    bitrixMeta={bitrixMeta}
                  />
                ) : (
                  <BindingCard
                    binding={item.item as Binding}
                    details={(details || []).filter(d => (item.item as Binding).detailIds?.includes(d.id))}
                    bindings={(bindings || []).filter(b => (item.item as Binding).bindingIds?.includes(b.id))}
                    allDetails={details || []}
                    allBindings={bindings || []}
                    onUpdate={(updates) => {
                      setBindings(prev =>
                        (prev || []).map(b => b.id === item.id ? { ...b, ...updates } : b)
                      )
                    }}
                    onDelete={() => {
                      setBindings(prev => (prev || []).filter(b => b.id !== item.id))
                      addInfoMessage('info', 'Скрепление удалено')
                    }}
                    onUpdateDetail={handleUpdateDetail}
                    onUpdateBinding={handleUpdateBinding}
                    orderNumber={index + 1}
                    detailStartIndex={0}
                    onDragStart={handleBindingDragStart}
                    isDragging={isDraggingThis}
                  />
                )}
                
                {dragState.isDragging && (
                  <div 
                    ref={(el) => { if (el) dropZoneRefs.current.set(index + 1, el) }}
                    className={cn(
                      "border-2 border-dashed rounded-lg flex items-center justify-center my-2 transition-all",
                      dragState.dropTargetIndex === index + 1 ? "border-accent bg-accent/10" : "border-border bg-muted/30"
                    )}
                    style={{ height: '43px' }}
                  >
                    <p className={cn(
                      "text-center text-sm",
                      dragState.dropTargetIndex === index + 1 ? "text-accent-foreground font-medium" : "text-muted-foreground"
                    )}>
                      Перетащите деталь сюда
                    </p>
                  </div>
                )}
                
                {draggedHeaderDetail && activeHeaderTab === 'detailsVariants' && (
                  <div 
                    className={cn(
                      "border-2 border-dashed rounded-lg flex items-center justify-center my-2 transition-all",
                      headerDropZoneHover === index + 1 ? "border-accent bg-accent/10" : "border-border bg-muted/30"
                    )}
                    style={{ height: '43px' }}
                    onDragEnter={() => setHeaderDropZoneHover(index + 1)}
                    onDragLeave={() => setHeaderDropZoneHover(null)}
                  >
                    <p className={cn(
                      "text-center text-sm",
                      headerDropZoneHover === index + 1 ? "text-accent-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {headerDropZoneHover === index + 1 ? "Отпустите для добавления детали" : "Перетащите деталь из шапки сюда"}
                    </p>
                  </div>
                )}
                
                {index < allItems.length - 1 && !dragState.isDragging && !draggedHeaderDetail && (
                  <div className="flex justify-center -my-3 z-10 relative" style={{ marginTop: '-12px', marginBottom: '-12px' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full h-8 w-8 p-0 bg-background hover:bg-accent hover:text-accent-foreground relative z-10 border border-border shadow-sm"
                      onClick={() => handleCreateBinding(index)}
                      pwcode="btn-create-binding"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )
            })}
          </div>
        </main>

        {isCalculating && (
          <div className="px-4 py-2 border-t border-border bg-card">
            <div className="flex items-center gap-3">
              <Progress value={calculationProgress} className="flex-1" />
              <span className="text-sm font-medium min-w-[4rem] text-right">
                {calculationProgress}%
              </span>
            </div>
          </div>
        )}

        <VariantsFooter
          selectedOffers={selectedOffers}
          testVariantId={testVariantId}
          setTestVariantId={setTestVariantId}
          addInfoMessage={addInfoMessage}
          bitrixMeta={bitrixMeta}
          onRemoveOffer={(offerId) => {
            setSelectedOffers(prev => prev.filter(o => o.id !== offerId))
            setSelectedVariantIds(prev => prev.filter(id => id !== offerId))
            if (testVariantId === offerId) {
              setTestVariantId(null)
            }
          }}
          onAddOfferRequest={handleAddOfferRequestPending}
          isBitrixLoading={isBitrixLoading}
        />

        <InfoPanel
          messages={infoMessages}
          isExpanded={isInfoPanelExpanded}
          onToggle={() => setIsInfoPanelExpanded(!isInfoPanelExpanded)}
        />
        
        {isGabVesActive && (
          <GabVesPanel
            messages={gabVesMessages}
            isExpanded={isGabVesPanelExpanded}
            onToggle={() => setIsGabVesPanelExpanded(!isGabVesPanelExpanded)}
          />
        )}
        
        {isCostActive && (
          <CostPanel
            messages={costMessages}
            isExpanded={isCostPanelExpanded}
            onToggle={() => setIsCostPanelExpanded(!isCostPanelExpanded)}
            settings={costingSettings || { basedOn: 'COMPONENT_PURCHASE', roundingStep: 1, markupValue: 0, markupUnit: 'RUB' }}
            onSettingsChange={(newSettings) => setCostingSettings(newSettings)}
          />
        )}
        
        {isPriceActive && (
          <PricePanel
            messages={priceMessages}
            isExpanded={isPricePanelExpanded}
            onToggle={() => setIsPricePanelExpanded(!isPricePanelExpanded)}
            settings={salePricesSettings || { selectedTypes: [], types: {} }}
            onSettingsChange={(newSettings) => setSalePricesSettings(newSettings)}
          />
        )}

        <footer className="border-t border-border bg-card p-3" pwcode="footer">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button 
                variant={isGabVesActive ? "default" : "outline"} 
                size="sm" 
                onClick={handleToggleGabVes}
                className={isGabVesActive ? "bg-accent text-accent-foreground" : ""}
                pwcode="btn-gabves"
              >
                <Cube className="w-4 h-4 mr-2" />
                Габариты/Вес
              </Button>
              <Button 
                variant={isCostActive ? "default" : "outline"} 
                size="sm" 
                onClick={handleToggleCost}
                className={isCostActive ? "bg-accent text-accent-foreground" : ""}
                pwcode="btn-cost"
              >
                <CurrencyDollar className="w-4 h-4 mr-2" />
                Себестоимость
              </Button>
              <Button 
                variant={isPriceActive ? "default" : "outline"} 
                size="sm" 
                onClick={handleTogglePrice}
                className={isPriceActive ? "bg-accent text-accent-foreground" : ""}
                pwcode="btn-price"
              >
                <Tag className="w-4 h-4 mr-2" />
                Отпускные цены
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTestCalculation} 
                disabled={isCalculating}
                pwcode="btn-test-calc"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Тест
              </Button>
              <Button 
                size="sm" 
                onClick={handleFullCalculation} 
                disabled={isCalculating}
                pwcode="btn-full-calc"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Рассчитать
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {}}
                pwcode="btn-save"
              >
                <FloppyDisk className="w-4 h-4 mr-2" />
                Сохранить
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {}}
                pwcode="btn-close"
              >
                <X className="w-4 h-4 mr-2" />
                Закрыть
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App
