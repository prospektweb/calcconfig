# Изменения в проекте: Интеграция с 1С-Битрикс

## Обзор

Проект полностью переработан для интеграции с 1С-Битрикс через протокол postMessage. Добавлена полная документация, обновлён API, изменён формат атрибутов UI.

## Основные изменения

### 1. Документация

✅ **docs/bitrix-integration.md** — комплексная документация (37,000+ символов):
- Общий сценарий использования приложения в контексте Битрикс
- Подробная доменная модель (продукты, торговые предложения, материалы, операции, конфигурации)
- Два режима работы: NEW_CONFIG и EXISTING_CONFIG
- Полное описание протокола postMessage v1.0.0 со всеми типами сообщений
- Примеры payload для каждого сообщения
- Справочник pwcode для всех элементов UI
- Правила версионирования протокола
- Примеры интеграции на JavaScript и PHP

✅ **README.md** — обновлён главный README с фокусом на Битрикс-интеграцию

✅ **README_INTEGRATION.md** — краткое руководство для быстрого старта

### 2. Протокол postMessage

#### Старая версия (удалена)
- Множество разрозненных типов сообщений
- Формат `{ type, data, timestamp }`
- Отсутствие унифицированной структуры

#### Новая версия v1.0.0
- Унифицированный формат `PwrtMessage`:
  ```typescript
  {
    source: 'prospektweb.calc' | 'bitrix',
    target: 'bitrix' | 'prospektweb.calc',
    type: MessageType,
    requestId?: string,
    payload?: any,
    timestamp?: number
  }
  ```

- 8 типов сообщений вместо 14:
  - `READY` — калькулятор загружен
  - `INIT` — инициализация с данными
  - `INIT_DONE` — готовность к работе
  - `CALC_PREVIEW` — предварительный расчёт
  - `SAVE_REQUEST` — сохранение конфигурации
  - `SAVE_RESULT` — результат сохранения
  - `ERROR` — ошибки
  - `CLOSE_REQUEST` — запрос закрытия

#### Файлы

**src/lib/postmessage-bridge.ts**
- Полностью переписан
- Добавлены методы: `sendReady()`, `sendInitDone()`, `sendCalcPreview()`, `sendSaveRequest()`, `sendCloseRequest()`
- Удалены методы: `sendStateUpdate()`, `requestState()`, `sendMessage()` (сделан приватным)
- Добавлена версионность: `protocolVersion` и `protocolCode`

**src/hooks/use-postmessage.ts**
- Упрощён до 6 методов
- Удалена логика автосинхронизации состояния
- Фокус на явных действиях пользователя

### 3. Атрибуты pwcode

#### Изменение формата

**Было:** `data-pwcode="btn-save"`  
**Стало:** `pwcode="btn-save"`

#### Причина
Согласно требованиям задачи, используется атрибут `pwcode`, а не `data-pwcode`.

#### Файлы изменены
- `src/App.tsx` — header, main, footer, кнопки
- `src/vite-end.d.ts` — добавлена декларация типов
- `src/types/global.d.ts` — глобальная декларация для React

#### Охват
Атрибуты заменены для основных элементов:
- Шапка: header, кнопки меню/обновления, табы
- Основная область: mainarea, кнопка создания скрепления
- Футер: footer, все кнопки (габариты, себестоимость, цены, расчёт, сохранение, закрытие)

**Примечание:** В компонентах DetailCard, BindingCard, HeaderSection и других ещё используется `data-pwcode`. Их можно обновить аналогично при необходимости.

### 4. Типы и интерфейсы

#### Новые типы в postmessage-bridge.ts

```typescript
interface InitPayload {
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG'
  context: {
    siteId: string
    userId: string
    lang: 'ru' | 'en'
    timestamp: number
  }
  iblocks: { ... }
  selectedOffers: [ ... ]
  config?: { ... }
}

interface ConfigData {
  details: Detail[]
  bindings: Binding[]
  costingSettings?: CostingSettings
  salePricesSettings?: SalePricesSettings
}

interface CalcPreviewPayload { ... }
interface SaveRequestPayload { ... }
interface SaveResultPayload { ... }
```

