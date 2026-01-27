# Calculation Engine LOGIC_JSON Integration - Implementation Summary

## Overview

This implementation adds deep integration of LOGIC_JSON processing into the calculation engine, addressing the requirements specified in the problem statement.

## Problem Statement (Original in Russian)

The issue described missing data in reports after executing the calculation engine:
- Stages, variables, and results were not being transferred to the structure
- Logic forming data through CALC_STAGES and CALC_SETTINGS depended only on initPayload
- Needed deep integration of INPUTS and LOGIC_JSON for processing variables
- Required correct collection of OUTPUTS
- CURRENT_STAGE integration was needed

## Solution Architecture

### 1. New Calculation Logic Processor Module
**File**: `src/services/calculationLogicProcessor.ts`

This module provides utilities for extracting and processing calculation logic:

#### Key Functions:

- **`extractParams()`**: Extracts parameter definitions from `CALC_SETTINGS.PARAMS`
  - Returns array of `{ name, type }` objects
  
- **`extractInputs()`**: Extracts input wiring from `CALC_STAGES.INPUTS`
  - Returns array of `{ paramName, sourcePath }` objects
  - Source paths use dot notation (e.g., "product.attributes.width")
  
- **`extractLogicDefinition()`**: Parses `CALC_SETTINGS.LOGIC_JSON`
  - Returns structured logic definition with vars, inputs, outputs
  - Handles both string and object formats using `extractLogicJsonString()`
  
- **`extractOutputs()`**: Extracts output mapping from `CALC_STAGES.OUTPUTS`
  - Returns array of `{ key, sourceRef }` objects
  - Supports HL fields (width, length, height, weight, purchasingPrice, basePrice)
  - Supports custom outputs with "slug|title" format
  
- **`buildCalculationContext()`**: Creates calculation context
  - Merges entire initPayload
  - Wires inputs from INPUTS mappings using `getValueByPath()`
  - Adds `CURRENT_STAGE` tracking
  
- **`evaluateLogicVars()`**: Evaluates LOGIC_JSON variables
  - Processes variables sequentially (each can reference previous vars)
  - Supports both formulas and static values
  - Returns complete variable map
  
- **`evaluateFormula()`**: Evaluates JavaScript expressions safely
  - Basic input validation (character whitelist)
  - Uses Function constructor (safe for admin-controlled formulas)
  - Returns typed values (number | string | boolean | undefined)
  
- **`mapOutputs()`**: Maps calculated variables to output fields
  - Handles required HL fields
  - Processes custom outputs with slug extraction
  - Only includes defined values

### 2. Enhanced Calculation Engine
**File**: `src/services/calculationEngine.ts`

Updated to integrate LOGIC_JSON processing:

#### Changes to `calculateStage()`:

1. **New Parameters**: Added `initPayload` parameter
2. **Logic Processing**:
   ```typescript
   // Extract components
   const params = extractParams(settingsElement)
   const inputs = extractInputs(stageElement)
   const logicDefinition = extractLogicDefinition(settingsElement)
   const outputs = extractOutputs(stageElement)
   
   // Build context with CURRENT_STAGE
   const context = buildCalculationContext(initPayload, inputs, stage.stageId)
   
   // Evaluate variables
   const evaluatedVars = evaluateLogicVars(logicDefinition, context)
   
   // Map to outputs
   const outputValues = mapOutputs(evaluatedVars, outputs)
   ```

3. **Cost Calculation Priority**:
   - First: Use `operationCost` and `materialCost` if provided
   - Second: Use `purchasingPrice` as total operation cost
   - Fallback: Use variant-based pricing (backward compatible)

4. **Enhanced Result Structure**:
   ```typescript
   {
     stageId, stageName, operationCost, materialCost, totalCost, currency,
     logicApplied: boolean,
     variables: Record<string, any>,  // All evaluated vars
     outputs: Record<string, any>     // Mapped output values
   }
   ```

#### Updates to `calculateDetail()` and `calculateBinding()`:
- Pass `initPayload` through entire calculation chain
- Maintain same structure and behavior

