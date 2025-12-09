# Planning Guide

Калькулятор себестоимости печатной продукции - автономное веб-приложение для управления деталями, материалами, операциями, оборудованием и скреплениями с drag-and-drop функциональностью и валидацией в реальном времени.

**Experience Qualities**:
1. **Профессиональный** - Интерфейс должен ощущаться как корпоративное ПО с четкой иерархией и точными элементами управления
2. **Эффективный** - Минимум кликов, возможность быстрой работы через горячие клавиши и drag-drop
3. **Прозрачный** - Все расчеты, валидация и ценообразование должны быть видимыми и отслеживаемыми в реальном времени

**Complexity Level**: Комплексное приложение (продвинутая функциональность)
  - Многоуровневая модель данных с деталями, скреплениями, калькуляторами, материалами, операциями и оборудованием
  - Валидация в реальном времени с проверкой зависимостей
  - Продвинутые drag-drop взаимодействия в разных контекстах
  - Сохранение состояния и отслеживание прогресса расчетов

## Essential Features

### Product Variant Selection
- **Functionality**: Select multiple product variants (trade offers) and designate one for test calculation
- **Purpose**: Initialize calculator with base product parameters (dimensions, quantities)
- **Trigger**: Footer section with variant badges
- **Progression**: Click variant badge → Toggle test marker → Click again to remove test marker → Hover to see variant name and actions → Open in Bitrix or remove from list
- **Success criteria**: Selected variants display in footer, test variant clearly marked, collapsible list for many variants, add button opens Bitrix selection dialog

### Material/Operation/Equipment Header Tabs
- **Functionality**: Four tabbed sections storing frequently used elements with drag-drop to fields
- **Purpose**: Quick access to common materials/operations without repeated selection dialogs
- **Trigger**: Click tab to view, drag elements to calculator fields
- **Progression**: Click tab → View stored elements → Drag to detail field → Field populates → OR click "Select" → Picker modal opens → Choose element → Added to tab
- **Success criteria**: Elements persist in localStorage, can be dragged to appropriate fields, visual feedback on valid/invalid drops, header height adjustable between 80px and 250px

### Detail Cards with Calculator Tabs
- **Functionality**: Draggable accordion cards with sequential numbering containing multiple calculator instances
- **Purpose**: Define each printed component with its production steps
- **Trigger**: "Add Detail" button or drag detail from header
- **Progression**: Add detail → Assigned sequential number → Name it → Drag header to reorder → Expand → Add calculator tab → Select calculator type → Fill operation → Select equipment → Add material → Configure options → Repeat for additional calculators
- **Success criteria**: All required fields validated, calculator tabs can be reordered, details can be reordered via drag-drop, sequential numbers visible, ID and Bitrix link accessible

### Binding System
- **Functionality**: Group multiple details together with sequential numbering, binding operations and optional finishing
- **Purpose**: Model multi-part products (calendars, booklets) that require assembly
- **Trigger**: Click link icon between details
- **Progression**: Click link icon → Binding created with sequential number → Adjacent details moved into binding (avoiding duplicates) → Add binding calculators → Optional: enable finishing → Add finishing calculators
- **Success criteria**: Details visually grouped, binding has sequential number, binding calculators apply to group, details can be dragged in/out, no duplicate details in same binding, ID and Bitrix link accessible

### Validation & Info Panel
- **Functionality**: Real-time validation with color-coded messages and collapsible log
- **Purpose**: Guide users to complete all required fields before calculation
- **Trigger**: Automatic on any state change
- **Progression**: Change field → Validation runs → Messages appear in panel → Errors highlight fields → Fix issues → Messages clear
- **Success criteria**: All error/warning/info states clearly differentiated, scrollable panel with max height, calculate buttons disabled when errors exist

### Cost Calculation with Progress
- **Functionality**: Test and full calculation modes with animated progress bar, plus configuration panels for costing and pricing settings
- **Purpose**: Process complex calculations with user feedback and configure calculation parameters
- **Trigger**: "Test" or "Execute Calculation" buttons, toggle buttons for Costing/Pricing panels
- **Progression**: Click calculate → Progress bar appears → Steps process → Messages log to panel → Completion message → Results displayed
- **Success criteria**: Progress accurately reflects calculation state, user can see which detail is processing, results appear in info panel, settings persist between sessions

