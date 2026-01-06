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
  createEmptyStage,
  getIblockByCode
} from '@/lib/types'
import { transformPresetToUI } from '@/lib/bitrix-to-ui-transformer'
import { HeaderSection } from '@/components/calculator/HeaderSection'
import { VariantsFooter } from '@/components/calculator/VariantsFooter'
import { DetailCard } from '@/components/calculator/DetailCard'
import { BindingCard } from '@/components/calculator/BindingCard'
import { InfoPanel } from '@/components/calculator/InfoPanel'
import { PricePanel } from '@/components/calculator/PricePanel'
import { SidebarMenu } from '@/components/calculator/SidebarMenu'
import { useCustomDrag } from '@/hooks/use-custom-drag'
import { initializeBitrixStore, getBitrixStore } from '@/services/configStore'
import { postMessageBridge, InitPayload, CalcInfoPayload, CalcSettingsResponsePayload, CalcOperationResponsePayload, CalcMaterialResponsePayload, CalcOperationVariantResponsePayload, CalcMaterialVariantResponsePayload, SyncVariantsRequestPayload, SyncVariantsResponsePayload } from '@/lib/postmessage-bridge'
import { setBitrixContext, openBitrixAdmin, getBitrixContext } from '@/lib/bitrix-utils'
import { useReferencesStore } from '@/stores/references-store'
import { useCalculatorSettingsStore } from '@/stores/calculator-settings-store'
import { useOperationSettingsStore } from '@/stores/operation-settings-store'
import { useMaterialSettingsStore } from '@/stores/material-settings-store'
import { useOperationVariantStore } from '@/stores/operation-variant-store'
import { useMaterialVariantStore } from '@/stores/material-variant-store'
import { transformBitrixTreeSelectElement, transformBitrixTreeSelectChild } from '@/lib/bitrix-transformers'

