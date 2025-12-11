# Документация интеграции с 1С-Битрикс

## Оглавление

1. [Общий сценарий использования](#общий-сценарий-использования)
2. [Доменная модель](#доменная-модель)
3. [Режимы работы приложения](#режимы-работы-приложения)
4. [Протокол postMessage](#протокол-postmessage)
5. [Справочник pwcode](#справочник-pwcode)
6. [Версионность протокола](#версионность-протокола)

---

## Общий сценарий использования

### Контекст

Калькулятор себестоимости — это приложение для администраторов интернет-магазина на 1С-Битрикс. Менеджеры по продажам его не видят и не используют.

### Режим работы

Приложение работает **ТОЛЬКО внутри iframe**, который встраивается в админ-часть Битрикс после выбора торговых предложений и нажатия кнопки «Калькуляция».

### Технические детали развертывания

На сервере нет никакого React/Node. Есть только собранный бандл (index.html + js + css) по пути:
```
/local/apps/prospektweb.calc/
```

### Взаимодействие

Всё взаимодействие с Битриксом происходит через `window.postMessage`.

### Важное правило

**ДО МОМЕНТА НАЖАТИЯ КНОПКИ «Сохранить» НИЧЕГО В БИТРИКС НЕ ЗАПИСЫВАЕТСЯ.**

Все изменения внутри приложения считаются временным рабочим черновиком. Пользователь может свободно экспериментировать, добавлять детали, менять параметры, запускать предварительные расчёты — всё это локальная работа. Только явное нажатие кнопки «Сохранить» инициирует запись данных в Битрикс.

---

## Доменная модель

### Основные сущности

#### 1. Продукт (товар для продажи на сайте)

- Имеет свои свойства: название, описание, артикул
- Имеет цены, единицу измерения
- Имеет **Торговые предложения** (варианты продукта для продажи)

#### 2. Торговые предложения ПРОДУКТА

- Это то, что пользователь видит на сайте как варианты товара
- Примеры: разные тиражи, размеры, материалы
- С ними работает Битрикс-хост: выбирает несколько ТП и открывает калькуляцию
- **Важно:** это ПРОДАЖНЫЕ торговые предложения, именно для них рассчитываются итоговые параметры

#### 3. Детали, Материалы, Операции, Оборудование

Это **ОТДЕЛЬНЫЕ инфоблоки**.

Внутри них тоже есть товары и их торговые предложения, но они **НЕ для продажи на сайте**, а для конфигурирования продукта.

**Пример иерархии:**
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

Примеры правильного подхода:
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
- список выбранных ПРОДАЖНЫХ торговых предложений (их ID)
- ID существующей конфигурации
- полные данные конфигурации (детали, скрепления, калькуляторы, параметры)
- служебную информацию

**Отличие от NEW_CONFIG:**
Приложение загружает существующую конфигурацию и отображает её пользователю. Пользователь может редактировать и пересохранить.

---

## Протокол postMessage

### Базовый формат сообщения

Все сообщения следуют единому формату:

```typescript
interface PwrtMessage {
  source: 'prospektweb.calc' | 'bitrix'  // источник сообщения
  target: 'bitrix' | 'prospektweb.calc'  // получатель
  type: string                           // тип сообщения
  requestId?: string                     // для парных запросов
  payload?: any                          // данные
  timestamp?: number                     // метка времени
}
```

**Правило:**
- Сообщения из калькулятора: `source: 'prospektweb.calc'`, `target: 'bitrix'`
- Сообщения из Битрикса: `source: 'bitrix'`, `target: 'prospektweb.calc'`

### Типы сообщений

#### 1. READY (iframe → Битрикс)

**Когда отправляется:**
Сразу после инициализации приложения, когда UI готов принять INIT.

**Назначение:**
Сигнализирует Битриксу, что калькулятор загружен и готов к работе.

**Структура payload:**
```json
{
  "version": "1.0.0",
  "protocol": "pwrt-v1",
  "timestamp": 1234567890123
}
```

**Пример:**
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "READY",
  "payload": {
    "version": "1.0.0",
    "protocol": "pwrt-v1",
    "timestamp": 1234567890123
  },
  "timestamp": 1234567890123
}
```

---

#### 2. INIT (Битрикс → iframe)

**Когда отправляется:**
После получения READY от калькулятора.

**Назначение:**
Передаёт стартовый контекст работы: режим, данные, справочники.

**Структура payload:**

```typescript
interface InitPayload {
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG'
  
  // Служебная информация
  context: {
    siteId: string
    userId: string
    lang: 'ru' | 'en'
    timestamp: number
  }
  
  // ID инфоблоков (для справочников)
  iblocks: {
    materials: number
    operations: number
    equipment: number
    details: number
    calculators: number
    configurations: number
  }
  
  // Выбранные ПРОДАЖНЫЕ торговые предложения
  selectedOffers: Array<{
    id: number              // ID торгового предложения
    productId: number       // ID родительского продукта
    name: string            // Название для отображения
    fields?: Record<string, any>  // Дополнительные поля
  }>
  
  // Только для режима EXISTING_CONFIG
  config?: {
    id: number              // ID конфигурации в инфоблоке
    name: string            // Название конфигурации
    data: ConfigData        // Полные данные конфигурации (см. ниже)
  }
}

interface ConfigData {
  // Детали
  details: Array<{
    id: string
    name: string
    width: number
    length: number
    calculators: CalculatorInstance[]
  }>
  
  // Скрепления
  bindings: Array<{
    id: string
    name: string
    calculators: CalculatorInstance[]
    detailIds: string[]
    bindingIds: string[]
    hasFinishing: boolean
    finishingCalculators: CalculatorInstance[]
  }>
  
  // Настройки себестоимости
  costingSettings?: {
    basedOn: 'COMPONENT_PURCHASE' | 'COMPONENT_PURCHASE_PLUS_MARKUP' | 'COMPONENT_BASE'
    roundingStep: 0 | 0.1 | 1 | 10 | 100
    markupValue?: number
    markupUnit?: '%' | 'RUB'
  }
  
  // Настройки отпускных цен
  salePricesSettings?: {
    selectedTypes: string[]  // коды типов цен, например ['BASE_PRICE', 'TRADE_PRICE']
    types: Record<string, PriceTypeSettings>
  }
}

interface CalculatorInstance {
  id: string
  calculatorCode: string | null    // код калькулятора
  operationId: number | null       // ID операции из справочника
  operationQuantity: number
  equipmentId: number | null       // ID оборудования
  materialId: number | null        // ID материала
  materialQuantity: number
  extraOptions: Record<string, any>
}

interface PriceTypeSettings {
  correctionBase: 'RUN' | 'COST'
  prettyPriceEnabled: boolean
  prettyPriceCommonLimitEnabled: boolean
  prettyPriceCommonLimitRub: number
  ranges: Array<{
    from: number
    markupValue: number
    markupUnit: '%' | 'RUB'
    prettyPriceLimitRub: number
  }>
}
```

**Пример для NEW_CONFIG:**
```json
{
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "INIT",
  "payload": {
    "mode": "NEW_CONFIG",
    "context": {
      "siteId": "s1",
      "userId": "123",
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
      {
        "id": 525,
        "productId": 100,
        "name": "Постер A3 - тираж 100 шт"
      },
      {
        "id": 526,
        "productId": 100,
        "name": "Постер A3 - тираж 500 шт"
      }
    ]
  },
  "timestamp": 1234567890123
}
```

**Пример для EXISTING_CONFIG:**
```json
{
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "INIT",
  "payload": {
    "mode": "EXISTING_CONFIG",
    "context": {
      "siteId": "s1",
      "userId": "123",
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
      {
        "id": 525,
        "productId": 100,
        "name": "Постер A3 - тираж 100 шт"
      }
    ],
    "config": {
      "id": 42,
      "name": "Конфигурация постера A3",
      "data": {
        "details": [
          {
            "id": "detail_1",
            "name": "Постер",
            "width": 297,
            "length": 420,
            "calculators": [
              {
                "id": "calc_1",
                "calculatorCode": "DIGITAL_PRINT",
                "operationId": 200,
                "operationQuantity": 1,
                "equipmentId": 300,
                "materialId": 400,
                "materialQuantity": 1,
                "extraOptions": {}
              }
            ]
          }
        ],
        "bindings": [],
        "costingSettings": {
          "basedOn": "COMPONENT_PURCHASE",
          "roundingStep": 1
        }
      }
    }
  },
  "timestamp": 1234567890123
}
```

---

#### 3. INIT_DONE (iframe → Битрикс)

**Когда отправляется:**
После полной обработки INIT и отрисовки интерфейса.

**Назначение:**
Сигнализирует Битриксу, что калькулятор полностью готов к работе и отобразил данные.

**Структура payload:**
```json
{
  "mode": "NEW_CONFIG",
  "offersCount": 2
}
```

**Пример:**
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "INIT_DONE",
  "payload": {
    "mode": "EXISTING_CONFIG",
    "offersCount": 1
  },
  "timestamp": 1234567890456
}
```

---

#### 4. CALC_PREVIEW (iframe → Битрикс)

**Когда отправляется:**
После локального расчета (кнопка "Тест" или "Рассчитать" без сохранения).

**Назначение:**
Передаёт результаты расчёта для предварительного просмотра. НЕ требует записи в Битрикс.

**Структура payload:**
```typescript
interface CalcPreviewPayload {
  type: 'test' | 'full'
  
  // Результаты расчёта по всем торговым предложениям
  results: Array<{
    offerId: number
    
    // Габариты и вес
    dimensions?: {
      width: number   // мм
      length: number  // мм
      height: number  // мм
      weight: number  // кг
    }
    
    // Себестоимость
    cost?: {
      materials: number       // руб
      operations: number      // руб
      equipment: number       // руб
      total: number          // руб
    }
    
    // Отпускные цены
    prices?: Record<string, number>  // { 'BASE_PRICE': 1500, 'TRADE_PRICE': 1200 }
    
    // Ошибки расчёта (если есть)
    errors?: string[]
  }>
  
  // Общая информация
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
          "width": 297,
          "length": 420,
          "height": 2,
          "weight": 0.15
        },
        "cost": {
          "materials": 450.00,
          "operations": 600.00,
          "equipment": 200.00,
          "total": 1250.00
        },
        "prices": {
          "BASE_PRICE": 1500.00,
          "TRADE_PRICE": 1300.00
        }
      },
      {
        "offerId": 526,
        "dimensions": {
          "width": 297,
          "length": 420,
          "height": 10,
          "weight": 0.75
        },
        "cost": {
          "materials": 2250.00,
          "operations": 3000.00,
          "equipment": 1000.00,
          "total": 6250.00
        },
        "prices": {
          "BASE_PRICE": 7500.00,
          "TRADE_PRICE": 6500.00
        }
      }
    ],
    "summary": {
      "totalCost": 7500.00,
      "calculatedAt": 1234567890789
    }
  },
  "timestamp": 1234567890789
}
```

---

#### 5. SAVE_REQUEST (iframe → Битрикс)

**Когда отправляется:**
Строго по нажатию кнопки «Сохранить».

**Назначение:**
Запрашивает сохранение конфигурации и рассчитанных параметров в Битрикс.

**Структура payload:**
```typescript
interface SaveRequestPayload {
  // Полный снимок конфигурации
  configuration: {
    name: string
    data: ConfigData  // та же структура, что в INIT
  }
  
  // Маппинг рассчитанных параметров на ПРОДАЖНЫЕ ТП
  offerUpdates: Array<{
    offerId: number
    
    // Поля торгового предложения
    fields?: {
      width?: number
      length?: number
      height?: number
      weight?: number
      [key: string]: any  // другие пользовательские поля
    }
    
    // Цены по типам
    prices?: Record<string, number>  // { 'BASE_PRICE': 1500 }
    
    // Пользовательские свойства
    properties?: Record<string, any>
    
    // Комментарии
    comments?: string
  }>
  
  // Режим сохранения
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG'
  
  // ID существующей конфигурации (только для EXISTING_CONFIG)
  configId?: number
}
```

**Пример:**
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "SAVE_REQUEST",
  "requestId": "save_1234567890",
  "payload": {
    "mode": "NEW_CONFIG",
    "configuration": {
      "name": "Конфигурация постера A3",
      "data": {
        "details": [
          {
            "id": "detail_1",
            "name": "Постер",
            "width": 297,
            "length": 420,
            "calculators": [
              {
                "id": "calc_1",
                "calculatorCode": "DIGITAL_PRINT",
                "operationId": 200,
                "operationQuantity": 1,
                "equipmentId": 300,
                "materialId": 400,
                "materialQuantity": 1,
                "extraOptions": {}
              }
            ]
          }
        ],
        "bindings": [],
        "costingSettings": {
          "basedOn": "COMPONENT_PURCHASE",
          "roundingStep": 1
        },
        "salePricesSettings": {
          "selectedTypes": ["BASE_PRICE"],
          "types": {
            "BASE_PRICE": {
              "correctionBase": "RUN",
              "prettyPriceEnabled": true,
              "prettyPriceCommonLimitEnabled": false,
              "prettyPriceCommonLimitRub": 100,
              "ranges": [
                {
                  "from": 0,
                  "markupValue": 20,
                  "markupUnit": "%",
                  "prettyPriceLimitRub": 100
                }
              ]
            }
          }
        }
      }
    },
    "offerUpdates": [
      {
        "offerId": 525,
        "fields": {
          "width": 297,
          "length": 420,
          "height": 2,
          "weight": 0.15
        },
        "prices": {
          "BASE_PRICE": 1500.00
        },
        "comments": "Рассчитано автоматически"
      },
      {
        "offerId": 526,
        "fields": {
          "width": 297,
          "length": 420,
          "height": 10,
          "weight": 0.75
        },
        "prices": {
          "BASE_PRICE": 7500.00
        },
        "comments": "Рассчитано автоматически"
      }
    ]
  },
  "timestamp": 1234567890999
}
```

---

#### 6. SAVE_RESULT (Битрикс → iframe)

**Когда отправляется:**
Ответ на SAVE_REQUEST после попытки сохранения.

**Назначение:**
Информирует калькулятор о результате сохранения.

**Структура payload:**
```typescript
interface SaveResultPayload {
  status: 'ok' | 'error' | 'partial'
  
  // ID созданной/обновлённой конфигурации
  configId?: number
  
  // Успешно обновлённые торговые предложения
  successOffers?: number[]
  
  // Ошибки по торговым предложениям
  errors?: Array<{
    offerId: number
    message: string
    code?: string
  }>
  
  // Общая ошибка
  message?: string
}
```

**Пример успешного сохранения:**
```json
{
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "SAVE_RESULT",
  "requestId": "save_1234567890",
  "payload": {
    "status": "ok",
    "configId": 42,
    "successOffers": [525, 526],
    "message": "Конфигурация успешно сохранена"
  },
  "timestamp": 1234567891000
}
```

**Пример частичного успеха:**
```json
{
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "SAVE_RESULT",
  "requestId": "save_1234567890",
  "payload": {
    "status": "partial",
    "configId": 42,
    "successOffers": [525],
    "errors": [
      {
        "offerId": 526,
        "message": "Недостаточно прав для изменения цены",
        "code": "ACCESS_DENIED"
      }
    ],
    "message": "Конфигурация сохранена, но не все торговые предложения обновлены"
  },
  "timestamp": 1234567891000
}
```

**Пример ошибки:**
```json
{
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "SAVE_RESULT",
  "requestId": "save_1234567890",
  "payload": {
    "status": "error",
    "message": "Не удалось сохранить конфигурацию: ошибка БД",
    "errors": [
      {
        "offerId": 525,
        "message": "Торговое предложение не найдено",
        "code": "NOT_FOUND"
      }
    ]
  },
  "timestamp": 1234567891000
}
```

---

#### 7. ERROR (двунаправленное)

**Когда отправляется:**
При возникновении ошибки в процессе работы любой из сторон.

**Назначение:**
Информировать о проблеме для логирования или обработки.

**Структура payload:**
```typescript
interface ErrorPayload {
  code?: string
  message: string
  details?: any
  context?: {
    component?: string
    action?: string
    [key: string]: any
  }
}
```

**Пример:**
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "ERROR",
  "payload": {
    "code": "INVALID_MATERIAL_ID",
    "message": "Материал с ID 999 не найден в справочнике",
    "details": {
      "materialId": 999,
      "detailId": "detail_1"
    },
    "context": {
      "component": "DetailCard",
      "action": "selectMaterial"
    }
  },
  "timestamp": 1234567891111
}
```

---

#### 8. CLOSE_REQUEST (iframe → Битрикс)

**Когда отправляется:**
При нажатии кнопки «Закрыть» в калькуляторе.

**Назначение:**
Просьба закрыть окно калькулятора.

**Структура payload:**
```json
{
  "saved": false,
  "hasChanges": true
}
```

**Пример:**
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "CLOSE_REQUEST",
  "payload": {
    "saved": false,
    "hasChanges": true
  },
  "timestamp": 1234567891222
}
```

Битрикс может показать предупреждение "Есть несохранённые изменения" перед закрытием.

---

## Справочник pwcode

Каждый важный элемент UI имеет атрибут `pwcode` для стабильной идентификации.

### Формат

```html
<button pwcode="btn-save">Сохранить</button>
```

**Важно:**
- Используется атрибут `pwcode`, а НЕ `data-pwcode`
- Имена стабильные и читаемые
- React не использует pwcode для логики
- Может повторяться для однородных элементов

### Верхняя панель (header)

| pwcode | Элемент | Описание |
|--------|---------|----------|
| `header` | Контейнер | Вся верхняя панель |
| `btn-menu` | Кнопка | Открытие меню (hamburger) |
| `btn-refresh` | Кнопка | Обновление данных |
| `tab-materials` | Вкладка | Таб "Материалы" |
| `tab-operations` | Вкладка | Таб "Операции" |
| `tab-equipment` | Вкладка | Таб "Оборудование" |
| `tab-details` | Вкладка | Таб "Детали" |
| `header-item` | Элемент | Элемент в активной вкладке (повторяется) |
| `header-item-drag` | Иконка | Иконка drag для элемента |
| `header-item-remove` | Кнопка | Удаление элемента из вкладки |

### Основная область (main)

| pwcode | Элемент | Описание |
|--------|---------|----------|
| `mainarea` | Контейнер | Основная рабочая область |
| `detail-card` | Карточка | Карточка детали (повторяется) |
| `detail-header` | Заголовок | Шапка детали |
| `detail-drag-handle` | Иконка | Иконка для drag детали |
| `detail-toggle` | Кнопка | Свернуть/развернуть деталь |
| `detail-delete` | Кнопка | Удалить деталь |
| `detail-name` | Инпут | Название детали |
| `detail-width` | Инпут | Ширина детали |
| `detail-length` | Инпут | Длина детали |
| `detail-calculator-select` | Селект | Выбор калькулятора |
| `detail-operation-select` | Селект | Выбор операции |
| `detail-equipment-select` | Селект | Выбор оборудования |
| `detail-material-select` | Селект | Выбор материала |
| `detail-material-dropzone` | Дроп-зона | Быстрое добавление материала |
| `detail-operation-dropzone` | Дроп-зона | Быстрое добавление операции |
| `detail-equipment-dropzone` | Дроп-зона | Быстрое добавление оборудования |
| `detail-stage-label` | Метка | "Этап #N" |
| `detail-add-stage` | Кнопка | Добавить этап |
| `detail-remove-stage` | Кнопка | Удалить этап |
| `binding-card` | Карточка | Карточка скрепления (повторяется) |
| `binding-header` | Заголовок | Шапка скрепления |
| `binding-drag-handle` | Иконка | Иконка для drag скрепления |
| `binding-toggle` | Кнопка | Свернуть/развернуть скрепление |
| `binding-delete` | Кнопка | Удалить скрепление |
| `binding-name` | Инпут | Название скрепления |
| `binding-stage-label` | Метка | "Этап скрепления #N" |
| `binding-add-stage` | Кнопка | Добавить этап скрепления |
| `binding-remove-stage` | Кнопка | Удалить этап скрепления |
| `binding-finishing-toggle` | Чекбокс | Включить финишную обработку |
| `binding-finishing-stage-label` | Метка | "Этап финишной обработки #N" |
| `binding-add-finishing-stage` | Кнопка | Добавить этап финишной обработки |
| `binding-remove-finishing-stage` | Кнопка | Удалить этап финишной обработки |
| `btn-create-binding` | Кнопка | Создать скрепление между элементами |

### Нижняя панель торговых предложений

| pwcode | Элемент | Описание |
|--------|---------|----------|
| `offerspanel` | Контейнер | Панель торговых предложений |
| `offer-chip` | Чип | Торговое предложение (повторяется) |
| `btn-remove-offer` | Кнопка | Удалить ТП из расчёта |
| `btn-open-offer` | Кнопка | Открыть ТП в новой вкладке |

### Информационные панели

| pwcode | Элемент | Описание |
|--------|---------|----------|
| `info-panel` | Контейнер | Панель информационных сообщений |
| `info-panel-toggle` | Кнопка | Свернуть/развернуть панель |
| `info-panel-message` | Элемент | Сообщение (повторяется) |
| `gabves-panel` | Контейнер | Панель габаритов/веса |
| `gabves-panel-toggle` | Кнопка | Свернуть/развернуть |
| `cost-panel` | Контейнер | Панель себестоимости |
| `cost-panel-toggle` | Кнопка | Свернуть/развернуть |
| `cost-panel-message` | Элемент | Сообщение в панели |
| `price-panel` | Контейнер | Панель отпускных цен |
| `price-panel-toggle` | Кнопка | Свернуть/развернуть |
| `price-panel-message` | Элемент | Сообщение в панели |

### Настройки себестоимости (внутри cost-panel)

| pwcode | Элемент | Описание |
|--------|---------|----------|
| `cost-based-on` | Селект | "Считать на основании" |
| `cost-markup-value` | Инпут | Значение наценки |
| `cost-markup-unit` | Селект | Единица наценки (% / RUB) |
| `cost-rounding-step` | Селект | Шаг округления |

### Настройки отпускных цен (внутри price-panel)

| pwcode | Элемент | Описание |
|--------|---------|----------|
| `price-types-select` | Мультиселект | Выбор типов цен |
| `price-type-block` | Контейнер | Блок настроек типа цены (повторяется) |
| `price-correction-base` | Селект | Коррекция на основе (Тираж/Стоимость) |
| `price-pretty-enabled` | Чекбокс | Подбор "красивой" цены |
| `price-common-limit-enabled` | Чекбокс | Общее ограничение |
| `price-common-limit-value` | Инпут | Значение общего ограничения |
| `price-range-row` | Контейнер | Строка диапазона (повторяется) |
| `price-range-from` | Инпут | От |
| `price-range-to` | Инпут | До (disabled) |
| `price-range-markup-value` | Инпут | Значение наценки |
| `price-range-markup-unit` | Селект | Единица наценки |
| `price-range-limit` | Инпут | Индивидуальное ограничение |
| `price-range-add` | Кнопка | Добавить/разделить диапазон |

### Футер

| pwcode | Элемент | Описание |
|--------|---------|----------|
| `footer` | Контейнер | Футер приложения |
| `btn-gabves` | Кнопка | Габариты/Вес |
| `btn-cost` | Кнопка | Себестоимость |
| `btn-price` | Кнопка | Отпускные цены |
| `btn-test-calc` | Кнопка | Тестовый расчёт |
| `btn-full-calc` | Кнопка | Полный расчёт |
| `btn-save` | Кнопка | Сохранить |
| `btn-close` | Кнопка | Закрыть |

### Модальные окна

| pwcode | Элемент | Описание |
|--------|---------|----------|
| `sidebar-menu` | Контейнер | Боковое меню |
| `about-dialog` | Диалог | Диалог "О программе" |

---

## Версионность протокола

### Текущая версия

**Версия:** `1.0.0`  
**Код протокола:** `pwrt-v1`

### Правила версионирования

Используется Semantic Versioning (MAJOR.MINOR.PATCH):

- **MAJOR** — несовместимые изменения протокола
- **MINOR** — обратно совместимые добавления
- **PATCH** — исправления ошибок

### Обратная совместимость

При добавлении новых полей:
- Старые клиенты игнорируют неизвестные поля
- Новые клиенты предоставляют значения по умолчанию для отсутствующих полей

### Проверка версии

При получении `READY` Битрикс может проверить версию:

```javascript
if (payload.payload.protocol !== 'pwrt-v1') {
  console.warn('Неизвестная версия протокола:', payload.payload.protocol);
}
```

### Как расширять протокол

#### 1. Добавление нового поля (MINOR версия)

✅ **Правильно:**
```typescript
// Было
interface SaveRequestPayload {
  mode: string
  configuration: ConfigData
}

// Стало (версия 1.1.0)
interface SaveRequestPayload {
  mode: string
  configuration: ConfigData
  metadata?: {  // новое опциональное поле
    author?: string
    description?: string
  }
}
```

#### 2. Изменение типа поля (MAJOR версия)

❌ **Несовместимо:**
```typescript
// Было
interface InitPayload {
  selectedOffers: number[]  // массив ID
}

// Стало (версия 2.0.0)
interface InitPayload {
  selectedOffers: Array<{  // массив объектов
    id: number
    name: string
  }>
}
```

#### 3. Добавление нового типа сообщения (MINOR версия)

✅ **Правильно:**
```typescript
// Новый тип сообщения для статистики
interface StatsRequestPayload {
  offerId: number
}

// Использование
{
  "type": "STATS_REQUEST",
  "payload": { "offerId": 525 }
}
```

### Changelog

#### v1.0.0 (2024-01-15)
- Начальная версия протокола
- Поддержка режимов NEW_CONFIG и EXISTING_CONFIG
- Базовые сообщения: READY, INIT, INIT_DONE, CALC_PREVIEW, SAVE_REQUEST, SAVE_RESULT, ERROR, CLOSE_REQUEST

---

## Примеры интеграции

### Пример 1: Базовая интеграция (JavaScript)

```javascript
// bitrix-integration.js

class CalcIntegration {
  constructor(iframeElement) {
    this.iframe = iframeElement;
    this.isReady = false;
    this.pendingRequests = new Map();
    
    this.init();
  }
  
  init() {
    window.addEventListener('message', (event) => {
      const msg = event.data;
      
      // Валидация
      if (!msg || msg.target !== 'bitrix') return;
      if (msg.source !== 'prospektweb.calc') return;
      
      console.log('[Bitrix] Received:', msg.type);
      
      switch (msg.type) {
        case 'READY':
          this.onReady(msg);
          break;
        case 'INIT_DONE':
          this.onInitDone(msg);
          break;
        case 'CALC_PREVIEW':
          this.onCalcPreview(msg);
          break;
        case 'SAVE_REQUEST':
          this.onSaveRequest(msg);
          break;
        case 'CLOSE_REQUEST':
          this.onCloseRequest(msg);
          break;
        case 'ERROR':
          this.onError(msg);
          break;
      }
    });
  }
  
  send(type, payload = {}, requestId = null) {
    const msg = {
      source: 'bitrix',
      target: 'prospektweb.calc',
      type,
      payload,
      timestamp: Date.now()
    };
    
    if (requestId) msg.requestId = requestId;
    
    this.iframe.contentWindow.postMessage(msg, '*');
  }
  
  onReady(msg) {
    console.log('[Bitrix] Calculator ready, version:', msg.payload.version);
    this.isReady = true;
    
    // Отправляем INIT
    const initPayload = this.prepareInitPayload();
    this.send('INIT', initPayload);
  }
  
  prepareInitPayload() {
    // Загружаем данные из Битрикс
    const selectedOffers = window.SELECTED_OFFERS || [];
    const existingConfig = window.EXISTING_CONFIG || null;
    
    return {
      mode: existingConfig ? 'EXISTING_CONFIG' : 'NEW_CONFIG',
      context: {
        siteId: 's1',
        userId: window.USER_ID,
        lang: 'ru',
        timestamp: Date.now()
      },
      iblocks: window.IBLOCK_IDS,
      selectedOffers,
      config: existingConfig
    };
  }
  
  onInitDone(msg) {
    console.log('[Bitrix] Calculator initialized');
  }
  
  onCalcPreview(msg) {
    console.log('[Bitrix] Calculation preview:', msg.payload);
    
    // Показываем результаты пользователю
    this.showPreviewResults(msg.payload.results);
  }
  
  async onSaveRequest(msg) {
    console.log('[Bitrix] Save request received');
    
    try {
      // Сохраняем конфигурацию
      const configId = await this.saveConfiguration(msg.payload.configuration);
      
      // Обновляем торговые предложения
      const errors = [];
      const successOffers = [];
      
      for (const update of msg.payload.offerUpdates) {
        try {
          await this.updateOffer(update);
          successOffers.push(update.offerId);
        } catch (err) {
          errors.push({
            offerId: update.offerId,
            message: err.message,
            code: err.code
          });
        }
      }
      
      // Отправляем результат
      this.send('SAVE_RESULT', {
        status: errors.length === 0 ? 'ok' : 'partial',
        configId,
        successOffers,
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length === 0 ? 'Успешно сохранено' : 'Частично сохранено'
      }, msg.requestId);
      
    } catch (err) {
      this.send('SAVE_RESULT', {
        status: 'error',
        message: err.message
      }, msg.requestId);
    }
  }
  
  onCloseRequest(msg) {
    if (msg.payload.hasChanges && !msg.payload.saved) {
      if (!confirm('Есть несохранённые изменения. Закрыть?')) {
        return;
      }
    }
    
    // Закрываем окно
    this.closeCalculator();
  }
  
  onError(msg) {
    console.error('[Bitrix] Calculator error:', msg.payload);
  }
  
  async saveConfiguration(config) {
    // Реализация сохранения через Битрикс API
    const response = await fetch('/local/ajax/calc_save_config.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    const result = await response.json();
    return result.id;
  }
  
  async updateOffer(update) {
    // Реализация обновления через Битрикс API
    const response = await fetch('/local/ajax/calc_update_offer.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update offer');
    }
  }
  
  showPreviewResults(results) {
    // Отображение результатов
    console.table(results);
  }
  
  closeCalculator() {
    // Закрытие модального окна/iframe
    window.close();
  }
}

// Использование
const iframe = document.getElementById('calc-iframe');
const calc = new CalcIntegration(iframe);
```

### Пример 2: Интеграция с PHP (1С-Битрикс)

```php
<?php
// calculator.php

require($_SERVER["DOCUMENT_ROOT"]."/bitrix/header.php");

$selectedOfferIds = $_GET['offers'] ?? [];
$configId = $_GET['config_id'] ?? null;

// Загружаем данные
$selectedOffers = [];
foreach ($selectedOfferIds as $offerId) {
    $offer = CCatalogProduct::GetByID($offerId);
    if ($offer) {
        $selectedOffers[] = [
            'id' => $offer['ID'],
            'productId' => $offer['PRODUCT_ID'],
            'name' => $offer['NAME']
        ];
    }
}

// Загружаем конфигурацию (если есть)
$existingConfig = null;
if ($configId) {
    $config = CIBlockElement::GetByID($configId)->Fetch();
    if ($config) {
        $existingConfig = [
            'id' => $config['ID'],
            'name' => $config['NAME'],
            'data' => json_decode($config['DETAIL_TEXT'], true)
        ];
    }
}

$initData = [
    'selectedOffers' => $selectedOffers,
    'existingConfig' => $existingConfig,
    'iblockIds' => [
        'materials' => MATERIALS_IBLOCK_ID,
        'operations' => OPERATIONS_IBLOCK_ID,
        'equipment' => EQUIPMENT_IBLOCK_ID,
        'details' => DETAILS_IBLOCK_ID,
        'calculators' => CALCULATORS_IBLOCK_ID,
        'configurations' => CONFIGURATIONS_IBLOCK_ID
    ]
];
?>

<!DOCTYPE html>
<html>
<head>
    <title>Калькулятор себестоимости</title>
    <style>
        body { margin: 0; padding: 0; }
        #calc-iframe { width: 100vw; height: 100vh; border: none; }
    </style>
</head>
<body>
    <iframe 
        id="calc-iframe" 
        src="/local/apps/prospektweb.calc/index.html"
    ></iframe>
    
    <script>
        const INIT_DATA = <?= json_encode($initData) ?>;
        const USER_ID = '<?= $USER->GetID() ?>';
        
        const iframe = document.getElementById('calc-iframe');
        let calcReady = false;
        
        window.addEventListener('message', (event) => {
            const msg = event.data;
            
            if (!msg || msg.target !== 'bitrix') return;
            if (msg.source !== 'prospektweb.calc') return;
            
            console.log('[Bitrix] Received:', msg.type);
            
            switch (msg.type) {
                case 'READY':
                    handleReady();
                    break;
                case 'SAVE_REQUEST':
                    handleSave(msg);
                    break;
                case 'CLOSE_REQUEST':
                    handleClose(msg);
                    break;
            }
        });
        
        function sendMessage(type, payload, requestId = null) {
            const msg = {
                source: 'bitrix',
                target: 'prospektweb.calc',
                type,
                payload,
                timestamp: Date.now()
            };
            if (requestId) msg.requestId = requestId;
            iframe.contentWindow.postMessage(msg, '*');
        }
        
        function handleReady() {
            calcReady = true;
            
            const initPayload = {
                mode: INIT_DATA.existingConfig ? 'EXISTING_CONFIG' : 'NEW_CONFIG',
                context: {
                    siteId: 's1',
                    userId: USER_ID,
                    lang: 'ru',
                    timestamp: Date.now()
                },
                iblocks: INIT_DATA.iblockIds,
                selectedOffers: INIT_DATA.selectedOffers,
                config: INIT_DATA.existingConfig
            };
            
            sendMessage('INIT', initPayload);
        }
        
        async function handleSave(msg) {
            try {
                const response = await fetch('/local/ajax/calc_save.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(msg.payload)
                });
                
                const result = await response.json();
                
                sendMessage('SAVE_RESULT', result, msg.requestId);
                
            } catch (err) {
                sendMessage('SAVE_RESULT', {
                    status: 'error',
                    message: err.message
                }, msg.requestId);
            }
        }
        
        function handleClose(msg) {
            if (msg.payload.hasChanges && !msg.payload.saved) {
                if (!confirm('Есть несохранённые изменения. Закрыть?')) {
                    return;
                }
            }
            window.close();
        }
    </script>
</body>
</html>

<?php require($_SERVER["DOCUMENT_ROOT"]."/bitrix/footer.php"); ?>
```

---

## Заключение

Данный протокол обеспечивает:
- ✅ Чёткое разделение ответственности между калькулятором и Битрикс
- ✅ Независимость от конкретных ID инфоблоков и товаров
- ✅ Гибкость при расширении функционала
- ✅ Безопасность данных (ничего не сохраняется до явной команды)
- ✅ Удобство отладки через стабильные pwcode

При возникновении вопросов или необходимости расширения протокола обращайтесь к данной документации и придерживайтесь описанных правил версионирования.