### Costing Settings Panel
- **Functionality**: Collapsible panel for configuring cost calculation parameters
- **Purpose**: Control how base costs are calculated and rounded
- **Trigger**: "Себестоимость" toggle button in footer
- **Progression**: Toggle active → Panel opens → Select basis (component purchase/purchase+markup/base price) → Select rounding step (none/0.1/1/10/100) → Settings auto-save
- **Success criteria**: Settings persist in KV storage, panel contains only configuration UI within isolated container (panel-costing), scrollable with stable width

### Sale Prices Settings Panel
- **Functionality**: Multi-type price configuration with dynamic range management
- **Purpose**: Define pricing rules for different customer types with markup ranges and pretty price rounding
- **Trigger**: "Отпускные цены" toggle button in footer
- **Progression**: Toggle active → Panel opens → Select price types (Base/Trade) → For each type: choose correction base (run/cost) → Enable pretty price option → Optionally enable common limit → Add/split ranges with + icon → Configure markup per range (% or RUB) → Settings auto-save
- **Success criteria**: 
  - Multi-select for price types shows/hides type-specific blocks
  - Each price type has independent settings (correction base, pretty price toggles, ranges)
  - Ranges calculate "to" automatically based on next range's "from"
  - First range always from=0 (disabled), last range to=∞
  - + icon splits mid-ranges at midpoint, adds new range at 2x for last range
  - Pretty price limit can be common (one input) or per-range (multiple inputs)
  - Settings persist in KV storage
  - Panel is isolated within container (panel-sale-prices) and scrollable with stable width

### Data Refresh Control
- **Functionality**: Кнопка обновления данных в шапке приложения
- **Purpose**: Обновить текущий контекст без полной перезагрузки страницы
- **Trigger**: Кнопка refresh в шапке рядом с кнопкой меню
- **Progression**: Клик → Кнопка показывает спиннер → Данные обновляются → Уведомление об успехе/ошибке → Кнопка активна
- **Success criteria**: Иконка вращается во время загрузки, состояние disabled предотвращает двойные клики, обработка ошибок с toast уведомлениями

## Edge Case Handling

- **Empty State** - Show helpful "Add your first detail" prompt when no details exist
- **Invalid Drops** - Shake animation and red flash when dragging incompatible element types
- **Missing Dependencies** - Disable equipment dropdown until operation selected, show warning messages
- **Binding Conflicts** - Prevent creating binding when detail already in another binding
- **Calculator Ordering** - Validate calculator sequence (e.g., lamination requires prior printing)
- **Equipment Compatibility** - Filter equipment list based on selected operation's valid equipment
- **Orphaned Slots** - Show drop zone placeholder when detail removed from binding

## Design Direction

The interface should feel precise and professional like CAD software - dense with information but organized clearly through hierarchy and spacing. A neutral, technical aesthetic with subtle color coding for status states creates trust and reduces visual fatigue during long work sessions.

## Color Selection

Custom palette using grayscale foundation with status color accents

- **Primary Color**: Deep charcoal (oklch(0.25 0 0)) - represents precision and technical professionalism, used for headers and primary text
- **Secondary Colors**: Light gray (oklch(0.96 0 0)) for cards and panels, medium gray (oklch(0.75 0 0)) for borders - creates clear visual hierarchy
- **Accent Color**: Blue (oklch(0.55 0.15 250)) for interactive elements and focus states - professional and trustworthy
- **Foreground/Background Pairings**:
  - Background (White oklch(1 0 0)): Dark text (oklch(0.25 0 0)) - Ratio 12.6:1 ✓
  - Card (Light Gray oklch(0.96 0 0)): Dark text (oklch(0.25 0 0)) - Ratio 11.2:1 ✓
  - Primary (Deep Charcoal oklch(0.25 0 0)): White text (oklch(1 0 0)) - Ratio 12.6:1 ✓
  - Accent (Blue oklch(0.55 0.15 250)): White text (oklch(1 0 0)) - Ratio 4.8:1 ✓
  - Success (Green oklch(0.55 0.15 140)): White text (oklch(1 0 0)) - Ratio 4.7:1 ✓
  - Warning (Orange oklch(0.65 0.15 45)): Dark text (oklch(0.25 0 0)) - Ratio 5.2:1 ✓
  - Error (Red oklch(0.55 0.20 25)): White text (oklch(1 0 0)) - Ratio 5.1:1 ✓

