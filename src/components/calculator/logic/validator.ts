import { InputParam, FormulaVar, ALLOWED_FUNCTIONS, ValueType, ValidationIssue } from './types'
import { inferExprType, SymbolTable, SymbolInfo } from './type-checker'

// Extract identifiers from formula (simplified, doesn't handle strings/complex cases)
export function extractIdentifiers(formula: string): string[] {
  const identifiers: string[] = []
  
  // First, remove string literals to avoid identifying content inside strings as identifiers
  const withoutStrings = formula.replace(/"[^"]*"|'[^']*'/g, '""')
  
  // Match word characters that are not part of function names or keywords
  const tokens = withoutStrings.match(/\b[a-zA-Z_][a-zA-Z0-9_]*/g) || []
  
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
 * Returns both the type and the reason for the inference
 */
export function inferTypeFromSourcePath(sourcePath: string): { type: ValueType; reason: string } {
  // Extract last segment from path
  const segments = sourcePath.split('.')
  const lastSegment = segments[segments.length - 1]
  const lastSegmentUpper = lastSegment.toUpperCase()
  
  // String patterns
  const stringPatterns = ['VALUE_XML_ID', 'XML_ID', 'DESCRIPTION', 'NAME', 'CODE', 'SYMBOL', 'CURRENCY']
  if (stringPatterns.includes(lastSegmentUpper)) {
    return { 
      type: 'string', 
      reason: `*.${lastSegmentUpper} → string` 
    }
  }
  
  // Number patterns
  const numberPatterns = ['ID', 'ENUM_ID', 'VALUE_ENUM_ID', 'SORT', 'MULTIPLE_CNT']
  const numberPatternLower = ['measureRatio', 'quantityFrom', 'quantityTo', 'price']
  
  if (numberPatterns.includes(lastSegmentUpper)) {
    return { 
      type: 'number', 
      reason: `*.${lastSegmentUpper} → number` 
    }
  }
  
  if (numberPatternLower.includes(lastSegment)) {
    return { 
      type: 'number', 
      reason: `*.${lastSegment} → number` 
    }
  }
  
  // Boolean patterns
  const boolPatterns = ['ACTIVE', 'IS_REQUIRED', 'MULTIPLE', 'FILTRABLE', 'SEARCHABLE']
  if (boolPatterns.includes(lastSegmentUpper)) {
    return { 
      type: 'bool', 
      reason: `*.${lastSegmentUpper} → bool` 
    }
  }
  
  // Special case for VALUE - always unknown
  if (lastSegmentUpper === 'VALUE') {
    return { 
      type: 'unknown', 
      reason: '*.VALUE → unknown' 
    }
  }
  
  return { 
    type: 'unknown', 
    reason: 'тип не удалось определить автоматически' 
  }
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

/**
 * Deduplicate issues by creating a unique key from severity, scope, refId, and message
 */
function deduplicateIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>()
  return issues.filter(issue => {
    const key = `${issue.severity}|${issue.scope}|${issue.refId || ''}|${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Sort issues by priority:
 * 1. Errors with forbidden sources (selectedOffers, array indices)
 * 2. Syntax errors (brackets, syntax)
 * 3. Unknown variable errors
 * 4. Other errors (type mismatches, etc.)
 * 5. Warnings
 */
function sortIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const priority = (issue: ValidationIssue): number => {
    // 1. error + forbidden sources (selectedOffers, indices)
    if (issue.severity === 'error' && 
        (issue.message.includes('selectedOffers') || 
         issue.message.includes('Запрещены индексы'))) {
      return 0
    }
    // 2. error syntax
    if (issue.severity === 'error' && 
        (issue.message.includes('скобок') || 
         issue.message.includes('синтаксис'))) {
      return 1
    }
    // 3. error unknown variable
    if (issue.severity === 'error' && 
        issue.message.includes('Неизвестная переменная')) {
      return 2
    }
    // 4. error type mismatch and others
    if (issue.severity === 'error') {
      return 3
    }
    // 5. warnings
    return 4
  }
  
  return [...issues].sort((a, b) => priority(a) - priority(b))
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
    
    // Type validation for inputs - check for conflicts with manual types
    if (input.typeSource === 'manual' && input.valueType && input.valueType !== 'any' && input.valueType !== 'unknown') {
      const inferred = inferTypeFromSourcePath(input.sourcePath)
      
      // Warn if there's a conflict between manual type and inferred type
      if (inferred.type !== 'unknown' && inferred.type !== input.valueType) {
        // Extract last segment for better error message
        const lastSegment = input.sourcePath.split('.').pop() || input.sourcePath
        issues.push({
          severity: 'warning',
          scope: 'input',
          refId: input.id,
          message: `Тип входного параметра (${input.valueType}) не соответствует источнику ${lastSegment} (${inferred.type})`,
          hint: 'Проверьте, действительно ли это ожидаемое поведение'
        })
      }
    }
  }
  
  // Build symbol table for type checking
  const symbols: SymbolTable = {}
  
  // Add inputs to symbol table
  for (const input of inputs) {
    const inferred = inferTypeFromSourcePath(input.sourcePath)
    const type = input.valueType || inferred.type
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

  return { 
    valid: issues.filter(i => i.severity === 'error').length === 0, 
    issues: sortIssues(deduplicateIssues(issues))
  }
}