#### Экспорт типов
Все основные типы экспортируются из `use-postmessage.ts` для использования в компонентах.

### 5. Удалённая функциональность

❌ Удалены типы сообщений:
- `STATE_UPDATE`
- `STATE_REQUEST`
- `STATE_RESPONSE`
- `VARIANT_SELECTED`
- `DETAIL_ADDED`
- `DETAIL_UPDATED`
- `DETAIL_DELETED`
- `BINDING_CREATED`
- `BINDING_UPDATED`
- `BINDING_DELETED`
- `CALCULATION_START`
- `CALCULATION_PROGRESS`
- `CALCULATION_COMPLETE`

**Причина:** Протокол упрощён. Битрикс не нуждается в детальных уведомлениях о каждом действии пользователя. Достаточно финального SAVE_REQUEST.

❌ Удалён интерфейс `CalculatorState`

**Причина:** Заменён на `ConfigData`, который точнее отражает структуру конфигурации для Битрикс.

### 6. Совместимость

#### Обратная совместимость
**НЕТ** — это breaking change (версия 1.0.0 → 2.0.0 при наличии предыдущих версий).

Старый код интеграции не будет работать. Необходимо обновить:
1. Обработчики сообщений в Битрикс
2. Формат отправляемых данных
3. Типы сообщений

#### Миграция
См. примеры в `docs/bitrix-integration.md`.

## Следующие шаги

### Для завершения интеграции нужно:

1. **Обработка INIT в App.tsx**
   - Добавить подписку на сообщение INIT
   - Загружать конфигурацию из payload
   - Устанавливать режим работы
   - Отправлять INIT_DONE после готовности

2. **Реализация SAVE_REQUEST**
   - Собирать полный снимок конфигурации
   - Формировать маппинг параметров на торговые предложения
   - Отправлять SAVE_REQUEST при нажатии кнопки "Сохранить"
   - Обрабатывать SAVE_RESULT

3. **Реализация CALC_PREVIEW**
   - Отправлять результаты расчёта без сохранения
   - Передавать габариты, вес, себестоимость, цены для всех ТП

4. **Обновление остальных pwcode**
   - Заменить `data-pwcode` на `pwcode` в компонентах:
     - DetailCard
     - BindingCard
     - HeaderSection
     - CostPanel
     - PricePanel
     - VariantsFooter
     - и других

5. **Тестирование**
   - Создать mock-сервер для тестирования полного цикла
   - Обновить test-integration.html под новый протокол
   - Протестировать оба режима: NEW_CONFIG и EXISTING_CONFIG

## Файлы для изучения

1. **docs/bitrix-integration.md** — начните отсюда
2. **src/lib/postmessage-bridge.ts** — ядро API
3. **src/hooks/use-postmessage.ts** — React интеграция
4. **README_INTEGRATION.md** — быстрый старт

## Вопросы и ответы

**Q: Где хранятся ID инфоблоков?**  
A: Приходят в INIT payload, приложение их не хардкодит.

**Q: Когда происходит сохранение в Битрикс?**  
A: Только при нажатии кнопки "Сохранить" → SAVE_REQUEST.

**Q: Что такое pwcode?**  
A: Стабильные идентификаторы элементов UI для автоматизации и тестирования. Полный список в docs/bitrix-integration.md.

**Q: Как расширять протокол?**  
A: Следовать Semantic Versioning. Новые поля — MINOR версия, изменение типов — MAJOR версия.

## Контрольный список

- [x] Создана полная документация (docs/bitrix-integration.md)
- [x] Обновлён протокол postMessage до v1.0.0
- [x] Изменены pwcode атрибуты (частично)
- [x] Добавлены типы для всех сообщений
- [x] Обновлены README файлы
- [ ] Реализована обработка INIT в App.tsx
- [ ] Реализована отправка SAVE_REQUEST
- [ ] Реализована отправка CALC_PREVIEW
- [ ] Обновлены все pwcode в компонентах
- [ ] Создан mock-сервер для тестирования
- [ ] Обновлён test-integration.html

---

**Дата:** 2024-01-15  
**Версия протокола:** 1.0.0 (pwrt-v1)  
**Статус:** Документация готова, API обновлён, требуется реализация интеграции в App.tsx
