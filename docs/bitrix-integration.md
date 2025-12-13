# Документация интеграции с 1С-Битрикс

## Оглавление

1. [Общий сценарий использования](#общий-сценарий-использования)
2. [Режимы развертывания](#режимы-развертывания)
3. [Режим Bitrix Deploy (без Spark KV)](#режим-bitrix-deploy-без-spark-kv)
4. [Доменная модель](#доменная-модель)
5. [Режимы работы приложения](#режимы-работы-приложения)
6. [Протокол postMessage](#протокол-postmessage)
7. [Элементы UI (pwcode)](#элементы-ui-pwcode)
8. [Версионность протокола](#версионность-протокола)

---

## Общий сценарий использования

### Кто использует

Это приложение калькуляции для **администратора** интернет-магазина на 1С-Битрикс. Менеджеры по продажам его не видят и не используют.

### Как работает

Приложение работает **ТОЛЬКО** внутри iframe, который встраивается в админ-часть Битрикс после выбора торговых предложений и нажатия кнопки «Калькуляция».

На сервере нет никакого React/Node, есть только собранный бандл (index.html + js + css) по пути:
```
/local/apps/prospektweb.calc
```

Всё взаимодействие с Битриксом происходит через `window.postMessage`.

### Важное правило сохранения

**ДО МОМЕНТА НАЖАТИЯ КНОПКИ «Сохранить» НИЧЕГО В БИТРИКС НЕ ЗАПИСЫВАЕТСЯ.**

Все изменения внутри приложения считаются временным рабочим черновиком.

---

## Режимы развертывания

Приложение поддерживает два режима развертывания:

### 1. Spark Mode (для разработки/GitHub)

- Использует Spark KV для постоянного хранения данных
- Выполняет HTTP-запросы к `/_spark/kv/*`, `/_spark/loaded` и т.д.
- Подходит для разработки и тестирования в Spark-окружении

### 2. Bitrix Mode (для продакшн-развертывания на Bitrix)

- **НЕ использует** Spark KV
- **НЕ выполняет** HTTP-запросы к `/_spark/*`
- Использует in-memory хранилище и postMessage для обмена данными с Bitrix
- Все настройки загружаются из сообщения `INIT` или используют дефолтные значения

---

## Режим Bitrix Deploy (без Spark KV)

### Активация режима

Режим Bitrix активируется через переменную окружения:

```bash
VITE_DEPLOY_TARGET=bitrix
```

### Сборка для Bitrix

```bash
# Используя npm script
npm run build:bitrix

# Или вручную
VITE_DEPLOY_TARGET=bitrix npm run build
```

После сборки бандл находится в директории `dist/` и готов к размещению на Bitrix-сервере.

### Что НЕ происходит в Bitrix-режиме

❌ Никаких запросов к `/_spark/kv/*`  
❌ Никаких запросов к `/_spark/loaded`  
❌ Никаких вызовов `spark.kv.get`, `spark.kv.set`, `spark.kv.delete`  
❌ Никаких попыток сохранить данные на сервер до нажатия кнопки "Сохранить"  

### Откуда берутся данные и настройки

#### 1. Начальные данные (при запуске)

Данные приходят в сообщении `INIT` от Bitrix:

```typescript
{
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG',
  config?: {
    data: {
      details: Detail[],           // Детали конфигурации
      bindings: Binding[],         // Скрепления
      costingSettings: {...},      // Настройки себестоимости
      salePricesSettings: {...},   // Настройки отпускных цен
    }
  }
}
```

#### 2. Дефолтные значения (если не пришли в INIT)

Если в `INIT` не пришли какие-то настройки, используются захардкоженные дефолты:

```typescript
{
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
```

#### 3. Рабочие изменения (в процессе работы)

Все изменения сохраняются **только в памяти** (in-memory storage) до момента нажатия кнопки "Сохранить".

#### 4. Сохранение данных (при нажатии "Сохранить")

Все изменения передаются обратно в Bitrix через сообщение `SAVE_REQUEST` с полным снимком состояния.

### Абстракция ConfigStore

Для обеспечения совместимости двух режимов создан абстрактный слой `ConfigStore`:

```typescript
// src/services/configStore.ts

interface ConfigStore {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
  getOrSetDefault<T>(key: string, defaultValue: T): Promise<T>
}
```

**Реализации:**

1. `SparkConfigStore` — работает через Spark KV (для dev-режима)
2. `BitrixConfigStore` — работает через in-memory Map (для Bitrix-режима)

### React Hook для работы с настройками

Вместо прямого использования `useKV` из `@github/spark/hooks` используется универсальный хук:

```typescript
import { useConfigKV } from '@/hooks/use-config-kv'

// Аналог useKV, но работает в обоих режимах
const [details, setDetails] = useConfigKV<Detail[]>('calc_details', [])
```

### Автоматическое определение режима

Режим определяется автоматически функцией `getDeployTarget()`:

1. Проверяет `import.meta.env.VITE_DEPLOY_TARGET`
2. Проверяет URL параметр `?deploy=bitrix` (для тестирования)
3. По умолчанию возвращает `'spark'`

---

## Доменная модель

### Основные сущности

#### 1. Продукт (товар для продажи на сайте)

- Имеет свои свойства: название, описание, картинки
- Имеет **Торговые предложения** (варианты продукта для продажи)

#### 2. Торговые предложения ПРОДУКТА

- Это то, что пользователь видит на сайте как варианты товара
- С ними работает Bitrix-хост: выбирает несколько ТП и открывает калькуляцию

#### 3. Детали, Материалы, Операции, Оборудование

Это **ОТДЕЛЬНЫЕ** инфоблоки. Внутри них тоже есть товары и их торговые предложения, но они **НЕ** для продажи на сайте, а для конфигурирования продукта.

**Пример структуры:**

```
Инфоблок "Материалы"
└── Раздел "Бумага"
    └── Раздел "Мелованная бумага"
        └── Товар "Мелованная матовая бумага"
            └── ТП с плотностью 115 г/м²
            └── ТП с плотностью 200 г/м²
            └── ТП с плотностью 300 г/м²
```

Пользователь выбирает в калькуляторе эти элементы для построения конфигурации продукта.

#### 4. Инфоблок Калькуляторов

Описывает логические калькуляторы:
- "Листовая цифровая печать"
- "Офсет B3"
- "Скрепление скобой"
- "Ламинация"
- и т.п.

Каждый калькулятор имеет код (например, `DIGITAL_PRINT_SHEET`) и набор параметров.

#### 5. Инфоблок Конфигураций

Описывает результирующую конфигурацию продукта:
- какие детали участвуют
- какие материалы, операции, оборудование
- какие калькуляторы используем
- параметры, влияющие на расчёт
- связь с ПРОДАЖНЫМИ торговыми предложениями

### Важное правило по ID

**ID инфоблоков, товаров и торговых предложений ЗАВИСЯТ ОТ САЙТА.**

Нельзя ничего хардкодить. Всё, что касается ID, должно восприниматься как **"чужие opaque-идентификаторы"** — приложение только их принимает и возвращает, не предполагая структуру.

**Примеры правильного подхода:**
- ✅ `materialId: 12345` — просто число, без предположений
- ✅ `calculatorCode: "DIGITAL_PRINT"` — строковый код, может быть любым
- ❌ `if (materialId === 100)` — хардкод, зависимость от конкретного сайта

---

## Режимы работы приложения

Приложение всегда стартует в одном из двух режимов:

### Режим 1: NEW_CONFIG

**Когда активируется:**
- либо выбранные торговые предложения не имеют конфигурации
- либо у выбранных ТП конфигурации разные

**Задача:**  
Администратор собирает новую конфигурацию с нуля и позже сохраняет её.

**Что получает приложение:**
- список выбранных ПРОДАЖНЫХ торговых предложений (их ID)
- служебную информацию (siteId, userId, lang)
- справочники (инфоблок IDs для материалов, операций, оборудования, деталей, калькуляторов)

**Что НЕ получает:**
- существующую конфигурацию

### Режим 2: EXISTING_CONFIG

**Когда активируется:**
- выбраны одно или несколько ТП с одинаковой конфигурацией

**Задача:**  
Администратор может изменить конфигурацию и пересчитать параметры ТП, затем сохранить.

**Что получает приложение:**
- список выбранных ПРОДАЖНЫХ торговых предложений
- служебную информацию
- справочники
- **существующую конфигурацию** (config.data)

---

## Протокол postMessage

### Базовая форма сообщения

```typescript
interface PwrtMessage {
  source: 'prospektweb.calc' | 'bitrix'
  target: 'prospektweb.calc' | 'bitrix'
  type: MessageType
  requestId?: string
  payload?: any
  timestamp?: number
}
```

### Типы сообщений

```typescript
type MessageType = 
  | 'READY'
  | 'INIT'
  | 'INIT_DONE'
  | 'CALC_PREVIEW'
  | 'SAVE_REQUEST'
  | 'SAVE_RESULT'
  | 'ERROR'
  | 'CLOSE_REQUEST'
```

### Жизненный цикл сообщений

#### 1. READY (iframe → Битрикс)

**Когда отправляется:**  
Сразу после инициализации приложения, когда UI готов принять INIT.

**Payload:**
```typescript
{
  version: string,      // Версия протокола, например "1.0.0"
  protocol: string,     // Код протокола, например "pwrt-v1"
  timestamp: number
}
```

**Пример:**
```json
{
  "protocol": "default",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "READY",
  "payload": {
    "version": "1.0.0",
    "protocol": "pwrt-v1",
    "timestamp": 1234567890123
  }
}
```

---

#### 2. INIT (Битрикс → iframe)

**Когда отправляется:**  
После получения READY от приложения.

**Задача:**  
Передаёт стартовый контекст приложению.

**Payload:**
```typescript
interface InitPayload {
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG'
  
  context: {
    siteId: string
    userId: string
    lang: 'ru' | 'en'
    timestamp: number
  }
  
  iblocks: {
    materials: number
    operations: number
    equipment: number
    details: number
    calculators: number
    configurations: number
  }
  
  selectedOffers: Array<{
    id: number              // ID торгового предложения
    productId: number       // ID родительского продукта
    name: string            // Название для отображения
    fields?: Record<string, any>
  }>
  
  config?: {
    id: number              // ID конфигурации в инфоблоке
    name: string
    data: ConfigData        // Полные данные конфигурации
  }
}

interface ConfigData {
  details: Detail[]
  bindings: Binding[]
  costingSettings?: CostingSettings
  salePricesSettings?: SalePricesSettings
}
```

**Пример (NEW_CONFIG):**
```json
{
  "protocol": "default",
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "INIT",
  "payload": {
    "mode": "NEW_CONFIG",
    "context": {
      "siteId": "s1",
      "userId": "1",
      "lang": "ru",
      "timestamp": 1234567890123
    },
    "iblocks": {
      "materials": 10,
      "operations": 11,
      "equipment": 12,
      "details": 13,
      "calculators": 14,
      "configurations": 15
    },
    "selectedOffers": [
      { "id": 525, "productId": 100, "name": "Буклет А4" },
      { "id": 526, "productId": 100, "name": "Буклет А5" }
    ]
  }
}
```

**Пример (EXISTING_CONFIG):**
```json
{
  "protocol": "default",
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "INIT",
  "payload": {
    "mode": "EXISTING_CONFIG",
    "context": { ... },
    "iblocks": { ... },
    "selectedOffers": [ ... ],
    "config": {
      "id": 42,
      "name": "Конфигурация буклета",
      "data": {
        "details": [ ... ],
        "bindings": [ ... ],
        "costingSettings": {
          "basedOn": "COMPONENT_PURCHASE",
          "roundingStep": 1
        },
        "salePricesSettings": {
          "selectedTypes": ["BASE_PRICE"],
          "types": { ... }
        }
      }
    }
  }
}
```

---

#### 3. INIT_DONE (iframe → Битрикс)

**Когда отправляется:**  
После полной обработки INIT и отрисовки интерфейса.

**Payload:**
```typescript
{
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG',
  offersCount: number
}
```

**Пример:**
```json
{
  "protocol": "default",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "INIT_DONE",
  "payload": {
    "mode": "EXISTING_CONFIG",
    "offersCount": 2
  }
}
```

---

#### 4. CALC_PREVIEW (iframe → Битрикс)

**Когда отправляется:**  
После локального расчета (кнопка "Тест" или "Рассчитать"), но **НЕ требует** записи в Битрикс.

**Задача:**  
Информирует хост о результатах расчёта для предварительного просмотра.

**Payload:**
```typescript
interface CalcPreviewPayload {
  type: 'test' | 'full'
  
  results: Array<{
    offerId: number
    dimensions?: {
      width: number
      length: number
      height: number
      weight: number
    }
    cost?: {
      materials: number
      operations: number
      equipment: number
      total: number
    }
    prices?: Record<string, number>  // Ключ = код типа цены
    errors?: string[]
  }>
  
  summary: {
    totalCost: number
    calculatedAt: number
  }
}
```

**Пример:**
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "CALC_PREVIEW",
  "payload": {
    "type": "full",
    "results": [
      {
        "offerId": 525,
        "dimensions": {
          "width": 210,
          "length": 297,
          "height": 2,
          "weight": 0.15
        },
        "cost": {
          "materials": 450,
          "operations": 600,
          "equipment": 200,
          "total": 1250
        },
        "prices": {
          "BASE_PRICE": 1500,
          "TRADE_PRICE": 1350
        }
      }
    ],
    "summary": {
      "totalCost": 1250,
      "calculatedAt": 1234567890123
    }
  }
}
```

---

#### 5. SAVE_REQUEST (iframe → Битрикс)

**Когда отправляется:**  
Строго по нажатию кнопки «Сохранить».

**Задача:**  
Передать полный снимок конфигурации и рассчитанные параметры для всех торговых предложений.

**Payload:**
```typescript
interface SaveRequestPayload {
  configuration: {
    name: string
    data: ConfigData
  }
  
  offerUpdates: Array<{
    offerId: number
    fields?: Record<string, any>      // Обновление полей
    prices?: Record<string, number>   // Обновление цен
    properties?: Record<string, any>  // Обновление свойств
    comments?: string
  }>
  
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG'
  configId?: number  // Только для EXISTING_CONFIG
}
```

**Пример:**
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "SAVE_REQUEST",
  "requestId": "save_1234567890123",
  "payload": {
    "mode": "NEW_CONFIG",
    "configuration": {
      "name": "Конфигурация буклета A4",
      "data": {
        "details": [ ... ],
        "bindings": [ ... ],
        "costingSettings": { ... },
        "salePricesSettings": { ... }
      }
    },
    "offerUpdates": [
      {
        "offerId": 525,
        "fields": {
          "WIDTH": 210,
          "LENGTH": 297,
          "HEIGHT": 2,
          "WEIGHT": 150
        },
        "prices": {
          "BASE_PRICE": 1500,
          "TRADE_PRICE": 1350
        },
        "comments": "Автоматически рассчитано"
      }
    ]
  }
}
```

---

#### 6. SAVE_RESULT (Битрикс → iframe)

**Когда отправляется:**  
Ответ на SAVE_REQUEST.

**Задача:**  
Сообщить о результате сохранения.

**Payload:**
```typescript
interface SaveResultPayload {
  status: 'ok' | 'error' | 'partial'
  configId?: number        // ID созданной/обновлённой конфигурации
  successOffers?: number[] // ID успешно обновлённых ТП
  errors?: Array<{
    offerId: number
    message: string
    code?: string
  }>
  message?: string
}
```

**Пример (успех):**
```json
{
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "SAVE_RESULT",
  "requestId": "save_1234567890123",
  "payload": {
    "status": "ok",
    "configId": 42,
    "successOffers": [525, 526],
    "message": "Конфигурация и торговые предложения успешно сохранены"
  }
}
```

**Пример (частичный успех):**
```json
{
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "SAVE_RESULT",
  "requestId": "save_1234567890123",
  "payload": {
    "status": "partial",
    "configId": 42,
    "successOffers": [525],
    "errors": [
      {
        "offerId": 526,
        "message": "Не удалось обновить цену BASE_PRICE",
        "code": "PRICE_UPDATE_FAILED"
      }
    ]
  }
}
```

---

#### 7. ERROR (iframe → Битрикс)

**Когда отправляется:**  
При возникновении ошибки в процессе работы.

**Payload:**
```typescript
{
  code: string,
  message: string,
  details?: any,
  context?: any
}
```

**Пример:**
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "ERROR",
  "payload": {
    "code": "CALC_ERROR",
    "message": "Не удалось выполнить расчёт",
    "details": "Division by zero",
    "context": { "detailId": "detail_123" }
  }
}
```

---

#### 8. CLOSE_REQUEST (iframe → Битрикс)

**Когда отправляется:**  
При просьбе закрыть окно из iframe (кнопка "Закрыть").

**Payload:**
```typescript
{
  saved: boolean,      // Были ли сохранены изменения
  hasChanges: boolean  // Есть ли несохранённые изменения
}
```

**Пример:**
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "CLOSE_REQUEST",
  "payload": {
    "saved": true,
    "hasChanges": false
  }
}
```

---

## Элементы UI (pwcode)

Каждый важный элемент UI имеет атрибут `pwcode` для однозначной идентификации.

### Верхние табы

| pwcode | Описание |
|--------|----------|
| `tab_details` | Таб "Детали" |
| `tab_materials` | Таб "Материалы" |
| `tab_operations` | Таб "Операции" |
| `tab_equipment` | Таб "Оборудование" |

### Список деталей

| pwcode | Описание |
|--------|----------|
| `details_list` | Контейнер списка деталей |
| `detail_card` | Карточка детали |
| `detail_open_button` | Кнопка раскрытия/сворачивания детали |
| `btn-add-detail` | Кнопка добавления детали |

### Внутри детали

| pwcode | Описание |
|--------|----------|
| `detail_calculator_select` | Select выбора калькулятора |
| `detail_operation_select` | Select выбора операции |
| `detail_material_select` | Select выбора материала |
| `detail_equipment_select` | Select выбора оборудования |
| `materials_tree` | Дерево материалов |
| `materials_tree_item` | Элемент дерева материалов |

### Панели

| pwcode | Описание |
|--------|----------|
| `panel-costing` | Панель "Себестоимость" |
| `panel-sale-prices` | Панель "Отпускные цены" |
| `panel-info` | Информационная панель |
| `panel-gabves` | Панель "Габариты/Вес" |

### Нижняя панель

| pwcode | Описание |
|--------|----------|
| `offers_strip` | Полоса торговых предложений |
| `offer_chip` | Чип торгового предложения |

### Кнопки

| pwcode | Описание |
|--------|----------|
| `btn-test-calc` | Кнопка "Тест" |
| `btn-full-calc` | Кнопка "Рассчитать" |
| `btn-save` | Кнопка "Сохранить" |
| `btn-close` | Кнопка "Закрыть" |
| `btn-gabves` | Кнопка "Габариты/Вес" |
| `btn-cost` | Кнопка "Себестоимость" |
| `btn-price` | Кнопка "Отпускные цены" |
| `btn-create-binding` | Кнопка создания скрепления (между деталями) |

### Футер и header

| pwcode | Описание |
|--------|----------|
| `header` | Верхняя панель |
| `mainarea` | Основная рабочая область |
| `footer` | Нижняя панель с кнопками |

---

## Версионность протокола

### Текущая версия

- **Версия:** `1.0.0`
- **Код протокола:** `pwrt-v1`

### Как расширять протокол

1. **Обратная совместимость:** При добавлении новых полей в payload, старые поля должны оставаться без изменений.

2. **Новые типы сообщений:** Добавляйте новые значения `MessageType`, не изменяя существующие.

3. **Изменение версии:**
   - **Patch (1.0.X):** Исправления багов, уточнения документации
   - **Minor (1.X.0):** Новые необязательные поля, новые типы сообщений
   - **Major (X.0.0):** Несовместимые изменения в структуре payload

4. **Проверка версии:** Битрикс должен проверять версию протокола в сообщении `READY` и предупреждать о несовместимости.

### Пример расширения

Добавление нового поля `theme` в `InitPayload`:

```typescript
// Версия 1.1.0
interface InitPayload {
  // ... существующие поля
  theme?: 'light' | 'dark'  // Необязательное поле
}
```

---

## Универсальная функция открытия элементов в Bitrix

### Назначение

Функция `openBitrixAdmin` предоставляет единый интерфейс для открытия элементов или списков инфоблоков в административной части Bitrix в новой вкладке браузера.

### API

```typescript
interface OpenBitrixAdminParams {
  iblockId: number  // ID инфоблока
  type: string      // Тип инфоблока (например, "catalog", "calculator_catalog")
  lang: string      // Язык интерфейса ("ru", "en")
  id?: number       // ID элемента (опционально)
}

function openBitrixAdmin(params: OpenBitrixAdminParams): void
```

### Примеры использования

#### Открыть элемент для редактирования

```typescript
openBitrixAdmin({
  iblockId: 100,
  type: 'calculator_catalog',
  lang: 'ru',
  id: 215,
})
// Откроется: https://site.ru/bitrix/admin/iblock_element_edit.php?IBLOCK_ID=100&type=calculator_catalog&lang=ru&ID=215
```

#### Открыть список инфоблока

```typescript
openBitrixAdmin({
  iblockId: 100,
  type: 'calculator_catalog',
  lang: 'ru',
})
// Откроется: https://site.ru/bitrix/admin/iblock_list_admin.php?IBLOCK_ID=100&type=calculator_catalog&lang=ru&find_section_section=0
```

### Инициализация контекста

Перед использованием `openBitrixAdmin` необходимо установить контекст Bitrix:

```typescript
import { setBitrixContext } from '@/lib/bitrix-utils'

// При обработке INIT
setBitrixContext({
  baseUrl: initPayload.context.url,  // Например, "https://prospektprint.ru/"
  lang: initPayload.context.lang,     // "ru" или "en"
})
```

### Использование в компонентах

Функция используется во многих компонентах для открытия различных сущностей:

- **Торговые предложения** (VariantsFooter):
  - Открытие ТП: `iblockId = INIT.iblocks.offers`
  - Открытие родительского товара: `iblockId = INIT.iblocks.products`

- **Детали** (HeaderSection, DetailCard):
  - `iblockId = INIT.iblocks.calcDetailsVariants`

- **Материалы** (HeaderSection):
  - `iblockId = INIT.iblocks.calcMaterialsVariants`

- **Операции** (HeaderSection):
  - `iblockId = INIT.iblocks.calcOperationsVariants`

- **Оборудование** (HeaderSection):
  - `iblockId = INIT.iblocks.calcEquipment`

---

## Дополнительные события postMessage

Помимо основных событий (`INIT`, `SAVE_REQUEST` и т.д.), добавлены новые типы событий для интерактивной работы с Bitrix.

### ADD_OFFER_REQUEST

**Направление:** iframe → Bitrix
**Назначение:** Запрос на добавление торговых предложений к текущей конфигурации

**Payload:**
```typescript
{
  iblockId: number
  iblockType: string
  lang: 'ru' | 'en'
}
```

**Пример:**
```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "ADD_OFFER_REQUEST",
  "requestId": "req-123",
  "payload": {
    "iblockId": 200,
    "iblockType": "offers",
    "lang": "ru"
  },
  "timestamp": 1712345678901
}
```

**Триггер:** Клик на кнопку `[data-pwcode="btn-add-offer"]` в панели торговых предложений

**Ожидаемое действие Bitrix:** Открыть интерфейс выбора торговых предложений, затем отправить новый `INIT` с обновлённым списком `selectedOffers`.

---

### REMOVE_OFFER_REQUEST

**Направление:** iframe → Bitrix
**Назначение:** Уведомление об удалении торгового предложения из списка

**Payload:**
```typescript
{
  id: number  // ID удалённого торгового предложения
  iblockId: number
  iblockType: string
  lang: 'ru' | 'en'
}
```

**Пример:**
```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "REMOVE_OFFER_REQUEST",
  "requestId": "req-123",
  "payload": {
    "id": 215,
    "iblockId": 200,
    "iblockType": "offers",
    "lang": "ru"
  },
  "timestamp": 1712345678901
}
```

**Триггер:** Клик на кнопку удаления `[data-pwcode="btn-remove-offer"]` в badge торгового предложения

**Ожидаемое действие Bitrix:** Обновить список выбранных ТП на стороне Bitrix (без перезагрузки iframe).

---

### SELECT_REQUEST

**Направление:** iframe → Bitrix
**Назначение:** Запрос на открытие пикера выбора элементов Bitrix для конкретного инфоблока

**Payload:**
```typescript
{
  iblockId: number,  // ID инфоблока
  iblockType: string,// Тип инфоблока
  lang: string       // Язык интерфейса
}
```

**Пример:**
```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "SELECT_REQUEST",
  "requestId": "req-123",
  "payload": {
    "iblockId": 100,
    "iblockType": "calculator_catalog",
    "lang": "ru"
  },
  "timestamp": 1712345678901
}
```

**Триггер:** Клик на кнопку `[data-pwcode="btn-select"]` в HeaderSection

**Контекст:** Какой таб активен определяет, какой инфоблок открывается:
- Таб "Детали" → `iblocks.calcDetailsVariants`
- Таб "Материалы" → `iblocks.calcMaterialsVariants`
- Таб "Операции" → `iblocks.calcOperationsVariants`
- Таб "Оборудование" → `iblocks.calcEquipment`

**Ожидаемое действие Bitrix:** Открыть модальное окно или overlay с интерфейсом выбора элементов из указанного инфоблока. После выбора обновить конфигурацию и отправить обновлённые данные обратно в iframe.

---

### CONFIG_ITEM_REMOVE

**Направление:** iframe → Bitrix  
**Назначение:** Уведомление об удалении элемента из конфигурации

**Payload:**
```typescript
{
  kind: 'detail' | 'material' | 'operation' | 'equipment',  // Тип элемента
  id: number  // ID элемента
}
```

**Пример:**
```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "CONFIG_ITEM_REMOVE",
  "requestId": "req-123",
  "payload": {
    "kind": "material",
    "id": 42
  },
  "timestamp": 1712345678901
}
```

**Триггер:** Клик на кнопки удаления в HeaderSection:
- `[data-pwcode="btn-delete-header-detail"]`
- `[data-pwcode="btn-delete-material"]`
- `[data-pwcode="btn-delete-operation"]`
- `[data-pwcode="btn-delete-equipment"]`

**Ожидаемое действие Bitrix:** Синхронизировать удаление элемента (опционально). Это событие информационное и не требует ответа.

---

## Панель торговых предложений (Tooltip с JSON)

### Описание

При наведении на badge торгового предложения `[data-pwcode="offer-badge"]` появляется tooltip с подробной информацией и JSON-представлением данных оффера.

### Структура Tooltip

#### Шапка tooltip
- **Название ТП** (`offer.name`)
- **ID родительского товара** (`offer.productId`)
- **Кнопка открытия родительского товара** — иконка ArrowSquareOut, открывает через `openBitrixAdmin`:
  ```typescript
  openBitrixAdmin({
    iblockId: INIT.iblocks.products,
    type: INIT.iblocksTypes[INIT.iblocks.products],
    lang: INIT.context.lang,
    id: offer.productId,
  })
  ```
- **Кнопка копирования JSON** — иконка Copy, копирует полный JSON оффера в буфер обмена

#### Основная часть tooltip
- **JSON Viewer** (библиотека `react-json-view-lite`):
  - Древовидное отображение всей структуры оффера
  - Возможность сворачивать/разворачивать ветки
  - Прокрутка при большом объёме данных
  - Максимальная высота: 384px (24rem)

### Поведение tooltip

- **Показ:** При наведении курсора на badge
- **Скрытие:** С задержкой 300ms после того, как курсор покинул badge
- **Залипание:** Если курсор перешёл на tooltip, он не исчезает
- **Закрытие:** Tooltip исчезает только когда курсор покинул и badge, и tooltip

### Технические детали

Для управления состоянием tooltip используются:
- `tooltipOpen: number | null` — ID оффера, для которого открыт tooltip
- `tooltipTimeoutRef` — таймер для задержки скрытия
- События `onMouseEnter` и `onMouseLeave` на badge и tooltip

---

## Заключение

Этот документ описывает полный протокол взаимодействия приложения калькуляции с 1С-Битрикс через postMessage, включая специальный режим развертывания без зависимости от Spark KV.

**Ключевые моменты:**
- ✅ В Bitrix-режиме нет HTTP-запросов к `/_spark/*`
- ✅ Все данные загружаются через `INIT` или используют дефолты
- ✅ Сохранение происходит только через `SAVE_REQUEST`
- ✅ Абстракция `ConfigStore` обеспечивает совместимость двух режимов
- ✅ Универсальная функция `openBitrixAdmin` для открытия элементов в админке
- ✅ Расширенные события postMessage для интерактивной работы
- ✅ Интерактивный tooltip с JSON-viewer для торговых предложений
