# Testing Guide: Calculate Button Visibility

## Overview
This guide explains how to test the new Calculate button visibility logic that hides the button when there are unsaved changes in calculation logic stages.

## What Changed
- The "Calculate" button (Рассчитать) now conditionally displays based on stage readiness
- The button is hidden if any stage has unsaved changes (drafts) in localStorage
- The button is hidden if any stage is missing required output fields
- Diagnostic logs are printed to the browser console to help debug readiness issues

## Testing Scenarios

### Scenario 1: Normal Operation (Button Visible)
**Expected Result:** Calculate button is visible

**Steps:**
1. Open the calculator in the browser
2. Ensure all stages have their calculation logic saved (no drafts in localStorage)
3. Verify all stages have the required output fields (width, length, height, weight, purchasingPrice, basePrice)
4. Check browser console for: `[READINESS CHECK] All stages ready - Calculate button visible`
5. Verify the Calculate button is visible at the bottom of the page

### Scenario 2: Unsaved Draft (Button Hidden)
**Expected Result:** Calculate button is hidden

**Steps:**
1. Open the calculator in the browser
2. Navigate to a stage's calculation logic dialog
3. Make changes to the logic without clicking "Сохранить" (Save)
4. Close the dialog (draft should be saved to localStorage)
5. Check browser console for warning:
   ```
   [READINESS CHECK] Calculate button hidden due to blocking stages: [...]
   - [Detail Name] Stage Name (stageId=X, settingsId=Y): Есть несохранённые изменения
   ```
6. Verify the Calculate button is NOT visible

**To Restore:**
- Open the calculation logic dialog again
- Click "Сохранить" (Save) to commit the changes
- The button should become visible again

### Scenario 3: Missing Required Fields (Button Hidden)
**Expected Result:** Calculate button is hidden

**Steps:**
1. Open a stage's calculation logic
2. Remove or don't define one of the required output fields
3. Save the logic
4. Check browser console for warning with reason like: `HL поле width не заполнено`
5. Verify the Calculate button is NOT visible

**Required Output Fields:**
- width
- length
- height
- weight
- purchasingPrice
- basePrice

### Scenario 4: Multiple Details/Bindings
**Expected Result:** All stages across all details and bindings are checked

**Steps:**
1. Create multiple details with stages
2. Create bindings with stages
3. Make one stage in any detail/binding have an unsaved draft
4. Check console logs - should list all blocking stages
5. Verify the Calculate button is hidden if ANY stage is not ready

## Console Log Examples

### All Ready
```
[READINESS CHECK] All stages ready - Calculate button visible
```

### Blocked by Draft
```
[READINESS CHECK] Calculate button hidden due to blocking stages:
  - [Деталь 1] Этап печати (stageId=123, settingsId=456): Есть несохранённые изменения
```

### Blocked by Missing Field
```
[READINESS CHECK] Calculate button hidden due to blocking stages:
  - [Скрепление A] Расчёт стоимости (stageId=789, settingsId=101): HL поле purchasingPrice не заполнено
```

### No CALC_STAGES Available
```
[READINESS CHECK] No elementsStore.CALC_STAGES available - allowing calculation
```

## Technical Details

### Implementation
- Function: `checkAllStagesReadiness()` in `src/App.tsx`
- Utility functions used:
  - `calculateStageReadiness(outputsValue, hasDraft)` from `src/lib/stage-utils.ts`
  - `hasDraftForStage(stageId, settingsId)` from `src/lib/stage-utils.ts`
- State: `canCalculate` boolean controls button visibility
- The check runs automatically when:
  - Details change
  - Bindings change
  - BitrixMeta changes

### Draft Storage
- Drafts are stored in localStorage with key: `calc_logic_draft:{stageId}:{settingsId}`
- Each calculator+stage combination has its own draft to prevent logic leakage
- Drafts persist across page refreshes until explicitly saved or cleared

## Troubleshooting

### Button Won't Appear
1. Check browser console for diagnostic logs
2. Verify all stages have saved logic (no localStorage drafts)
3. Ensure all stages have required output fields defined
4. Clear localStorage if needed: `localStorage.clear()` in console

### Button Always Visible
1. Check if CALC_STAGES is loaded in bitrixMeta.elementsStore
2. Verify stages have valid stageId and settingsId (not null)
3. Check console logs for the readiness check execution

### False Positives
1. If a stage is marked as not ready incorrectly:
   - Check the OUTPUTS property in elementsStore.CALC_STAGES
   - Verify the draft key format matches: `calc_logic_draft:{stageId}:{settingsId}`
   - Ensure the stage IDs are correct
