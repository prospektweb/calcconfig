# Итоговый summary: Интеграция с Bitrix INIT и универсальные действия

## Что реализовано

### ✅ 1. Универсальная функция `openBitrixAdmin`

Создана функция для открытия элементов и списков инфоблоков в админке Bitrix:
- Файл: `/src/lib/bitrix-utils.ts`
- Поддерживает открытие элемента по ID или списка инфоблока
- Использует контекст Bitrix (baseUrl, lang) из INIT
- Открывает ссылки в новой вкладке

### ✅ 2. Интеграция с INIT

App.tsx обновлён для работы с реальными данными:
- Сохранение `bitrixMeta` из INIT
- Установка контекста Bitrix через `setBitrixContext()`
- Заполнение `selectedOffers` и `selectedVariantIds` из INIT
- Удаление демо-данных после получения INIT
- Передача `bitrixMeta` в дочерние компоненты

### ✅ 3. Панель торговых предложений (VariantsFooter)

Полностью переработана для работы с реальными данными:
- Отображение реальных ТП из `selectedOffers`
- Tooltip при hover на badge с:
  - Названием ТП и ID родительского товара
  - Кнопкой открытия родительского товара
  - JSON-viewer с полными данными оффера
  - Кнопкой копирования JSON
- Интеграция с `openBitrixAdmin` для открытия ТП и товаров
- PostMessage события:
  - `ADD_OFFER_REQUEST` при клике "Выбрать"
  - `REMOVE_OFFER_REQUEST` при удалении оффера

### ✅ 4. Шапка (HeaderSection)

Добавлены события Bitrix для всех кнопок:
- `btn-select` → отправляет `SELECT_REQUEST` с параметрами активного таба
- `btn-catalog` → открывает список инфоблока через `openBitrixAdmin`
- `btn-open-*` → открывают элементы в Bitrix
- `btn-delete-*` → отправляют `CONFIG_ITEM_REMOVE`

Сопоставление табов с инфоблоками:
- Детали → `calcDetailsVariants`
- Материалы → `calcMaterialsVariants`
- Операции → `calcOperationsVariants`
- Оборудование → `calcEquipment`

### ✅ 5. Карточки деталей (DetailCard)

Добавлена кнопка открытия детали в Bitrix:
- Использует `openBitrixAdmin` с iblockId деталей
- Fallback на старое поведение если нет `bitrixMeta`

### ✅ 6. Расширение postMessage протокола

Добавлены новые типы событий:
- `ADD_OFFER_REQUEST` — запрос добавления ТП
- `REMOVE_OFFER_REQUEST` — удаление оффера
- `SELECT_REQUEST` — открыть пикер элементов
- `CONFIG_ITEM_REMOVE` — удаление элемента конфигурации

### ✅ 7. Обновление InitPayload

Расширен интерфейс:
- Добавлено `context.url` — базовый URL сайта
- Добавлены `iblocks.products` и `iblocks.offers`
- Добавлен `iblocksTypes` — маппинг ID → тип
- Расширен формат `selectedOffers` (prices, properties)

### ✅ 8. Документация

Созданы/обновлены документы:
- `BITRIX_INTEGRATION_CHANGELOG.md` — подробный changelog
- `docs/bitrix-integration.md` — обновлена с новыми разделами:
  - Универсальная функция `openBitrixAdmin`
  - Дополнительные события postMessage
  - Панель торговых предложений (Tooltip с JSON)

### ✅ 9. Зависимости

Добавлена библиотека:
- `react-json-view-lite@^2.5.0` — JSON viewer для tooltip

---

## Data-pwcode (полный список)

### Футер — Торговые предложения
- `offerspanel` — панель торговых предложений
- `offer-badge` — badge ТП (повторяется)
- `btn-open-offer` — открыть ТП в Bitrix
- `btn-remove-offer` — удалить ТП
- `btn-add-offer` — добавить ТП
- `btn-toggle-offers` — свернуть/развернуть

### Шапка
- `headersection` — контейнер
- `btn-menu` — гамбургер
- `btn-refresh` — обновить данные
- `header-tabs` — контейнер табов
- `tab-details`, `tab-materials`, `tab-operations`, `tab-equipment`
- `btn-select` — выбрать элементы
- `btn-catalog` — открыть каталог
- `btn-reset` — сбросить таб
- `header-detail`, `header-material`, `header-operation`, `header-equipment`
- `btn-open-header-detail`, `btn-open-material`, `btn-open-operation`, `btn-open-equipment`
- `btn-delete-header-detail`, `btn-delete-material`, `btn-delete-operation`, `btn-delete-equipment`