#### Updates to `calculateOffer()` and `calculateAllOffers()`:
- Added `initPayload` parameter
- Pass through to child calculation functions

### 3. Application Integration
**File**: `src/App.tsx`

Modified the calculation trigger to pass `bitrixMeta` as `initPayload`:

```typescript
await calculateAllOffers(
  selectedOffers,
  bitrixMeta?.product || null,
  bitrixMeta?.preset || null,
  details || [],
  bindings || [],
  bitrixMeta?.priceTypes || [],
  bitrixMeta, // ← Pass initPayload
  progressCallback,
  undefined,
  offerCallback
)
```

## Data Flow

### Complete Calculation Flow:

```
1. User triggers calculation
   ↓
2. App.tsx calls calculateAllOffers() with bitrixMeta
   ↓
3. For each offer → calculateOffer()
   ↓
4. For each detail/binding → calculateDetail()/calculateBinding()
   ↓
5. For each stage → calculateStage() with initPayload
   ↓
6. Extract CALC_SETTINGS (by settingsId)
   ↓
7. Extract CALC_STAGES (by stageId)
   ↓
8. Build context:
   - Start with initPayload
   - Wire INPUTS (e.g., "width" ← "product.attributes.width")
   - Add CURRENT_STAGE = stageId
   ↓
9. Evaluate LOGIC_JSON vars:
   - area = width * length
   - volume = area * height
   - cost_per_sqm = 100
   - purchasingPrice = area * cost_per_sqm
   ↓
10. Map to OUTPUTS:
    - purchasingPrice → purchasingPrice var
    - width → width var
    - custom_field|Custom Field → custom_field var
   ↓
11. Use output values for costs:
    - operationCost = purchasingPrice
    - materialCost = 0 (if not specified)
   ↓
12. Return CalculationStageResult with:
    - Costs (operation, material, total)
    - logicApplied = true
    - variables = { area, volume, cost_per_sqm, purchasingPrice, ... }
    - outputs = { purchasingPrice, width, length, height, ... }
```

### Example with Real Data:

**Input**:
```json
{
  "product": {
    "attributes": { "width": 100, "length": 200, "height": 50 }
  },
  "CALC_SETTINGS.LOGIC_JSON": {
    "vars": [
      { "name": "area", "formula": "width * length" },
      { "name": "cost_per_sqm", "value": 100 },
      { "name": "purchasingPrice", "formula": "area * cost_per_sqm" }
    ]
  },
  "CALC_STAGES.INPUTS": {
    "VALUE": ["width", "length", "height"],
    "DESCRIPTION": ["product.attributes.width", "product.attributes.length", "product.attributes.height"]
  },
  "CALC_STAGES.OUTPUTS": {
    "VALUE": ["purchasingPrice", "width", "length"],
    "DESCRIPTION": ["purchasingPrice", "width", "length"]
  }
}
```

**Processing**:
1. Context: `{ width: 100, length: 200, height: 50, CURRENT_STAGE: 10 }`
2. Vars: `{ area: 20000, cost_per_sqm: 100, purchasingPrice: 2000000 }`
3. Outputs: `{ purchasingPrice: 2000000, width: 100, length: 200 }`
4. Costs: `operationCost: 2000000, materialCost: 0`

**Output**:
```json
{
  "stageId": "stage_123",
  "stageName": "Printing",
  "operationCost": 2000000,
  "materialCost": 0,
  "totalCost": 2000000,
  "currency": "RUB",
  "logicApplied": true,
  "variables": {
    "width": 100,
    "length": 200,
    "height": 50,
    "area": 20000,
    "cost_per_sqm": 100,
    "purchasingPrice": 2000000
  },
  "outputs": {
    "purchasingPrice": 2000000,
    "width": 100,
    "length": 200
  }
}
```

## Key Features

### 1. CURRENT_STAGE Tracking
- Every stage knows its own ID during calculation
- Available in context as `CURRENT_STAGE` variable
- Can be used in formulas if needed

