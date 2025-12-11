# Внедрение режима Bitrix Deploy (без Spark KV)

## Резюме изменений

Реализован специальный режим развертывания приложения для 1С-Битрикс, который полностью исключает зависимость от Spark KV и HTTP-запросов к эндпоинтам `/_spark/*`.

## Что было сделано

### 1. Создана абстракция ConfigStore

**Файл:** `src/services/configStore.ts`

Создан универсальный интерфейс для работы с хранилищем конфигураций:

```typescript
interface ConfigStore {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
  getOrSetDefault<T>(key: string, defaultValue: T): Promise<T>
}
```

**Две реализации:**

1. **SparkConfigStore** — для dev-режима, использует `window.spark.kv`
2. **BitrixConfigStore** — для продакшн-режима, использует:
   - In-memory Map для хранения рабочих данных
   - Данные из `INIT.payload.config.data` (если есть)
   - Захардкоженные дефолты для всех ключей

**Функции:**

- `getDeployTarget()` — определяет режим работы
- `createConfigStore()` — фабрика, создает правильную реализацию
- `initializeBitrixStore()` — инициализирует Bitrix-хранилище данными из INIT

### 2. Создан React Hook для работы с хранилищем

**Файл:** `src/hooks/use-config-kv.ts`

Универсальный хук `useConfigKV<T>` который заменяет `useKV` из `@github/spark/hooks`:

```typescript
const [details, setDetails] = useConfigKV<Detail[]>('calc_details', [])
```

- Работает идентично `useKV` по API
- Автоматически определяет режим (Spark или Bitrix)
- Поддерживает функциональные обновления: `setValue(prev => ...)`

### 3. Обновлен App.tsx

**Изменения:**

1. Заменены все вызовы `useKV` на `useConfigKV`
2. Добавлен импорт утилит из `configStore`
3. Добавлен `useEffect` для обработки сообщения `INIT` в Bitrix-режиме:
   - Инициализирует хранилище данными из payload
   - Загружает конфигурацию (details, bindings, settings)
   - Отправляет `INIT_DONE` обратно в Bitrix

### 4. Обновлен main.tsx

**Изменения:**

Сделан условный импорт Spark SDK:

```typescript
const deployTarget = import.meta.env.VITE_DEPLOY_TARGET || 'spark'
if (deployTarget === 'spark') {
  await import("@github/spark/spark")
}
```

В Bitrix-режиме Spark SDK не загружается вообще.

### 5. Добавлена конфигурация сборки

**Файлы:**

- `.env.example` — пример переменных окружения
- `.env.bitrix` — конфигурация для Bitrix-сборки
- `package.json` — добавлен script `build:bitrix`

**Команда для сборки:**

```bash
npm run build:bitrix
```

### 6. Создана документация

**Файлы:**

1. **docs/bitrix-integration.md** — полная документация:
   - Описание режимов развертывания
   - Подробный протокол postMessage
   - Список всех pwcode элементов
   - Версионность протокола

2. **BITRIX_DEPLOY.md** — краткая инструкция по развертыванию:
   - Быстрый старт
   - Как собрать и разместить на сервере
   - Тестирование локально
   - Troubleshooting

## Как это работает

### В режиме Spark (dev)

1. Приложение использует `SparkConfigStore`
2. Данные сохраняются через `window.spark.kv` (HTTP-запросы к `/_spark/kv/*`)
3. Импортируется `@github/spark/spark`

### В режиме Bitrix (production)

1. Приложение использует `BitrixConfigStore`
2. Данные хранятся **только в памяти** (in-memory Map)
3. Начальные данные загружаются из `INIT` сообщения от Bitrix
4. Никаких HTTP-запросов к `/_spark/*`
5. Сохранение только через `SAVE_REQUEST` → Bitrix

## Переключение режимов

Режим определяется автоматически:

1. **Проверяется** `import.meta.env.VITE_DEPLOY_TARGET`
2. **Проверяется** URL параметр `?deploy=bitrix`
3. **По умолчанию** используется `'spark'`

## Дефолтные значения в Bitrix-режиме

Все ключи имеют захардкоженные дефолты в `BitrixConfigStore`:

```typescript
{
  'calc_header_tabs': { materials: [], operations: [], equipment: [], details: [] },
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

Эти дефолты используются, если:
- Приложение запускается в режиме `NEW_CONFIG`
- В `INIT` не пришли соответствующие данные

## Проверка работоспособности

### 1. Проверить отсутствие запросов к /_spark/*

Откройте DevTools → Network, отфильтруйте по `_spark`. Не должно быть никаких запросов.

### 2. Проверить режим в консоли

```javascript
// Должно вернуть 'bitrix'
import { getDeployTarget } from './src/services/configStore'
console.log(getDeployTarget())
```

### 3. Проверить обработку INIT

Отправьте тестовое сообщение `INIT` через postMessage. Приложение должно:
1. Загрузить данные из payload
2. Отправить `INIT_DONE`
3. Отобразить интерфейс с загруженными данными

## Что НЕ изменилось

- ✅ Протокол postMessage остался прежним
- ✅ Структура UI не изменилась
- ✅ Все pwcode остались на месте
- ✅ Логика работы приложения осталась прежней
- ✅ Dev-режим со Spark KV работает как раньше

## Итого

Приложение теперь может быть развернуто на обычном Bitrix-хостинге **без каких-либо backend-эндпоинтов** для Spark. Все данные:
- Загружаются через postMessage при старте
- Хранятся в памяти во время работы
- Сохраняются через postMessage при нажатии "Сохранить"

**Никаких ошибок "Failed to set default value for key" в продакшн-режиме быть не должно.**
