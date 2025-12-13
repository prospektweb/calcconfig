export interface ConfigStore {
  get<T = any>(key: string): Promise<T | undefined>
  set<T = any>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
  getOrSetDefault<T = any>(key: string, defaultValue: T): Promise<T>
}

async function loadSparkKV() {
  const deployTarget = getDeployTarget()

  if (deployTarget !== 'spark') {
    return null
  }

  if (typeof window === 'undefined') return null

  if (!window.spark?.kv) {
    try {
      await import('@github/spark/spark')
    } catch (error) {
      console.error('[loadSparkKV] Failed to load Spark SDK', error)
      return null
    }
  }

  return window.spark?.kv ?? null
}

class SparkConfigStore implements ConfigStore {
  async get<T = any>(key: string): Promise<T | undefined> {
    const kv = await loadSparkKV()
    if (!kv) return undefined
    return await kv.get<T>(key)
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    const kv = await loadSparkKV()
    if (!kv) return
    await kv.set(key, value)
  }

  async delete(key: string): Promise<void> {
    const kv = await loadSparkKV()
    if (!kv) return
    await kv.delete(key)
  }

  async keys(): Promise<string[]> {
    const kv = await loadSparkKV()
    if (!kv) return []
    return await kv.keys()
  }

  async getOrSetDefault<T = any>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key)
    if (value === undefined) {
      await this.set(key, defaultValue)
      return defaultValue
    }
    return value
  }
}

const DEMO_OFFERS = [
  {
    id: 999,
    productId: 998,
    name: "Демо ТП: A4 (210×297мм), 100 экз.",
    fields: { width: 210, height: 297, length: 210, weight: 500 },
    prices: [{ type: "BASE", value: 2500, currency: "RUB" }],
    properties: { VOLUME: "100 экз.", FORMAT: "A4", COLOR_SCHEME: "4+4", CML2_LINK: "998" }
  },
  {
    id: 1000,
    productId: 998,
    name: "Демо ТП: A5 (148×210мм), 50 экз.",
    fields: { width: 148, height: 210, length: 148, weight: 250 },
    prices: [{ type: "BASE", value: 1500, currency: "RUB" }],
    properties: { VOLUME: "50 экз.", FORMAT: "A5", COLOR_SCHEME: "4+0", CML2_LINK: "998" }
  }
]

class BitrixConfigStore implements ConfigStore {
  private storage: Map<string, any> = new Map()
  private initData: Record<string, any> | null = null
  private defaults: Record<string, any> = {}
  private initialized: boolean = false

  constructor() {
    this.initializeDefaults()
  }

  private initializeDefaults() {
    this.defaults = {
      'calc_header_tabs': {
        materials: [],
        operations: [],
        equipment: [],
        details: [],
      },
      'calc_details': [],
      'calc_bindings': [],
      'calc_costing_settings': {
        basedOn: 'COMPONENT_PURCHASE',
        roundingStep: 1,
        markupValue: 0,
        markupUnit: 'RUB',
      },
      'calc_sale_prices_settings': {
        selectedTypes: [],
        types: {},
      },
    }
  }

  setInitData(data: Record<string, any>) {
    this.initData = data
    this.initialized = true
    
    const isDebug = isDebugEnabled()
    if (isDebug) {
      console.info('[BitrixConfigStore] INIT data applied')
    }
    
    if (data.config?.data) {
      if (data.config.data.details) {
        this.storage.set('calc_details', data.config.data.details)
      }
      if (data.config.data.bindings) {
        this.storage.set('calc_bindings', data.config.data.bindings)
      }
      if (data.config.data.costingSettings) {
        this.storage.set('calc_costing_settings', data.config.data.costingSettings)
      }
      if (data.config.data.salePricesSettings) {
        this.storage.set('calc_sale_prices_settings', data.config.data.salePricesSettings)
      }
    }
  }
  
  reset() {
    this.storage.clear()
    this.initData = null
    this.initialized = false
    
    const isDebug = isDebugEnabled()
    if (isDebug) {
      console.info('[BitrixConfigStore] Storage reset')
    }
  }

  isInitialized(): boolean {
    return this.initialized
  }

