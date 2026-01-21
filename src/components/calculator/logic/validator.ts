import { InputParam, FormulaVar, ALLOWED_FUNCTIONS, ValueType, ValidationIssue } from './types'
import { inferExprType, SymbolTable, SymbolInfo } from './type-checker'

// Extract identifiers from formula (simplified, doesn't handle strings/complex cases)
export function extractIdentifiers(formula: string): string[] {
  const identifiers: string[] = []
  // Match word characters that are not part of function names or keywords
  const tokens = formula.match(/\b[a-zA-Z_][a-zA-Z0-9_]*/g) || []
  
  for (const token of tokens) {
    // Skip allowed functions and keywords
    if (ALLOWED_FUNCTIONS.includes(token as any)) continue
    if (['true', 'false', 'null', 'and', 'or', 'not'].includes(token.toLowerCase())) continue
    
    // Add unique identifiers
    if (!identifiers.includes(token)) {
      identifiers.push(token)
    }
  }
  
  return identifiers
}

/**
 * Infer type from sourcePath based on patterns
 */
export function inferTypeFromSourcePath(sourcePath: string): ValueType {
  const path = sourcePath.toLowerCase()
  
  // String patterns
  if (path.includes('.value_xml_id') || path.includes('.xml_id') || path.includes('.description')) {
    return 'string'
  }
  
  // Number patterns
  if (path.includes('.value_enum_id') || path.includes('.enum_id') || 
      path.includes('.id') || path.includes('.sort') || path.includes('.multiple_cnt')) {
    return 'number'
  }
  
  // Boolean patterns
  if (path.includes('.active') || path.includes('.is_required') || 
      path.includes('.multiple') || path.includes('.filtrable') || path.includes('.searchable')) {
    return 'bool'
  }
  
  return 'unknown'
}

// Validate formula syntax and references
export function validateFormula(
  formula: string,
  availableInputs: string[],
  availableVars: string[],  // только vars выше текущей
  currentStageIndex: number
): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') {
    return { valid: false, error: 'Формула не может быть пустой' }
  }

  // Check for forbidden selectedOffers reference
  if (formula.includes('selectedOffers')) {
    return { valid: false, error: 'Запрещённый источник: selectedOffers. Используйте offer.*' }
  }

  // Check for forbidden array indices (except stages[N])
  const arrayIndexPattern = /\[(\d+)\]/g
  const arrayIndexMatches = formula.match(arrayIndexPattern)
  if (arrayIndexMatches) {
    // Check if all matches are stages[N] pattern
    const stagesPattern = /stages\[(\d+)\]/g
    const stagesMatches = formula.match(stagesPattern)
    const stagesMatchCount = stagesMatches ? stagesMatches.length : 0
    
    // If there are more array index matches than stages matches, there are forbidden indices
    if (arrayIndexMatches.length > stagesMatchCount) {
      return { valid: false, error: 'Запрещены индексы в путях. Нельзя использовать [0], [1] и т.п.' }
    }
  }

  // Check for basic syntax issues
  const openParens = (formula.match(/\(/g) || []).length
  const closeParens = (formula.match(/\)/g) || []).length
  if (openParens !== closeParens) {
    return { valid: false, error: 'Несовпадение скобок' }
  }

  // Extract identifiers
  const identifiers = extractIdentifiers(formula)
  
  // Check each identifier
  for (const id of identifiers) {
    // Check if it's an input parameter
    if (availableInputs.includes(id)) continue
    
    // Check if it's a variable defined above
    if (availableVars.includes(id)) continue
    
    // Check if it references a future stage (format: stageN_xxx)
    const stageMatch = id.match(/^stage(\d+)_/)
    if (stageMatch) {
      const stageNum = parseInt(stageMatch[1])
      if (stageNum > currentStageIndex) {
        return { 
          valid: false, 
          error: `Данные следующего этапа недоступны: ${id}` 
        }
      }
      continue
    }
    
    // Unknown identifier
    return { valid: false, error: `Неизвестная переменная: ${id}` }
  }

  return { valid: true }
}

// Re-export for backward compatibility
export function inferType(
  formula: string,
  symbolTable: Map<string, ValueType>
): { type: ValueType, issues: ValidationIssue[] } {
  // Convert Map to SymbolTable
  const symbols: SymbolTable = {}
  symbolTable.forEach((type, name) => {
    symbols[name] = {
      kind: 'var',
      name,
      inferredType: type
    }
  })
  
  return inferExprType(formula, symbols)
}

