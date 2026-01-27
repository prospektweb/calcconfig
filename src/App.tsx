import { useState, useEffect, useCallback, useRef } from 'react'
import { useConfigKV } from '@/hooks/use-config-kv'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { 
  Calculator,
  Package,
  Link as LinkIcon,
  Cube,
  CurrencyDollar,
  Tag,
  FloppyDisk,
  X,
  Link,
  Plus,
  FolderOpen,
  FileText
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { 
  AppState, 
  Detail, 
  Binding,
  InfoMessage,
  SalePricesSettings,
  ElementsStore,
  ElementsStoreItem,
  createEmptyDetail,
  createEmptyBinding,
  createEmptyStage
} from '@/lib/types'
import { transformPresetToUI } from '@/lib/bitrix-to-ui-transformer'
import { loadExpandedById } from '@/lib/ui-state-storage'
import { HeaderSection } from '@/components/calculator/HeaderSection'
import { VariantsFooter } from '@/components/calculator/VariantsFooter'
import { DetailCard } from '@/components/calculator/DetailCard'
import { BindingCard } from '@/components/calculator/BindingCard'
import { InfoPanel } from '@/components/calculator/InfoPanel'
import { PricePanel } from '@/components/calculator/PricePanel'
import { SidebarMenu } from '@/components/calculator/SidebarMenu'
import { DragOverlay } from '@/components/drag/DragOverlay'
import { useDragContext, DragProvider } from '@/contexts/DragContext'
import { initializeBitrixStore, getBitrixStore } from '@/services/configStore'
import { postMessageBridge, InitPayload, CalcInfoPayload, CalcSettingsResponsePayload, CalcOperationResponsePayload, CalcMaterialResponsePayload, CalcOperationVariantResponsePayload, CalcMaterialVariantResponsePayload } from '@/lib/postmessage-bridge'
import { setBitrixContext, openBitrixAdmin, getBitrixContext, getIblockByCode } from '@/lib/bitrix-utils'
import { useReferencesStore } from '@/stores/references-store'
import { useCalculatorSettingsStore } from '@/stores/calculator-settings-store'
import { useOperationSettingsStore } from '@/stores/operation-settings-store'
import { useMaterialSettingsStore } from '@/stores/material-settings-store'
import { useOperationVariantStore } from '@/stores/operation-variant-store'
import { useMaterialVariantStore } from '@/stores/material-variant-store'
import { transformBitrixTreeSelectElement, transformBitrixTreeSelectChild } from '@/lib/bitrix-transformers'
import { calculateStageReadiness, hasDraftForStage } from '@/lib/stage-utils'

// Helper function to check if targetBinding is a descendant of sourceBinding
function isDescendant(
  sourceBindingId: number,
  targetBindingId: number,
  bindings: Binding[]
): boolean {
  if (sourceBindingId === targetBindingId) return true
  
  // Find the target binding
  const targetBinding = bindings.find(b => b.bitrixId === targetBindingId)
  if (!targetBinding) return false
  
  // Check if any child binding is the source or contains the source
  for (const childBindingId of targetBinding.bindingIds || []) {
    const childBitrixId = bindings.find(b => b.id === childBindingId)?.bitrixId
    if (childBitrixId && isDescendant(sourceBindingId, childBitrixId, bindings)) {
      return true
    }
  }
  
  return false
}

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([])
  const [bitrixMeta, setBitrixMeta] = useState<InitPayload | null>(null)
  const bitrixMetaRef = useRef<InitPayload | null>(null)
  
  const [selectedOffers, setSelectedOffers] = useState<InitPayload['selectedOffers']>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pendingRequestsRef = useRef<Map<string, {}>>(new Map())
  const [isBitrixLoading, setIsBitrixLoading] = useState(false)
  const [canCalculate, setCanCalculate] = useState(false)
  
  // Dialog states for detail management
  const [isCreateDetailDialogOpen, setIsCreateDetailDialogOpen] = useState(false)
  const [newDetailName, setNewDetailName] = useState('')
  const [createDetailBinding, setCreateDetailBinding] = useState(false)
  const [isSelectDetailDialogOpen, setIsSelectDetailDialogOpen] = useState(false)
  const [selectDetailDialogMode, setSelectDetailDialogMode] = useState<'select' | 'create'>('select')
  const [isDeleteStageDialogOpen, setIsDeleteStageDialogOpen] = useState(false)
  const [stageToDelete, setStageToDelete] = useState<{detailId: string, calcIndex: number} | null>(null)
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false)
  const [groupDetailsToMerge, setGroupDetailsToMerge] = useState<(number | string)[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [isRemoveFromBindingDialogOpen, setIsRemoveFromBindingDialogOpen] = useState(false)
  const [pendingRemoveDetail, setPendingRemoveDetail] = useState<{
    detailId: string,
    bitrixId: number,
    parentId: number | null
  } | null>(null)
  const detailCounter = useRef(1)
  
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
    bitrixMetaRef.current = bitrixMeta
  }, [bitrixMeta])
  
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculationProgress, setCalculationProgress] = useState(0)

  const dragContext = useDragContext()

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

  // Helper function to get iblock info by code
  const getIblockInfo = useCallback((iblockCode: string) => {
    if (!bitrixMeta || !bitrixMeta.iblocks) return null
    const iblock = getIblockByCode(bitrixMeta.iblocks, iblockCode)
    if (!iblock) return null
    return {
      iblockId: iblock.id,
      iblockType: iblock.type,
    }
  }, [bitrixMeta])

  // Helper function to initialize calculator settings from elementsStore
  /**
   * Initializes the calculator settings store from elementsStore.CALC_SETTINGS.
   * This is used during INIT and REFRESH to load preset calculator settings into the store.
   * 
   * @param elementsStore - The elements store containing CALC_SETTINGS array
   * @param source - A label for logging purposes (e.g., 'INIT', 'REFRESH')
   * 
   * The function iterates through CALC_SETTINGS items and stores them using the
   * settings item ID as the key (converted to string).
   */
  const initializeCalculatorSettings = useCallback((elementsStore: ElementsStore, source: string) => {
    if (elementsStore.CALC_SETTINGS) {
      const settingsStore = useCalculatorSettingsStore.getState()
      console.log(`[${source}] Loading calculator settings from elementsStore`, {
        count: elementsStore.CALC_SETTINGS.length
      })
      elementsStore.CALC_SETTINGS.forEach((settingsItem: ElementsStoreItem) => {
        if (!settingsItem.id) {
          console.warn(`[${source}] Skipping settings item with missing id`)
          return
        }
        settingsStore.setSettings(settingsItem.id.toString(), {
          id: settingsItem.id,
          name: settingsItem.name,
          properties: settingsItem.properties || {},
          customFields: settingsItem.customFields,  // <-- добавить
        })
      })
      console.log(`[${source}] Calculator settings loaded successfully`)
    }
  }, [])

  /**
   * Check readiness of all stages across all details and bindings
   * @returns Object with canCalculate flag and list of blocking stages
   */
  const checkAllStagesReadiness = useCallback(() => {
    // If there's no CALC_STAGES data, allow calculation to proceed
    // This handles the case where the system is initializing or no stages exist yet
    if (!bitrixMeta?.elementsStore?.CALC_STAGES) {
      console.log('[READINESS CHECK] No elementsStore.CALC_STAGES available - allowing calculation')
      return { canCalculate: true, blockingStages: [] }
    }

    const blockingStages: Array<{
      detailName: string
      stageName: string
      stageId: number
      settingsId: number
      reason: string
    }> = []

    /**
     * Helper to check a single stage's readiness
     */
    const checkStage = (stage: typeof details[0]['stages'][0], containerName: string) => {
      if (stage.stageId !== null && stage.settingsId !== null) {
        // Find stage element in elementsStore
        const stageElement = bitrixMeta?.elementsStore?.CALC_STAGES?.find(s => s.id === stage.stageId)
        const outputsValue = stageElement?.properties?.OUTPUTS?.VALUE as string[] | undefined
        
        // Check for draft
        const hasDraft = hasDraftForStage(stage.stageId, stage.settingsId)
        
        // Calculate readiness
        const readiness = calculateStageReadiness(outputsValue, hasDraft)
        
        if (!readiness.ready) {
          blockingStages.push({
            detailName: containerName,
            stageName: stage.stageName || stageElement?.name || `Stage #${stage.stageId}`,
            stageId: stage.stageId,
            settingsId: stage.settingsId,
            reason: readiness.reason || 'Unknown reason'
          })
        }
      }
    }

    // Check all details
    details.forEach(detail => {
      detail.stages.forEach(stage => checkStage(stage, detail.name))
    })

    // Check all bindings
    bindings.forEach(binding => {
      binding.stages.forEach(stage => checkStage(stage, binding.name))
    })

    // Log diagnostic information
    if (blockingStages.length > 0) {
      console.warn('[READINESS CHECK] Calculate button hidden due to blocking stages:', blockingStages)
      blockingStages.forEach(stage => {
        console.warn(`  - [${stage.detailName}] ${stage.stageName} (stageId=${stage.stageId}, settingsId=${stage.settingsId}): ${stage.reason}`)
      })
    } else {
      console.log('[READINESS CHECK] All stages ready - Calculate button visible')
    }

    return {
      canCalculate: blockingStages.length === 0,
      blockingStages
    }
  }, [bitrixMeta, details, bindings])

  // Update canCalculate state whenever details, bindings, or bitrixMeta changes
  useEffect(() => {
    const { canCalculate: calculable } = checkAllStagesReadiness()
    setCanCalculate(calculable)
  }, [details, bindings, bitrixMeta, checkAllStagesReadiness])

  // Helper function to send REMOVE_DETAIL_REQUEST
  const sendRemoveDetailRequestHelper = useCallback((detailBitrixId: number, parentId: number | null) => {
    const iblockInfo = getIblockInfo('CALC_DETAILS')
    if (!iblockInfo) {
      addInfoMessage('error', 'Не удалось отправить запрос на удаление: отсутствует информация об инфоблоке')
      return
    }
    
    console.log('[REMOVE_DETAIL_REQUEST] Sending...', { detailId: detailBitrixId, parentId })
    postMessageBridge.sendRemoveDetailRequest({
      detailId: detailBitrixId,
      parentId,
      iblockId: iblockInfo.iblockId,
      iblockType: iblockInfo.iblockType,
    })
    // НЕ удаляем из UI — ждём INIT
    addInfoMessage('info', 'Запрос на удаление отправлен')
  }, [bitrixMeta])

  useEffect(() => {
    return () => {
      pendingRequestsRef.current.clear()
      setIsBitrixLoading(false)
    }
  }, [])
  
  useEffect(() => {
    const unsubscribe = postMessageBridge.on('INIT', (message) => {
      const bitrixStore = getBitrixStore()
      if (bitrixStore && message.payload) {
        const initPayload = message.payload as InitPayload
        
        console.info('[INIT] received')
        console.info('[INIT] applied offers=', (initPayload.selectedOffers || []).length)
        
        setBitrixMeta(initPayload)
        setSelectedOffers(initPayload.selectedOffers || [])
        setSelectedVariantIds(initPayload.selectedOffers?.map(o => o.id) || [])
        
        if (initPayload.context?.url && initPayload.context?.lang) {
          setBitrixContext({
            baseUrl: initPayload.context.url,
            lang: initPayload.context.lang,
          })
        }
        
        initializeBitrixStore(message.payload)
        
        // Load hierarchical data from Bitrix
        const referencesStore = useReferencesStore.getState()
        
        if (initPayload.iblocksTree?.calcSettings) {
          const iblock = getIblockByCode(initPayload.iblocks, 'CALC_SETTINGS')
          referencesStore.setCalculatorsHierarchy(
            transformBitrixTreeSelectElement(initPayload.iblocksTree.calcSettings, iblock?.type)
          )
        }
        
        if (initPayload.iblocksTree?.calcEquipment) {
          const iblock = getIblockByCode(initPayload.iblocks, 'CALC_EQUIPMENT')
          referencesStore.setEquipmentHierarchy(
            transformBitrixTreeSelectElement(initPayload.iblocksTree.calcEquipment, iblock?.type)
          )
        }
        
        if (initPayload.iblocksTree?.calcOperations) {
          const iblock = getIblockByCode(initPayload.iblocks, 'CALC_OPERATIONS')
          referencesStore.setOperationsHierarchy(
            transformBitrixTreeSelectChild(initPayload.iblocksTree.calcOperations, iblock?.type)
          )
        }
        
        if (initPayload.iblocksTree?.calcMaterials) {
          const iblock = getIblockByCode(initPayload.iblocks, 'CALC_MATERIALS')
          referencesStore.setMaterialsHierarchy(
            transformBitrixTreeSelectChild(initPayload.iblocksTree.calcMaterials, iblock?.type)
          )
        }
        
        referencesStore.setLoaded(true)
        
        // ПОЛНОСТЬЮ перестраиваем UI из preset и elementsStore
        if (message.payload.preset && message.payload.elementsStore) {
          console.info('[INIT] Transforming preset to UI...')
          try {
            // Load persisted expanded state
            const expandedById = loadExpandedById()
            
            const { details: transformedDetails, bindings: transformedBindings } = transformPresetToUI(
              message.payload.preset,
              message.payload.elementsStore,
              expandedById
            )
            
            // ЗАМЕНЯЕМ состояние (не добавляем!)
            setDetails(transformedDetails)
            setBindings(transformedBindings)
            console.info('[INIT] UI rebuilt:', {
              details: transformedDetails.length,
              bindings: transformedBindings.length,
            })
          } catch (error) {
            console.error('[INIT] Transformation error:', error)
          }
          
          // Initialize calculatorSettings store from elementsStore.CALC_SETTINGS
          initializeCalculatorSettings(message.payload.elementsStore, 'INIT')
        } else {
          // Нет preset — очищаем
          setDetails([])
          setBindings([])
          console.info('[INIT] No preset — UI cleared')
        }
        
        postMessageBridge.sendInitDone(
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
          
          // Transform preset and elementsStore to UI format
          if (refreshPayload.preset && refreshPayload.elementsStore) {
            console.log('[REFRESH] Transforming preset and elementsStore to UI format')
            try {
              // Load persisted expanded state
              const expandedById = loadExpandedById()
              
              const { details: transformedDetails, bindings: transformedBindings } = transformPresetToUI(
                refreshPayload.preset,
                refreshPayload.elementsStore,
                expandedById
              )
              
              // ЗАМЕНЯЕМ состояние полностью
              setDetails(transformedDetails)
              setBindings(transformedBindings)
              console.log('[REFRESH] Transformed data:', { 
                details: transformedDetails.length, 
                bindings: transformedBindings.length 
              })
            } catch (error) {
              console.error('[REFRESH] Transformation error:', error)
            }
            
            // Initialize calculatorSettings store from elementsStore.CALC_SETTINGS
            initializeCalculatorSettings(refreshPayload.elementsStore, 'REFRESH')
          } else {
            // Нет preset — очищаем
            setDetails([])
            setBindings([])
          }
          
          console.info('[REFRESH] applied offers=', (refreshPayload.selectedOffers || []).length)
          
          setIsRefreshing(false)
          toast.success('Данные обновлены')
        }
      })

    return () => {
      unsubscribe()
      unsubscribeRefresh()
    }
  }, [])

  useEffect(() => {
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

      // For offers (not header tabs anymore)
      const uniqueOffers = items as InitPayload['selectedOffers']
      setSelectedOffers((prev) => {
        const merged = mergeUniqueById(prev || [], uniqueOffers)
        setSelectedVariantIds(merged.map(o => o.id))
        return merged
      })

      setIsBitrixLoading(pendingRequestsRef.current.size > 0)
    })

    return () => {
      unsubscribeSelectDone()
    }
  }, [dedupeById, mergeUniqueById])

  useEffect(() => {
    const unsubscribeCalcSettings = postMessageBridge.on('CALC_SETTINGS_RESPONSE', (message) => {
      console.log('[CALC_SETTINGS_RESPONSE][DEBUG] Raw message received:', message)
      console.log('[CALC_SETTINGS_RESPONSE][DEBUG] Payload:', message.payload)

      if (!message.payload) {
        console.warn('[CALC_SETTINGS_RESPONSE][DEBUG] No payload in message')
        return
      }

      const payload = message.payload as CalcSettingsResponsePayload
      
      console.log('[CALC_SETTINGS_RESPONSE][DEBUG] Parsed payload:', {
        id: payload.id,
        status: payload.status,
        hasItem: !!payload.item,
        itemId: payload.item?.id,
        itemName: payload.item?.name,
        itemProperties: payload.item?.properties ? Object.keys(payload.item.properties) : [],
      })

      // Check that item exists
      if (!payload.item) {
        console.warn('[CALC_SETTINGS_RESPONSE][DEBUG] No item in payload')
        return
      }

      // Log important properties
      const props = payload.item.properties || {}
      console.log('[CALC_SETTINGS_RESPONSE][DEBUG] Key properties:', {
        USE_OPERATION_VARIANT: props.USE_OPERATION_VARIANT?.VALUE,
        USE_OPERATION_VARIANT_XML_ID: props.USE_OPERATION_VARIANT?.VALUE_XML_ID,
        USE_MATERIAL_VARIANT: props.USE_MATERIAL_VARIANT?.VALUE,
        USE_MATERIAL_VARIANT_XML_ID: props.USE_MATERIAL_VARIANT?.VALUE_XML_ID,
        USE_OPERATION_QUANTITY: props.USE_OPERATION_QUANTITY?.VALUE,
        USE_OPERATION_QUANTITY_XML_ID: props.USE_OPERATION_QUANTITY?.VALUE_XML_ID,
        USE_MATERIAL_QUANTITY: props.USE_MATERIAL_QUANTITY?.VALUE,
        USE_MATERIAL_QUANTITY_XML_ID: props.USE_MATERIAL_QUANTITY?.VALUE_XML_ID,
        DEFAULT_OPERATION_VARIANT: props.DEFAULT_OPERATION_VARIANT?.VALUE,
        DEFAULT_MATERIAL_VARIANT: props.DEFAULT_MATERIAL_VARIANT?.VALUE,
        OTHER_OPTIONS: props.OTHER_OPTIONS?.VALUE,
      })
      
      const settingsStore = useCalculatorSettingsStore.getState()
      
      const settingsKey = payload.item.id.toString()
      console.log('[CALC_SETTINGS_RESPONSE][DEBUG] Saving to store with key:', settingsKey)

      // Save settings to store using the calculator ID as key
      settingsStore.setSettings(settingsKey, {
        id: payload.item.id,
        name: payload.item.name,
        properties: payload.item.properties,
        customFields:  payload.item.customFields,  // <-- добавить
      })

      // Verify save
      const savedSettings = settingsStore.getSettings(settingsKey)
      console.log('[CALC_SETTINGS_RESPONSE][DEBUG] Verified saved settings:', {
        key: settingsKey,
        found: !!savedSettings,
        savedId: savedSettings?.id,
        savedName: savedSettings?.name,
        savedPropertiesCount: savedSettings?.properties ? Object.keys(savedSettings.properties).length : 0,
      })

      console.info('[CALC_SETTINGS] saved settings for calculator', payload.item.id, payload.item.name)
    })

    const unsubscribeOperation = postMessageBridge.on('CALC_OPERATION_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] CALC_OPERATION_RESPONSE', message)

      if (!message.payload?.item) return

      const payload = message.payload as CalcOperationResponsePayload
      const item = payload.item
      const operationStore = useOperationSettingsStore.getState()

      operationStore.setOperation(item.id.toString(), {
        id: item.id,
        name: item.name,
        properties: item.properties,
      })

      console.info('[CALC_OPERATION] saved operation', item.id, item.name)
    })

    const unsubscribeMaterial = postMessageBridge.on('CALC_MATERIAL_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] CALC_MATERIAL_RESPONSE', message)

      if (!message.payload?.item) return

      const payload = message.payload as CalcMaterialResponsePayload
      const item = payload.item
      const materialStore = useMaterialSettingsStore.getState()

      materialStore.setMaterial(item.id.toString(), {
        id: item.id,
        name: item.name,
        properties: item.properties,
      })

      console.info('[CALC_MATERIAL] saved material', item.id, item.name)
    })

    const unsubscribeOperationVariant = postMessageBridge.on('CALC_OPERATION_VARIANT_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] CALC_OPERATION_VARIANT_RESPONSE', message)

      if (!message.payload?.item) return

      const payload = message.payload as CalcOperationVariantResponsePayload
      const item = payload.item
      const operationVariantStore = useOperationVariantStore.getState()
      const operationStore = useOperationSettingsStore.getState()

      // Save to operation variant store (for unit data)
      operationVariantStore.setVariant(item.id.toString(), {
        id: item.id,
        name: item.name,
        properties: item.properties || {},
        measure: item.measure,  // ← ДОБАВИТЬ для единиц измерения
      })

      // Save to operation settings store (for SUPPORTED lists from itemParent)
      operationStore.setOperation(item.id.toString(), {
        id: item.id,
        name: item.name,
        properties: item.properties || {},
        itemParent: item.itemParent,  // ← ДОБАВИТЬ itemParent
      })

      const rawEquipment = item.itemParent?.properties?.SUPPORTED_EQUIPMENT_LIST?.VALUE
      const rawMaterials = item.itemParent?.properties?.SUPPORTED_MATERIALS_VARIANTS_LIST?.VALUE

      console.info('[CALC_OPERATION_VARIANT] saved operation with itemParent', {
        id: item.id,
        name: item.name,
        hasItemParent: !!item.itemParent,
        itemParentId: item.itemParent?.id,
        supportedEquipment: rawEquipment,
        supportedEquipmentParsed: rawEquipment === false || rawEquipment === 'false' ? '(all)' : rawEquipment,
        supportedMaterials: rawMaterials,
        supportedMaterialsParsed: rawMaterials === false || rawMaterials === 'false' ? '(all)' : rawMaterials,
      })
    })

    const unsubscribeMaterialVariant = postMessageBridge.on('CALC_MATERIAL_VARIANT_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] CALC_MATERIAL_VARIANT_RESPONSE', message)

      if (!message.payload?.item) return

      const payload = message.payload as CalcMaterialVariantResponsePayload
      const item = payload.item
      const materialVariantStore = useMaterialVariantStore.getState()

      materialVariantStore.setVariant(item.id.toString(), {
        id: item.id,
        name: item.name,
        properties: item.properties,
        measure: item.measure,  // ← ДОБАВИТЬ
      })

      console.info('[CALC_MATERIAL_VARIANT] saved material variant', item.id, item.name)
    })

    const unsubscribeAddNewGroup = postMessageBridge.on('ADD_NEW_GROUP_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] ADD_NEW_GROUP_RESPONSE', message)
      
      if (!message.payload?.group) return
      
      const groupData = message.payload.group
      // groupData содержит:
      // {
      //     id: 1045,
      //     name: "Группа скрепления #1",
      //     type: "BINDING",
      //     detailIds: [1041, 1043]
      // }
      
      // Создаем объект Binding для UI
      const newBinding: Binding = {
        id: `binding_${groupData.id}_${Date.now()}`,
        name: groupData.name || 'Группа скрепления',
        isExpanded: true,
        hasStages: false,
        stages: [],
        detailIds: [], // Будет заполнено ниже
        bindingIds: [],
        bitrixId: groupData.id,
      }
      
      // Находим детали по bitrixId из groupData.detailIds
      setDetails(prev => {
        const detailsToMove: string[] = []
        const remainingDetails: Detail[] = []
        
        for (const detail of (prev || [])) {
          // Проверяем, входит ли деталь в группу по bitrixId
          const detailBitrixId = detail.bitrixId || parseInt(detail.id.split('_')[1], 10)
          if (groupData.detailIds?.includes(detailBitrixId)) {
            detailsToMove.push(detail.id)
          } else {
            remainingDetails.push(detail)
          }
        }
        
        // Обновляем binding с найденными деталями
        newBinding.detailIds = detailsToMove
        
        return remainingDetails
      })
      
      // Добавляем новую группу в bindings
      setBindings(prev => [...(prev || []), newBinding])
      
      toast.success(`Группа "${groupData.name}" создана с ${groupData.detailIds?.length || 0} деталями`)
    })

    const unsubscribeCalcInfo = postMessageBridge.on('CALC_INFO', (message) => {
      console.info('[FROM_BITRIX] CALC_INFO', message)
      
      const payload = message.payload as CalcInfoPayload
      const { status, message: infoMessage, progress, updatedOffers } = payload
      
      if (status === 'progress') {
        setCalculationProgress(progress || 0)
      } else if (status === 'complete') {
        setIsCalculating(false)
        toast.success(infoMessage || 'Расчёт завершён')
        // TODO: обработать updatedOffers
      } else if (status === 'error') {
        setIsCalculating(false)
        toast.error(infoMessage || 'Ошибка расчёта')
      }
    })

    return () => {
      unsubscribeCalcSettings()
      unsubscribeOperation()
      unsubscribeMaterial()
      unsubscribeOperationVariant()
      unsubscribeMaterialVariant()
      unsubscribeAddNewGroup()
      unsubscribeCalcInfo()
    }
  }, [])

  // Handle RESPONSE messages for stage operations
  useEffect(() => {
    const unsubscribeResponse = postMessageBridge.on('RESPONSE', (message) => {
      console.log('[RESPONSE] Received:', message)
      
      const payload = message.payload as any
      if (!payload) return

      // Handle ADD_STAGE_REQUEST response
      if (payload.requestType === 'ADD_STAGE_REQUEST' && payload.status === 'success') {
        console.log('[RESPONSE] ADD_STAGE_REQUEST success, updating UI from elementsStore')
        
        // Transform preset and elementsStore to UI format
        if (payload.state?.preset && payload.state?.elementsStore) {
          try {
            // Load persisted expanded state
            const expandedById = loadExpandedById()
            
            const { details: transformedDetails, bindings: transformedBindings } = transformPresetToUI(
              payload.state.preset,
              payload.state.elementsStore,
              expandedById
            )
            
            setDetails(transformedDetails)
            setBindings(transformedBindings)
            console.log('[RESPONSE] ADD_STAGE_REQUEST: UI updated', { 
              details: transformedDetails.length, 
              bindings: transformedBindings.length 
            })
            
            toast.success('Этап добавлен')
          } catch (error) {
            console.error('[RESPONSE] ADD_STAGE_REQUEST transformation error:', error)
            toast.error('Ошибка обновления UI после добавления этапа')
          }
        }
      }

      // Handle DELETE_STAGE_REQUEST response
      if (payload.requestType === 'DELETE_STAGE_REQUEST' && payload.status === 'success') {
        console.log('[RESPONSE] DELETE_STAGE_REQUEST success, updating UI from elementsStore')
        
        // Transform preset and elementsStore to UI format
        if (payload.state?.preset && payload.state?.elementsStore) {
          try {
            // Load persisted expanded state
            const expandedById = loadExpandedById()
            
            const { details: transformedDetails, bindings: transformedBindings } = transformPresetToUI(
              payload.state.preset,
              payload.state.elementsStore,
              expandedById
            )
            
            setDetails(transformedDetails)
            setBindings(transformedBindings)
            console.log('[RESPONSE] DELETE_STAGE_REQUEST: UI updated', { 
              details: transformedDetails.length, 
              bindings: transformedBindings.length 
            })
            
            toast.success('Этап удалён')
          } catch (error) {
            console.error('[RESPONSE] DELETE_STAGE_REQUEST transformation error:', error)
            toast.error('Ошибка обновления UI после удаления этапа')
          }
        }
      }

      // Handle error responses
      if (payload.status === 'error') {
        const errorMessage = payload.message || 'Произошла ошибка'
        toast.error(errorMessage)
        console.error('[RESPONSE] Error:', payload)
      }
    })

    return () => {
      unsubscribeResponse()
    }
  }, [])
  
  const addInfoMessage = (type: InfoMessage['type'], message: string, extendedMessage?: Partial<InfoMessage>) => {
    const newMessage: InfoMessage = {
      id: `msg_${Date.now()}`,
      type,
      message,
      timestamp: Date.now(),
      ...extendedMessage,
    }
    setInfoMessages((prev) => [...prev, newMessage])
  }

  const handleAddDetail = () => {
    const newDetail = createEmptyDetail()
    console.log('[ADD_DETAIL] Adding new detail', { detail: newDetail })
    setDetails(prev => [...(prev || []), newDetail])
    addInfoMessage('info', `Добавлена деталь: ${newDetail.name}`)
  }

  const handleCreateDetail = () => {
    const hasDetails = (details || []).length > 0 || (bindings || []).length > 0
    
    if (!hasDetails) {
      // Нет деталей — сразу создаём с binding = false и именем по умолчанию
      const name = `Деталь #${detailCounter.current++}`
      
      console.log('[ADD_DETAIL_REQUEST] Sending create detail request', { name, offerIds: selectedVariantIds, binding: false })
      
      // Send ADD_DETAIL_REQUEST
      if (bitrixMeta && selectedVariantIds.length > 0) {
        postMessageBridge.sendAddDetailRequest({
          offerIds: selectedVariantIds,
          name: name,
          binding: false,
          ...getIblockInfo('CALC_DETAILS')!,
        })
      }
      
      toast.info('Запрос на создание детали отправлен...')
    } else {
      // Есть детали — показываем диалог выбора (используем тот же диалог что и для select)
      setSelectDetailDialogMode('create')
      setIsSelectDetailDialogOpen(true)
    }
  }

  const handleCreateDetailConfirm = async () => {
    const name = newDetailName.trim() || `Деталь #${detailCounter.current++}`
    
    console.log('[ADD_DETAIL_REQUEST] Sending create detail request', { name, offerIds: selectedVariantIds, binding: createDetailBinding })
    
    // Send ADD_DETAIL_REQUEST
    if (bitrixMeta && selectedVariantIds.length > 0) {
      postMessageBridge.sendAddDetailRequest({
        offerIds: selectedVariantIds,
        name: name,
        binding: createDetailBinding,
        ...getIblockInfo('CALC_DETAILS')!,
      })
    }
    
    setIsCreateDetailDialogOpen(false)
    toast.info('Запрос на создание детали отправлен...')
  }

  const handleSelectDetail = () => {
    if (!bitrixMeta) return
    
    const hasDetails = (details || []).length > 0
    
    if (!hasDetails) {
      // Нет деталей — сразу отправляем запрос на выбор
      postMessageBridge.sendSelectDetailsRequest({
        binding: false,
        ...getIblockInfo('CALC_DETAILS')!,
      })
      toast.info('Открытие окна выбора детали...')
    } else {
      // Есть детали — показываем диалог выбора действия
      setSelectDetailDialogMode('select')
      setIsSelectDetailDialogOpen(true)
    }
  }

  const handleSelectDetailReplace = () => {
    if (selectDetailDialogMode === 'create') {
      // Режим создания — создать деталь с именем по умолчанию и binding = false
      const name = `Деталь #${detailCounter.current++}`
      
      console.log('[ADD_DETAIL_REQUEST] Sending create detail request', { name, offerIds: selectedVariantIds, binding: false })
      
      // Send ADD_DETAIL_REQUEST
      if (bitrixMeta && selectedVariantIds.length > 0) {
        postMessageBridge.sendAddDetailRequest({
          offerIds: selectedVariantIds,
          name: name,
          binding: false,
          ...getIblockInfo('CALC_DETAILS')!,
        })
      }
      
      toast.info('Запрос на создание детали отправлен...')
      setIsSelectDetailDialogOpen(false)
    } else {
      // Режим выбора — заменить деталь
      if (bitrixMeta) {
        postMessageBridge.sendSelectDetailsRequest({
          binding: false,
          ...getIblockInfo('CALC_DETAILS')!,
        })
        toast.info('Открытие окна выбора детали...')
      }
      setIsSelectDetailDialogOpen(false)
    }
  }

  const handleSelectDetailBinding = () => {
    if (selectDetailDialogMode === 'create') {
      // Режим создания — создать деталь с именем по умолчанию и binding = true
      const name = `Деталь #${detailCounter.current++}`
      
      console.log('[ADD_DETAIL_REQUEST] Sending create detail request', { name, offerIds: selectedVariantIds, binding: true })
      
      // Send ADD_DETAIL_REQUEST
      if (bitrixMeta && selectedVariantIds.length > 0) {
        postMessageBridge.sendAddDetailRequest({
          offerIds: selectedVariantIds,
          name: name,
          binding: true,
          ...getIblockInfo('CALC_DETAILS')!,
        })
      }
      
      toast.info('Запрос на создание детали отправлен...')
      setIsSelectDetailDialogOpen(false)
    } else {
      // Режим выбора — создать скрепление
      if (bitrixMeta) {
        postMessageBridge.sendSelectDetailsRequest({
          binding: true,
          ...getIblockInfo('CALC_DETAILS')!,
        })
        toast.info('Открытие окна выбора детали для скрепления...')
      }
      setIsSelectDetailDialogOpen(false)
    }
  }

  const handleDeleteStageConfirm = () => {
    if (!stageToDelete) return
    
    const detail = (details || []).find(d => d.id === stageToDelete.detailId)
    const stage = detail?.stages[stageToDelete.calcIndex]
    
    console.log('[DELETE_STAGE] Deleting stage', { 
      detailId: stageToDelete.detailId, 
      calcIndex: stageToDelete.calcIndex,
      stageId: stage?.stageId 
    })
    
    // НЕ удаляем из UI — ждём INIT
    
    if (stage?.stageId && bitrixMeta && detail?.bitrixId) {
      const stagesIblock = getIblockInfo('CALC_STAGES')
      if (stagesIblock) {
        postMessageBridge.sendDeleteStageRequest({
          stageId: stage.stageId,
          detailId: detail.bitrixId,
          previousStageId: detail.stages[stageToDelete.calcIndex - 1]?.stageId ?? undefined,
          nextStageId: detail.stages[stageToDelete.calcIndex + 1]?.stageId ?? undefined,
          iblockId: stagesIblock.iblockId,
          iblockType: stagesIblock.iblockType,
        })
      }
    }

    
    
    setIsDeleteStageDialogOpen(false)
    setStageToDelete(null)
    toast.info('Запрос на удаление этапа отправлен')
  }


  const handleDeleteDetail = (detailId: string) => {
    const detail = (details || []).find(d => d.id === detailId)
    
    // Проверяем, вложена ли деталь в скрепление
    const parentBinding = bindings?.find(b => b.detailIds?.includes(detailId))
    
    // Проверяем, это верхний уровень
    const isTopLevel = !parentBinding
    
    // Проверяем количество элементов на верхнем уровне
    const topLevelDetails = (details || []).filter(d => 
      !bindings?.some(b => b.detailIds?.includes(d.id))
    )
    const topLevelBindings = (bindings || []).filter(b => 
      !bindings?.some(parent => parent.bindingIds?.includes(b.id))
    )
    const isOnlyTopLevelElement = isTopLevel && 
      topLevelDetails.length <= 1 && 
      topLevelBindings.length === 0

    console.log('[DELETE_DETAIL]', { 
      detailId, 
      bitrixId: detail?.bitrixId,
      isTopLevel,
      isOnlyTopLevelElement,
      parentBindingId: parentBinding?.bitrixId
    })

    if (!bitrixMeta || !detail?.bitrixId) {
      if (!detail?.bitrixId) {
        addInfoMessage('error', 'Не удалось удалить деталь: отсутствует ID')
      }
      return
    }

    if (isOnlyTopLevelElement) {
      // Единственный элемент на верхнем уровне → CLEAR_PRESET_REQUEST
      const iblockInfo = getIblockInfo('CALC_DETAILS')
      if (iblockInfo) {
        console.log('[CLEAR_PRESET_REQUEST] Sending...')
        postMessageBridge.sendClearPresetRequest({
          iblockId: iblockInfo.iblockId,
          iblockType: iblockInfo.iblockType,
        })
      }
      // НЕ удаляем из UI — ждём INIT
      addInfoMessage('info', 'Запрос на очистку пресета отправлен')
    } else if (parentBinding) {
      // Деталь вложена в скрепление
      const detailsInBinding = parentBinding.detailIds?.length || 0
      
      if (detailsInBinding === 2) {
        // Ровно 2 детали в скреплении → показываем диалог
        if (!parentBinding.bitrixId) {
          addInfoMessage('error', 'Не удалось удалить деталь: отсутствует ID скрепления')
          return
        }
        setPendingRemoveDetail({
          detailId,
          bitrixId: detail.bitrixId,
          parentId: parentBinding.bitrixId
        })
        setIsRemoveFromBindingDialogOpen(true)
      } else {
        // Больше 2 деталей → просто удаляем
        if (!parentBinding.bitrixId) {
          addInfoMessage('error', 'Не удалось удалить деталь: отсутствует ID скрепления')
          return
        }
        sendRemoveDetailRequestHelper(detail.bitrixId, parentBinding.bitrixId)
      }
    } else {
      // Верхний уровень, но не единственный элемент
      sendRemoveDetailRequestHelper(detail.bitrixId, null)
    }
  }

  const handleDeleteBinding = (bindingId: string) => {
    const binding = (bindings || []).find(b => b.id === bindingId)
    
    // Проверяем, вложено ли скрепление в другое скрепление
    const parentBinding = bindings?.find(parent => parent.bindingIds?.includes(bindingId))
    
    // Проверяем, это верхний уровень
    const isTopLevel = !parentBinding
    
    // Проверяем количество элементов на верхнем уровне
    const topLevelDetails = (details || []).filter(d => 
      !bindings?.some(b => b.detailIds?.includes(d.id))
    )
    const topLevelBindings = (bindings || []).filter(b => 
      !bindings?.some(parent => parent.bindingIds?.includes(b.id))
    )
    const isOnlyTopLevelElement = isTopLevel && 
      topLevelDetails.length === 0 && 
      topLevelBindings.length <= 1

    console.log('[DELETE_BINDING]', { 
      bindingId, 
      bitrixId: binding?.bitrixId,
      isTopLevel,
      isOnlyTopLevelElement,
      parentBindingId: parentBinding?.bitrixId
    })

    if (!bitrixMeta || !binding?.bitrixId) {
      if (!binding?.bitrixId) {
        addInfoMessage('error', 'Не удалось удалить скрепление: отсутствует ID')
      }
      return
    }

    if (isOnlyTopLevelElement) {
      // Единственный элемент на верхнем уровне → CLEAR_PRESET_REQUEST
      const iblockInfo = getIblockInfo('CALC_DETAILS')
      if (iblockInfo) {
        console.log('[CLEAR_PRESET_REQUEST] Sending...')
        postMessageBridge.sendClearPresetRequest({
          iblockId: iblockInfo.iblockId,
          iblockType: iblockInfo.iblockType,
        })
      }
      // НЕ удаляем из UI — ждём INIT
      addInfoMessage('info', 'Запрос на очистку пресета отправлен')
    } else {
      // Не единственный элемент → REMOVE_DETAIL_REQUEST с parentId
      const parentId = parentBinding?.bitrixId ?? null
      sendRemoveDetailRequestHelper(binding.bitrixId, parentId)
    }
  }

  const handleConfirmRemoveFromBinding = () => {
    if (pendingRemoveDetail) {
      sendRemoveDetailRequestHelper(pendingRemoveDetail.bitrixId, pendingRemoveDetail.parentId)
    }
    setIsRemoveFromBindingDialogOpen(false)
    setPendingRemoveDetail(null)
  }

  const handleCancelRemoveFromBinding = () => {
    setIsRemoveFromBindingDialogOpen(false)
    setPendingRemoveDetail(null)
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

  const handleMainAreaDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  
  const handleMainAreaDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
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
    
    console.log('[ADD_BINDING] Creating binding', { 
      bindingId: newBinding.id, 
      detailIds: newBinding.detailIds, 
      bindingIds: newBinding.bindingIds 
    })
    
    setBindings(prev => [...(prev || []), newBinding])
    addInfoMessage('success', `Создано скрепление`)
  }

  const handleCalculation = async () => {
    console.log('[CALC_RUN] Starting calculation', { 
      detailsCount: details?.length || 0,
      details: details?.map(d => ({ id: d.id, name: d.name, stagesCount: d.stages?.length || 0 })),
      bindingsCount: bindings?.length || 0,
      bindings: bindings?.map(b => ({ id: b.id, name: b.name, detailIds: b.detailIds, bindingIds: b.bindingIds })),
      selectedOffers: selectedOffers.length
    })
    
    setIsCalculating(true)
    setCalculationProgress(0)
    
    // Import calculation engine
    const calculationEngine = await import('@/services/calculationEngine')
    const { calculateAllOffers, CalculationProgress, CalculationOfferResult, CalculationDetailResult, CalculationStageResult } = calculationEngine
    
    try {
      const results: CalculationOfferResult[] = []
      
      // Progress callback
      const progressCallback = (progress: CalculationProgress) => {
        setCalculationProgress(progress.percentage)
        console.log('[CALC_PROGRESS]', progress.message, `${progress.percentage}%`)
      }
      
      // Offer callback - add result to info panel
      const offerCallback = (result: CalculationOfferResult) => {
        // Convert calculation result to InfoMessage format
        const offerMessage: InfoMessage = {
          id: `calc_${result.offerId}_${Date.now()}`,
          type: 'success',
          message: `Расчёт завершён: ${result.offerName}`,
          timestamp: Date.now(),
          level: 'calculation',
          offerId: result.offerId,
          calculationData: {
            offerName: result.offerName,
            productId: result.productId,
            productName: result.productName,
            presetId: result.presetId,
            presetName: result.presetName,
            presetModified: result.presetModified,
            purchasePrice: result.totalPurchasePrice,
            basePrice: result.totalBasePrice,
            currency: result.currency,
            pricesWithMarkup: result.pricesWithMarkup,
            children: result.details.map((detail) => convertDetailToMessage(detail)),
          },
        }
        
        addInfoMessage(offerMessage.type, offerMessage.message, offerMessage)
        results.push(result)
      }
      
      // Helper function to convert detail result to message
      const convertDetailToMessage = (detail: CalculationDetailResult): InfoMessage => {
        return {
          id: `detail_${detail.detailId}_${Date.now()}_${Math.random()}`,
          type: 'info',
          message: detail.detailName,
          timestamp: Date.now(),
          level: 'detail',
          detailId: detail.detailId,
          calculationData: {
            detailName: detail.detailName,
            detailType: detail.detailType,
            purchasePrice: detail.purchasePrice,
            basePrice: detail.basePrice,
            currency: detail.currency,
            children: [
              ...(detail.children || []).map((child) => convertDetailToMessage(child)),
              ...(detail.stages || []).map((stage: CalculationStageResult) => ({
                id: `stage_${stage.stageId}_${Date.now()}_${Math.random()}`,
                type: 'info' as const,
                message: stage.stageName,
                timestamp: Date.now(),
                level: 'stage' as const,
                stageId: stage.stageId,
                calculationData: {
                  stageName: stage.stageName,
                  purchasePrice: stage.totalCost,
                  basePrice: stage.totalCost,
                  currency: stage.currency,
                },
              })),
            ],
          },
        }
      }
      
      // Run calculation
      await calculateAllOffers(
        selectedOffers,
        bitrixMeta?.product || null,
        bitrixMeta?.preset || null,
        details || [],
        bindings || [],
        bitrixMeta?.priceTypes || [],
        bitrixMeta, // Pass initPayload
        progressCallback,
        undefined,
        offerCallback
      )
      
      // Store results for later use (when saving)
      setHasSuccessfulCalculations(true)
      setCalculationResults(results)
      
      toast.success(`Расчёт завершён успешно! Обработано ${results.length} торговых предложений`)
      setIsInfoPanelExpanded(true) // Auto-expand to show results
      
    } catch (error) {
      console.error('[CALC_ERROR]', error)
      toast.error('Ошибка при расчёте')
      addInfoMessage('error', `Ошибка при расчёте: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsCalculating(false)
      setCalculationProgress(100)
    }
  }
  
  // New state for calculation results
  const [calculationResults, setCalculationResults] = useState<any[]>([])
  const [hasSuccessfulCalculations, setHasSuccessfulCalculations] = useState(false)
  
  // New function to save successful calculations
  const handleSaveCalculations = () => {
    if (!hasSuccessfulCalculations || calculationResults.length === 0) {
      toast.warning('Нет успешных расчётов для сохранения')
      return
    }
    
    console.log('[SAVE_CALC] Saving calculations', { count: calculationResults.length })
    
    // Send calculation results to parent via CALC_RUN message
    postMessageBridge.sendCalcRun({
      results: calculationResults,
      timestamp: Date.now(),
    })
    
    toast.success('Результаты расчёта отправлены')
    setHasSuccessfulCalculations(false)
  }
  
  const handleOpenPreset = () => {
    console.log('[OPEN_PRESET] Opening preset', { preset: bitrixMeta?.preset })
    
    if (!bitrixMeta?.preset) {
      toast.error('Пресет не загружен')
      return
    }

    const context = getBitrixContext()
    if (!context) {
      toast.error('Контекст Bitrix не инициализирован')
      return
    }

    // Find preset iblock
    const presetIblock = bitrixMeta.iblocks.find(ib => ib.code === 'CALC_PRESETS')
    if (!presetIblock) {
      toast.error('Не найден инфоблок пресетов')
      return
    }

    try {
      openBitrixAdmin({
        iblockId: presetIblock.id,
        type: presetIblock.type,
        lang: context.lang,
        id: bitrixMeta.preset.id,
      })
      addInfoMessage('info', `Открыт пресет ID: ${bitrixMeta.preset.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось открыть пресет'
      toast.error(message)
      addInfoMessage('error', message)
    }
  }
  
  const handleClose = () => {
    // Send close request to Bitrix
    // For now, we'll send saved=false and hasChanges=false
    // In a full implementation, you would track if there are unsaved changes
    postMessageBridge.sendCloseRequest(false, false)
    console.info('[CLOSE_REQUEST] sent')
  }

  const handleRefreshData = async () => {
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
    if (!dragContext.dragState.isDragging || !dragContext.dragState.draggedItemId || !dragContext.dragState.initialPosition) return null
    
    // Find item in all details and bindings
    let item: Detail | Binding | null = null
    let itemType: 'detail' | 'binding' | null = null
    
    const detail = (details || []).find(d => d.id === dragContext.dragState.draggedItemId)
    if (detail) {
      item = detail
      itemType = 'detail'
    } else {
      const binding = (bindings || []).find(b => b.id === dragContext.dragState.draggedItemId)
      if (binding) {
        item = binding
        itemType = 'binding'
      }
    }
    
    if (!item || !itemType) return null
    
    return (
      <div
        style={{
          position: 'fixed',
          left: dragContext.dragState.dragPosition.x,
          top: dragContext.dragState.dragPosition.y,
          width: dragContext.dragState.initialPosition.width,
          zIndex: 9999,
          pointerEvents: 'none',
          opacity: 0.9,
        }}
      >
        {itemType === 'detail' ? (
          <DetailCard
            detail={item as Detail}
            onUpdate={() => {}}
            onDelete={() => {}}
            isInBinding={false}
            orderNumber={0}
            isDragging={false}
            bitrixMeta={bitrixMeta}
          />
        ) : (
          <BindingCard
            binding={item as Binding}
            details={(details || []).filter(d => (item as Binding).detailIds?.includes(d.id))}
            bindings={(bindings || []).filter(b => (item as Binding).bindingIds?.includes(b.id))}
            allDetails={details || []}
            allBindings={bindings || []}
            onUpdate={() => {}}
            onDelete={() => {}}
            onUpdateDetail={() => {}}
            onUpdateBinding={() => {}}
            onDeleteDetail={handleDeleteDetail}
            onDeleteBinding={handleDeleteBinding}
            orderNumber={0}
            detailStartIndex={0}
            isDragging={false}
            bitrixMeta={bitrixMeta}
          />
        )}
      </div>
    )
  }

  // Helper function to recursively find bitrixId by element id
  const findElementBitrixId = useCallback((elementId: string): number | null => {
    // First, search in all top-level details
    for (const d of details || []) {
      if (d.id === elementId) return d.bitrixId || null
    }
    
    // Then search in bindings and their nested children recursively
    const searchInBindings = (bindingsList: Binding[]): number | null => {
      for (const b of bindingsList) {
        if (b.id === elementId) return b.bitrixId || null
        
        // Search in nested bindings recursively
        for (const bindingId of b.bindingIds || []) {
          const nestedBinding = (bindings || []).find(nb => nb.id === bindingId)
          if (nestedBinding) {
            // Search deeper in nested bindings
            const found = searchInBindings([nestedBinding])
            if (found) return found
          }
        }
      }
      return null
    }
    
    return searchInBindings(bindings || [])
  }, [details, bindings])

  // Helper function to get effective children order (fallback to detailIds + bindingIds if empty)
  const getEffectiveChildrenOrder = useCallback((binding: Binding): string[] => {
    return binding.childrenOrder?.length 
      ? binding.childrenOrder 
      : [...(binding.detailIds || []), ...(binding.bindingIds || [])]
  }, [])

  // Helper function to compute sortingBitrixIds from children order
  const computeSortingBitrixIds = useCallback((childrenOrder: string[]): number[] => {
    const sortingBitrixIds = childrenOrder
      .map(childId => findElementBitrixId(childId))
      .filter((id): id is number => id !== null && id > 0)
    
    console.log('[DROP] sortingBitrixIds:', sortingBitrixIds)
    
    if (sortingBitrixIds.length === 0) {
      console.warn('[DROP] sortingBitrixIds is empty, but sending request anyway')
    }
    
    return sortingBitrixIds
  }, [findElementBitrixId])

  // Helper function to recursively find binding by bitrixId
  const findBindingByBitrixId = useCallback((bitrixId: number): Binding | null => {
    // Поиск на верхнем уровне
    const directFind = (bindings || []).find(b => b.bitrixId === bitrixId)
    if (directFind) return directFind
    
    // Рекурсивный поиск во вложенных bindings
    const searchNested = (bindingsList: Binding[]): Binding | null => {
      for (const binding of bindingsList) {
        if (binding.bitrixId === bitrixId) return binding
        
        // Искать в дочерних bindings
        for (const childBindingId of binding.bindingIds || []) {
          const childBinding = (bindings || []).find(b => b.id === childBindingId)
          if (childBinding) {
            if (childBinding.bitrixId === bitrixId) return childBinding
            const found = searchNested([childBinding])
            if (found) return found
          }
        }
      }
      return null
    }
    
    return searchNested(bindings || [])
  }, [bindings])

  const handleDrop = useCallback((dragItem: any, dropTarget: any) => {
    console.log('[DROP] Handling drop', { dragItem, dropTarget })
    console.log('[DROP] All bindings:', (bindings || []).map(b => ({ id: b.id, bitrixId: b.bitrixId, name: b.name })))

    // Use bitrixId directly from dragItem - no need to search!
    const draggedBitrixId = dragItem.bitrixId
    if (!draggedBitrixId) {
      console.error('[DROP] Dragged item has no bitrixId')
      return
    }

    // Determine operation type
    const isSameBinding = dragItem.sourceBindingId === dropTarget.bindingId
    
    if (isSameBinding) {
      // SORT operation - reorder within same binding
      console.log('[DROP] SORT operation')
      
      // Find target binding BEFORE state update
      const targetBinding = findBindingByBitrixId(dropTarget.bindingId)
      console.log('[DROP] targetBinding:', targetBinding)
      
      if (!targetBinding) {
        console.error('[DROP] Target binding not found:', dropTarget.bindingId)
        return
      }
      
      // Compute effective children order (fallback to detailIds + bindingIds if empty)
      const effectiveChildrenOrder = getEffectiveChildrenOrder(targetBinding)
      
      console.log('[DROP] childrenOrder:', targetBinding.childrenOrder)
      console.log('[DROP] effectiveChildrenOrder:', effectiveChildrenOrder)
      
      // Update UI first
      setBindings(prev => {
        return (prev || []).map(binding => {
          if (binding.bitrixId !== dropTarget.bindingId) return binding
          
          // Use effective children order
          const currentOrder = getEffectiveChildrenOrder(binding)
          
          const fromIndex = currentOrder.indexOf(dragItem.id)
          if (fromIndex === -1) {
            console.warn('[DROP] Item not found in children order:', dragItem.id)
            return binding
          }
          
          const newOrder = [...currentOrder]
          const [movedItem] = newOrder.splice(fromIndex, 1)
          newOrder.splice(dropTarget.position.index, 0, movedItem)
          
          // Update detailIds and bindingIds to match new order
          const newDetailIds = newOrder.filter(id => (binding.detailIds || []).includes(id))
          const newBindingIds = newOrder.filter(id => (binding.bindingIds || []).includes(id))
          
          return { 
            ...binding, 
            childrenOrder: newOrder,
            detailIds: newDetailIds,
            bindingIds: newBindingIds
          }
        })
      })
      
      // Calculate new order for message
      const newChildrenOrder = [...effectiveChildrenOrder]
      const fromIndex = newChildrenOrder.indexOf(dragItem.id)
      if (fromIndex !== -1) {
        const [movedItem] = newChildrenOrder.splice(fromIndex, 1)
        newChildrenOrder.splice(dropTarget.position.index, 0, movedItem)
        
        console.log('[DROP] newChildrenOrder:', newChildrenOrder)
        
        const sortingBitrixIds = computeSortingBitrixIds(newChildrenOrder)
        
        console.log('[DROP] Sending SORT request:', {
          parentId: dropTarget.bindingId,
          sorting: sortingBitrixIds
        })
        
        postMessageBridge.sendChangeDetailSortRequest({
          parentId: dropTarget.bindingId,
          sorting: sortingBitrixIds
        })
      } else {
        console.error('[DROP] Item not found in effective children order:', dragItem.id)
      }
    } else {
      // LEVEL operation - move to different binding
      console.log('[DROP] LEVEL operation')
      
      // Find target binding BEFORE state update
      const targetBinding = findBindingByBitrixId(dropTarget.bindingId)
      console.log('[DROP] targetBinding:', targetBinding)
      
      if (!targetBinding) {
        console.error('[DROP] Target binding not found:', dropTarget.bindingId)
        return
      }
      
      // Compute effective children order (fallback to detailIds + bindingIds if empty)
      const effectiveChildrenOrder = getEffectiveChildrenOrder(targetBinding)
      
      console.log('[DROP] childrenOrder:', targetBinding.childrenOrder)
      console.log('[DROP] effectiveChildrenOrder:', effectiveChildrenOrder)
      
      // Update UI first - remove from source and add to target
      setBindings(prev => {
        return (prev || []).map(binding => {
          // Remove from source binding
          if (binding.bitrixId === dragItem.sourceBindingId) {
            const detailIds = (binding.detailIds || []).filter(id => id !== dragItem.id)
            const bindingIds = (binding.bindingIds || []).filter(id => id !== dragItem.id)
            const childrenOrder = (binding.childrenOrder || []).filter(id => id !== dragItem.id)
            return { ...binding, detailIds, bindingIds, childrenOrder }
          }
          
          // Add to target binding
          if (binding.bitrixId === dropTarget.bindingId) {
            // Use effective children order
            const currentOrder = getEffectiveChildrenOrder(binding)
            const newOrder = [...currentOrder]
            newOrder.splice(dropTarget.position.index, 0, dragItem.id)
            
            if (dragItem.kind === 'detail') {
              const detailIds = [...(binding.detailIds || [])]
              if (!detailIds.includes(dragItem.id)) {
                detailIds.push(dragItem.id)
              }
              return { ...binding, detailIds, childrenOrder: newOrder }
            } else {
              const bindingIds = [...(binding.bindingIds || [])]
              if (!bindingIds.includes(dragItem.id)) {
                bindingIds.push(dragItem.id)
              }
              return { ...binding, bindingIds, childrenOrder: newOrder }
            }
          }
          
          return binding
        })
      })
      
      // Calculate new order for message
      const newChildrenOrder = [...effectiveChildrenOrder]
      newChildrenOrder.splice(dropTarget.position.index, 0, dragItem.id)
      
      console.log('[DROP] newChildrenOrder:', newChildrenOrder)
      
      const sortingBitrixIds = computeSortingBitrixIds(newChildrenOrder)
      
      console.log('[DROP] Sending LEVEL request:', {
        fromParentId: dragItem.sourceBindingId,
        detailId: draggedBitrixId,
        toParentId: dropTarget.bindingId,
        sorting: sortingBitrixIds
      })
      
      postMessageBridge.sendChangeDetailLevelRequest({
        fromParentId: dragItem.sourceBindingId,
        detailId: draggedBitrixId,
        toParentId: dropTarget.bindingId,
        sorting: sortingBitrixIds
      })
    }
  }, [details, bindings, setBindings, findElementBitrixId, getEffectiveChildrenOrder, computeSortingBitrixIds, findBindingByBitrixId])

  // Register the handleDrop callback with the DragContext
  useEffect(() => {
    dragContext.setOnDrop(handleDrop)
  }, [handleDrop, dragContext])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SidebarMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} bitrixMeta={bitrixMeta} />
      
      <DragOverlay />
      
      <div className="w-full flex flex-col min-h-screen">
        <header className="border-b border-border bg-card" data-pwcode="header">
          <HeaderSection
            onOpenMenu={() => setIsMenuOpen(true)}
            bitrixMeta={bitrixMeta}
            onCreateDetail={handleCreateDetail}
            onSelectDetail={handleSelectDetail}
          />
        </header>

        <main 
          className="flex-1 p-4 overflow-auto"
          onDragOver={handleMainAreaDragOver}
          onDrop={handleMainAreaDrop}
          data-pwcode="mainarea"
        >
         
          <div className="space-y-0">
            {dragContext.dragState.isDragging && allItems.length > 0 && (
              <div 
                ref={(el) => { if (el) dropZoneRefs.current.set(0, el) }}
                className={cn(
                  "border-2 border-dashed rounded-lg flex items-center justify-center mb-2 transition-all",
                  dragContext.dragState.dropTargetBindingId === null && dragContext.dragState.dropTargetIndex === 0 
                    ? "border-accent bg-accent/10" 
                    : "border-border bg-muted/30"
                )}
                style={{ height: '43px' }}
              >
                <p className={cn(
                  "text-center text-sm",
                  dragContext.dragState.dropTargetBindingId === null && dragContext.dragState.dropTargetIndex === 0 
                    ? "text-accent-foreground font-medium" 
                    : "text-muted-foreground"
                )}>
                  Перетащите деталь сюда
                </p>
              </div>
            )}
            
            {allItems.map((item, index) => {
              const isDraggingThis = dragContext.dragState.isDragging && dragContext.dragState.draggedItemId === item.id
              
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
                    isDragging={isDraggingThis}
                    bitrixMeta={bitrixMeta}
                    onValidationMessage={addInfoMessage}
                    isTopLevel={true}
                    parentBindingId={null}
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
                    onDelete={() => handleDeleteBinding(item.id)}
                    onUpdateDetail={handleUpdateDetail}
                    onUpdateBinding={handleUpdateBinding}
                    onDeleteDetail={handleDeleteDetail}
                    onDeleteBinding={handleDeleteBinding}
                    orderNumber={index + 1}
                    detailStartIndex={0}
                    isDragging={isDraggingThis}
                    bitrixMeta={bitrixMeta}
                    onValidationMessage={addInfoMessage}
                    isTopLevel={true}
                    parentBindingId={null}
                  />
                )}
                
                {dragContext.dragState.isDragging && (
                  <div 
                    ref={(el) => { if (el) dropZoneRefs.current.set(index + 1, el) }}
                    className={cn(
                      "border-2 border-dashed rounded-lg flex items-center justify-center my-2 transition-all",
                      dragContext.dragState.dropTargetBindingId === null && dragContext.dragState.dropTargetIndex === index + 1 
                        ? "border-accent bg-accent/10" 
                        : "border-border bg-muted/30"
                    )}
                    style={{ height: '43px' }}
                  >
                    <p className={cn(
                      "text-center text-sm",
                      dragContext.dragState.dropTargetBindingId === null && dragContext.dragState.dropTargetIndex === index + 1 
                        ? "text-accent-foreground font-medium" 
                        : "text-muted-foreground"
                    )}>
                      Перетащите деталь сюда
                    </p>
                  </div>
                )}
                
                {index < allItems.length - 1 && !dragContext.dragState.isDragging && (
                  <div className="flex justify-center -my-3 z-10 relative" style={{ marginTop: '-12px', marginBottom: '-12px' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full h-8 w-8 p-0 bg-background hover:bg-accent hover:text-accent-foreground relative z-10 border border-border shadow-sm"
                      onClick={() => handleCreateBinding(index)}
                      data-pwcode="btn-create-binding"
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

        <PricePanel
          priceTypes={bitrixMeta?.priceTypes}
          presetPrices={bitrixMeta?.preset?.prices}
          presetId={bitrixMeta?.preset?.id}
          defaultExtraCurrency={bitrixMeta?.context?.defaultExtraCurrency}
          defaultExtraValue={bitrixMeta?.context?.defaultExtraValue}
        />

        <VariantsFooter
          selectedOffers={selectedOffers}
          addInfoMessage={addInfoMessage}
          bitrixMeta={bitrixMeta}
        />

        <footer className="border-t border-border bg-card p-3" data-pwcode="footer">
          <div className="flex items-center justify-between gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleOpenPreset}
              data-pwcode="btn-preset"
              title="Открыть пресет в Bitrix"
            >
              <FileText className="w-4 h-4 mr-2" />
              Пресет
            </Button>
            <div className="flex items-center gap-2">
              {hasSuccessfulCalculations && (
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={handleSaveCalculations}
                  data-pwcode="btn-save-calc"
                  title="Сохранить расчёты (успешные предложения)"
                >
                  <FloppyDisk className="w-4 h-4 mr-2" />
                  Сохранить расчёты
                </Button>
              )}
              {canCalculate && (
                <Button 
                  size="sm" 
                  onClick={handleCalculation} 
                  disabled={isCalculating}
                  data-pwcode="btn-calc"
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Рассчитать
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClose}
                data-pwcode="btn-close"
              >
                <X className="w-4 h-4 mr-2" />
                Закрыть
              </Button>
            </div>
          </div>
        </footer>

        <InfoPanel
          messages={infoMessages}
          isExpanded={isInfoPanelExpanded}
          onToggle={() => setIsInfoPanelExpanded(!isInfoPanelExpanded)}
        />
      </div>
      
      {/* Dialog: Create Detail */}
      <Dialog open={isCreateDetailDialogOpen} onOpenChange={setIsCreateDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создание новой детали</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="detail-name">Название</Label>
            <Input
              id="detail-name"
              value={newDetailName}
              onChange={(e) => setNewDetailName(e.target.value)}
              placeholder={`Деталь #${detailCounter.current}`}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDetailDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateDetailConfirm}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Delete Stage */}
      <AlertDialog open={isDeleteStageDialogOpen} onOpenChange={setIsDeleteStageDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите удаление этапа</AlertDialogTitle>
            <AlertDialogDescription>
              Этап будет удалён. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStageConfirm}>
              Подтверждаю
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Удаление из скрепления с 2 деталями */}
      <AlertDialog open={isRemoveFromBindingDialogOpen} onOpenChange={setIsRemoveFromBindingDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление детали</AlertDialogTitle>
            <AlertDialogDescription>
              Данное действие приведёт к удалению скрепления. Продолжить?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelRemoveFromBinding}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemoveFromBinding}>
              Продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Select Detail Action */}
      <AlertDialog open={isSelectDetailDialogOpen} onOpenChange={setIsSelectDetailDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectDetailDialogMode === 'create' ? 'Создание детали' : 'Выбор детали'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectDetailDialogMode === 'create' 
                ? 'Заменить существующие детали или добавить в скрепление?'
                : 'Заменить деталь или создать скрепление из деталей?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <Button variant="outline" onClick={handleSelectDetailReplace}>
              {selectDetailDialogMode === 'create' ? 'Заменить существующие' : 'Заменить'}
            </Button>
            <Button onClick={handleSelectDetailBinding}>
              {selectDetailDialogMode === 'create' ? 'Добавить в скрепление' : 'Создать скрепление'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Create Group */}
      <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создание группы скрепления</DialogTitle>
            <DialogDescription>
              Введите название группы для объединения деталей
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="group-name">Название группы</Label>
            <Input
              id="group-name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Группа скрепления #1"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateGroupDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => {
              const name = newGroupName.trim() || 'Группа скрепления #1'
              
              // Send ADD_GROUP_REQUEST
              if (bitrixMeta) {
                postMessageBridge.sendAddGroupRequest({
                  name: name,
                  detailIds: groupDetailsToMerge,
                  ...getIblockInfo('CALC_DETAILS')!,
                })
              }
              
              setIsCreateGroupDialogOpen(false)
              toast.info('Запрос на создание группы отправлен...')
            }}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AppWrapper() {
  return (
    <DragProvider>
      <App />
    </DragProvider>
  )
}

export default AppWrapper
