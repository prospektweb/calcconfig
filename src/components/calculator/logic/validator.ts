import { InputParam, FormulaVar, ALLOWED_FUNCTIONS, ValueType, ValidationIssue } from './types'

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

/**
 * Check if types are compatible
 */
function areTypesCompatible(type1: ValueType, type2: ValueType): boolean {
  if (type1 === 'any' || type2 === 'any') return true
  if (type1 === 'unknown' || type2 === 'unknown') return true
  return type1 === type2
}

/**
 * Merge two types (for operations like if())
 */
function mergeTypes(type1: ValueType, type2: ValueType): ValueType {
  if (type1 === 'any' || type2 === 'any') return 'any'
  if (type1 === 'unknown') return type2
  if (type2 === 'unknown') return type1
  if (type1 === type2) return type1
  return 'unknown' // conflict
}

/**
 * Simple tokenizer for formula parsing
 */
interface Token {
  type: 'identifier' | 'number' | 'string' | 'operator' | 'keyword' | 'function' | 'lparen' | 'rparen' | 'comma'
  value: string
  pos: number
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  
  while (i < formula.length) {
    const char = formula[i]
    
    // Skip whitespace
    if (/\s/.test(char)) {
      i++
      continue
    }
    
    // String literals
    if (char === '"' || char === "'") {
      const quote = char
      let value = ''
      i++
      while (i < formula.length && formula[i] !== quote) {
        if (formula[i] === '\\' && i + 1 < formula.length) {
          value += formula[i + 1]
          i += 2
        } else {
          value += formula[i]
          i++
        }
      }
      i++ // skip closing quote
      tokens.push({ type: 'string', value, pos: i })
      continue
    }
    
    // Numbers
    if (/\d/.test(char) || (char === '.' && i + 1 < formula.length && /\d/.test(formula[i + 1]))) {
      let value = ''
      while (i < formula.length && /[\d.]/.test(formula[i])) {
        value += formula[i]
        i++
      }
      tokens.push({ type: 'number', value, pos: i })
      continue
    }
    
    // Operators
    if ('+-*/'.includes(char)) {
      tokens.push({ type: 'operator', value: char, pos: i })
      i++
      continue
    }
    
    // Comparison and logical operators
    if (char === '=' && i + 1 < formula.length && formula[i + 1] === '=') {
      tokens.push({ type: 'operator', value: '==', pos: i })
      i += 2
      continue
    }
    if (char === '!' && i + 1 < formula.length && formula[i + 1] === '=') {
      tokens.push({ type: 'operator', value: '!=', pos: i })
      i += 2
      continue
    }
    if (char === '>' && i + 1 < formula.length && formula[i + 1] === '=') {
      tokens.push({ type: 'operator', value: '>=', pos: i })
      i += 2
      continue
    }
    if (char === '<' && i + 1 < formula.length && formula[i + 1] === '=') {
      tokens.push({ type: 'operator', value: '<=', pos: i })
      i += 2
      continue
    }
    if (char === '>') {
      tokens.push({ type: 'operator', value: '>', pos: i })
      i++
      continue
    }
    if (char === '<') {
      tokens.push({ type: 'operator', value: '<', pos: i })
      i++
      continue
    }
    
    // Parentheses and comma
    if (char === '(') {
      tokens.push({ type: 'lparen', value: '(', pos: i })
      i++
      continue
    }
    if (char === ')') {
      tokens.push({ type: 'rparen', value: ')', pos: i })
      i++
      continue
    }
    if (char === ',') {
      tokens.push({ type: 'comma', value: ',', pos: i })
      i++
      continue
    }
    
    // Identifiers, keywords, and functions
    if (/[a-zA-Z_]/.test(char)) {
      let value = ''
      while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
        value += formula[i]
        i++
      }
      
      const lowerValue = value.toLowerCase()
      if (['true', 'false', 'null'].includes(lowerValue)) {
        tokens.push({ type: 'keyword', value: lowerValue, pos: i })
      } else if (['and', 'or', 'not'].includes(lowerValue)) {
        tokens.push({ type: 'keyword', value: lowerValue, pos: i })
      } else if (ALLOWED_FUNCTIONS.includes(value as any)) {
        tokens.push({ type: 'function', value, pos: i })
      } else {
        tokens.push({ type: 'identifier', value, pos: i })
      }
      continue
    }
    
