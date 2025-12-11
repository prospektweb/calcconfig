# Документация интеграции с 1С-Битрикс

## Оглавление

1. [Общий сценарий использования](#общий-сценарий-использования)
2. [Доменная модель](#доменная-модель)
3. [Режимы работы приложения](#режимы-работы-приложения)
4. [Протокол postMessage](#протокол-postmessage)









```

Всё взаимодейств

**ДО МОМЕНТА НАЖАТИЯ КНОПКИ «Сохранить» НИЧЕГО В БИТРИКС НЕ ЗАПИСЫВАЕТСЯ.**

---

### Основные сущности
###
- Имеет свои свойства: назван
- И

- Это то, что поль





```

        └── Товар "Мелованная матовая бумага"

```

#### 4. Инфоблок К

- "Офсет B3"




- какие детали участвуют
- какие калькуляторы используем

### Важное правило по ID

Нельзя ничего хардкодить. Всё, что касается ID, должно воспри
Примеры правильного подхода:
- ✅ `calculatorCode: "DIGITAL_PRINT"` — строковый код, может быть любым








**Что получает прило
- с

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

{
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
  "timestamp": 1234567890123

---
#### 2. INIT (Битрикс → iframe)
**Когда отправляется:**

Передаёт стартовый кон

```typescript
  mode: 'NEW_CONFIG' | 'EXISTING_CONFIG'

   

  }

    materials: number

    calculators: number

  // Выбранны
    id: number         
    name: string            // Название для отображения
  }>
  // Только для режима EXISTING_CONFIG
    id: number              // ID конфигурации в инфоблоке
    data: ConfigData        // Полные данные конфи
}
i
  d

    length: 
  }>
  // Скрепления

    calculators: C

    finishingCalculators: Calcul

  costingSettings?: {
    roundingStep: 0 | 0.1 | 1 | 10 | 100

  
  salePricesSettings?: {

}
interfa
 
  operationQuantity: 
  materialId: number | n
  extraOptions: Record<strin

  c

  ranges: A
    mar
 
}

```json
  "source": "b
  "type": "INIT",
    "mode": "NEW_CONFIG",
      "siteId": "s1",
    
    },
 
   

   

        "productId": 100,

        "id": 526,
        "name": "Постер A3 - тираж 500

  "timestamp": 
```

{

  "payload": 
    "context": {
      "userId": "123",
  
    "iblocks": {
      "opera
      "details": 1
      "configurati
    "selectedOffers":
        "id": 525,
   
  
      "id": 42,
      "data"
          {
            "name": "П
            "length":
              {
                "calcul
                "operation
   
  
            ]
        ],
        "costingSettings": {
          "roundingStep": 1
      }
  },
}



После полной обработки INIT и отрисовки интерфейса.
**Назначение:**

```
 


```json
  "source": "prosp
  "type": "INI
    "mode": "EXI
  },
}



После локальног
**Назначение:**

```typescript
  type: 'test' | 'full'
  // Результаты расчёта
    offerId: number
    // Габариты и вес
      width: number   // мм
    
  
    // Себестоимость
      materials: numb
      equipment: number       // руб
    }
    // Отпускные цены
    
   
  
  summary: {
    calculatedAt: number
}

```
 

    "type": "full",
      {
        "dimensions": {
          "length": 420,
          "weight": 0.15
        "cost": {
          "operations": 600.00,
          "total": 1250.00
        "prices": {
 

        "offerId": 526,
          "width": 297,
          "height": 10,
        },
          "materials": 2250.00,
          "equipm
        },
          "BASE_PRICE":
        }
    ],
    
 
  "

---
#### 5.
*

Запрашивает сохранение конфигур
**Структура paylo
interface Save
  configuration: {
    data: Config
  
  offerUpdates: Array<
    
    fields?: {
      
      weight?: n
    }
    // Цены по типам
    
    properties?: Rec
    // Комментарии
  }>
  // Р
  
  confi
```
**Пример:**
{
  "targe
  "requ
    "mode": "NEW_C
      "name": "Конфигурац
        "details": [
       
     
    
                "id": "calc_
 
   

              }
       
 
          "basedOn": 
        },
          "select
            "B
              "prettyPriceEnab
              "p
                {
                  "mar
                  "
              ]
      
      }
    "offerUpdates": [
        "offerId": 525,
          "width": 297
          "height": 
        },
          "BASE_PRICE": 15
      
      {
       
          "length"
          "weight": 0.75
        "prices": {
       
      
  },
}



Ответ на SA
**Назначение:**

```typescript
  status: 'ok' | 'error' |
  // ID созданной/обновлённо
  
  successOffers?: number[]
  // Ошибки по торговым предложениям
    offerId: number
    code?: string
  
  message?: string
```
**Пример успешного сохранения:**
{
  "target": "
  "requestI
    "statu
    "successOffers": [5
  },
}

```json
  "sour
  "ty
  "p
    "configId": 42,
 
   

   

}

```json
  "source": "bitrix",

  "payload": {
    "message": "Не удалось сохранить конфигурацию: ошибка БД",

        "message": "То
      }
 
}




**Назначени

`
  code?: string
  details?: any
    component?: string
    [key: stri
}

