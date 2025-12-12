# Changelog: Интеграция с Bitrix INIT и универсальные действия

## Дата: 2024

## Цель изменений
Привести UI к реальным данным из Bitrix INIT и добавить универсальные действия "открыть в админке Bitrix" + события в родителя.

---

## Изменённые файлы

### 1. `/src/lib/bitrix-utils.ts` (НОВЫЙ ФАЙЛ)

**Добавлено:**
- Функция `openBitrixAdmin({ iblockId, type, lang, id? })` — универсальная функция для открытия элементов или списков инфоблоков в админке Bitrix
- Хранение контекста Bitrix (baseUrl, lang) через `setBitrixContext()` и `getBitrixContext()`
- Формирование URL для редактирования элемента или просмотра списка инфоблока

**Использование:**
```typescript
// Открыть элемент для редактирования
openBitrixAdmin({
  iblockId: 100,
  type: 'calculator_catalog',
  lang: 'ru',
  id: 215,
})

// Открыть список инфоблока
openBitrixAdmin({
  iblockId: 100,
  type: 'calculator_catalog',
  lang: 'ru',
})
```

### 2. `/src/lib/postmessage-bridge.ts`

**Добавлено:**
- Новые типы событий:
  - `OFFERS_ADD` — запрос на добавление торговых предложений
  - `OFFERS_REMOVE` — удаление оффера из списка
  - `BITRIX_PICKER_OPEN` — открыть пикер элементов Bitrix для выбора
  - `CONFIG_ITEM_REMOVE` — удаление элемента из конфигурации
  
- Новые методы:
  - `sendOffersAdd()` — отправить запрос на добавление ТП
  - `sendOffersRemove(offerId)` — отправить событие удаления оффера
  - `sendBitrixPickerOpen(iblockId, type, lang)` — открыть пикер Bitrix
  - `sendConfigItemRemove(kind, id)` — уведомить о удалении элемента

- Расширен интерфейс `InitPayload`:
  - Добавлено поле `context.url` — базовый URL сайта
  - Добавлены поля `iblocks.products`, `iblocks.offers`
  - Добавлен `iblocksTypes` — маппинг ID инфоблока на его тип
  - Расширен формат `selectedOffers` (добавлены prices, properties)

### 3. `/src/App.tsx`

**Добавлено:**
- State для хранения:
  - `bitrixMeta: InitPayload | null` — полные метаданные из INIT
  - `selectedOffers: InitPayload['selectedOffers']` — список выбранных ТП
  - `selectedVariantIds` теперь динамический (не захардкожен)

- При обработке INIT:
  - Сохранение метаданных Bitrix в state
  - Установка контекста Bitrix через `setBitrixContext()`
  - Замена демо-данных на данные из INIT
  - Заполнение `selectedOffers` и `selectedVariantIds`

- Передача `bitrixMeta` в дочерние компоненты:
  - `HeaderSection`
  - `DetailCard`
  - `VariantsFooter`

- Обработка удаления оффера через callback `onRemoveOffer`

### 4. `/src/components/calculator/VariantsFooter.tsx`

**Изменено:**
- Работа с реальными данными из `selectedOffers` вместо мок-данных
- Добавлена библиотека `react-json-view-lite` для отображения JSON

**Добавлено:**
- Tooltip при наведении на badge торгового предложения:
  - Показывается с задержкой (не исчезает при переходе курсора на tooltip)
  - Отображает:
    - Название ТП
    - ID родительского товара
    - Кнопку открытия родительского товара в Bitrix
    - JSON-viewer с полными данными оффера
    - Кнопку копирования JSON в буфер

- Интеграция с `openBitrixAdmin`:
  - Кнопка открытия ТП (`btn-open-offer`)
  - Кнопка открытия родительского товара

- PostMessage события:
  - `btn-add-offer` → `OFFERS_ADD`
  - `btn-remove-offer` → `OFFERS_REMOVE` с offerId

**data-pwcode элементы:**
- `offerspanel` — панель торговых предложений
- `offer-badge` — badge торгового предложения
- `btn-open-offer` — открыть ТП в Bitrix
- `btn-remove-offer` — удалить оффер
- `btn-add-offer` — добавить ТП
- `btn-toggle-offers` — свернуть/развернуть список

### 5. `/src/components/calculator/HeaderSection.tsx`

**Изменено:**
- Добавлен проп `bitrixMeta?: InitPayload | null`

