# PostMessage API Documentation (Refactored)

Калькулятор себестоимости поддерживает двустороннюю коммуникацию с Битрикс через `postMessage` API.

## Протокол

**Версия**: pwrt-v1  
**Protocol Code**: pwrt-v1

Все сообщения (кроме READY, INIT, INIT_DONE) должны содержать поле `protocol: "pwrt-v1"` и `requestId`.

## Типы сообщений (19 типов)

### Жизненный цикл

#### READY
Отправляется калькулятором при готовности к работе.

**Направление**: Калькулятор → Битрикс

```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "READY",
  "payload": {
    "version": "1.0.0",
    "timestamp": 1234567890
  }
}
```

#### INIT
Отправляется Битрикс для инициализации калькулятора с данными.

**Направление**: Битрикс → Калькулятор

```json
{
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "INIT",
  "payload": {
    "context": {
      "siteId": "s1",
      "userId": "1",
      "lang": "ru",
      "timestamp": 1234567890,
      "url": "https://example.com"
    },
    "iblocks": [...],
    "iblocksTree": {...},
    "selectedOffers": [...],
    "preset": {...},
    "elementsStore": {...}
  }
}
```

#### INIT_DONE
Отправляется калькулятором после завершения инициализации.

**Направление**: Калькулятор → Битрикс

```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "INIT_DONE",
  "payload": {
    "offersCount": 3
  }
}
```

### Общие сообщения

#### ERROR
Отправляется при возникновении ошибки.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "ERROR",
  "payload": {
    "code": "VALIDATION_ERROR",
    "message": "Не выбран калькулятор",
    "details": {...},
    "context": {...}
  }
}
```

#### CLOSE_REQUEST
Запрос на закрытие калькулятора.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "CLOSE_REQUEST",
  "payload": {
    "saved": true,
    "hasChanges": false
  }
}
```

#### RESPONSE
**ЕДИНЫЙ тип ответа** на любой `*_REQUEST`. Заменяет все старые `*_RESPONSE` типы.

**Направление**: Битрикс → Калькулятор

```json
{
  "protocol": "pwrt-v1",
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "RESPONSE",
  "requestId": "add_detail_request_1234567890_abc123",
  "payload": {
    "requestType": "ADD_DETAIL_REQUEST",
    "requestId": "add_detail_request_1234567890_abc123",
    "status": "success",
    "message": "Деталь успешно создана",
    "state": {
      "elementsStore": {...},
      "preset": {...}
    }
  }
}
```

### Расчёт и сохранение

#### CALC_PREVIEW
Отправляется для предпросмотра результатов расчёта.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "CALC_PREVIEW",
  "requestId": "calc_preview_1234567890_abc123",
  "payload": {
    "type": "test",
    "results": [...],
    "summary": {
      "totalCost": 1500.50,
      "calculatedAt": 1234567890
    }
  }
}
```

#### SAVE_REQUEST
Запрос на сохранение конфигурации.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "SAVE_REQUEST",
  "requestId": "save_1234567890",
  "payload": {
    "configuration": {
      "name": "Конфигурация 1",
      "data": {...}
    },
    "offerUpdates": [...],
    "configId": 123
  }
}
```

**Ответ**: RESPONSE с requestType="SAVE_REQUEST"

### Загрузка данных элемента

#### LOAD_ELEMENT_REQUEST
**НОВЫЙ**: Объединяет CALC_SETTINGS_REQUEST, CALC_OPERATION_REQUEST, CALC_MATERIAL_REQUEST и т.д.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "LOAD_ELEMENT_REQUEST",
  "requestId": "load_element_request_1234567890_abc123",
  "payload": {
    "elementType": "calculator",
    "elementId": 42,
    "iblockId": 10,
    "iblockType": "calculator"
  }
}
```

**elementType**: `"calculator"` | `"operation"` | `"material"` | `"equipment"`

**Ответ**: RESPONSE с requestType="LOAD_ELEMENT_REQUEST" и state.loadedElement

### Детали

#### ADD_DETAIL_REQUEST
Создание новой детали. (Переименован из ADD_NEW_DETAIL_REQUEST)

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "ADD_DETAIL_REQUEST",
  "requestId": "add_detail_request_1234567890_abc123",
  "payload": {
    "offerIds": [525, 526],
    "name": "Новая деталь",
    "iblockId": 15,
    "iblockType": "calculator"
  }
}
```

**Ответ**: RESPONSE с requestType="ADD_DETAIL_REQUEST"