### Карточка детали
- `detail-card` — контейнер
- `detail-header` — шапка
- `detail-drag-handle` — иконка drag & drop
- `input-detail-name` — input названия
- `btn-open-detail-bitrix` — открыть в Bitrix
- `btn-toggle-detail` — свернуть/развернуть
- `btn-delete-detail` — удалить
- `detail-content` — содержимое

---

## Структура PostMessage событий

### ADD_OFFER_REQUEST
```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "ADD_OFFER_REQUEST",
  "requestId": "req-123",
  "payload": {
    "iblockId": 100,
    "iblockType": "calculator_catalog",
    "lang": "ru"
  },
  "timestamp": 1234567890
}
```

### REMOVE_OFFER_REQUEST
```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "REMOVE_OFFER_REQUEST",
  "requestId": "req-123",
  "payload": { "id": 215, "iblockId": 101, "iblockType": "calculator_catalog", "lang": "ru" },
  "timestamp": 1234567890
}
```

### SELECT_REQUEST
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
  "timestamp": 1234567890
}
```

### CONFIG_ITEM_REMOVE
```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "CONFIG_ITEM_REMOVE",
  "payload": {
    "kind": "material",
    "id": 42
  },
  "timestamp": 1234567890
}
```

---

## Требования к INIT.payload от Bitrix

```typescript
{
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG',
  context: {
    siteId: string,
    userId: string,
    lang: 'ru' | 'en',
    timestamp: number,
    url: string,  // ← ОБЯЗАТЕЛЬНО! Базовый URL (например, "https://prospektprint.ru/")
  },
  iblocks: {
    products: number,
    offers: number,
    calcDetailsVariants: number,
    calcMaterialsVariants: number,
    calcOperationsVariants: number,
    calcEquipment: number,
  },
  iblocksTypes: {
    // Маппинг iblockId → тип
    "16": "catalog",
    "17": "offers",
    "100": "calculator_catalog",
    // ...
  },
  selectedOffers: [
    {
      id: number,
      productId: number,
      name: string,
      fields?: {...},
      prices?: [...],
      properties?: {...}
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

## Сборка для Bitrix

```bash
VITE_DEPLOY_TARGET=bitrix npm run build
```

После сборки бандл готов для размещения на Bitrix-сервере в:
```
/local/apps/prospektweb.calc/
```

---

## Тестирование

### Чек-лист интеграции:

✅ При INIT панель ТП заполняется из selectedOffers  
✅ Tooltip ТП показывается при hover и не исчезает при переходе на него  
✅ JSON корректно отображается в tooltip  
✅ Кнопка "Copy JSON" копирует в буфер  
✅ Клик "btn-open-offer" открывает ТП в Bitrix  
✅ Клик на иконку товара в tooltip открывает товар  
✅ Клик "btn-add-offer" отправляет ADD_OFFER_REQUEST  
✅ Клик "btn-remove-offer" отправляет REMOVE_OFFER_REQUEST  
✅ Клик "btn-select" в шапке отправляет SELECT_REQUEST  
✅ Клик "btn-catalog" открывает список инфоблока  
✅ Клик "btn-open-*" в шапке открывает элементы в Bitrix  
✅ Клик "btn-delete-*" в шапке отправляет CONFIG_ITEM_REMOVE  
✅ Клик "btn-open-detail-bitrix" в детали открывает деталь в Bitrix  
✅ Сборка для Bitrix не содержит запросов к /_spark/*  

---

## Известные ограничения

### Не реализовано в текущей версии:

1. **Иконки открытия внутри CalculatorTabs**
   - Материал/операция/оборудование внутри карточек деталей
   - Требует передачи bitrixMeta через несколько уровней

2. **Обработка ответов от Bitrix picker**
   - После выбора элементов через SELECT_REQUEST
   - Требует доп. события от Bitrix с выбранными элементами

3. **Двусторонняя синхронизация удалений**
   - CONFIG_ITEM_REMOVE отправляется, но ответ не обрабатывается

---

## Следующие шаги (рекомендации)

1. Добавить иконки открытия для материалов/операций/оборудования в CalculatorTabs
2. Реализовать обработку ответов от Bitrix picker
3. Добавить обработку ошибок при открытии ссылок Bitrix
4. Тестирование на реальном Bitrix-хостинге
5. Доработка синхронизации состояния между iframe и Bitrix