**Добавлено:**
- Функция `getIblockInfoForTab()` — возвращает iblockId, type, lang для активного таба
- Функция `handleOpenHeaderElement(itemId)` — открывает элемент в Bitrix
- Обновлённая `handleRemoveElement(id, itemId)` — отправляет событие `CONFIG_ITEM_REMOVE`

- Интеграция кнопок:
  - `btn-select` → отправляет `BITRIX_PICKER_OPEN` с параметрами для активного таба
  - `btn-catalog` → открывает список инфоблока через `openBitrixAdmin`
  - `btn-open-header-detail`, `btn-open-material`, `btn-open-operation`, `btn-open-equipment` → открывают элемент в Bitrix
  - `btn-delete-header-detail`, `btn-delete-material`, `btn-delete-operation`, `btn-delete-equipment` → удаляют элемент и отправляют событие

**Сопоставление табов с инфоблоками:**
- Детали → `iblocks.calcDetailsVariants`
- Материалы → `iblocks.calcMaterialsVariants`
- Операции → `iblocks.calcOperationsVariants`
- Оборудование → `iblocks.calcEquipment`

### 6. `/src/components/calculator/DetailCard.tsx`

**Изменено:**
- Добавлен проп `bitrixMeta?: InitPayload | null`
- Обновлена функция `handleOpenInBitrix()`:
  - Если `bitrixMeta` доступен → открывает через `openBitrixAdmin`
  - Иначе → fallback на старое поведение

**data-pwcode элементы:**
- `btn-open-detail-bitrix` — открыть деталь в админке Bitrix

---

## Добавленные зависимости

### NPM пакеты
- `react-json-view-lite@^2.5.0` — легковесный JSON viewer для React

---

## Data-pwcode: полный список

### Футер (Торговые предложения)
- `offerspanel` — панель торговых предложений
- `offer-badge` — badge с ID торгового предложения (повторяется для каждого ТП)
- `btn-open-offer` — кнопка открыть ТП в Bitrix
- `btn-remove-offer` — кнопка удалить ТП из списка
- `btn-add-offer` — кнопка добавить торговые предложения
- `btn-toggle-offers` — свернуть/развернуть список ТП

### Шапка (HeaderSection)
- `headersection` — контейнер секции шапки
- `btn-menu` — кнопка меню (гамбургер)
- `btn-refresh` — кнопка обновления данных
- `header-tabs` — контейнер табов
- `tab-details`, `tab-materials`, `tab-operations`, `tab-equipment` — табы
- `tabcontent` — контент активного таба
- `tab-actions` — панель действий таба
- `btn-select` — кнопка "Выбрать" (открывает Bitrix picker)
- `btn-catalog` — кнопка "Каталог" (открывает список инфоблока)
- `btn-reset` — кнопка "Сбросить" таб
- `header-detail`, `header-material`, `header-operation`, `header-equipment` — элементы в табах
- `btn-open-header-detail` — открыть деталь в Bitrix
- `btn-delete-header-detail` — удалить деталь из списка
- `btn-open-material` — открыть материал в Bitrix
- `btn-delete-material` — удалить материал
- `btn-open-operation` — открыть операцию в Bitrix
- `btn-delete-operation` — удалить операцию
- `btn-open-equipment` — открыть оборудование в Bitrix
- `btn-delete-equipment` — удалить оборудование

### Карточка детали (DetailCard)
- `detail-card` — контейнер карточки детали
- `detail-header` — шапка карточки
- `detail-drag-handle` — иконка для drag & drop
- `input-detail-name` — input названия детали
- `btn-open-detail-bitrix` — кнопка открыть деталь в Bitrix
- `btn-toggle-detail` — свернуть/развернуть деталь
- `btn-delete-detail` — удалить деталь
- `detail-content` — основное содержимое детали

---

## PostMessage события

### Исходящие события (iframe → Bitrix)

#### `OFFERS_ADD`
Запрос на добавление торговых предложений
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "OFFERS_ADD",
  "payload": {},
  "timestamp": 1234567890
}
```

#### `OFFERS_REMOVE`
Удаление торгового предложения
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "OFFERS_REMOVE",
  "payload": {
    "offerId": 215
  },
  "timestamp": 1234567890
}
```

