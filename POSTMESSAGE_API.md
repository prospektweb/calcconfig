# PostMessage API Documentation

Калькулятор себестоимости поддерживает двустороннюю коммуникацию с родительским окном через `postMessage` API.

## Архитектура

### Модули

1. **postmessage-bridge.ts** - Основной модуль для отправки и получения сообщений
2. **use-postmessage.ts** - React hook для интеграции в компоненты
3. **App.tsx** - Интеграция в главный компонент приложения

## Типы сообщений

### Исходящие сообщения (из калькулятора)

#### INIT
Отправляется при инициализации калькулятора
```json
{
  "type": "INIT",
  "data": { "ready": true },
  "timestamp": 1234567890
}
```

#### STATE_UPDATE
Отправляется при изменении состояния (с задержкой 500ms для группировки)
```json
{
  "type": "STATE_UPDATE",
  "data": {
    "selectedVariantIds": [525, 526, 527],
    "testVariantId": 525,
    "headerTabs": {
      "materials": [...],
      "operations": [...],
      "equipment": [...],
      "details": [...]
    },
    "details": [...],
    "bindings": [...]
  },
  "timestamp": 1234567890
}
```

#### VARIANT_SELECTED
Отправляется при выборе/изменении вариантов продукции
```json
{
  "type": "VARIANT_SELECTED",
  "data": {
    "variantIds": [525, 526, 527],
    "testVariantId": 525
  },
  "timestamp": 1234567890
}
```

#### DETAIL_ADDED
Отправляется при добавлении новой детали
```json
{
  "type": "DETAIL_ADDED",
  "data": {
    "detail": {
      "id": "detail_1234567890_abc123",
      "name": "Новая деталь",
      "width": 210,
      "length": 297,
      "isExpanded": true,
      "calculators": [...]
    }
  },
  "timestamp": 1234567890
}
```

#### DETAIL_UPDATED
Отправляется при обновлении детали
```json
{
  "type": "DETAIL_UPDATED",
  "data": {
    "detailId": "detail_1234567890_abc123",
    "updates": {
      "name": "Постер A3",
      "width": 297,
      "length": 420
    }
  },
  "timestamp": 1234567890
}
```

#### DETAIL_DELETED
Отправляется при удалении детали
```json
{
  "type": "DETAIL_DELETED",
  "data": {
    "detailId": "detail_1234567890_abc123"
  },
  "timestamp": 1234567890
}
```

#### BINDING_CREATED
Отправляется при создании группы скрепления
```json
{
  "type": "BINDING_CREATED",
  "data": {
    "binding": {
      "id": "binding_1234567890_xyz789",
      "name": "Новая группа скрепления",
      "isExpanded": true,
      "calculators": [...],
      "detailIds": ["detail_1", "detail_2"],
      "bindingIds": [],
      "hasFinishing": false,
      "finishingCalculators": []
    }
  },
  "timestamp": 1234567890
}
```

#### BINDING_UPDATED
Отправляется при обновлении группы скрепления
```json
{
  "type": "BINDING_UPDATED",
  "data": {
    "bindingId": "binding_1234567890_xyz789",
    "updates": {
      "name": "Календарь",
      "hasFinishing": true
    }
  },
  "timestamp": 1234567890
}
```

#### BINDING_DELETED
Отправляется при удалении группы скрепления
```json
{
  "type": "BINDING_DELETED",
  "data": {
    "bindingId": "binding_1234567890_xyz789"
  },
  "timestamp": 1234567890
}
```

#### CALCULATION_START
Отправляется при запуске расчёта
```json
{
  "type": "CALCULATION_START",
  "data": {
    "type": "test" // или "full"
  },
  "timestamp": 1234567890
}
```

#### CALCULATION_PROGRESS
Отправляется в процессе расчёта
```json
{
  "type": "CALCULATION_PROGRESS",
  "data": {
    "progress": 45,
    "type": "test",
    "currentDetail": "detail_1234567890_abc123"
  },
  "timestamp": 1234567890
}
```

