# Калькулятор себестоимости печатной продукции

## Два режима развёртывания

Приложение работает в одном из двух режимов:

### 🎨 DEMO режим (Spark)
- Для локальной разработки и тестирования
- Демо-данные (торговые предложения)
- Spark KV для персистентности
- Кнопка "Simulate INIT" для тестирования интеграции

### 🏢 BITRIX режим (Production)
- Для деплоя в Bitrix iframe
- NO демо-данных (только из INIT)
- NO запросов к `/_spark/*`
- In-memory хранилище

---

## Быстрый старт

### Development (DEMO режим)
```bash
npm install
npm run dev
```

Откройте http://localhost:5173

Ожидается:
- MODE: DEMO (правый верхний угол)
- OFFERS: DEMO (2 демо-оффера в футере)
- Кнопка "Simulate INIT" для тестирования

---

### Production DEMO (Spark)
```bash
npm run build
npm run preview
```

---

### Production BITRIX (для деплоя в Bitrix)
```bash
npm run build:bitrix
```

или

```bash
VITE_DEPLOY_TARGET=bitrix npm run build
```

**Результат:** `dist/` содержит статический бандл без зависимостей от Spark backend

**Деплой в Bitrix:**
1. Скопировать содержимое `dist/` в `/local/apps/prospektweb.calc/`
2. Открыть iframe в админке Bitrix
3. Bitrix отправит INIT по postMessage
4. Приложение заполнится данными из INIT

---

## Визуальный индикатор режима

В правом верхнем углу отображается:

```
MODE: DEMO | BITRIX
OFFERS: DEMO | INIT
```

**Цвета:**
- MODE: BITRIX → фиолетовый (accent)
- MODE: DEMO → чёрный (primary)
- OFFERS: INIT → зелёный (success)
- OFFERS: DEMO → серый (muted)

**Кнопка "Simulate INIT":**
- Видна только в DEMO режиме (когда OFFERS: DEMO)
- Симулирует приём INIT от Bitrix
- Заменяет демо-офферы на тестовые данные
- Полезно для отладки без реального Bitrix backend

---

## Проверка режима

### DEMO режим

```bash
npm run dev
```

**Checklist:**
- ✅ MODE: DEMO
- ✅ OFFERS: DEMO
- ✅ 2 демо-оффера в футере ("Демо ТП: A4", "Демо ТП: A5")
- ✅ Кнопка "Simulate INIT" видна
- ✅ Network: запросы к `/_spark/kv/*` (это OK)
- ✅ Console: `[MODE] DEMO`

**После клика "Simulate INIT":**
- ✅ OFFERS: INIT
- ✅ 1 симулированный оффер ("Визитки: 50 экз.")
- ✅ Console: `[INIT] Simulated`, `[INIT] applied offers= 1`
- ✅ Toast: "INIT симуляция применена"

---

### BITRIX режим

```bash
npm run build:bitrix
npm run preview
```

**Checklist:**
- ✅ MODE: BITRIX
- ✅ OFFERS: DEMO (изначально пусто)
- ✅ Кнопки "Simulate INIT" НЕТ
- ✅ Network: НЕТ запросов к `/_spark/*`
- ✅ Console: `[MODE] BITRIX`
- ✅ Console: НЕТ ошибок "Failed to set default value for key"

**После получения реального INIT от Bitrix:**
- ✅ OFFERS: INIT
- ✅ Офферы из INIT отображаются
- ✅ Console: `[INIT] received`, `[INIT] applied offers=N`

---

## Структура проекта

```
/
├── src/
│   ├── App.tsx                     # Главный компонент, обработка INIT
│   ├── services/
│   │   └── configStore.ts          # Фабрика хранилищ (Spark/Bitrix)
│   ├── hooks/
│   │   └── use-config-kv.ts        # Hook для работы с конфигом
│   ├── lib/
│   │   ├── postmessage-bridge.ts   # Протокол postMessage
│   │   └── types.ts                # TypeScript типы
│   └── components/
│       └── calculator/             # Компоненты калькулятора
├── DEPLOY_MODES.md                 # 📘 Полная документация режимов
├── DEPLOY_MODES_CHANGELOG.md       # 📝 Changelog по внедрению режимов
├── POSTMESSAGE_API.md              # 📘 Протокол Bitrix postMessage
├── .env                            # Dev конфиг (DEMO по умолчанию)
├── .env.bitrix                     # Production BITRIX конфиг
└── vite.config.ts                  # Vite конфиг с поддержкой режимов
```

---

## Документация