    // Unknown character, skip it
    i++
  }
  
  return tokens
}

/**
 * Infer type from formula expression
 */
export function inferType(
  formula: string,
  symbolTable: Map<string, ValueType>
): { type: ValueType, issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []
  
  try {
    const tokens = tokenize(formula)
    if (tokens.length === 0) {
      return { type: 'unknown', issues }
    }
    
    let pos = 0
    
    function parseExpression(): ValueType {
      return parseLogicalOr()
    }
    
    function parseLogicalOr(): ValueType {
      let left = parseLogicalAnd()
      
      while (pos < tokens.length && tokens[pos].type === 'keyword' && tokens[pos].value === 'or') {
        pos++
        const right = parseLogicalAnd()
        
        if (left !== 'bool' && left !== 'any' && left !== 'unknown') {
          issues.push({
            severity: 'error',
            scope: 'var',
            refId: '',
            message: `Оператор 'or' работает только с bool, получен ${left}`
          })
        }
        if (right !== 'bool' && right !== 'any' && right !== 'unknown') {
          issues.push({
            severity: 'error',
            scope: 'var',
            refId: '',
            message: `Оператор 'or' работает только с bool, получен ${right}`
          })
        }
        
        left = 'bool'
      }
      
      return left
    }
    
    function parseLogicalAnd(): ValueType {
      let left = parseComparison()
      
      while (pos < tokens.length && tokens[pos].type === 'keyword' && tokens[pos].value === 'and') {
        pos++
        const right = parseComparison()
        
        if (left !== 'bool' && left !== 'any' && left !== 'unknown') {
          issues.push({
            severity: 'error',
            scope: 'var',
            refId: '',
            message: `Оператор 'and' работает только с bool, получен ${left}`
          })
        }
        if (right !== 'bool' && right !== 'any' && right !== 'unknown') {
          issues.push({
            severity: 'error',
            scope: 'var',
            refId: '',
            message: `Оператор 'and' работает только с bool, получен ${right}`
          })
        }
        
        left = 'bool'
      }
      
      return left
    }
    
    function parseComparison(): ValueType {
      let left = parseAdditive()
      
      if (pos < tokens.length && tokens[pos].type === 'operator' && 
          ['==', '!=', '>', '<', '>=', '<='].includes(tokens[pos].value)) {
        const op = tokens[pos].value
        pos++
        const right = parseAdditive()
        
        // For > < >= <=, only numbers are allowed
        if (['>', '<', '>=', '<='].includes(op)) {
          if (left !== 'number' && left !== 'any' && left !== 'unknown') {
            issues.push({
              severity: 'error',
              scope: 'var',
              refId: '',
              message: `Оператор '${op}' работает только с number, слева получен ${left}`
            })
          }
          if (right !== 'number' && right !== 'any' && right !== 'unknown') {
            issues.push({
              severity: 'error',
              scope: 'var',
              refId: '',
              message: `Оператор '${op}' работает только с number, справа получен ${right}`
            })
          }
        } else {
          // For == !=, types should match
          if (!areTypesCompatible(left, right)) {
            issues.push({
              severity: 'error',
              scope: 'var',
              refId: '',
              message: `Оператор '${op}' требует совместимые типы, получены ${left} и ${right}`
            })
          }
        }
        
        return 'bool'
      }
      
      return left
    }
    
    function parseAdditive(): ValueType {
      let left = parseMultiplicative()
      
      while (pos < tokens.length && tokens[pos].type === 'operator' && ['+', '-'].includes(tokens[pos].value)) {
        const op = tokens[pos].value
        pos++
        const right = parseMultiplicative()
        
        if (op === '+') {
          // + can be number or string, but not mixed
          if (left === 'number' && right === 'number') {
            left = 'number'
          } else if (left === 'string' && right === 'string') {
            left = 'string'
          } else if (left === 'any' || right === 'any') {
            left = 'any'
          } else if (left === 'unknown' || right === 'unknown') {
            if (left === 'unknown' && right === 'unknown') {
              issues.push({
                severity: 'error',
                scope: 'var',
                refId: '',
                message: 'Оператор + требует явных типов (number или string), оба операнда unknown'
              })
            } else {
              left = left === 'unknown' ? right : left
            }
          } else {
            issues.push({
              severity: 'error',
              scope: 'var',
              refId: '',
              message: `Оператор + не допускает смешивание типов: ${left} и ${right}`
            })
            left = 'unknown'
          }
        } else {
          // - only works with numbers
          if (left !== 'number' && left !== 'any' && left !== 'unknown') {
            issues.push({
              severity: 'error',
              scope: 'var',
              refId: '',
              message: `Оператор - работает только с number, слева получен ${left}`
            })
          }
          if (right !== 'number' && right !== 'any' && right !== 'unknown') {
            issues.push({
              severity: 'error',
              scope: 'var',
              refId: '',
              message: `Оператор - работает только с number, справа получен ${right}`
            })
          }
          left = 'number'
        }
      }
      
      return left
    }
    
    function parseMultiplicative(): ValueType {
      let left = parseUnary()
      
      while (pos < tokens.length && tokens[pos].type === 'operator' && ['*', '/'].includes(tokens[pos].value)) {
        const op = tokens[pos].value
        pos++
        const right = parseUnary()
        
        if (left !== 'number' && left !== 'any' && left !== 'unknown') {
          issues.push({
            severity: 'error',
            scope: 'var',
            refId: '',
            message: `Оператор ${op} работает только с number, слева получен ${left}`
          })
        }
        if (right !== 'number' && right !== 'any' && right !== 'unknown') {
          issues.push({
            severity: 'error',
            scope: 'var',
            refId: '',
            message: `Оператор ${op} работает только с number, справа получен ${right}`
          })
        }
        
        left = 'number'
      }
      
      return left
    }
    
    function parseUnary(): ValueType {
      // Handle 'not' operator
      if (pos < tokens.length && tokens[pos].type === 'keyword' && tokens[pos].value === 'not') {
        pos++
        const operand = parseUnary()
        
        if (operand !== 'bool' && operand !== 'any' && operand !== 'unknown') {
          issues.push({
            severity: 'error',
            scope: 'var',
            refId: '',
            message: `Оператор 'not' работает только с bool, получен ${operand}`
          })
        }
        
        return 'bool'
      }
      
      return parsePrimary()
    }
    
    function parsePrimary(): ValueType {
      if (pos >= tokens.length) {
        return 'unknown'
      }
      
      const token = tokens[pos]
      
      // Number literal
      if (token.type === 'number') {
        pos++
        return 'number'
      }
      
      // String literal
      if (token.type === 'string') {
        pos++
        return 'string'
      }
      
      // Boolean keywords
      if (token.type === 'keyword' && (token.value === 'true' || token.value === 'false')) {
        pos++
        return 'bool'
      }
      
      // null keyword
      if (token.type === 'keyword' && token.value === 'null') {
        pos++
        return 'any'
      }
      
      // Function call
      if (token.type === 'function') {
        return parseFunctionCall()
      }
      
      // Identifier (variable reference)
      if (token.type === 'identifier') {
        const varName = token.value
        pos++
        const varType = symbolTable.get(varName)
        if (!varType) {
          return 'unknown'
        }
        return varType
      }
      
      // Parenthesized expression
      if (token.type === 'lparen') {
        pos++
        const type = parseExpression()
        if (pos < tokens.length && tokens[pos].type === 'rparen') {
          pos++
        }
        return type
      }
      
      pos++
      return 'unknown'
    }
    
    function parseFunctionCall(): ValueType {
      const funcToken = tokens[pos]
      const funcName = funcToken.value
      pos++
      
      // Expect opening parenthesis
      if (pos >= tokens.length || tokens[pos].type !== 'lparen') {
        return 'unknown'
      }
      pos++
      
      const args: ValueType[] = []
      
      // Parse arguments
      while (pos < tokens.length && tokens[pos].type !== 'rparen') {
        args.push(parseExpression())
        
        if (pos < tokens.length && tokens[pos].type === 'comma') {
          pos++
        }
      }
      
      // Expect closing parenthesis
      if (pos < tokens.length && tokens[pos].type === 'rparen') {
        pos++
      }
      
      // Type check based on function
      return inferFunctionType(funcName, args, issues)
    }
    
    return { type: parseExpression(), issues }
  } catch (e) {
    return { type: 'unknown', issues }
  }
}