## Font Selection

Use a technical sans-serif that balances readability with information density - Inter provides excellent legibility at small sizes with professional appearance.

- **Typographic Hierarchy**:
  - H1 (Main Header): Inter SemiBold/20px/tight - primary navigation tabs
  - H2 (Section Headers): Inter Medium/16px/normal - detail/binding titles
  - H3 (Field Labels): Inter Medium/13px/wide - form field labels
  - Body (Field Values): Inter Regular/14px/normal - inputs and content
  - Small (Meta Info): Inter Regular/12px/normal - IDs and secondary info
  - Mono (IDs): JetBrains Mono Regular/13px - element IDs and technical values

## Animations

Animations should be functional and quick - indicating state changes and relationships without delaying user actions. The technical nature demands efficiency over delight.

- **Purposeful Meaning**: Smooth accordion transitions show/hide complexity, drag animations show spatial relationships, validation shakes indicate errors
- **Hierarchy of Movement**: Progress bar is primary motion during calculation, accordion transitions are secondary, subtle hover states are tertiary

## Component Selection

- **Components**: 
  - Accordion for detail/binding cards (customized for inline header actions)
  - Tabs for header sections and calculator instances
  - Select dropdowns for calculator/operation/equipment (with groups for calculators)
  - Button variants (primary for calculate, ghost for actions, destructive for delete)
  - Card for detail/binding containers
  - Dialog for modals (element picker, settings)
  - Progress bar for calculation status
  - Checkbox for finishing toggle
  - Input with number type for quantities and dimensions
  - Badge for status indicators in info panel
  - ScrollArea for header tabs and info panel
  
- **Customizations**: 
  - Drag-drop overlay zones with dashed borders
  - Inline editable text fields (click to edit)
  - Combined input fields (icon button + readonly input + clear button for pickers)
  - Link icon component between details for binding creation
  - Custom progress bar above info panel
  - PostMessage API integration for parent window communication
  
- **States**: 
  - Inputs with error/warning border colors
  - Buttons disabled during validation errors
  - Accordion headers with hover background
  - Draggable items with grab cursor and reduced opacity while dragging
  - Drop zones with highlighted border and background on drag-over
  
- **Icon Selection**: 
  - Plus (add detail/calculator/range)
  - X (close/delete)
  - CaretDown/CaretUp (accordion toggle)
  - MagnifyingGlass (search in picker)
  - Link/LinkBreak (create/destroy binding)
  - Gear (settings)
  - Calculator (calculate actions)
  - ArrowsOut (fullscreen)
  - Question (open picker)
  - DotsSixVertical (drag handle)
  - ArrowsClockwise (refresh data)
  - Trash (delete range)
  
- **Spacing**: 
  - Cards: p-4 with gap-3 between sections
  - Detail containers: gap-2 for tight grouping
  - Binding containers: gap-1 for visual closeness
  - Form fields: gap-2 vertically, gap-3 between field groups
  - Header tabs: p-3 with gap-2 for elements
  
- **Mobile**: 
  - Приложение оптимизировано для desktop (min-width 1280px), адаптивные версии не предусмотрены

## Хранение данных

Приложение использует встроенный механизм Spark KV storage для сохранения состояния:

- **Детали и скрепления**: Сохраняются автоматически при изменении
- **Настройки расчетов**: Настройки себестоимости и отпускных цен сохраняются в KV storage
- **Состояние панелей**: Состояние развернутости информационных панелей
- **Вкладки шапки**: Материалы, операции, оборудование и детали

Все данные сохраняются локально в браузере и сохраняются между сессиями.
