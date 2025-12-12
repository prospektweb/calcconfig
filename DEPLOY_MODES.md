# Режимы развёртывания приложения

## Два независимых режима

Приложение работает в одном из двух режимов:

### 1. DEMO режим (Spark)

**Когда используется:**
- При обычном запуске в Spark (без Bitrix-родителя)
- Для локальной разработки и тестирования

**Характеристики:**
- Используются демо-данные (торговые предложения, конфигурации)
- Spark KV доступен и может использоваться для персистентности
- Запросы к `/_spark/*` разрешены
- UI показывает MODE: DEMO, OFFERS: DEMO

**Демо-данные включают:**
- 2 торговых предложения с базовыми характеристиками
- Пустые конфигурации (детали, скрепления)
- Дефолтные настройки себестоимости и цен

**Кнопка "Simulate INIT":**
- Доступна только в DEMO режиме
- Позволяет протестировать применение INIT без реального Bitrix backend
- Подменяет демо-офферы на симулированные данные из INIT
- После симуляции: MODE: DEMO, OFFERS: INIT

---

### 2. BITRIX режим (Production)

**Когда используется:**
- При деплое в Bitrix iframe
- Build с флагом `VITE_DEPLOY_TARGET=bitrix`

**Характеристики:**
- НЕТ демо-данных после получения INIT
- НЕТ запросов к `/_spark/*` (полностью отключены)
- Весь UI строится на данных из INIT.payload
- Spark KV заменён на in-memory хранилище (BitrixConfigStore)
- UI показывает MODE: BITRIX, OFFERS: DEMO (до INIT) → OFFERS: INIT (после)

**Источники данных:**
- INIT payload от Bitrix-родителя (postMessage)
- Hardcoded дефолты в коде (если INIT не содержит конфиг)
- In-memory состояние React

**Важно:** 
- Никаких сетевых запросов к Spark backend
- Все изменения сохраняются только через SAVE_REQUEST → Bitrix

---

## Определение режима

### Build-time флаг (приоритет)

```bash
# BITRIX режим
VITE_DEPLOY_TARGET=bitrix npm run build

# DEMO режим (по умолчанию)
npm run build
```

### Runtime определение

В коде:
```typescript
import { getAppMode, getDeployTarget } from '@/services/configStore'

const mode = getAppMode() // 'DEMO' | 'BITRIX'
const target = getDeployTarget() // 'spark' | 'bitrix'
```

Приоритеты:
1. `import.meta.env.VITE_DEPLOY_TARGET` (build-time)
2. URL query parameter `?deploy=bitrix` (fallback)
3. По умолчанию: 'spark' (DEMO)

---

## Отключение Spark KV в BITRIX build

### Архитектура

**Абстракция хранилища:** `ConfigStore` интерфейс
- `get<T>(key): Promise<T>`
- `set<T>(key, value): Promise<void>`
- `delete(key): Promise<void>`
- `getOrSetDefault<T>(key, defaultValue): Promise<T>`

**Две реализации:**

1. **SparkConfigStore** (DEMO режим)
   - Использует `window.spark.kv.*`
   - Делает запросы к `/_spark/kv/*`
   - Асинхронная загрузка через `loadSparkKV()`

2. **BitrixConfigStore** (BITRIX режим)
   - In-memory хранилище (Map)
   - Инициализируется дефолтами
   - Заполняется из INIT.payload
   - НЕТ сетевых запросов

### Фабрика хранилища

```typescript
export function createConfigStore(): ConfigStore {
  const deployTarget = getDeployTarget()
  
  if (deployTarget === 'bitrix') {
    return new BitrixConfigStore()
  } else {
    return new SparkConfigStore()
  }
}
```

### useConfigKV hook

Hook работает с абстракцией и не знает о конкретной реализации:

```typescript
export function useConfigKV<T>(key: string, defaultValue: T) {
  const store = getConfigStore() // автоматически выбирает реализацию
  
  // ... работа через store.get / store.set
}
```

### Гарантии для BITRIX build

✅ Spark KV код не попадает в критический путь (динамическая загрузка)  
✅ Никаких `fetch("/_spark/*")` запросов  
✅ Никаких ошибок "Failed to set default value for key"  
✅ Все дефолты захардкожены в BitrixConfigStore  

---

## Протокол INIT

### Приём INIT (только BITRIX режим)

```typescript
postMessageBridge.on('INIT', (message) => {
  const payload = message.payload as InitPayload
  
  console.info('[INIT] received', payload)
  
  // 1. Сохранить meta
  setBitrixMeta(payload)
  
  // 2. Заменить offers
  setSelectedOffers(payload.selectedOffers)
  setOffersSource('INIT')
  
  console.info('[INIT] applied offers=', payload.selectedOffers.length)
  
  // 3. Инициализировать store
  initializeBitrixStore(payload)
  
  // 4. Применить конфиг (если есть)
  if (payload.config?.data) {
    setDetails(payload.config.data.details)
    setBindings(payload.config.data.bindings)
    // ...
  }
  
  // 5. Подтвердить готовность
  postMessageBridge.sendInitDone(payload.mode, payload.selectedOffers.length)
})
```

### Структура INIT.payload

