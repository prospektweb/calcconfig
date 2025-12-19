# Требования к Bitrix модулю

## Настройки свойств калькулятора

При установке модуля для свойств `USE_OPERATION_VARIANT` и `USE_MATERIAL_VARIANT` должны быть установлены следующие значения:

### USE_OPERATION_VARIANT

```php
[
    'CODE' => 'USE_OPERATION_VARIANT',
    'NAME' => 'Активировать выбор варианта Операции',
    'PROPERTY_TYPE' => 'L',
    'IS_REQUIRED' => 'Y',
    'DEFAULT_VALUE' => 'Y',
    'LIST_TYPE' => 'C', // Checkbox
    'VALUES' => [
        ['VALUE' => 'Да', 'XML_ID' => 'Y', 'DEF' => 'Y'],
    ],
]
```

### USE_MATERIAL_VARIANT

```php
[
    'CODE' => 'USE_MATERIAL_VARIANT', 
    'NAME' => 'Активировать выбор варианта Материала',
    'PROPERTY_TYPE' => 'L',
    'IS_REQUIRED' => 'Y',
    'DEFAULT_VALUE' => 'Y',
    'LIST_TYPE' => 'C', // Checkbox
    'VALUES' => [
        ['VALUE' => 'Да', 'XML_ID' => 'Y', 'DEF' => 'Y'],
    ],
]
```

### DEFAULT_OPERATION_VARIANT

```php
[
    'CODE' => 'DEFAULT_OPERATION_VARIANT',
    'NAME' => 'Операция по умолчанию',
    'PROPERTY_TYPE' => 'S',
    'IS_REQUIRED' => 'N',
]
```

### DEFAULT_MATERIAL_VARIANT

```php
[
    'CODE' => 'DEFAULT_MATERIAL_VARIANT',
    'NAME' => 'Материал по умолчанию',
    'PROPERTY_TYPE' => 'S',
    'IS_REQUIRED' => 'N',
]
```

### OTHER_OPTIONS

```php
[
    'CODE' => 'OTHER_OPTIONS',
    'NAME' => 'Дополнительные опции',
    'PROPERTY_TYPE' => 'S',
    'IS_REQUIRED' => 'N',
]
```

## Цель

Эти настройки обеспечивают, что по умолчанию блоки "Операция" и "Материал" будут активны для всех новых калькуляторов.

## Расположение

Эти изменения должны быть сделаны в файле установки модуля Bitrix (обычно `install/index.php` или аналогичном файле в репозитории модуля Bitrix).

**Примечание:** Данный репозиторий содержит только frontend приложение React. Изменения в PHP файлах модуля Bitrix должны быть сделаны в соответствующем репозитории модуля.
