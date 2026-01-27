# Calculation Engine Implementation

## Overview

This document describes the implementation of the Calculation Engine for the calcconfig application. The engine performs progressive calculation of trade offers, details, bindings, and stages with real-time progress updates and comprehensive reporting.

## Features Implemented

### 1. Core Calculation Engine (`/src/services/calculationEngine.ts`)

**Functionality:**
- Asynchronous calculation queue with progressive execution
- Stage-by-stage calculation with cost accumulation
- Support for nested detail groups (bindings)
- Price markup application based on preset configurations
- Real-time progress tracking

**Key Functions:**
- `calculateStage()` - Calculates costs for a single stage (operation + material)
- `calculateDetail()` - Calculates total cost for a detail including all its stages
- `calculateBinding()` - Recursively calculates costs for grouped details
- `calculateOffer()` - Calculates complete offer with all details and price variants
- `calculateAllOffers()` - Processes multiple offers with progress callbacks
- `applyPriceMarkups()` - Applies quantity-based price markups from preset

**Data Flow:**
```
Offer → Details/Bindings → Stages → Operations + Materials
                                   ↓
                         Stage Costs Accumulated
                                   ↓
                         Detail Costs Calculated
                                   ↓
                         Offer Total with Markups
```

### 2. Enhanced Data Structures

**Extended InfoMessage Type (`/src/lib/types.ts`):**
```typescript
interface InfoMessage {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  timestamp: number
  level?: 'calculation' | 'offer' | 'detail' | 'stage' | 'root'
  parentId?: string
  offerId?: number
  detailId?: string
  stageId?: string
  calculationData?: {
    offerName?: string
    productId?: number
    productName?: string
    presetId?: number
    presetName?: string
    presetModified?: string
    // ... detailed calculation results
  }
}
```

**New AppState Fields:**
- `calculationResults` - Stores completed calculation results
- `hasSuccessfulCalculations` - Tracks if there are results ready to save

### 3. Nested Accordion InfoPanel

**Component Architecture:**

```
InfoPanel (parent)
  └─ CalculationReport (per offer)
      ├─ Offer Header (with product & preset info)
      ├─ Copy Buttons (BBCode & Compressed)
      ├─ Details Accordion
      │   ├─ DetailItem (expandable)
      │   │   ├─ Child Details (recursive)
      │   │   └─ StageItems (list)
      │   └─ ...
      └─ Price Summary
          ├─ Calculated Prices
          └─ Prices with Markups
```

**Features:**
- Multi-level accordion expansion
- Automatic price formatting
- Icons for detail types (📦 binding, 📄 detail)
- Timestamp display for messages
- Color-coded message types

### 4. Copy Functionality

**BBCode Format:**
```
[b]Торговое предложение:[/b] {name} | {id}
[b]Товар:[/b] {productId} | {productName}
[b]Пресет:[/b] {presetId} | {presetName} | Изменён: {date}

[b]Детали:[/b]
  - деталь {name} ({purchasePrice} RUB > {basePrice} RUB)
  ...

[b]Итоги расчёта:[/b]
  - {priceTypeName}: {price} {currency}
  ...
```

**Compressed Format:**
```
Торговое предложение {name} | {id}
Детали: деталь {name} ({price} > {price}), ...
Итоги расчёта: {type} - {price} {currency}, ...
```

### 5. UI Changes

**Calculate Button:**
- Now triggers local calculation engine
- Shows progress bar during calculation
- Auto-expands InfoPanel on completion
- Does NOT send data to parent window

**New "Save Calculations" Button:**
- Appears after successful calculations
- Sends calculation results to parent via `CALC_RUN` message
- Hidden when no calculations available
- Uses FloppyDisk icon

**Progress Display:**
- Real-time percentage updates
- Stage-by-stage progress messages
- Smooth progress bar animation

## Technical Details

### Calculation Logic

**Stage Cost Calculation:**
```typescript
operationCost = operationPrice × operationQuantity
materialCost = materialPrice × materialQuantity
totalCost = operationCost + materialCost
```

**Detail Cost Calculation:**
```typescript
detailCost = sum(allStageCosts)
```

**Binding Cost Calculation:**
```typescript
bindingCost = sum(childDetailCosts) + sum(bindingStageCosts)
```

**Markup Application:**
```typescript
if (currency === 'PRC') {
  finalPrice = basePrice × (1 + markupPercent / 100)
} else {
  finalPrice = basePrice + markupRUB
}
```

### Async Execution

The engine uses `setTimeout` with 10ms delay between stages to maintain UI responsiveness:

```typescript
await new Promise(resolve => setTimeout(resolve, 10))
```

This allows:
- Progress updates to render
- User interactions to remain responsive
- Browser to handle other events