#### CALCULATION_COMPLETE
Отправляется при завершении расчёта
```json
{
  "type": "CALCULATION_COMPLETE",
  "data": {
    "type": "test",
    "result": {
      "cost": 1250.00,
      "details": {...}
    }
  },
  "timestamp": 1234567890
}
```

#### ERROR
Отправляется при возникновении ошибки
```json
{
  "type": "ERROR",
  "data": {
    "error": "Описание ошибки",
    "context": {...}
  },
  "timestamp": 1234567890
}
```

### Входящие сообщения (в калькулятор)

#### STATE_REQUEST
Запрос текущего состояния калькулятора
```json
{
  "type": "STATE_REQUEST",
  "data": {},
  "timestamp": 1234567890
}
```

Ответ: автоматически отправляется `STATE_RESPONSE`

#### STATE_RESPONSE
Установка состояния калькулятора из родительского окна
```json
{
  "type": "STATE_RESPONSE",
  "data": {
    "selectedVariantIds": [525, 526],
    "testVariantId": 525,
    "headerTabs": {...},
    "details": [...],
    "bindings": [...]
  },
  "timestamp": 1234567890
}
```

## Примеры использования

### Родительское окно (1С-Битрикс)

#### HTML структура
```html
<!DOCTYPE html>
<html>
<head>
    <title>Интеграция калькулятора</title>
</head>
<body>
    <iframe 
        id="calculator-frame" 
        src="https://your-spark-app.dev" 
        width="100%" 
        height="800"
        style="border: none;"
    ></iframe>
    
    <script src="calculator-integration.js"></script>
</body>
</html>
```

#### JavaScript интеграция
```javascript
// calculator-integration.js

class CalculatorIntegration {
    constructor(iframeId) {
        this.iframe = document.getElementById(iframeId);
        this.state = null;
        this.listeners = new Map();
        
        this.initializeListener();
    }
    
    initializeListener() {
        window.addEventListener('message', (event) => {
            // Для безопасности проверяйте origin
            // if (event.origin !== 'https://your-spark-app.dev') return;
            
            const payload = event.data;
            
            if (!payload || !payload.type) return;
            
            console.log('[Calculator] Received:', payload.type, payload.data);
            
            // Обработка разных типов сообщений
            switch (payload.type) {
                case 'INIT':
                    this.onInit();
                    break;
                case 'STATE_UPDATE':
                    this.onStateUpdate(payload.data);
                    break;
                case 'DETAIL_ADDED':
                    this.onDetailAdded(payload.data.detail);
                    break;
                case 'CALCULATION_COMPLETE':
                    this.onCalculationComplete(payload.data);
                    break;
                // ... другие обработчики
            }
            
            // Вызов пользовательских обработчиков
            const listeners = this.listeners.get(payload.type);
            if (listeners) {
                listeners.forEach(callback => callback(payload.data));
            }
        });
    }
    
    sendMessage(type, data = {}) {
        const payload = {
            type,
            data,
            timestamp: Date.now()
        };
        
        this.iframe.contentWindow.postMessage(payload, '*');
    }
    
    requestState() {
        this.sendMessage('STATE_REQUEST');
    }
    
    setState(state) {
        this.sendMessage('STATE_RESPONSE', state);
    }
    
    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(callback);
        
        return () => {
            const listeners = this.listeners.get(type);
            if (listeners) {
                listeners.delete(callback);
            }
        };
    }
    
    onInit() {
        console.log('[Calculator] Initialized');
        
        // Можно загрузить сохранённое состояние из БД
        // и установить его в калькуляторе
        const savedState = this.loadStateFromDatabase();
        if (savedState) {
            this.setState(savedState);
        }
    }
    
    onStateUpdate(state) {
        this.state = state;
        
        // Сохранить состояние в БД
        this.saveStateToDatabase(state);
    }
    
    onDetailAdded(detail) {
        console.log('[Calculator] Detail added:', detail);
        
        // Создать соответствующую запись в Битрикс
        this.createDetailInBitrix(detail);
    }
    
    onCalculationComplete(data) {
        console.log('[Calculator] Calculation complete:', data);
        
        // Обновить цены в Битрикс
        this.updatePricesInBitrix(data.result);
    }
    
    // Интеграция с БД/API
    loadStateFromDatabase() {
        // Реализация загрузки состояния
        return null;
    }
    
    saveStateToDatabase(state) {
        // Реализация сохранения состояния
        console.log('Saving state:', state);
    }
    
    createDetailInBitrix(detail) {
        // Реализация создания детали в Битрикс
        console.log('Creating detail in Bitrix:', detail);
    }
    
    updatePricesInBitrix(result) {
        // Реализация обновления цен в Битрикс
        console.log('Updating prices in Bitrix:', result);
    }
}

// Инициализация
const calculator = new CalculatorIntegration('calculator-frame');

// Подписка на события
calculator.on('STATE_UPDATE', (state) => {
    console.log('State changed:', state);
    // Ваша логика обработки
});

calculator.on('CALCULATION_COMPLETE', (data) => {
    console.log('Calculation finished:', data);
    // Показать результаты пользователю
});

// Примеры взаимодействия
document.getElementById('load-state').addEventListener('click', () => {
    calculator.requestState();
});

document.getElementById('reset-calculator').addEventListener('click', () => {
    calculator.setState({
        selectedVariantIds: [],
        testVariantId: null,
        headerTabs: {
            materials: [],
            operations: [],
            equipment: [],
            details: []
        },
        details: [],
        bindings: []
    });
});
```