#### SELECT_DETAILS_REQUEST
Запрос на выбор существующих деталей из справочника.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "SELECT_DETAILS_REQUEST",
  "requestId": "select_details_request_1234567890_abc123",
  "payload": {
    "iblockId": 15,
    "iblockType": "calculator"
  }
}
```

**Ответ**: RESPONSE с requestType="SELECT_DETAILS_REQUEST"

#### UPDATE_DETAIL_REQUEST
Обновление детали. **НОВЫЙ**: объединяет CHANGE_NAME_DETAIL_REQUEST и другие операции обновления.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "UPDATE_DETAIL_REQUEST",
  "requestId": "update_detail_request_1234567890_abc123",
  "payload": {
    "detailId": 100,
    "updates": {
      "name": "Новое название",
      "width": 210,
      "length": 297
    },
    "iblockId": 15,
    "iblockType": "calculator"
  }
}
```

**Ответ**: RESPONSE с requestType="UPDATE_DETAIL_REQUEST"

#### DELETE_DETAIL_REQUEST
Удаление детали.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "DELETE_DETAIL_REQUEST",
  "requestId": "delete_detail_request_1234567890_abc123",
  "payload": {
    "detailId": 100,
    "iblockId": 15,
    "iblockType": "calculator"
  }
}
```

**Ответ**: RESPONSE с requestType="DELETE_DETAIL_REQUEST"

### Этапы

#### ADD_STAGE_REQUEST
Создание нового этапа. (Переименован из ADD_NEW_STAGE_REQUEST)

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "ADD_STAGE_REQUEST",
  "requestId": "add_stage_request_1234567890_abc123",
  "payload": {
    "detailId": 100,
    "previousStageId": 50,
    "iblockId": 20,
    "iblockType": "calculator"
  }
}
```

**Ответ**: RESPONSE с requestType="ADD_STAGE_REQUEST"

#### UPDATE_STAGE_REQUEST
**НОВЫЙ**: Обновление этапа.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "UPDATE_STAGE_REQUEST",
  "requestId": "update_stage_request_1234567890_abc123",
  "payload": {
    "stageId": 50,
    "detailId": 100,
    "updates": {
      "calculatorId": 42,
      "operationId": 10,
      "materialId": 15,
      "equipmentId": 8,
      "operationQuantity": 2,
      "materialQuantity": 1.5
    },
    "iblockId": 20,
    "iblockType": "calculator"
  }
}
```

**Ответ**: RESPONSE с requestType="UPDATE_STAGE_REQUEST"

#### DELETE_STAGE_REQUEST
Удаление этапа (с расширенной информацией).

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "DELETE_STAGE_REQUEST",
  "requestId": "delete_stage_request_1234567890_abc123",
  "payload": {
    "stageId": 50,
    "detailId": 100,
    "previousStageId": 49,
    "nextStageId": 51,
    "iblockId": 20,
    "iblockType": "calculator"
  }
}
```

**Ответ**: RESPONSE с requestType="DELETE_STAGE_REQUEST"

### Группы/Скрепления

#### ADD_GROUP_REQUEST
Создание новой группы. (Переименован из ADD_NEW_GROUP_REQUEST)

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "ADD_GROUP_REQUEST",
  "requestId": "add_group_request_1234567890_abc123",
  "payload": {
    "name": "Группа скрепления",
    "detailIds": [100, 101, 102],
    "iblockId": 15,
    "iblockType": "calculator"
  }
}
```

**Ответ**: RESPONSE с requestType="ADD_GROUP_REQUEST"

#### UPDATE_GROUP_REQUEST
**НОВЫЙ**: Обновление группы.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "UPDATE_GROUP_REQUEST",
  "requestId": "update_group_request_1234567890_abc123",
  "payload": {
    "groupId": "group_123",
    "updates": {
      "name": "Новое название группы"
    },
    "iblockId": 15,
    "iblockType": "calculator"
  }
}
```

**Ответ**: RESPONSE с requestType="UPDATE_GROUP_REQUEST"

#### DELETE_GROUP_REQUEST
Удаление группы.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "DELETE_GROUP_REQUEST",
  "requestId": "delete_group_request_1234567890_abc123",
  "payload": {
    "groupId": "group_123",
    "detailIdToKeep": 100,
    "deleteAll": false,
    "iblockId": 15,
    "iblockType": "calculator"
  }
}
```

**Ответ**: RESPONSE с requestType="DELETE_GROUP_REQUEST"

### Сортировка

#### REORDER_REQUEST
**НОВЫЙ**: Изменение порядка элементов (деталей, этапов, групп).

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "REORDER_REQUEST",
  "requestId": "reorder_request_1234567890_abc123",
  "payload": {
    "entityType": "stages",
    "parentId": 100,
    "orderedIds": [50, 51, 52, 53],
    "iblockId": 20,
    "iblockType": "calculator"
  }
}
```

**entityType**: `"details"` | `"stages"` | `"groups"`

**Ответ**: RESPONSE с requestType="REORDER_REQUEST"