/**
 * Infer return type of a function call
 */
function inferFunctionType(funcName: string, args: ValueType[], issues: ValidationIssue[]): ValueType {
  switch (funcName) {
    case 'if':
      if (args.length !== 3) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция if() требует 3 аргумента, получено ${args.length}`
        })
        return 'unknown'
      }
      
      // First arg should be bool
      if (args[0] !== 'bool' && args[0] !== 'any' && args[0] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция if() ожидает bool в первом аргументе, получен ${args[0]}`
        })
      }
      
      // Second and third args should have compatible types
      const resultType = mergeTypes(args[1], args[2])
      if (resultType === 'unknown' && args[1] !== 'unknown' && args[2] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `В if() ветви должны иметь один тип: ${args[1]} vs ${args[2]}`
        })
      }
      if ((args[1] === 'unknown' || args[2] === 'unknown') && args[1] !== args[2]) {
        issues.push({
          severity: 'warning',
          scope: 'var',
          refId: '',
          message: 'В if() одна из ветвей имеет тип unknown'
        })
      }
      
      return resultType === 'unknown' && args[1] !== 'unknown' ? args[1] : (args[2] !== 'unknown' ? args[2] : resultType)
    
    case 'round':
    case 'ceil':
    case 'floor':
    case 'abs':
    case 'toNumber':
      if (args.length !== 1) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция ${funcName}() требует 1 аргумент, получено ${args.length}`
        })
        return 'number'
      }
      
      if (args[0] !== 'number' && args[0] !== 'string' && args[0] !== 'any' && args[0] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция ${funcName}() ожидает number или string, получен ${args[0]}`
        })
      }
      
      return 'number'
    
    case 'min':
    case 'max':
      if (args.length < 2) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция ${funcName}() требует минимум 2 аргумента, получено ${args.length}`
        })
        return 'number'
      }
      
      for (let i = 0; i < args.length; i++) {
        if (args[i] !== 'number' && args[i] !== 'any' && args[i] !== 'unknown') {
          issues.push({
            severity: 'error',
            scope: 'var',
            refId: '',
            message: `Функция ${funcName}() ожидает number в аргументе ${i + 1}, получен ${args[i]}`
          })
        }
      }
      
      return 'number'
    
    case 'trim':
    case 'lower':
    case 'upper':
      if (args.length !== 1) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция ${funcName}() требует 1 аргумент, получено ${args.length}`
        })
        return 'string'
      }
      
      // These functions accept strings, but if explicitly number/bool -> error
      if (args[0] === 'number' || args[0] === 'bool') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция ${funcName}() не работает с ${args[0]}`
        })
      }
      
      return 'string'
    
    case 'toString':
      if (args.length !== 1) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция toString() требует 1 аргумент, получено ${args.length}`
        })
      }
      return 'string'
    
    case 'len':
      if (args.length !== 1) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция len() требует 1 аргумент, получено ${args.length}`
        })
        return 'number'
      }
      
      // len works with strings and arrays, we'll allow any for simplicity
      return 'number'
    
    case 'contains':
      if (args.length !== 2) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция contains() требует 2 аргумента, получено ${args.length}`
        })
        return 'bool'
      }
      
      if (args[0] !== 'string' && args[0] !== 'any' && args[0] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция contains() ожидает string в первом аргументе, получен ${args[0]}`
        })
      }
      if (args[1] !== 'string' && args[1] !== 'any' && args[1] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция contains() ожидает string во втором аргументе, получен ${args[1]}`
        })
      }
      
      return 'bool'
    
    case 'replace':
      if (args.length !== 3) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция replace() требует 3 аргумента, получено ${args.length}`
        })
        return 'string'
      }
      
      for (let i = 0; i < 3; i++) {
        if (args[i] !== 'string' && args[i] !== 'any' && args[i] !== 'unknown') {
          issues.push({
            severity: 'error',
            scope: 'var',
            refId: '',
            message: `Функция replace() ожидает string в аргументе ${i + 1}, получен ${args[i]}`
          })
        }
      }
      
      return 'string'
    
    case 'split':
      if (args.length !== 2) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция split() требует 2 аргумента, получено ${args.length}`
        })
        return 'any'
      }
      
      if (args[0] !== 'string' && args[0] !== 'any' && args[0] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция split() ожидает string в первом аргументе, получен ${args[0]}`
        })
      }
      if (args[1] !== 'string' && args[1] !== 'any' && args[1] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция split() ожидает string во втором аргументе, получен ${args[1]}`
        })
      }
      
      return 'any' // returns array
    
    case 'join':
      if (args.length !== 2) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция join() требует 2 аргумента, получено ${args.length}`
        })
        return 'string'
      }
      
      // First arg should be array (we use 'any' for arrays)
      if (args[1] !== 'string' && args[1] !== 'any' && args[1] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция join() ожидает string во втором аргументе, получен ${args[1]}`
        })
      }
      
      return 'string'
    
    case 'get':
      if (args.length !== 2) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция get() требует 2 аргумента, получено ${args.length}`
        })
        return 'any'
      }
      
      if (args[1] !== 'number' && args[1] !== 'any' && args[1] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция get() ожидает number во втором аргументе (индекс), получен ${args[1]}`
        })
      }
      
      return 'any'
    
    case 'regexMatch':
      if (args.length !== 2) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция regexMatch() требует 2 аргумента, получено ${args.length}`
        })
        return 'bool'
      }
      
      if (args[0] !== 'string' && args[0] !== 'any' && args[0] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция regexMatch() ожидает string в первом аргументе, получен ${args[0]}`
        })
      }
      if (args[1] !== 'string' && args[1] !== 'any' && args[1] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция regexMatch() ожидает string во втором аргументе, получен ${args[1]}`
        })
      }
      
      return 'bool'
    
    case 'regexExtract':
      if (args.length !== 3) {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция regexExtract() требует 3 аргумента, получено ${args.length}`
        })
        return 'string'
      }
      
      if (args[0] !== 'string' && args[0] !== 'any' && args[0] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция regexExtract() ожидает string в первом аргументе, получен ${args[0]}`
        })
      }
      if (args[1] !== 'string' && args[1] !== 'any' && args[1] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция regexExtract() ожидает string во втором аргументе, получен ${args[1]}`
        })
      }
      if (args[2] !== 'number' && args[2] !== 'any' && args[2] !== 'unknown') {
        issues.push({
          severity: 'error',
          scope: 'var',
          refId: '',
          message: `Функция regexExtract() ожидает number в третьем аргументе, получен ${args[2]}`
        })
      }
      
      return 'string'
    
    default:
      return 'unknown'
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
  const symbolTable = new Map<string, ValueType>()
  
  // Add inputs to symbol table
  for (const input of inputs) {
    const type = input.valueType || inferTypeFromSourcePath(input.sourcePath)
    symbolTable.set(input.name, type)
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
    
    // Type inference and validation
    if (v.formula.trim()) {
      const typeResult = inferType(v.formula, symbolTable)
      
      // Add type-specific issues
      for (const issue of typeResult.issues) {
        issues.push({
          ...issue,
          refId: v.id
        })
      }
      
      // Add variable to symbol table for next iterations
      symbolTable.set(v.name, typeResult.type)
    } else {
      symbolTable.set(v.name, 'unknown')
    }
  })

  return { valid: issues.filter(i => i.severity === 'error').length === 0, issues }
}