  async get<T = any>(key: string): Promise<T | undefined> {
    if (this.storage.has(key)) {
      return this.storage.get(key) as T
    }
    
    if (this.initData && key in this.initData) {
      return this.initData[key] as T
    }
    
    return undefined
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    this.storage.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key)
  }

  async keys(): Promise<string[]> {
    const allKeys = new Set<string>()
    this.storage.forEach((_, key) => allKeys.add(key))
    if (this.initData) {
      Object.keys(this.initData).forEach(key => allKeys.add(key))
    }
    Object.keys(this.defaults).forEach(key => allKeys.add(key))
    return Array.from(allKeys)
  }

  async getOrSetDefault<T = any>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key)
    
    if (value !== undefined) {
      return value
    }
    
    const defaultFromDefaults = key in this.defaults ? this.defaults[key] : undefined
    const finalValue = defaultFromDefaults !== undefined ? defaultFromDefaults : defaultValue
    
    await this.set(key, finalValue)
    return finalValue as T
  }

  getAllData(): Record<string, any> {
    const result: Record<string, any> = {}
    this.storage.forEach((value, key) => {
      result[key] = value
    })
    return result
  }
}

export type AppMode = 'DEMO' | 'BITRIX'
export type OffersSource = 'DEMO' | 'INIT'

let currentAppMode: AppMode = 'DEMO'
let modeSetByInit = false

export function getDeployTarget(): 'bitrix' | 'spark' {
  if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DEPLOY_TARGET) {
    const target = import.meta.env.VITE_DEPLOY_TARGET as string
    return target as 'bitrix' | 'spark'
  }
  
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('deploy') === 'bitrix') {
      return 'bitrix'
    }
  }
  
  return 'spark'
}

export function getAppMode(): AppMode {
  return currentAppMode
}

export function setAppMode(mode: AppMode) {
  const isDebug = typeof localStorage !== 'undefined' && localStorage.getItem('pwrt_debug') === '1'
  
  if (isDebug) {
    console.info('[MODE]', mode)
  }
  
  currentAppMode = mode
  
  if (mode === 'BITRIX') {
    modeSetByInit = true
  }
}

export function isDebugEnabled(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem('pwrt_debug') === '1'
}

export function getDemoOffers() {
  return DEMO_OFFERS
}

let configStoreInstance: ConfigStore | null = null
let bitrixStoreInstance: BitrixConfigStore | null = null

export function createConfigStore(): ConfigStore {
  const deployTarget = getDeployTarget()

  if (deployTarget === 'bitrix') {
    if (!bitrixStoreInstance) {
      bitrixStoreInstance = new BitrixConfigStore()
    }
    configStoreInstance = bitrixStoreInstance
  } else {
    configStoreInstance = new SparkConfigStore()
  }

  return configStoreInstance
}

export function getConfigStore(): ConfigStore {
  const deployTarget = getDeployTarget()

  if (!configStoreInstance) {
    return createConfigStore()
  }

  if (deployTarget === 'bitrix' && configStoreInstance !== bitrixStoreInstance) {
    return createConfigStore()
  }

  if (deployTarget === 'spark' && configStoreInstance === bitrixStoreInstance) {
    return createConfigStore()
  }

  return configStoreInstance
}

export function getBitrixStore(): BitrixConfigStore | null {
  return bitrixStoreInstance
}

export function initializeBitrixStore(initData: Record<string, any>) {
  if (bitrixStoreInstance) {
    bitrixStoreInstance.setInitData(initData)
  }
}

export function clearDemoStorage() {
  if (typeof localStorage === 'undefined') return
  
  const keysToRemove = [
    'calc_header_tabs',
    'calc_active_header_tab',
    'calc_header_height',
    'calc_info_panel_expanded',
  ]
  
  keysToRemove.forEach(key => localStorage.removeItem(key))
  
  const isDebug = isDebugEnabled()
  if (isDebug) {
    console.info('[clearDemoStorage] Demo localStorage keys cleared')
  }
}

export function resetBitrixStore() {
  if (bitrixStoreInstance) {
    bitrixStoreInstance.reset()
  }
}