### Пример полной интеграции с PHP (1С-Битрикс)

```php
<?php
// calculator.php

// Загрузка состояния калькулятора из БД
$calculatorState = [];
$variantId = (int)$_GET['variant_id'];

if ($variantId > 0) {
    // Загрузить из БД сохранённое состояние для этого варианта
    $calculatorState = loadCalculatorState($variantId);
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Калькулятор себестоимости</title>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; }
        #calculator-frame { width: 100vw; height: 100vh; border: none; }
    </style>
</head>
<body>
    <iframe 
        id="calculator-frame" 
        src="<?= CALCULATOR_URL ?>"
    ></iframe>
    
    <script>
        const VARIANT_ID = <?= $variantId ?>;
        const INITIAL_STATE = <?= json_encode($calculatorState) ?>;
        
        const iframe = document.getElementById('calculator-frame');
        let isInitialized = false;
        
        window.addEventListener('message', (event) => {
            const payload = event.data;
            
            if (!payload || !payload.type) return;
            
            console.log('[Bitrix] Received:', payload.type);
            
            switch (payload.type) {
                case 'INIT':
                    if (!isInitialized) {
                        isInitialized = true;
                        
                        // Установить начальное состояние
                        if (INITIAL_STATE && Object.keys(INITIAL_STATE).length > 0) {
                            iframe.contentWindow.postMessage({
                                type: 'STATE_RESPONSE',
                                data: INITIAL_STATE,
                                timestamp: Date.now()
                            }, '*');
                        }
                    }
                    break;
                    
                case 'STATE_UPDATE':
                    // Сохранить состояние на сервер
                    saveState(payload.data);
                    break;
                    
                case 'CALCULATION_COMPLETE':
                    // Обновить цены в Битрикс
                    updatePrices(payload.data.result);
                    break;
            }
        });
        
        function saveState(state) {
            fetch('/local/ajax/calculator_save_state.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    variant_id: VARIANT_ID,
                    state: state
                })
            });
        }
        
        function updatePrices(result) {
            fetch('/local/ajax/calculator_update_prices.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    variant_id: VARIANT_ID,
                    result: result
                })
            });
        }
    </script>
</body>
</html>
```

## Безопасность

1. **Проверка origin**: Всегда проверяйте `event.origin` при получении сообщений
2. **Валидация данных**: Проверяйте структуру и типы получаемых данных
3. **HTTPS**: Используйте HTTPS для защиты передаваемых данных
4. **Санитизация**: Очищайте данные перед отправкой в БД

## Отладка

Все сообщения логируются в консоль с префиксами:
- `[PostMessageBridge]` - для событий моста
- `[App]` - для событий приложения

Включите консоль браузера для мониторинга обмена сообщениями.