### Progress Tracking

Progress is calculated based on total stage count:

```typescript
totalSteps = countAllStages(details, bindings)
currentStep++
percentage = (currentStep / totalSteps) × 100
```

## Integration Points

### PostMessage Bridge

**Modified Behavior:**
- `handleCalculation()` - Now runs local calculation instead of sending `CALC_RUN` immediately
- `handleSaveCalculations()` - New function to send results via `CALC_RUN` with payload

**Message Format:**
```typescript
{
  type: 'CALC_RUN',
  payload: {
    results: CalculationOfferResult[],
    timestamp: number
  }
}
```

### State Management

**React State:**
- `isCalculating` - Boolean flag for calculation in progress
- `calculationProgress` - Number (0-100) for progress bar
- `calculationResults` - Array of completed calculations
- `hasSuccessfulCalculations` - Boolean for button visibility
- `infoMessages` - Extended array with calculation reports

**Zustand Stores (read-only):**
- `useCalculatorSettingsStore` - Calculator configurations
- `useOperationVariantStore` - Operation variants with prices
- `useMaterialVariantStore` - Material variants with prices

## Files Modified

1. **`/src/services/calculationEngine.ts`** (NEW)
   - Core calculation engine
   - Export all calculation types and functions

2. **`/src/components/calculator/CalculationReport.tsx`** (NEW)
   - Nested accordion report component
   - Copy functionality
   - Price formatting utilities

3. **`/src/components/calculator/InfoPanel.tsx`** (MODIFIED)
   - Added CalculationReport rendering
   - Increased scroll area height to 400px
   - Enhanced message display

4. **`/src/lib/types.ts`** (MODIFIED)
   - Extended InfoMessage interface
   - Added AppState fields

5. **`/src/App.tsx`** (MODIFIED)
   - Replaced `handleCalculation()` implementation
   - Added `handleSaveCalculations()` function
   - Added new state variables
   - Updated footer buttons

## Usage Example

```typescript
// User clicks "Calculate" button
handleCalculation() {
  // 1. Set calculating state
  setIsCalculating(true)
  
  // 2. Run calculation engine
  await calculateAllOffers(
    offers,
    product,
    preset,
    details,
    bindings,
    priceTypes,
    progressCallback,  // Updates progress bar
    undefined,
    offerCallback      // Adds to InfoPanel
  )
  
  // 3. Store results
  setCalculationResults(results)
  setHasSuccessfulCalculations(true)
  
  // 4. Show results
  setIsInfoPanelExpanded(true)
}

// User clicks "Save Calculations" button
handleSaveCalculations() {
  // Send results to parent
  postMessageBridge.sendCalcRun({ results })
}
```

## Testing Recommendations

1. **Test with Empty Data:**
   - No details/bindings
   - No stages
   - No offers

2. **Test with Complex Hierarchies:**
   - Multiple nested bindings
   - Large number of stages
   - Multiple price types

3. **Test Copy Functions:**
   - BBCode format correctness
   - Compressed format readability
   - Clipboard integration

4. **Test Progress Updates:**
   - Progress bar accuracy
   - Message updates
   - UI responsiveness

5. **Test Edge Cases:**
   - Zero prices
   - Missing variant data
   - Invalid quantity ranges

## Future Enhancements

1. **Calculation Validation:**
   - Pre-flight checks for missing data
   - Warning messages for incomplete configurations
   - Validation rules for price ranges

2. **Performance Optimization:**
   - Batch stage calculations
   - Memoization of repeated calculations
   - Web Worker for heavy calculations

3. **Enhanced Reporting:**
   - Export to PDF/Excel
   - Comparison between offers
   - Historical calculation tracking

4. **User Preferences:**
   - Save accordion expansion state
   - Custom copy format templates
   - Progress notification settings

## Known Limitations

1. **Price Source:**
   - Currently uses prices from variants (purchasingPrice)
   - Does not traverse to base operations/materials
   - May need enhancement for more complex price hierarchies

2. **Quantity Handling:**
   - Default quantity is 1 for markup application
   - May need per-offer quantity input

3. **Currency Conversion:**
   - All calculations use RUB
   - No multi-currency support yet

4. **Error Handling:**
   - Basic error catching
   - Limited validation of input data
   - No retry mechanism for failed calculations

## Conclusion

The Calculation Engine implementation provides a robust, asynchronous calculation system with comprehensive reporting and user-friendly progress tracking. The nested accordion interface allows users to drill down into calculation details while maintaining an overview of all offers.

The separation of calculation logic (engine) from presentation (InfoPanel) ensures maintainability and testability. The copy functionality enables easy sharing of calculation results in multiple formats.