// Validate all formulas
export function validateAll(
  inputs: InputParam[],
  vars: FormulaVar[],
  stageIndex: number
): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []
  const inputNames = inputs.map(inp => inp.name)
  
  // Validate input parameters
  for (const input of inputs) {
    // Check for selectedOffers reference
    if (input.sourcePath.includes('selectedOffers')) {
      issues.push({
        severity: 'error',
        scope: 'global',
        message: `Запрещённый источник: selectedOffers. Используйте offer.*`
      })
      issues.push({
        severity: 'error',
        scope: 'input',
        refId: input.id,
        message: `Запрещённый источник: selectedOffers. Используйте offer.*`
      })
    }
    
    // Check for forbidden array indices (except stages[N])
    const arrayIndexPattern = /\[(\d+)\]/g
    const arrayIndexMatches = input.sourcePath.match(arrayIndexPattern)
    
    if (arrayIndexMatches) {
      // Check if path starts with stages[
      if (input.sourcePath.startsWith('stages[')) {
        // Extract stage index and validate it's not in the future
        const stageMatch = input.sourcePath.match(/^stages\[(\d+)\]/)
        if (stageMatch) {
          const stageNum = parseInt(stageMatch[1])
          if (stageNum > stageIndex) {
            issues.push({
              severity: 'error',
              scope: 'input',
              refId: input.id,
              message: `Данные следующего этапа недоступны`
            })
          }
        }
      } else {
        // For all other paths, array indices are forbidden
        issues.push({
          severity: 'error',
          scope: 'input',
          refId: input.id,
          message: `Запрещены индексы в путях. Нельзя использовать [0], [1] и т.п.`
        })
      }
    }
    
    // Type validation for inputs
    if (input.valueType && input.valueType !== 'any' && input.valueType !== 'unknown') {
      const inferredType = inferTypeFromSourcePath(input.sourcePath)
      
      // Warn if there's a conflict between explicit type and inferred type
      if (inferredType !== 'unknown' && inferredType !== input.valueType) {
        issues.push({
          severity: 'warning',
          scope: 'input',
          refId: input.id,
          message: `Тип ${input.valueType} может конфликтовать с путём (ожидается ${inferredType})`,
          hint: `Проверьте соответствие типа пути ${input.sourcePath}`
        })
      }
    }
  }
  
  // Build symbol table for type checking
  const symbols: SymbolTable = {}
  
  // Add inputs to symbol table
  for (const input of inputs) {
    const type = input.valueType || inferTypeFromSourcePath(input.sourcePath)
    symbols[input.name] = {
      kind: 'input',
      name: input.name,
      declaredType: type
    }
  }
  
  // Validate each variable
  vars.forEach((v, idx) => {
    // Only variables defined above current one are available
    const availableVars = vars.slice(0, idx).map(vr => vr.name)
    
    const result = validateFormula(v.formula, inputNames, availableVars, stageIndex)
    if (!result.valid && result.error) {
      issues.push({ 
        severity: 'error',
        scope: 'var',
        refId: v.id, 
        message: result.error 
      })
    }
    
    // Check if variable name references a variable below it
    const referencedVars = extractIdentifiers(v.formula).filter(id => 
      vars.some(vr => vr.name === id)
    )
    for (const refVar of referencedVars) {
      const refIdx = vars.findIndex(vr => vr.name === refVar)
      if (refIdx > idx) {
        issues.push({ 
          severity: 'error',
          scope: 'var',
          refId: v.id, 
          message: `Ссылка на переменную ниже по списку: ${refVar}` 
        })
      }
    }
    
    // Type inference and validation using TypeChecker
    if (v.formula.trim()) {
      const typeResult = inferExprType(v.formula, symbols, { scope: 'var', refId: v.id })
      
      // Add type-specific issues from TypeChecker
      issues.push(...typeResult.issues)
      
      // Add variable to symbol table for next iterations
      symbols[v.name] = {
        kind: 'var',
        name: v.name,
        inferredType: typeResult.type
      }
    } else {
      symbols[v.name] = {
        kind: 'var',
        name: v.name,
        inferredType: 'unknown'
      }
    }
  })

  return { valid: issues.filter(i => i.severity === 'error').length === 0, issues }
}
