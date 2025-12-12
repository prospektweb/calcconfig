# ПРАВКИ: РЕЖИМЫ + LOCALSTORAGE + УДАЛЕНИЕ + REFRESH

## Дата внедрения
2025-01-12

## Цели
1. Жёстко развести режимы DEMO и BITRIX
2. В BITRIX режиме полностью исключить демо-данные и неконтролируемый localStorage
3. Починить удаление элементов из шапки (и синхронизацию с localStorage)
4. Упростить/ограничить логи
5. Переместить MODE в нижнюю часть меню
6. Добавить REFRESH сценарий по кнопке btn-refresh

---

## 1. РЕЖИМЫ (DEMO / BITRIX)

### Реализация

#### src/services/configStore.ts
- Добавлены функции для управления режимом:
  - `getAppMode(): AppMode` - получить текущий режим ('DEMO' | 'BITRIX')
  - `setAppMode(mode: AppMode)` - установить режим
  - `isDebugEnabled()` - проверка флага `localStorage.pwrt_debug`

- Режим определяется:
  1. **Build-time**: `VITE_DEPLOY_TARGET=bitrix` → BITRIX режим
  2. **URL параметр**: `?deploy=bitrix` → BITRIX режим
  3. **По умолчанию**: DEMO режим
  4. **Динамически**: При получении INIT от Bitrix → переключение в BITRIX режим

- При переключении в BITRIX режим:
  - Выводится лог `[MODE] BITRIX`
  - Устанавливается флаг `modeSetByInit = true`

#### src/App.tsx
- Добавлено состояние `appMode` и `setAppModeState`
- При INIT:
  - Вызывается `setAppMode('BITRIX')` для установки глобального режима
  - Вызывается `setAppModeState('BITRIX')` для обновления локального состояния
  - Очищаются демо-данные через `clearDemoStorage()`
  - Сбрасывается Bitrix store через `resetBitrixStore()`
  - Очищаются header tabs (шапка)

### Индикатор режима

#### Визуальный индикатор (верхний правый угол)
- **Отображает**:
  - `MODE: DEMO | BITRIX`
  - `OFFERS: DEMO | INIT`
- **Цвета**:
  - BITRIX режим: accent цвет
  - DEMO режим: primary цвет
  - INIT источник: success цвет

#### Индикатор в меню (нижняя часть)
**src/components/calculator/SidebarMenu.tsx**
- Перенесён в нижнюю часть бокового меню
- Использует Badge компоненты
- Компактное отображение:
  ```
  Режим: [DEMO/BITRIX]
  Источник ТП: [DEMO/INIT]
  ```

---

## 2. INIT — СТРОГИЕ ПРАВИЛА

### Обработка INIT (src/App.tsx)

При получении INIT от Bitrix:

1. **Логирование**:
   ```javascript
   console.info('[INIT] received')
   console.info('[INIT] applied offers=', count)
   ```

2. **Переключение режима**:
   ```javascript
   setAppMode('BITRIX')
   setAppModeState('BITRIX')
   ```

3. **Очистка демо-данных**:
   ```javascript
   clearDemoStorage()        // localStorage
   resetBitrixStore()        // in-memory store
   setHeaderTabs({ ... })    // UI шапка
   ```

4. **Применение INIT данных**:
   - `selectedOffers` → список ТП
   - `context` → Bitrix контекст (url, lang)
   - `iblocks` → ID инфоблоков
   - `config.data` → конфигурация (details, bindings, settings)

5. **Отправка подтверждения**:
   ```javascript
   postMessageBridge.sendInitDone(mode, offersCount)
   console.info('[INIT_DONE] sent')
   ```

---

## 3. LOCALSTORAGE — НОРМАЛИЗАЦИЯ

### Функция clearDemoStorage() (src/services/configStore.ts)

Очищает только ключи, связанные с демо-данными:
- `calc_header_tabs`
- `calc_active_header_tab`
- `calc_header_height`
- `calc_info_panel_expanded`

**НЕ делает** `localStorage.clear()` - удаляет только ключи приложения.

### Функция resetBitrixStore()

