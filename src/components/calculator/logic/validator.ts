import { InputParam, FormulaVar, ALLOWED_FUNCTIONS } from './types'

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

// Validate all formulas
export function validateAll(
  inputs: InputParam[],
  vars: FormulaVar[],
  stageIndex: number
): { valid: boolean; errors: Array<{ varId: string; error: string }> } {
  const errors: Array<{ varId: string; error: string }> = []
  const inputNames = inputs.map(inp => inp.name)
  
  // Regex pattern for stages array index
  const STAGES_INDEX_PATTERN = /stages\[(\d+)\]/
  
  // Validate input parameters
  for (const input of inputs) {
    // Check for selectedOffers reference
    if (input.sourcePath.includes('selectedOffers')) {
      errors.push({
        varId: input.id,
        error: `Запрещённый источник: selectedOffers. Используйте offer.*`
      })
    }
    
    // Check for forbidden array indices (except stages[N])
    // Match array indices like [0], [1], etc.
    const arrayIndexMatch = input.sourcePath.match(/\[(\d+)\]/g)
    if (arrayIndexMatch) {
      // Check if it's in a stages path
      const isStagesPath = input.sourcePath.match(STAGES_INDEX_PATTERN)
      
      if (isStagesPath) {
        // For stages path, check if stage index is not in the future
        const stageNumMatch = input.sourcePath.match(STAGES_INDEX_PATTERN)
        if (stageNumMatch) {
          const stageNum = parseInt(stageNumMatch[1])
          if (stageNum > stageIndex) {
            errors.push({
              varId: input.id,
              error: `Данные следующего этапа недоступны`
            })
          }
        }
      } else {
        // For offer.* paths and other paths, indices are forbidden
        if (input.sourcePath.startsWith('offer.')) {
          errors.push({
            varId: input.id,
            error: `Запрещены индексы массивов в путях offer.*`
          })
        } else if (!input.sourcePath.startsWith('stages')) {
          errors.push({
            varId: input.id,
            error: `Запрещены индексы массивов в путях (кроме stages[N])`
          })
        }
      }
    }
  }
  
  // Validate each variable
  vars.forEach((v, idx) => {
    // Only variables defined above current one are available
    const availableVars = vars.slice(0, idx).map(vr => vr.name)
    
    const result = validateFormula(v.formula, inputNames, availableVars, stageIndex)
    if (!result.valid && result.error) {
      errors.push({ varId: v.id, error: result.error })
    }
    
    // Check if variable name references a variable below it
    const referencedVars = extractIdentifiers(v.formula).filter(id => 
      vars.some(vr => vr.name === id)
    )
    for (const refVar of referencedVars) {
      const refIdx = vars.findIndex(vr => vr.name === refVar)
      if (refIdx > idx) {
        errors.push({ 
          varId: v.id, 
          error: `Ссылка на переменную ниже по списку: ${refVar}` 
        })
      }
    }
  })

  return { valid: errors.length === 0, errors }
}