```j
  "source": "prospektweb.cal
 
   

   

      "action": "selectMaterial"

}



При нажатии кнопки «Закрыть» в калькуляторе.


```json
  "saved": false,
}

```json
  "source": "prosp
  "type": "CLOSE_RE
    
  },
}






<button pwcode="btn-

- Используется атрибут `pwcode`, а Н
- React не использует pwcode для лог


|----
| `b
| `tab-materials` | В
| `tab-equipment` | Вкладка | Таб "Оборудование" |
| `h
| `header-item-remove` | Кнопка |
### Основная область 
| pw
| 
| `detail-header` | З
| `detail-to
| `detail-name` | Инп
| `detail-length` | Инпу
| `
|
| `

| `detail-r
| `bind
|
| `binding-name` | Инпут | Назв
| `binding-add-stage`
| `binding-finishing-togg
| `binding-add
| `btn-create-bindi
### Нижняя панел
| pwcod
| `offerspanel` | Конте
| `btn-remove-offer` | 


|--------|---------|--
| `info-panel-toggle` | 
| `gabves-
| `cost-panel` | 
| `cost-panel-message` | Элеме
| `price-panel-toggle` | Кнопка


|--------|
| `cost-markup-valu
| `cost-rounding-step` | Селект 
### Настройки отпускных цен (вну
| pwcode 
| `price
| `pric
| `price-common-limit-e
| `price-range-row` | К
| `price-range-to` | Ин
| `price-range-markup-un
| `price-range-add` | К
### Футер
| pwcode |
| `footer` | Конт
| `btn-cost` | Кнопка | Себесто
| `btn-test-calc` | Кнопка | Тес
| `btn-save` | Кнопка | Сохрани


|--------|---------
| `about-dialog` | Диалог | Диал
---
## Версио
### Тек
**Верс



- **M


-




}




interface SaveR
  configuration: ConfigData

interface SaveRequestP
  configurati
    author?: string
  }
```
#### 2. Изменени
❌ **Несовместимо:**
// 
  

interface InitPayload {
    id: number
  }>
```
#### 3. Добавл
✅ **Правильно:**
// Новый тип сообщени
  offerId: number

{
  "pa
```
### Changelog
#### v1.0.0 (2024-01-15)
- По




// bitrix-integration
clas
  
    this.pendingReque
    this.init();
  
    window.addEventListener('message', (event) => {
      
 
   

        cas
       
 
        case 'CALC_PREVIEW':
          break;
          this.onSaveRequ
        case 'CLOSE_REQUEST':
          brea
          this.onError(ms
      }
  }
  send(type, pa
      source: 'bitri
      type,
      timestamp: Date.now()
    
    
  }
  onReady(msg) {
    this.isRead
    // Отправляем INIT
    this.send('INIT', initPayload);
  
    // Загружаем данные из Битрикс
    const existingConfig = window.E
    return {
      context: {
        userId: window.USER_ID,
        timesta
      iblocks
      confi
  }
  onInitDone(msg) {
  }
  onCalcPreview(msg) {
    
    this.s
  
    console.log('[Bitrix] Save request rec
    try {
      const configId = awai
      // Обновляем торговые предложени
      const successOffers = [];
      for (const update of msg.payload.offerUpdates) 
          await this.updateOffer(update);
        } catch (err) {
            offer
            code: err.code
        }
      
      this.send('SAVE_RESULT', {
        configId,
        errors:
      }, msg.
    } catch
        s
      }
  }
  onCloseRequest(msg)
      i
      }
    
    this.closeCalculato
  
    console.error('[Bi
  
    // Реа
      method: 'POST
      body: JSON.stringify(conf
    
    return result.id;
  
    // 
      method: 'POST',
      body: JSON.st
    
      throw new Error('F
  }
  showPreviewResults(res
    consol
  
    // Закрытие модального окна
  }

const i
```
### 
```php
/
req



    $offer = CCatalogProduct::GetByID(

            'productId'
        ];

// Загружаем ко
if ($configId) {

            'id' => $c
            '
    }

  
    'iblockIds' => [
        'operations
  
        'configurations' => CONFIGURATIONS_IB
];

<html>
    <title>Калькул
        body { marg
    </style>
<body>
    
  
    <script>
        const USER
 
   

            if (!msg || msg.targ
       
 
                case 
                    break;
                    hand
                case 'CLOSE_REQUE
              
        });
        function se
                source: 'bitrix'
                type,
    
            if (requestId) m
 
   

                mode: INIT_DA
       
 
                },
                selectedOffers:
            };
            sendMessage('INIT', i
        
            try {
                   
                    body: J
               
       
                
                sendMessage('SAVE_RESULT', {
                    message: er
       
      
            if (msg.payload.hasChanges && !msg.payload.saved) {
    
            }
 
</b

```
---
#
Данный протокол обесп
- ✅ Независимость от конкретных
- ✅ Безопасность данных 





































































































































































































































































































































































































































































































































































































































































































