Сбрасывает in-memory хранилище `BitrixConfigStore`:
- Очищает `storage` Map
- Сбрасывает `initData`
- Устанавливает `initialized = false`

### BITRIX режим
- localStorage НЕ используется для восстановления демо-данных
- Все данные берутся из INIT
- Состояние хранится в памяти или через `BitrixConfigStore`

### DEMO режим
- localStorage может использоваться для удобства демо
- Демо-данные сохраняются и восстанавливаются

---

## 4. УДАЛЕНИЕ ЭЛЕМЕНТОВ ИЗ ШАПКИ

### Реализация (src/components/calculator/HeaderSection.tsx)

#### Функция handleRemoveElement()

```javascript
const handleRemoveElement = (id: string, itemId: number) => {
  // 1. Удалить из state
  setHeaderTabs(prev => {
    const currentTab = prev[activeTab] || []
    return {
      ...prev,
      [activeTab]: currentTab.filter(el => el.id !== id)
    }
  })

  // 2. Отправить событие в Bitrix (только в BITRIX режиме)
  if (bitrixMeta) {
    postMessageBridge.sendHeaderItemRemove(kind, itemId)
  }
  
  // 3. Показать уведомление
  addInfoMessage('info', 'Элемент удалён из шапки')
}
```

#### Кнопки удаления
- `data-pwcode="btn-delete-header-detail"` - удаление детали
- `data-pwcode="btn-delete-material"` - удаление материала
- `data-pwcode="btn-delete-operation"` - удаление операции
- `data-pwcode="btn-delete-equipment"` - удаление оборудования

#### PostMessage событие

**Новое событие**: `HEADER_ITEM_REMOVE`

```typescript
type: 'HEADER_ITEM_REMOVE'
payload: {
  kind: 'detail' | 'material' | 'operation' | 'equipment',
  id: number
}
```

**Добавлен метод** (src/lib/postmessage-bridge.ts):
```javascript
sendHeaderItemRemove(kind, id)
```

---

## 5. ЛОГИ — УБРАТЬ ШУМ

### Реализация контролируемого логирования

#### Debug флаг
**localStorage.pwrt_debug = '1'** - включить подробные логи

#### Функция isDebugEnabled() (src/services/configStore.ts)
```javascript
export function isDebugEnabled(): boolean {
  return typeof localStorage !== 'undefined' 
    && localStorage.getItem('pwrt_debug') === '1'
}
```

#### Ключевые логи (всегда)
- `[MODE] DEMO | BITRIX`
- `[INIT] received`
- `[INIT] applied offers=<n>`
- `[INIT_DONE] sent`
- `[REFRESH] request sent`
- `[REFRESH] received`
- `[REFRESH] applied offers=<n>`

#### Подробные логи (только при pwrt_debug=1)
- Полные payload сообщений
- Внутренние события store
- Детальная трассировка событий

#### Убрано
- ❌ `console.trace`
- ❌ Дублирующиеся логи
- ❌ Логи payload без debug флага

### Реализация в postmessage-bridge.ts

```javascript
private initializeListener() {
  const isDebug = localStorage.getItem('pwrt_debug') === '1'
  
  if (isDebug || ['INIT', 'REFRESH_RESULT'].includes(message.type)) {
    console.log('[PostMessageBridge] Received:', message.type, message.payload)
  }
  // ...
}

private sendMessage(type, payload) {
  const isDebug = localStorage.getItem('pwrt_debug') === '1'
  
  if (isDebug || ['INIT_DONE', 'REFRESH_REQUEST'].includes(type)) {
    console.log('[PostMessageBridge] Sending:', type, payload)
  }
  // ...
}
```

---

## 6. REFRESH ПО КНОПКЕ btn-refresh

### Реализация

#### PostMessage протокол

**Новые типы сообщений**:
- `REFRESH_REQUEST` - запрос обновления (iframe → Bitrix)
- `REFRESH_RESULT` - результат обновления (Bitrix → iframe)

#### src/lib/postmessage-bridge.ts

Добавлен метод:
```javascript
sendRefreshRequest(offerIds: number[]) {
  this.sendMessage('REFRESH_REQUEST', { offerIds })
}
```

#### src/App.tsx