### 📘 Основная документация
- **[DEPLOY_MODES.md](./DEPLOY_MODES.md)** - Полное описание режимов DEMO/BITRIX
  - Архитектура отключения Spark KV
  - Определение режима (env флаги)
  - Протокол INIT
  - Troubleshooting
  - Checklist перед деплоем

### 📝 Changelog
- **[DEPLOY_MODES_CHANGELOG.md](./DEPLOY_MODES_CHANGELOG.md)** - Изменения по внедрению режимов

### 📘 Интеграция с Bitrix
- **[POSTMESSAGE_API.md](./POSTMESSAGE_API.md)** - Протокол postMessage
- **[docs/bitrix-integration.md](./docs/bitrix-integration.md)** - Bitrix integration guide

---

## Технические детали

### Как работает отключение Spark KV в BITRIX

**1. Build-time флаг:**
```bash
VITE_DEPLOY_TARGET=bitrix npm run build
```

**2. Runtime выбор хранилища:**
```typescript
const store = getConfigStore()
// → DEMO: SparkConfigStore (Spark KV)
// → BITRIX: BitrixConfigStore (in-memory Map)
```

**3. SparkConfigStore (DEMO):**
- Использует `window.spark.kv.*`
- Делает запросы к `/_spark/kv/*`
- Асинхронная загрузка (динамический import)

**4. BitrixConfigStore (BITRIX):**
- In-memory `Map<string, any>`
- Hardcoded дефолты
- Инициализация из INIT.payload
- NO сетевых запросов

---

## Environment Variables

### `.env` (Development)
```bash
# DEMO режим по умолчанию
# VITE_DEPLOY_TARGET=spark
```

### `.env.bitrix` (Production)
```bash
VITE_DEPLOY_TARGET=bitrix
```

### Vite config
```typescript
export default defineConfig(({ mode }) => {
  const isBitrixMode = mode === 'bitrix' || process.env.VITE_DEPLOY_TARGET === 'bitrix'
  
  return {
    define: {
      'import.meta.env.VITE_DEPLOY_TARGET': JSON.stringify(
        isBitrixMode ? 'bitrix' : 'spark'
      )
    }
  }
})
```

---

## Troubleshooting

### ❌ Ошибка: "Failed to set default value for key"
**Причина:** BITRIX режим пытается использовать Spark KV  
**Решение:** Проверить `VITE_DEPLOY_TARGET`, пересобрать

### ❌ Запросы к `/_spark/*` в BITRIX режиме
**Причина:** Неправильная инициализация ConfigStore  
**Решение:** Убедиться что `getDeployTarget()` возвращает 'bitrix'

### ❌ Демо-данные не исчезают после INIT
**Причина:** `setOffersSource('INIT')` не вызывается  
**Решение:** Проверить обработчик INIT в App.tsx

### ❌ MODE показывает неправильное значение
**Причина:** Env переменная не передаётся  
**Решение:** Использовать `VITE_` префикс, проверить vite.config.ts

---

## Build команды

```bash
# Development DEMO
npm run dev

# Production DEMO (Spark)
npm run build

# Production BITRIX
npm run build:bitrix

# Preview (после build)
npm run preview
```

---

## Логирование

**Console logs (автоматические):**

```bash
# При старте
[MODE] DEMO
# или
[MODE] BITRIX

# При получении INIT
[INIT] received {mode: "NEW_CONFIG", ...}
[INIT] applied offers= 1

# При инициализации Bitrix store
[BitrixConfigStore] INIT data applied
```

---

## pwcode атрибуты

Все функциональные элементы имеют `pwcode` атрибут для тестирования:

**Новые:**
- `pwcode="btn-simulate-init"` - кнопка симуляции INIT

**Существующие:**
- `pwcode="header"` - шапка
- `pwcode="mainarea"` - основная область
- `pwcode="footer"` - футер
- `pwcode="offerspanel"` - панель офферов
- `pwcode="btn-open-offer"` - открыть оффер в Bitrix
- `pwcode="btn-remove-offer"` - удалить оффер
- `pwcode="btn-add-offer"` - добавить оффер
- ... и другие (см. документацию)

---

## Контакты / Вопросы

При проблемах:
1. Проверить визуальный индикатор (MODE/OFFERS)
2. Проверить Console (`[MODE]`, `[INIT]`)
3. Проверить Network (`/_spark/*`)
4. Обратиться к [DEPLOY_MODES.md](./DEPLOY_MODES.md) → Troubleshooting

---

## Лицензия

MIT

---

*README актуализирован для поддержки двух режимов развёртывания*