#### `BITRIX_PICKER_OPEN`
Открыть пикер выбора элементов Bitrix
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "BITRIX_PICKER_OPEN",
  "payload": {
    "iblockId": 100,
    "type": "calculator_catalog",
    "lang": "ru"
  },
  "timestamp": 1234567890
}
```

#### `CONFIG_ITEM_REMOVE`
Удаление элемента из конфигурации
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "CONFIG_ITEM_REMOVE",
  "payload": {
    "kind": "detail|material|operation|equipment",
    "id": 123
  },
  "timestamp": 1234567890
}
```

---

## Изменения в обработке INIT

### Было:
- Демо-данные (selectedVariantIds захардкожены)
- Отсутствие контекста Bitrix
- Метаданные не сохранялись

### Стало:
- `selectedOffers` и `selectedVariantIds` заполняются из INIT
- Контекст Bitrix (baseUrl, lang) сохраняется глобально
- `bitrixMeta` доступен для всех компонентов
- Все демо-данные заменяются на данные из INIT.config

---

## Требования к Bitrix-стороне

### INIT.payload должен содержать:

```typescript
{
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG',
  context: {
    siteId: string,
    userId: string,
    lang: 'ru' | 'en',
    timestamp: number,
    url: string,  // ← ОБЯЗАТЕЛЬНО: базовый URL сайта (например, "https://prospektprint.ru/")
  },
  iblocks: {
    products: number,              // ID инфоблока товаров
    offers: number,                // ID инфоблока торговых предложений
    calcDetailsVariants: number,   // ID инфоблока деталей
    calcMaterialsVariants: number, // ID инфоблока материалов
    calcOperationsVariants: number,// ID инфоблока операций
    calcEquipment: number,         // ID инфоблока оборудования
  },
  iblocksTypes: {
    // Маппинг iblockId → тип инфоблока
    "16": "catalog",
    "17": "offers",
    "100": "calculator_catalog",
    "95": "calculator_catalog",
    // и т.д. для всех iblocks
  },
  selectedOffers: [
    {
      id: number,         // ID торгового предложения
      productId: number,  // ID родительского товара
      name: string,       // Название ТП
      fields?: { ... },   // Поля элемента
      prices?: [ ... ],   // Цены
      properties?: { ... }// Свойства
    }
  ],
  config?: {
    id: number,
    name: string,
    data: {
      details: Detail[],
      bindings: Binding[],
      costingSettings?: CostingSettings,
      salePricesSettings?: SalePricesSettings,
    }
  }
}
```

---

## Тестирование

### Проверка интеграции:

1. **При INIT:**
   - Панель "Торговые предложения" заполняется из `selectedOffers`
   - Демо-данные заменяются на данные из INIT

2. **Tooltip ТП:**
   - При hover на badge появляется tooltip
   - Tooltip не исчезает при переходе курсора на него
   - JSON корректно отображается
   - Кнопка "Copy JSON" копирует в буфер

3. **Кнопки открытия:**
   - Клик на "btn-open-offer" → открывает ТП в новой вкладке Bitrix
   - Клик на "btn-open-product" (в tooltip) → открывает родительский товар
   - Клик на "btn-open-header-detail" → открывает деталь в Bitrix
   - Клик на "btn-catalog" → открывает список инфоблока

4. **PostMessage события:**
   - Клик "btn-add-offer" → отправляется OFFERS_ADD
   - Клик "btn-remove-offer" → отправляется OFFERS_REMOVE с offerId
   - Клик "btn-select" в шапке → отправляется BITRIX_PICKER_OPEN
   - Удаление элемента из шапки → отправляется CONFIG_ITEM_REMOVE

5. **Сборка для Bitrix:**
   ```bash
   VITE_DEPLOY_TARGET=bitrix npm run build
   ```
   - Отсутствуют запросы к `/_spark/*`
   - Приложение работает без ошибок в консоли

---

## Известные ограничения

1. **Иконки открытия в секциях детали** (материал/операция/оборудование внутри CalculatorTabs):
   - Не реализованы в текущей версии
   - Требуют передачи `bitrixMeta` через несколько уровней компонентов
   - Могут быть добавлены в следующей итерации

2. **Демо-режим:**
   - Если `bitrixMeta` отсутствует (не Bitrix-режим), кнопки открытия используют fallback (#placeholder)

---

## Следующие шаги

1. Добавить иконки открытия для материалов/операций/оборудования внутри CalculatorTabs
2. Обработка ответов на события `BITRIX_PICKER_OPEN` (получение выбранных элементов)
3. Синхронизация удалённых элементов с сервером
4. Обработка ошибок при открытии ссылок Bitrix