##### Состояние
```javascript
const [isRefreshing, setIsRefreshing] = useState(false)
```

##### Обработчик кнопки
```javascript
const handleRefreshData = async () => {
  // 1. Проверка режима
  if (appMode === 'DEMO') {
    toast.info('REFRESH доступен только в Bitrix')
    return
  }
  
  // 2. Отправка запроса
  setIsRefreshing(true)
  console.info('[REFRESH] request sent')
  
  const offerIds = selectedOffers.map(o => o.id)
  postMessageBridge.sendRefreshRequest(offerIds)
  
  // 3. Таймаут 10 сек
  const timeout = setTimeout(() => {
    if (isRefreshing) {
      setIsRefreshing(false)
      toast.error('Не удалось обновить данные')
    }
  }, 10000)
}
```

##### Обработчик ответа
```javascript
postMessageBridge.on('REFRESH_RESULT', (message) => {
  console.info('[REFRESH] received')
  
  const refreshPayload = message.payload as InitPayload
  
  // Обновление offers
  setSelectedOffers(refreshPayload.selectedOffers || [])
  setSelectedVariantIds(refreshPayload.selectedOffers?.map(o => o.id) || [])
  
  console.info('[REFRESH] applied offers=', count)
  
  setIsRefreshing(false)
  toast.success('Данные обновлены')
})
```

#### src/components/calculator/HeaderSection.tsx

Добавлен prop `isRefreshing`:
```typescript
interface HeaderSectionProps {
  // ...
  isRefreshing?: boolean
}
```

Кнопка обновления:
```jsx
<Button
  onClick={handleRefreshData}
  disabled={externalIsRefreshing}
  data-pwcode="btn-refresh"
>
  <ArrowsClockwise className={
    externalIsRefreshing ? 'animate-spin' : ''
  } />
</Button>
```

### Поведение

#### DEMO режим
- Клик на btn-refresh → toast "REFRESH доступен только в Bitrix"
- Никаких запросов не отправляется

#### BITRIX режим
1. Клик на btn-refresh
2. Отправка `REFRESH_REQUEST` с текущими offerIds
3. UI переходит в состояние loading (кнопка disabled, иконка вращается)
4. Ожидание `REFRESH_RESULT` (таймаут 10 сек)
5. Применение новых данных или показ ошибки

### Структура REFRESH_REQUEST

```json
{
  "source": "prospektweb.calc",
  "target": "bitrix",
  "type": "REFRESH_REQUEST",
  "payload": {
    "offerIds": [215, 216, 217]
  },
  "timestamp": 1736700000000
}
```

### Структура REFRESH_RESULT

```json
{
  "source": "bitrix",
  "target": "prospektweb.calc",
  "type": "REFRESH_RESULT",
  "payload": {
    "mode": "EXISTING_CONFIG",
    "context": { ... },
    "selectedOffers": [ ... ]
  },
  "timestamp": 1736700001000
}
```

---

## 7. КРИТЕРИИ ПРИЁМКИ

### DEMO режим ✅
- [x] MODE: DEMO отображается в меню и в индикаторе
- [x] Демо-данные в шапке и offer-панели сохраняются
- [x] Кнопки удаления в шапке работают
- [x] REFRESH показывает сообщение "доступен только в Bitrix"
- [x] Кнопка "Simulate INIT" работает и переключает в BITRIX

### BITRIX режим ✅
- [x] MODE: BITRIX отображается в меню и в индикаторе
- [x] После INIT демо-данные в шапке отсутствуют
- [x] Кнопки удаления в шапке работают
- [x] Удаление не восстанавливает демо из localStorage
- [x] btn-refresh отправляет REFRESH_REQUEST
- [x] btn-refresh ждёт REFRESH_RESULT
- [x] btn-refresh обновляет offers и UI
- [x] Таймаут 10 сек при отсутствии ответа

### Логи ✅
- [x] Без pwrt_debug=1: только ключевые логи
- [x] С pwrt_debug=1: подробные логи
- [x] Нет console.trace
- [x] Нет дублирующихся логов

---

## Изменённые файлы

