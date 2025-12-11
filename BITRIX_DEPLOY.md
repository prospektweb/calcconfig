# Развертывание приложения в 1С-Битрикс

## Быстрый старт

### 1. Сборка для Bitrix

```bash
npm run build:bitrix
```

Эта команда создаст продакшн-бандл в директории `dist/` с отключенными Spark-зависимостями.

### 2. Размещение на сервере

Скопируйте содержимое директории `dist/` на сервер Bitrix по пути:

```
/local/apps/prospektweb.calc/
```

Структура после копирования:

```
/local/apps/prospektweb.calc/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── ...другие статические файлы
```

### 3. Настройка Bitrix

Убедитесь, что страница Bitrix, которая открывает iframe, корректно отправляет сообщение `INIT` после получения `READY`.

## Отличия Bitrix-сборки от dev-версии

### Что отключено

- ❌ Spark KV (никаких запросов к `/_spark/kv/*`)
- ❌ Запросы к `/_spark/loaded`
- ❌ Любые другие Spark-специфичные HTTP-запросы

### Что включено

- ✅ In-memory хранилище для рабочих данных
- ✅ Полная поддержка postMessage протокола
- ✅ Загрузка начальных данных из `INIT`
- ✅ Сохранение через `SAVE_REQUEST`

## Переменные окружения

### VITE_DEPLOY_TARGET

Определяет режим работы приложения:

- `spark` (по умолчанию) — для разработки, использует Spark KV
- `bitrix` — для продакшн-развертывания на Bitrix, использует in-memory storage

### Способы установки

#### Вариант 1: Через npm script (рекомендуется)

```bash
npm run build:bitrix
```

#### Вариант 2: Через .env файл

Создайте файл `.env.bitrix`:

```
VITE_DEPLOY_TARGET=bitrix
```

Затем выполните:

```bash
vite build --mode bitrix
```

#### Вариант 3: Через командную строку

```bash
VITE_DEPLOY_TARGET=bitrix npm run build
```

## Проверка режима

Чтобы убедиться, что приложение работает в Bitrix-режиме, откройте консоль браузера после загрузки приложения и выполните:

```javascript
// Должно вернуть 'bitrix'
import { getDeployTarget } from './src/services/configStore'
console.log(getDeployTarget())
```

Или проверьте, что нет запросов к `/_spark/*` во вкладке Network в DevTools.

## Тестирование Bitrix-режима локально

Для тестирования Bitrix-режима без реального Bitrix-сервера:

### 1. Соберите для Bitrix

```bash
npm run build:bitrix
```

### 2. Запустите локальный сервер

```bash
npm run preview
```

### 3. Откройте в браузере с параметром

```
http://localhost:4173/?deploy=bitrix
```

### 4. Отправьте тестовое сообщение INIT

Откройте консоль браузера и выполните:

```javascript
window.postMessage({
  source: 'bitrix',
  target: 'prospektweb.calc',
  type: 'INIT',
  payload: {
    mode: 'NEW_CONFIG',
    context: {
      siteId: 's1',
      userId: '1',
      lang: 'ru',
      timestamp: Date.now()
    },
    iblocks: {
      materials: 10,
      operations: 11,
      equipment: 12,
      details: 13,
      calculators: 14,
      configurations: 15
    },
    selectedOffers: [
      { id: 525, productId: 100, name: 'Тестовый продукт' }
    ]
  }
}, '*')
```

## Troubleshooting

### Ошибка: "Failed to set default value for key"

**Причина:** Приложение пытается использовать Spark KV вместо Bitrix-режима.

**Решение:** Убедитесь, что:
1. Сборка выполнена с `npm run build:bitrix`
2. Переменная `VITE_DEPLOY_TARGET=bitrix` установлена корректно
3. В консоли нет запросов к `/_spark/*`

### Приложение не реагирует на INIT

**Причина:** Неправильный формат сообщения или origin.

**Решение:**
1. Проверьте структуру сообщения `INIT` согласно документации
2. Убедитесь, что `target: 'prospektweb.calc'`
3. Проверьте, что сообщение `READY` было отправлено приложением

### Данные не сохраняются после нажатия "Сохранить"

**Причина:** Bitrix не обрабатывает сообщение `SAVE_REQUEST`.

**Решение:**
1. Убедитесь, что Bitrix слушает postMessage события
2. Проверьте формат `SAVE_REQUEST` в консоли
3. Реализуйте обработчик `SAVE_REQUEST` на стороне Bitrix

## Структура файлов

```
/workspaces/spark-template/
├── src/
│   ├── services/
│   │   └── configStore.ts          # Абстракция хранилища
│   ├── hooks/
│   │   └── use-config-kv.ts        # React hook для работы с хранилищем
│   ├── lib/
│   │   └── postmessage-bridge.ts   # Протокол postMessage
│   └── App.tsx                      # Инициализация Bitrix-режима
├── .env.example                     # Пример переменных окружения
├── .env.bitrix                      # Переменные для Bitrix-сборки
├── package.json                     # npm scripts
└── docs/
    └── bitrix-integration.md        # Полная документация интеграции
```

## Дополнительная информация

Полная документация протокола и интеграции: [docs/bitrix-integration.md](./docs/bitrix-integration.md)
