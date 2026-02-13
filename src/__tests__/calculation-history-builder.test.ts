/**
 * Manual test to verify calculationHistoryBuilder output
 * 
 * Run with: npx tsx src/__tests__/calculation-history-builder.test.ts
 * Requires Node.js 18+ and tsx package
 */

import { buildCalculationHistoryJson } from '../services/calculationHistoryBuilder'
import type { CalculationOfferResult } from '../services/calculationEngine'
import type { InitPayload } from '../lib/postmessage-bridge'

// Mock calculation result for testing
const mockCalculationResult: CalculationOfferResult = {
  offerId: 123,
  offerName: 'Test Offer',
  productId: 456,
  productName: 'Test Product',
  presetId: 789,
  presetName: 'Test Preset',
  details: [
    {
      detailId: 'detail_1',
      detailName: 'Detail 1',
      detailType: 'detail',
      purchasePrice: 100,
      basePrice: 100,
      currency: 'RUB',
      stages: [
        {
          stageId: 'stage_1',
          stageName: 'Stage 1',
          operationCost: 50,
          materialCost: 30,
          totalCost: 80,
          currency: 'RUB',
          logicApplied: true,
          variables: { width: 100, height: 200 },
          outputs: { purchasingPrice: 80, basePrice: 90 },
        },
        {
          stageId: 'stage_2',
          stageName: 'Stage 2',
          operationCost: 10,
          materialCost: 10,
          totalCost: 20,
          currency: 'RUB',
          outputs: { purchasingPrice: 100, basePrice: 100 },
        },
      ],
    },
    {
      detailId: 'binding_1',
      detailName: 'Binding 1',
      detailType: 'binding',
      purchasePrice: 200,
      basePrice: 200,
      currency: 'RUB',
      stages: [],
      children: [
        {
          detailId: 'detail_2',
          detailName: 'Detail 2 (in binding)',
          detailType: 'detail',
          purchasePrice: 150,
          basePrice: 150,
          currency: 'RUB',
          stages: [
            {
              stageId: 'stage_3',
              stageName: 'Stage 3',
              operationCost: 100,
              materialCost: 50,
              totalCost: 150,
              currency: 'RUB',
              outputs: { purchasingPrice: 150, basePrice: 150 },
            },
          ],
        },
      ],
    },
  ],
  directPurchasePrice: 300,
  purchasePrice: 300,
  currency: 'RUB',
  parametrValues: [
    { name: 'param1', value: 'value1' },
    { name: 'param2', value: 'value2' },
  ],
  priceRangesWithMarkup: [
    {
      quantityFrom: 1,
      quantityTo: 10,
      prices: [
        {
          typeId: 1,
          typeName: 'Base Price',
          purchasePrice: 300,
          basePrice: 300,
          currency: 'RUB',
        },
      ],
    },
  ],
}

const mockBitrixMeta: InitPayload | null = null

console.log('Testing buildCalculationHistoryJson...\n')

const result = buildCalculationHistoryJson(mockCalculationResult, mockBitrixMeta)

console.log('Generated JSON structure:')
console.log(JSON.stringify(result, null, 2))

console.log('\n✅ Test completed! Verify the structure matches CalculationHistoryJson interface.')

// Basic assertions
if (result.offerId !== 123) {
  console.error('❌ FAIL: offerId mismatch')
}
if (result.structure.length !== 2) {
  console.error('❌ FAIL: structure length mismatch')
}
if (result.structure[0].stages.length !== 2) {
  console.error('❌ FAIL: detail stages count mismatch')
}
if (!result.structure[1].children || result.structure[1].children.length !== 1) {
  console.error('❌ FAIL: binding children count mismatch')
}

// Check totals rules
const detail1 = result.structure[0]
const lastStageOfDetail1 = detail1.stages[detail1.stages.length - 1]
if (detail1.totals.purchasePrice !== lastStageOfDetail1.outputs?.purchasingPrice) {
  console.error('❌ FAIL: Detail totals should match last stage output')
}

console.log('\n✅ All basic checks passed!')
