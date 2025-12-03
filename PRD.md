# Planning Guide

A sophisticated cost calculator for printing production that manages product variants, materials, operations, equipment, and bindings with drag-and-drop functionality and real-time validation.

**Experience Qualities**:
1. **Professional** - Interface should feel like enterprise-grade software with clear hierarchy and precise controls
2. **Efficient** - Minimize clicks and allow power users to work quickly through keyboard shortcuts and drag-drop
3. **Transparent** - All calculations, validations, and pricing should be visible and traceable in real-time

**Complexity Level**: Complex Application (advanced functionality, accounts)
  - Multi-layered data model with details, bindings, calculators, materials, operations, and equipment
  - Real-time validation with dependency checking
  - Advanced drag-drop interactions across multiple contexts
  - State persistence and calculation progress tracking

## Essential Features

### Product Variant Selection
- **Functionality**: Load and select from pre-defined product variants with specifications
- **Purpose**: Initialize calculator with base product parameters (dimensions, quantities)
- **Trigger**: Application load or variant selector in header
- **Progression**: Display variant IDs → Click ID to inspect → Select test variant → Load into calculator
- **Success criteria**: Selected variants populate the calculator state and display in header

### Material/Work/Equipment Header Tabs
- **Functionality**: Four tabbed sections storing frequently used elements with drag-drop to fields
- **Purpose**: Quick access to common materials/operations without repeated selection dialogs
- **Trigger**: Click tab to view, drag elements to calculator fields
- **Progression**: Click tab → View stored elements → Drag to detail field → Field populates → OR click "Select" → Picker modal opens → Choose element → Added to tab
- **Success criteria**: Elements persist in localStorage, can be dragged to appropriate fields, visual feedback on valid/invalid drops

### Detail Cards with Calculator Tabs
- **Functionality**: Accordion cards containing multiple calculator instances with operation/material/equipment selection
- **Purpose**: Define each printed component with its production steps
- **Trigger**: "Add Detail" button or drag detail from header
- **Progression**: Add detail → Name it → Expand → Add calculator tab → Select calculator type → Fill operation → Select equipment → Add material → Configure options → Repeat for additional calculators
- **Success criteria**: All required fields validated, calculator tabs can be reordered, details can be reordered via drag-drop

### Binding System
- **Functionality**: Group multiple details together with binding operations and optional finishing
- **Purpose**: Model multi-part products (calendars, booklets) that require assembly
- **Trigger**: Click link icon between details
- **Progression**: Click link icon → Binding created → Adjacent details moved into binding → Add binding calculators → Optional: enable finishing → Add finishing calculators
- **Success criteria**: Details visually grouped, binding calculators apply to group, details can be dragged in/out

### Validation & Info Panel
- **Functionality**: Real-time validation with color-coded messages and collapsible log
- **Purpose**: Guide users to complete all required fields before calculation
- **Trigger**: Automatic on any state change
- **Progression**: Change field → Validation runs → Messages appear in panel → Errors highlight fields → Fix issues → Messages clear
- **Success criteria**: All error/warning/info states clearly differentiated, scrollable panel with max height, calculate buttons disabled when errors exist

### Cost Calculation with Progress
- **Functionality**: Test and full calculation modes with animated progress bar
- **Purpose**: Process complex calculations with user feedback
- **Trigger**: "Test" or "Execute Calculation" buttons
- **Progression**: Click calculate → Progress bar appears → Steps process → Messages log to panel → Completion message → Results displayed
- **Success criteria**: Progress accurately reflects calculation state, user can see which detail is processing, results appear in info panel

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
  
- **States**: 
  - Inputs with error/warning border colors
  - Buttons disabled during validation errors
  - Accordion headers with hover background
  - Draggable items with grab cursor and reduced opacity while dragging
  - Drop zones with highlighted border and background on drag-over
  
- **Icon Selection**: 
  - Plus (add detail/calculator)
  - X (close/delete)
  - CaretDown/CaretUp (accordion toggle)
  - MagnifyingGlass (search in picker)
  - Link/LinkBreak (create/destroy binding)
  - Gear (settings)
  - Calculator (calculate actions)
  - ArrowsOut (fullscreen)
  - Question (open picker)
  - DotsSixVertical (drag handle)
  
- **Spacing**: 
  - Cards: p-4 with gap-3 between sections
  - Detail containers: gap-2 for tight grouping
  - Binding containers: gap-1 for visual closeness
  - Form fields: gap-2 vertically, gap-3 between field groups
  - Header tabs: p-3 with gap-2 for elements
  
- **Mobile**: 
  - Desktop-only (min-width 1280px), no responsive adaptations needed per requirements