type DragItem = {
  type: 'detail' | 'binding'
  index: number
  id: string
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
  const [isDeleteStageDialogOpen, setIsDeleteStageDialogOpen] = useState(false)
  const [stageToDelete, setStageToDelete] = useState<{detailId: string, calcIndex: number} | null>(null)
  const [isDeleteDetailDialogOpen, setIsDeleteDetailDialogOpen] = useState(false)
  const [detailToDelete, setDetailToDelete] = useState<string | null>(null)
  const [isDeleteGroupDialogOpen, setIsDeleteGroupDialogOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<any>(null)
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false)
  const [groupDetailsToMerge, setGroupDetailsToMerge] = useState<(number | string)[]>([])
  const [newGroupName, setNewGroupName] = useState('')
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

  const { dragState, startDrag, setDropTarget, endDrag, cancelDrag } = useCustomDrag()
  const dropZoneRefs = useRef<Map<number, HTMLElement>>(new Map())

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
        settingsStore.setSettings(settingsItem.id. toString(), {
          id: settingsItem.id,
          name: settingsItem.name,
          properties: settingsItem.properties || {},
          customFields: settingsItem.customFields,  // <-- добавить
        })
      })
      console.log(`[${source}] Calculator settings loaded successfully`)
    }
  }, [])

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
        
        // Transform preset and elementsStore to UI format
        if (message.payload.preset && message.payload.elementsStore) {
          console.log('[INIT] Transforming preset and elementsStore to UI format')
          try {
            const { details: transformedDetails, bindings: transformedBindings } = transformPresetToUI(
              message.payload.preset,
              message.payload.elementsStore
            )
            
            if (transformedDetails.length > 0 || transformedBindings.length > 0) {
              setDetails(transformedDetails)
              setBindings(transformedBindings)
              console.log('[INIT] Transformed data:', { 
                details: transformedDetails.length, 
                bindings: transformedBindings.length 
              })
            }
          } catch (error) {
            console.error('[INIT] Transformation error:', error)
          }
          
          // Initialize calculatorSettings store from elementsStore.CALC_SETTINGS
          initializeCalculatorSettings(message.payload.elementsStore, 'INIT')
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
              const { details: transformedDetails, bindings: transformedBindings } = transformPresetToUI(
                refreshPayload.preset,
                refreshPayload.elementsStore
              )
              
              if (transformedDetails.length > 0 || transformedBindings.length > 0) {
                setDetails(transformedDetails)
                setBindings(transformedBindings)
                console.log('[REFRESH] Transformed data:', { 
                  details: transformedDetails.length, 
                  bindings: transformedBindings.length 
                })
              }
            } catch (error) {
              console.error('[REFRESH] Transformation error:', error)
            }
            
            // Initialize calculatorSettings store from elementsStore.CALC_SETTINGS
            initializeCalculatorSettings(refreshPayload.elementsStore, 'REFRESH')
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

    const unsubscribeSyncVariants = postMessageBridge.on('SYNC_VARIANTS_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] SYNC_VARIANTS_RESPONSE', message)
      
      if (!message.payload) return
      
      const payload = message.payload as SyncVariantsResponsePayload
      
      // Update bitrixId for details and bindings
      if (payload.items) {
        payload.items.forEach((syncItem) => {
          if (syncItem.type === 'detail') {
            setDetails(prev => 
              (prev || []).map(d => 
                d.id === syncItem.id 
                  ? { 
                      ...d, 
                      bitrixId: syncItem.bitrixId,
                      stages: d.stages.map(stage => {
                        const syncStage = syncItem.calculators.find(sc => sc.id === stage.id)
                        return syncStage ? { ...stage, configId: syncStage.configId } : stage
                      })
                    }
                  : d
              )
            )
          } else if (syncItem.type === 'binding') {
            setBindings(prev => 
              (prev || []).map(b => 
                b.id === syncItem.id 
                  ? { 
                      ...b, 
                      bitrixId: syncItem.bitrixId,
                      stages: b.stages.map(stage => {
                        const syncStage = syncItem.calculators.find(sc => sc.id === stage.id)
                        return syncStage ? { ...stage, configId: syncStage.configId } : stage
                      })
                    }
                  : b
              )
            )
          }
        })
      }
      
      // Update canCalculate state
      setCanCalculate(payload.canCalculate)
      
      // Show toast with result
      if (payload.status === 'ok') {
        toast.success(`Успешно обновлено: деталей создано ${payload.stats.detailsCreated}, обновлено ${payload.stats.detailsUpdated}, конфигураций создано ${payload.stats.configsCreated}`)
      } else if (payload.status === 'partial') {
        toast.warning(`Частично обновлено с ошибками. Деталей создано ${payload.stats.detailsCreated}, обновлено ${payload.stats.detailsUpdated}`)
        if (payload.errors) {
          payload.errors.forEach(err => {
            addInfoMessage('error', `Ошибка: ${err.message}`)
          })
        }
      } else {
        toast.error('Ошибка при обновлении связей')
        if (payload.errors) {
          payload.errors.forEach(err => {
            addInfoMessage('error', `Ошибка: ${err.message}`)
          })
        }
      }
    })

    const unsubscribeAddNewDetail = postMessageBridge.on('ADD_NEW_DETAIL_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] ADD_NEW_DETAIL_RESPONSE', message)
      
      if (!message.payload?.detail) return
      
      const bitrixDetail = message.payload.detail
      
      // Transform Bitrix data to Detail format
      const newDetail: Detail = {
        id: `detail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: bitrixDetail.name || 'Новая деталь',
        width: bitrixDetail.width ?? 210,
        length: bitrixDetail.length ?? 297,
        isExpanded: true,
        stages: bitrixDetail.stages || [createEmptyStage()],
        bitrixId: typeof bitrixDetail.id === 'number' ? bitrixDetail.id : parseInt(bitrixDetail.id, 10) || null,
      }
      
      setDetails(prev => {
        const updated = [...(prev || []), newDetail]
        
        // If now 2 details and no group - create group
        if (updated.length === 2 && bindings.length === 0) {
          setGroupDetailsToMerge(updated.map(d => d.bitrixId || d.id))
          setNewGroupName('')
          setIsCreateGroupDialogOpen(true)
        }
        
        return updated
      })
      
      toast.success(`Деталь "${newDetail.name}" создана`)
    })

  const unsubscribeSelectDetails = postMessageBridge.on('SELECT_DETAILS_RESPONSE', (message) => {
    console.info('[FROM_BITRIX] SELECT_DETAILS_RESPONSE', message)
    
    const items = message. payload?.items || []
    
    if (items.length === 0) {
      toast.info('Детали не выбраны')
      return
    }
    
    const selectedDetail = items[0]
    const currentBitrixMeta = bitrixMetaRef.current
    
    if (currentBitrixMeta && selectedDetail?. id) {
      postMessageBridge. sendUseDetailRequest({
        detailId:  selectedDetail.id,
        presetId: currentBitrixMeta. preset?.id ??  0,
      })
      console.info('[USE_DETAIL_REQUEST] sent', {
        detailId: selectedDetail.id,
        presetId:  currentBitrixMeta.preset?.id ??  0,
      })
      toast.info(`Использование детали "${selectedDetail.name}"... `)
    } else {
      console. warn('[SELECT_DETAILS_RESPONSE] Cannot send USE_DETAIL_REQUEST', {
        hasBitrixMeta:  !!currentBitrixMeta,
        detailId:  selectedDetail?.id,
      })
      toast.error('Ошибка: контекст Bitrix не инициализирован')
    }
    
    if (items.length > 1) {
      toast.info(`Выбрано ${items.length} деталей, используется первая`)
    }
  })

    const unsubscribeCopyDetail = postMessageBridge.on('COPY_DETAIL_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] COPY_DETAIL_RESPONSE', message)
      
      if (!message.payload?.detail) return
      
      const bitrixDetail = message.payload.detail
      
      // Transform Bitrix data to Detail format
      const copiedDetail: Detail = {
        id: `detail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: bitrixDetail.name || 'Копия детали',
        width: bitrixDetail.width ?? 210,
        length: bitrixDetail.length ?? 297,
        isExpanded: true,
        stages: bitrixDetail.stages || [createEmptyStage()],
        bitrixId: typeof bitrixDetail.id === 'number' ? bitrixDetail.id : parseInt(bitrixDetail.id, 10) || null,
      }
      
      setDetails(prev => [...(prev || []), copiedDetail])
      toast.success(`Деталь "${copiedDetail.name}" скопирована`)
    })

    const unsubscribeUseDetail = postMessageBridge.on('USE_DETAIL_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] USE_DETAIL_RESPONSE', message)
      
      if (!message.payload?.detail) return
      
      const bitrixDetail = message.payload.detail
      
      // Transform Bitrix data to Detail format
      const detail: Detail = {
        id: `detail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: bitrixDetail.name || 'Деталь',
        width: bitrixDetail.width ?? 210,
        length: bitrixDetail.length ?? 297,
        isExpanded: true,
        stages: bitrixDetail.stages || [createEmptyStage()],
        bitrixId: typeof bitrixDetail.id === 'number' ? bitrixDetail.id : parseInt(bitrixDetail.id, 10) || null,
      }
      
      setDetails(prev => [...(prev || []), detail])
      toast.success(`Деталь "${detail.name}" добавлена`)
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

    const unsubscribeAddNewStage = postMessageBridge.on('ADD_NEW_STAGE_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] ADD_NEW_STAGE_RESPONSE', message)
      
      toast.success('Этап создан')
    })

    const unsubscribeDeleteStage = postMessageBridge.on('DELETE_STAGE_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] DELETE_STAGE_RESPONSE', message)
      // Already handled in UI
    })

    const unsubscribeDeleteDetail = postMessageBridge.on('DELETE_DETAIL_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] DELETE_DETAIL_RESPONSE', message)
      // Already handled in UI
    })

    const unsubscribeChangeNameDetail = postMessageBridge.on('CHANGE_NAME_DETAIL_RESPONSE', (message) => {
      console.info('[FROM_BITRIX] CHANGE_NAME_DETAIL_RESPONSE', message)
      
      if (message.payload?.success) {
        toast.success('Имя детали обновлено')
      }
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
      unsubscribeSyncVariants()
      unsubscribeAddNewDetail()
      unsubscribeSelectDetails()
      unsubscribeCopyDetail()
      unsubscribeUseDetail()
      unsubscribeAddNewGroup()
      unsubscribeAddNewStage()
      unsubscribeDeleteStage()
      unsubscribeDeleteDetail()
      unsubscribeChangeNameDetail()
      unsubscribeCalcInfo()
    }
  }, [])
  
  const addInfoMessage = (type: InfoMessage['type'], message: string) => {
    const newMessage: InfoMessage = {
      id: `msg_${Date.now()}`,
      type,
      message,
      timestamp: Date.now(),
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
    setNewDetailName('')
    setIsCreateDetailDialogOpen(true)
  }

  const handleCreateDetailConfirm = async () => {
    const name = newDetailName.trim() || `Деталь #${detailCounter.current++}`
    
    console.log('[CREATE_DETAIL_REQUEST] Sending create detail request', { name, offerIds: selectedVariantIds })
    
    // Send ADD_DETAIL_REQUEST
    if (bitrixMeta && selectedVariantIds.length > 0) {
      postMessageBridge.sendAddDetailRequest({
        offerIds: selectedVariantIds,
        name: name,
        ...getIblockInfo('CALC_DETAILS')!,
      })
    }
    
    setIsCreateDetailDialogOpen(false)
    toast.info('Запрос на создание детали отправлен...')
  }

  const handleSelectDetail = () => {
    // Send SELECT_DETAILS_REQUEST to open detail selection dialog
    if (bitrixMeta) {
      postMessageBridge.sendSelectDetailsRequest({
        ...getIblockInfo('CALC_DETAILS')!,
      })
    }
    toast.info('Открытие окна выбора детали...')
  }

  const handleDeleteStageConfirm = () => {
    if (!stageToDelete) return
    
    const detail = (details || []).find(d => d.id === stageToDelete.detailId)
    const stage = detail?.stages[stageToDelete.calcIndex]
    
    console.log('[DELETE_STAGE] Deleting stage', { 
      detailId: stageToDelete.detailId, 
      calcIndex: stageToDelete.calcIndex,
      configId: stage?.configId 
    })
    
    // Find detail and remove calculator at index
    setDetails(prev => 
      (prev || []).map(d => 
        d.id === stageToDelete.detailId
          ? {
              ...d,
              stages: d.stages.filter((_, i) => i !== stageToDelete.calcIndex)
            }
          : d
      )
    )
    
    if (stage?.configId && bitrixMeta) {
      postMessageBridge.sendDeleteStageRequest({
        configId: stage.configId,
        ...(getIblockInfo('CALC_CONFIG') || { iblockId: 0, iblockType: '' }),
      })
    }
    
    setIsDeleteStageDialogOpen(false)
    setStageToDelete(null)
    toast.success('Этап удалён')
  }

  const handleDeleteDetailConfirm = () => {
    if (!detailToDelete) return
    
    const detail = (details || []).find(d => d.id === detailToDelete)
    
    console.log('[DELETE_DETAIL] Deleting detail', { 
      detailId: detailToDelete, 
      bitrixId: detail?.bitrixId 
    })
    
    // Send DELETE_DETAIL_REQUEST if has bitrixId
    if (detail?.bitrixId && bitrixMeta) {
      postMessageBridge.sendDeleteDetailRequest({
        detailId: detail.bitrixId,
        ...getIblockInfo('CALC_DETAILS')!,
      })
    }
    
    // Remove from UI
    setDetails(prev => (prev || []).filter(d => d.id !== detailToDelete))
    
    setIsDeleteDetailDialogOpen(false)
    setDetailToDelete(null)
    toast.success('Деталь удалена')
  }

  const handleDeleteGroupKeepDetail = (detailId: number | string) => {
    // Logic for keeping one detail and removing group
    if (!groupToDelete || !bitrixMeta) return
    
    // Send DELETE_GROUP_REQUEST with detailIdToKeep
    postMessageBridge.sendDeleteGroupRequest({
      groupId: groupToDelete.id,
      detailIdToKeep: detailId,
      ...getIblockInfo('CALC_DETAILS')!,
    })
    
    setIsDeleteGroupDialogOpen(false)
    setGroupToDelete(null)
    toast.info('Удаление группы...')
  }

  const handleDeleteGroupAll = () => {
    // Logic for deleting all details in group
    if (!groupToDelete || !bitrixMeta) return
    
    // Send DELETE_GROUP_REQUEST without detailIdToKeep
    postMessageBridge.sendDeleteGroupRequest({
      groupId: groupToDelete.id,
      deleteAll: true,
      ...getIblockInfo('CALC_DETAILS')!,
    })
    
    setIsDeleteGroupDialogOpen(false)
    setGroupToDelete(null)
    toast.info('Удаление группы и всех деталей...')
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

  const handleCalculation = async () => {
    setIsCalculating(true)
    setCalculationProgress(0)
    
    // Send CALC_RUN message
    postMessageBridge.sendCalcRun()
    toast.info('Расчёт запущен...')
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
    const presetIblock = bitrixMeta.iblocks.find(ib => ib.code === 'CALC_CONFIG')
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
            bitrixMeta={bitrixMeta}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SidebarMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} bitrixMeta={bitrixMeta} />
      
      {dragState.isDragging && getDraggedElement()}
      
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
                    onValidationMessage={addInfoMessage}
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
                    bitrixMeta={bitrixMeta}
                    onValidationMessage={addInfoMessage}
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
                
                {index < allItems.length - 1 && !dragState.isDragging && (
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
          settings={salePricesSettings || { selectedTypes: [], types: {} }}
          onSettingsChange={(newSettings) => setSalePricesSettings(newSettings)}
          priceTypes={bitrixMeta?.priceTypes}
          presetPrices={bitrixMeta?.preset?.prices}
          presetMeasure={bitrixMeta?.preset?.measure}
        />

        <InfoPanel
          messages={infoMessages}
          isExpanded={isInfoPanelExpanded}
          onToggle={() => setIsInfoPanelExpanded(!isInfoPanelExpanded)}
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
              <Button 
                size="sm" 
                onClick={handleCalculation} 
                disabled={isCalculating}
                data-pwcode="btn-calc"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Рассчитать
              </Button>
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

      {/* AlertDialog: Delete Detail */}
      <AlertDialog open={isDeleteDetailDialogOpen} onOpenChange={setIsDeleteDetailDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите удаление детали</AlertDialogTitle>
            <AlertDialogDescription>
              ⚠️ Деталь может использоваться в других сборках. 
              Все связанные этапы будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDetailConfirm} className="bg-destructive">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Delete Group (Choose Detail) */}
      <Dialog open={isDeleteGroupDialogOpen} onOpenChange={setIsDeleteGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удаление группы скрепления</DialogTitle>
            <DialogDescription>
              Выберите какую деталь оставить
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {groupToDelete?.detailIds?.map((detailId: number | string) => {
              const detail = details.find(d => d.id === detailId || d.bitrixId === detailId)
              return (
                <Button
                  key={detailId}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleDeleteGroupKeepDetail(detailId)}
                >
                  Оставить [{detail?.name || `ID: ${detailId}`}]
                </Button>
              )
            })}
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDeleteGroupAll}
            >
              Удалить всё
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteGroupDialogOpen(false)}>
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

export default App
