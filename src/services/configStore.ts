export interface ConfigStore {
  get<T = any>(key: string): Promise<T | undefined>
  set<T = any>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
  getOrSetDefault<T = any>(key: string, defaultValue: T): Promise<T>
}

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

export function isDebugEnabled(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem('pwrt_debug') === '1'
}

let bitrixStoreInstance: BitrixConfigStore | null = null

export function createConfigStore(): ConfigStore {
  if (!bitrixStoreInstance) {
    bitrixStoreInstance = new BitrixConfigStore()
  }
  return bitrixStoreInstance
}

export function getConfigStore(): ConfigStore {
  if (!bitrixStoreInstance) {
    return createConfigStore()
  }
  return bitrixStoreInstance
}

export function getBitrixStore(): BitrixConfigStore | null {
  return bitrixStoreInstance
}

export function initializeBitrixStore(initData: Record<string, any>) {
  if (bitrixStoreInstance) {
    bitrixStoreInstance.setInitData(initData)
  }
}