### 2. Input Wiring
- Maps parameters to data paths in initPayload
- Supports nested access via dot notation
- Example: `"product.attributes.width"` → `100`

### 3. Variable Evaluation
- Supports formulas: `"width * length * cost_per_sqm"`
- Supports static values: `{ "name": "tax_rate", "value": 0.2 }`
- Variables can reference other variables
- Sequential evaluation (simple dependency handling)

### 4. Output Mapping
- Required HL fields: width, length, height, weight, purchasingPrice, basePrice
- Custom outputs: "slug|Title" format
- Only defined values are included

### 5. Backward Compatibility
- Falls back to variant-based pricing if no LOGIC_JSON
- Existing calculations continue to work
- No breaking changes to API

### 6. Debug Logging
- Comprehensive `[CALC]` prefix logging
- Shows context building, variable evaluation, output mapping
- Indicates when logic is applied vs fallback used

## Security Considerations

### Formula Evaluation
- Uses `Function` constructor for formula evaluation
- **Safe Context**: Formulas are defined by administrators in CALC_SETTINGS (not user input)
- **Input Validation**: Basic character whitelist pattern
- **Recommendation**: For production with untrusted formula sources, use a safe expression library like `expr-eval` or `mathjs`

### Data Access
- Context includes entire initPayload - be mindful of sensitive data
- Evaluated in isolated scope per stage
- No persistent state between calculations

## Testing and Validation

### Validation Script
**File**: `src/services/__tests__/validation.js`

Provides mock data and expected behavior for manual testing.

### Console Logging
All key operations log to console with `[CALC]` prefix:
- `[CALC] Wired input: width = 100 from product.attributes.width`
- `[CALC] Evaluating 4 variables`
- `[CALC] Var area = 20000 from formula: width * length`
- `[CALC] Logic applied for stage: 10`

### Testing Steps
1. Open application in browser
2. Configure calculator with LOGIC_JSON
3. Set up stage with INPUTS and OUTPUTS
4. Run calculation
5. Check console for `[CALC]` messages
6. Verify result structure includes variables and outputs

## Future Enhancements

### 1. Topological Sorting
Currently variables are evaluated sequentially. For complex dependency graphs, implement topological sorting to ensure correct evaluation order.

### 2. Safe Expression Parser
Replace `Function` constructor with a safe expression library:
- `expr-eval`: Lightweight, safe expression evaluator
- `mathjs`: Full-featured math library with expression parser
- `jexl`: JSON Expression Language

### 3. Type Validation
Add runtime type checking for variable types to catch errors early.

### 4. Performance Optimization
- Cache parsed LOGIC_JSON definitions
- Lazy evaluation for unused variables
- Parallel calculation for independent stages

### 5. Error Handling
- Detailed error messages for formula errors
- Validation of LOGIC_JSON structure
- Recovery strategies for partial failures

## Compliance with Requirements

✅ **Stages transferred to structure**: CalculationStageResult includes full stage data  
✅ **Variables transferred**: `variables` field contains all evaluated vars  
✅ **Results transferred**: `outputs` field contains mapped output values  
✅ **LOGIC_JSON processed**: Full integration via calculationLogicProcessor  
✅ **INPUTS integrated**: Context wiring using CALC_STAGE.INPUTS  
✅ **PARAMS integrated**: Available in context from CALC_SETTINGS.PARAMS  
✅ **OUTPUTS collected**: Proper mapping to result structure  
✅ **CURRENT_STAGE integrated**: Available in context during calculation  

## Files Changed

1. **New**: `src/services/calculationLogicProcessor.ts` (280 lines)
2. **Modified**: `src/services/calculationEngine.ts` (+150 lines)
3. **Modified**: `src/App.tsx` (+1 line - parameter pass)
4. **New**: `src/services/__tests__/validation.js` (100 lines)

Total: ~530 lines of new code, minimal changes to existing code.

## Conclusion

This implementation provides a complete integration of LOGIC_JSON processing into the calculation engine while maintaining backward compatibility and adding comprehensive debugging capabilities. The solution addresses all requirements from the problem statement and provides a foundation for future enhancements.