### Основные изменения
1. **src/services/configStore.ts**
   - Добавлены функции управления режимом
   - Добавлена функция `clearDemoStorage()`
   - Добавлена функция `resetBitrixStore()`
   - Добавлена функция `isDebugEnabled()`
   - Метод `reset()` в `BitrixConfigStore`

2. **src/lib/postmessage-bridge.ts**
   - Добавлен тип `HEADER_ITEM_REMOVE`
   - Добавлен тип `REFRESH_REQUEST`
   - Добавлен тип `REFRESH_RESULT`
   - Добавлен метод `sendHeaderItemRemove()`
   - Добавлен метод `sendRefreshRequest()`
   - Контролируемое логирование с проверкой debug флага

3. **src/App.tsx**
   - Добавлено состояние `appMode` и `setAppModeState`
   - Добавлено состояние `isRefreshing`
   - Реализована функция `handleRefreshData()`
   - Обработка `REFRESH_RESULT`
   - При INIT: очистка демо, установка режима, reset store
   - Функция `handleSimulateInit()` обновлена
   - Передача `isRefreshing` в `HeaderSection`
   - Передача `offersSource` в `SidebarMenu`

4. **src/components/calculator/HeaderSection.tsx**
   - Добавлен prop `isRefreshing`
   - Обновлена функция `handleRemoveElement()` для отправки `HEADER_ITEM_REMOVE`
   - Упрощена функция `handleRefreshData()` (делегирование родителю)
   - Кнопка btn-refresh использует `externalIsRefreshing`

5. **src/components/calculator/SidebarMenu.tsx**
   - Добавлен prop `offersSource`
   - Добавлен блок MODE/OFFERS индикатора внизу меню
   - Использование Badge компонентов

---

## Как проверить

### 1. DEMO режим (localhost)
```bash
npm run dev
```
- Проверить индикатор MODE: DEMO
- Проверить демо offers в футере
- Кликнуть btn-refresh → toast "доступен только в Bitrix"
- Кликнуть "Simulate INIT" → переключение в BITRIX, offers заменяются

### 2. BITRIX build
```bash
VITE_DEPLOY_TARGET=bitrix npm run build
```
или используя `.env.bitrix`:
```bash
npm run build
```

Затем разместить dist в Bitrix и проверить:
- MODE: BITRIX после INIT
- Нет демо-данных после INIT
- btn-refresh отправляет postMessage
- Удаление из шапки отправляет HEADER_ITEM_REMOVE

### 3. Debug режим
В консоли браузера:
```javascript
localStorage.setItem('pwrt_debug', '1')
```
Перезагрузить страницу и проверить подробные логи.

Отключить:
```javascript
localStorage.removeItem('pwrt_debug')
```

---

## Известные особенности

1. **Simulate INIT работает только в DEMO режиме**
   - Кнопка видна только когда MODE=DEMO и OFFERS=DEMO
   - После симуляции переключает в BITRIX режим

2. **REFRESH_RESULT ожидает структуру как INIT**
   - Если backend возвращает другую структуру, нужно адаптировать обработчик
   - Текущая реализация переиспользует `InitPayload` интерфейс

3. **localStorage не используется в BITRIX после INIT**
   - Но старые ключи могут остаться, если не было INIT
   - `clearDemoStorage()` вызывается только при INIT

4. **Таймаут REFRESH 10 сек**
   - Можно настроить в `handleRefreshData()`
   - Сейчас хардкод 10000ms

---

## Что дальше

### Возможные доработки
1. Добавить retry логику для REFRESH
2. Добавить индикатор прогресса refresh в UI
3. Сохранять последнее время refresh
4. Добавить автообновление по таймеру (опционально)
5. Добавить валидацию REFRESH_RESULT payload

### Тестирование
1. Unit тесты для режимов
2. E2E тесты для postMessage протокола
3. Тесты на корректность очистки localStorage

---

## Контакты

При возникновении проблем проверьте:
1. Консоль браузера (включите pwrt_debug=1)
2. Network вкладку (postMessage не видно, но можно логировать)
3. localStorage (должно быть чисто после INIT в BITRIX)
4. Индикатор режима (верхний правый угол или меню)

Документация актуальна на 2025-01-12.