```typescript
{
  mode: "NEW_CONFIG" | "EXISTING_CONFIG",
  context: {
    siteId: "s1",
    userId: "1",
    lang: "ru",
    url: "https://prospektprint.ru/",
    timestamp: 1765536402
  },
  iblocks: {
    products: 16,
    offers: 17,
    calcDetailsVariants: 100,
    calcMaterialsVariants: 95,
    calcOperationsVariants: 97,
    calcEquipment: 98
  },
  iblocksTypes: {
    "16": "catalog",
    "17": "offers",
    "100": "calculator_catalog",
    "95": "calculator_catalog",
    "97": "calculator_catalog",
    "98": "calculator_catalog"
  },
  selectedOffers: [
    {
      id: 215,
      productId: 213,
      name: "...",
      fields: { width: 74, height: 8, length: 105, weight: 70 },
      prices: [{ type: "BASE", value: 1152, currency: "RUB" }],
      properties: { VOLUME: "50 экз.", FORMAT: "A7 74×105мм", ... }
    }
  ],
  config?: {
    id: 123,
    name: "Конфигурация №123",
    data: {
      details: [...],
      bindings: [...],
      costingSettings: {...},
      salePricesSettings: {...}
    }
  }
}
```

---

## Визуальный индикатор режима

**Расположение:** правый верхний угол (fixed position)

**Содержимое:**
```
MODE: DEMO | BITRIX
OFFERS: DEMO | INIT
```

**Цвета:**
- MODE: BITRIX → accent
- MODE: DEMO → primary
- OFFERS: INIT → success
- OFFERS: DEMO → muted

**Кнопка "Simulate INIT":**
- Видна только в DEMO режиме И когда OFFERS: DEMO
- Скрывается после симуляции

---

## Проверка режимов

### DEMO режим (локальная разработка)

```bash
npm run dev
```

Ожидается:
- ✅ MODE: DEMO
- ✅ OFFERS: DEMO (2 демо-оффера видны)
- ✅ Кнопка "Simulate INIT" видна
- ✅ После клика: OFFERS: INIT (1 симулированный оффер)
- ✅ Запросы к `/_spark/kv/*` в Network (разрешены)

### BITRIX режим (продакшен)

```bash
VITE_DEPLOY_TARGET=bitrix npm run build
npm run preview
```

Ожидается:
- ✅ MODE: BITRIX
- ✅ OFFERS: DEMO (изначально пусто, если INIT не пришёл)
- ✅ Кнопки "Simulate INIT" НЕТ
- ✅ После INIT от Bitrix: OFFERS: INIT
- ✅ В Network НЕТ запросов к `/_spark/*`
- ✅ В Console НЕТ ошибок "Failed to set default value for key"
- ✅ Логи: `[MODE] BITRIX`, `[INIT] received`, `[INIT] applied offers=N`

---

## Build команды

### Development (DEMO)
```bash
npm run dev
```

### Production DEMO (Spark)
```bash
npm run build
```

### Production BITRIX
```bash
VITE_DEPLOY_TARGET=bitrix npm run build
```

Результат: `dist/` содержит статический HTML/JS/CSS без зависимостей от Spark backend

---

## Troubleshooting

### Проблема: Ошибки "Failed to set default value for key"
**Причина:** Запущен BITRIX режим, но код пытается использовать Spark KV  
**Решение:** Проверить `VITE_DEPLOY_TARGET`, пересобрать с правильным флагом

### Проблема: Запросы к /_spark/* в BITRIX режиме
**Причина:** Неправильная инициализация ConfigStore  
**Решение:** Убедиться что `getDeployTarget()` возвращает 'bitrix'

### Проблема: Демо-данные не исчезают после INIT
**Причина:** `setOffersSource('INIT')` не вызывается  
**Решение:** Проверить обработчик INIT в useEffect

### Проблема: MODE показывает неправильное значение
**Причина:** Env переменная не передаётся в build  
**Решение:** Использовать `VITE_` префикс для Vite env vars

---

## Документация кода

**Файлы:**
- `src/services/configStore.ts` - фабрика и реализации хранилищ
- `src/hooks/use-config-kv.ts` - React hook для работы с конфигом
- `src/App.tsx` - обработка INIT, визуальный индикатор, симуляция

**Ключевые функции:**
- `getDeployTarget()` - определяет режим из env/query
- `getAppMode()` - возвращает 'DEMO' | 'BITRIX'
- `getDemoOffers()` - демо торговые предложения
- `createConfigStore()` - фабрика для создания правильного store
- `initializeBitrixStore(payload)` - применяет INIT к BitrixConfigStore

**pwcode атрибуты:**
- `pwcode="btn-simulate-init"` - кнопка симуляции INIT
- Все остальные pwcode остались без изменений

---

## Расширение

При добавлении новых ключей конфига:

1. Добавить дефолт в `BitrixConfigStore.initializeDefaults()`
2. Добавить маппинг в `BitrixConfigStore.setInitData()` (если приходит из INIT)
3. Использовать через `useConfigKV(key, defaultValue)`

При изменении протокола INIT:

1. Обновить `InitPayload` тип в `src/lib/postmessage-bridge.ts`
2. Обновить обработчик в `App.tsx`
3. Обновить mock в `handleSimulateInit()`
4. Обновить эту документацию

---

## Итоговая проверка перед деплоем

**BITRIX build checklist:**

- [ ] `VITE_DEPLOY_TARGET=bitrix npm run build` выполняется без ошибок
- [ ] `dist/` содержит только статические файлы
- [ ] При открытии в браузере: MODE: BITRIX
- [ ] В Network НЕТ запросов к `/_spark/*`
- [ ] В Console НЕТ ошибок связанных с Spark KV
- [ ] INIT обработчик регистрируется (проверить через DevTools → Sources)
- [ ] После postMessage INIT: офферы заменяются, логи корректны

**DEMO build checklist:**

- [ ] `npm run build` (без env) выполняется
- [ ] При запуске: MODE: DEMO, OFFERS: DEMO
- [ ] Демо-офферы (2 шт) видны в футере
- [ ] Кнопка "Simulate INIT" работает
- [ ] После симуляции: OFFERS: INIT, 1 оффер

---

*Документация актуальна на момент внедрения двух режимов развёртывания.*