### Обновление данных

#### REFRESH_REQUEST
Запрос на обновление данных из Битрикс.

**Направление**: Калькулятор → Битрикс

```json
{
  "protocol": "pwrt-v1",
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "REFRESH_REQUEST",
  "requestId": "refresh_request_1234567890_abc123",
  "payload": {
    "offerIds": [525, 526, 527]
  }
}
```

**Ответ**: RESPONSE с requestType="REFRESH_REQUEST" и обновленным state

## Удаленные типы

Следующие типы были удалены в ходе рефакторинга:

- `ADD_OFFER_REQUEST` - не используется
- `REMOVE_OFFER_REQUEST` - не используется
- `SELECT_REQUEST` - старая шапка с табами удалена
- `SELECT_DONE` - заменён на RESPONSE
- `CONFIG_ITEM_REMOVE` - не используется
- `HEADER_ITEM_REMOVE` - не используется
- `COPY_DETAIL_REQUEST` / `COPY_DETAIL_RESPONSE` - не используется
- `USE_DETAIL_REQUEST` / `USE_DETAIL_RESPONSE` - объединён с SELECT_DETAILS_REQUEST
- `SYNC_VARIANTS_REQUEST` / `SYNC_VARIANTS_RESPONSE` - дублирует REFRESH
- `SAVE_RESULT` - заменён на RESPONSE
- `REFRESH_RESULT` - заменён на RESPONSE

**Все `*_RESPONSE` типы заменены на единый RESPONSE**:
- `CALC_SETTINGS_RESPONSE`
- `CALC_OPERATION_RESPONSE`
- `CALC_MATERIAL_RESPONSE`
- `CALC_OPERATION_VARIANT_RESPONSE`
- `CALC_MATERIAL_VARIANT_RESPONSE`
- `ADD_NEW_DETAIL_RESPONSE`
- `SELECT_DETAILS_RESPONSE`
- `DELETE_DETAIL_RESPONSE`
- `DELETE_STAGE_RESPONSE`
- `CHANGE_NAME_DETAIL_RESPONSE`
- `ADD_NEW_GROUP_RESPONSE`
- `DELETE_GROUP_RESPONSE`
- `ADD_NEW_STAGE_RESPONSE`

## Обратная совместимость

Для обеспечения обратной совместимости:

1. **Калькулятор** сохраняет старые методы отправки:
   - `sendCalcSettingsRequest()` → использует `sendLoadElementRequest('calculator', ...)`
   - `sendCalcOperationVariantRequest()` → использует `sendLoadElementRequest('operation', ...)`
   - `sendCalcMaterialVariantRequest()` → использует `sendLoadElementRequest('material', ...)`

2. **Битрикс** может продолжать отправлять старые типы ответов (`CALC_SETTINGS_RESPONSE`, etc.), калькулятор их обрабатывает.

3. Рекомендуется переход на новый единый `RESPONSE` тип на стороне Битрикс.

## Пример интеграции

### Отправка запроса из калькулятора

```typescript
// Отправить запрос на загрузку калькулятора
postMessageBridge.sendLoadElementRequest(
  'calculator',
  42,
  10,
  'calculator'
)
```

### Обработка ответа в калькуляторе

```typescript
// Слушать единый RESPONSE
postMessageBridge.on('RESPONSE', (message) => {
  const { requestType, status, state, message: errorMessage } = message.payload
  
  if (status === 'error') {
    toast.error(errorMessage)
    return
  }
  
  switch (requestType) {
    case 'LOAD_ELEMENT_REQUEST':
      if (state?.loadedElement) {
        // Обработать загруженный элемент
        console.log('Loaded:', state.loadedElement)
      }
      break
      
    case 'ADD_DETAIL_REQUEST':
      if (state?.preset) {
        // Обновить состояние
        console.log('Detail added:', state.preset)
      }
      break
      
    // ... другие случаи
  }
})
```

### Отправка ответа из Битрикс

```javascript
// Битрикс отправляет единый RESPONSE
iframe.contentWindow.postMessage({
  protocol: 'pwrt-v1',
  source: 'bitrix',
  target: 'prospektweb.calc',
  type: 'RESPONSE',
  requestId: message.requestId, // из исходного запроса
  timestamp: Date.now(),
  payload: {
    requestType: 'ADD_DETAIL_REQUEST',
    requestId: message.requestId,
    status: 'success',
    message: 'Деталь успешно создана',
    state: {
      preset: {...},
      elementsStore: {...}
    }
  }
}, '*')
```

## Отладка

Для включения режима отладки:

```javascript
localStorage.setItem('pwrt_debug', '1')
```

Все сообщения будут логироваться в консоль с префиксом `[PostMessageBridge]`.
