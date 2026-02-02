import assert from 'node:assert/strict'
import { evaluateFormula } from '../services/calculationLogicProcessor'
import { inferExprType } from '../components/calculator/logic/type-checker'
import type { SymbolTable } from '../components/calculator/logic/type-checker'

export function runLogicOperatorTests(): void {
  const context = { a: true, b: false }
  const keywordResult = evaluateFormula('if(a and b, 1, 0)', context)
  const symbolicResult = evaluateFormula('if(a && b, 1, 0)', context)

  assert.equal(keywordResult, 0)
  assert.equal(symbolicResult, 0)

  const symbols: SymbolTable = {
    a: { kind: 'input', name: 'a', declaredType: 'bool' },
    b: { kind: 'input', name: 'b', declaredType: 'bool' },
  }

  const keywordType = inferExprType('if(a and b, 1, 0)', symbols)
  const symbolicType = inferExprType('if(a && b, 1, 0)', symbols)

  assert.equal(keywordType.type, 'number')
  assert.equal(symbolicType.type, 'number')
  assert.equal(keywordType.issues.length, 0)
  assert.equal(symbolicType.issues.length, 0)
}

if (process.env.RUN_LOGIC_OPERATOR_TESTS === 'true') {
  runLogicOperatorTests()
}
