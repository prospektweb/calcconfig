import { ALLOWED_FUNCTIONS, ValueType } from './types'

// ============================================================================
// TYPES
// ============================================================================

export type Severity = 'error' | 'warning'
export type Scope = 'input' | 'var' | 'result' | 'global'

export interface ValidationIssue {
  severity: Severity
  scope: Scope
  refId?: string
  message: string
  hint?: string
}

export interface TypeResult {
  type: ValueType
  issues: ValidationIssue[]
}

export interface SymbolInfo {
  kind: 'input' | 'var' | 'const'
  name: string
  declaredType?: ValueType
  inferredType?: ValueType
}

export type SymbolTable = Record<string, SymbolInfo>

// ============================================================================
// TOKENIZER
// ============================================================================

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

// ============================================================================
// TYPE UTILITIES
// ============================================================================

function areTypesCompatible(type1: ValueType, type2: ValueType): boolean {
  if (type1 === 'any' || type2 === 'any') return true
  if (type1 === 'unknown' || type2 === 'unknown') return true
  return type1 === type2
}

function mergeTypes(type1: ValueType, type2: ValueType): ValueType {
  if (type1 === 'any' || type2 === 'any') return 'any'
  if (type1 === 'unknown') return type2
  if (type2 === 'unknown') return type1
  if (type1 === type2) return type1
  return 'unknown' // conflict
}

// ============================================================================
// MAIN TYPE INFERENCE
// ============================================================================

export function inferExprType(
  formula: string,
  symbols: SymbolTable,
  refMeta?: { scope: Scope; refId?: string }
): TypeResult {
  const issues: ValidationIssue[] = []
  const scope = refMeta?.scope || 'var'
  const refId = refMeta?.refId || ''
  
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
            scope,
            refId,
            message: `Оператор 'or' работает только с bool, получен ${left}`
          })
        }
        if (right !== 'bool' && right !== 'any' && right !== 'unknown') {
          issues.push({
            severity: 'error',
            scope,
            refId,
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
            scope,
            refId,
            message: `Оператор 'and' работает только с bool, получен ${left}`
          })
        }
        if (right !== 'bool' && right !== 'any' && right !== 'unknown') {
          issues.push({
            severity: 'error',
            scope,
            refId,
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
              scope,
              refId,
              message: `Оператор '${op}' работает только с number, слева получен ${left}`
            })
          }
          if (right !== 'number' && right !== 'any' && right !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Оператор '${op}' работает только с number, справа получен ${right}`
            })
          }
        } else {
          // For == !=, types should match
          if (!areTypesCompatible(left, right)) {
            issues.push({
              severity: 'error',
              scope,
              refId,
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
                scope,
                refId,
                message: 'Оператор + требует явных типов (number или string), оба операнда unknown'
              })
            } else {
              left = left === 'unknown' ? right : left
            }
          } else {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Оператор + не поддерживает смешивание типов (${left} и ${right})`
            })
            left = 'unknown'
          }
        } else {
          // - only works with numbers
          if (left !== 'number' && left !== 'any' && left !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Оператор - работает только с number, слева получен ${left}`
            })
          }
          if (right !== 'number' && right !== 'any' && right !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
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
            scope,
            refId,
            message: `Оператор ${op} работает только с number, слева получен ${left}`
          })
        }
        if (right !== 'number' && right !== 'any' && right !== 'unknown') {
          issues.push({
            severity: 'error',
            scope,
            refId,
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
            scope,
            refId,
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
        const symbol = symbols[varName]
        if (!symbol) {
          return 'unknown'
        }
        // For inputs, use declaredType; for vars, use inferredType
        return symbol.kind === 'input' 
          ? (symbol.declaredType || 'unknown')
          : (symbol.inferredType || 'unknown')
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
      return inferFunctionType(funcName, args)
    }
    
    function inferFunctionType(funcName: string, args: ValueType[]): ValueType {
      switch (funcName) {
        case 'if':
          if (args.length !== 3) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция if() требует 3 аргумента, получено ${args.length}`
            })
            return 'unknown'
          }
          
          // First arg should be bool
          if (args[0] !== 'bool' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция if() ожидает bool в первом аргументе, получен ${args[0]}`
            })
          }
          
          // Second and third args should have compatible types
          const resultType = mergeTypes(args[1], args[2])
          if (resultType === 'unknown' && args[1] !== 'unknown' && args[2] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `В if() ветви должны иметь совместимые типы: ${args[1]} vs ${args[2]}`
            })
          }
          if ((args[1] === 'unknown' || args[2] === 'unknown') && args[1] !== args[2]) {
            issues.push({
              severity: 'warning',
              scope,
              refId,
              message: 'В if() одна из ветвей имеет тип unknown',
              hint: 'Проверьте типы переменных в обеих ветвях'
            })
          }
          
          return resultType === 'unknown' && args[1] !== 'unknown' ? args[1] : (args[2] !== 'unknown' ? args[2] : resultType)
        
        case 'round':
        case 'ceil':
        case 'floor':
        case 'abs':
          if (args.length !== 1) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция ${funcName}() требует 1 аргумент, получено ${args.length}`
            })
            return 'number'
          }
          
          if (args[0] !== 'number' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция ${funcName}() ожидает number, получен ${args[0]}`
            })
          }
          
          return 'number'
        
        case 'toNumber':
          if (args.length !== 1) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция toNumber() требует 1 аргумент, получено ${args.length}`
            })
            return 'number'
          }
          
          // toNumber accepts string or number
          if (args[0] !== 'number' && args[0] !== 'string' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция toNumber() ожидает number или string, получен ${args[0]}`
            })
          }
          
          return 'number'
        
        case 'min':
        case 'max':
          if (args.length < 2) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция ${funcName}() требует минимум 2 аргумента, получено ${args.length}`
            })
            return 'number'
          }
          
          for (let i = 0; i < args.length; i++) {
            if (args[i] !== 'number' && args[i] !== 'any' && args[i] !== 'unknown') {
              issues.push({
                severity: 'error',
                scope,
                refId,
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
              scope,
              refId,
              message: `Функция ${funcName}() требует 1 аргумент, получено ${args.length}`
            })
            return 'string'
          }
          
          // These functions work with strings
          if (args[0] === 'number' || args[0] === 'bool') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция ${funcName}() не работает с типом ${args[0]}`
            })
          }
          
          return 'string'
        
        case 'toString':
          if (args.length !== 1) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция toString() требует 1 аргумент, получено ${args.length}`
            })
          }
          return 'string'
        
        case 'len':
          if (args.length !== 1) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция len() требует 1 аргумент, получено ${args.length}`
            })
            return 'number'
          }
          
          // len works with strings and arrays
          if (args[0] !== 'string' && args[0] !== 'array' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция len() ожидает string или array, получен ${args[0]}`
            })
          }
          
          return 'number'
        
        case 'contains':
          if (args.length !== 2) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция contains() требует 2 аргумента, получено ${args.length}`
            })
            return 'bool'
          }
          
          if (args[0] !== 'string' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция contains() ожидает string в первом аргументе, получен ${args[0]}`
            })
          }
          if (args[1] !== 'string' && args[1] !== 'any' && args[1] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция contains() ожидает string во втором аргументе, получен ${args[1]}`
            })
          }
          
          return 'bool'
        
        case 'replace':
          if (args.length !== 3) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция replace() требует 3 аргумента, получено ${args.length}`
            })
            return 'string'
          }
          
          for (let i = 0; i < 3; i++) {
            if (args[i] !== 'string' && args[i] !== 'any' && args[i] !== 'unknown') {
              issues.push({
                severity: 'error',
                scope,
                refId,
                message: `Функция replace() ожидает string в аргументе ${i + 1}, получен ${args[i]}`
              })
            }
          }
          
          return 'string'
        
        case 'split':
          if (args.length !== 2) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция split() требует 2 аргумента, получено ${args.length}`
            })
            return 'array'
          }
          
          if (args[0] !== 'string' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция split() ожидает string в первом аргументе, получен ${args[0]}`
            })
          }
          if (args[1] !== 'string' && args[1] !== 'any' && args[1] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция split() ожидает string во втором аргументе, получен ${args[1]}`
            })
          }
          
          return 'array'
        
        case 'join':
          if (args.length !== 2) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция join() требует 2 аргумента, получено ${args.length}`
            })
            return 'string'
          }
          
          // First arg should be array
          if (args[0] !== 'array' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция join() ожидает array в первом аргументе, получен ${args[0]}`
            })
          }
          if (args[1] !== 'string' && args[1] !== 'any' && args[1] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция join() ожидает string во втором аргументе, получен ${args[1]}`
            })
          }
          
          return 'string'
        
        case 'get':
          if (args.length !== 2) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция get() требует 2 аргумента, получено ${args.length}`
            })
            return 'any'
          }
          
          // First arg should be array
          if (args[0] !== 'array' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция get() ожидает array в первом аргументе, получен ${args[0]}`
            })
          }
          if (args[1] !== 'number' && args[1] !== 'any' && args[1] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция get() ожидает number во втором аргументе (индекс), получен ${args[1]}`
            })
          }
          
          return 'any'

        case 'getPrice': {
          if (args.length < 2 || args.length > 3) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция getPrice() требует 2 или 3 аргумента, получено ${args.length}`
            })
            return 'number'
          }

          if (args[0] !== 'number' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция getPrice() ожидает number в первом аргументе, получен ${args[0]}`
            })
          }
          if (args[1] !== 'array' && args[1] !== 'any' && args[1] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция getPrice() ожидает array во втором аргументе, получен ${args[1]}`
            })
          }
          if (args.length === 3 && args[2] !== 'bool' && args[2] !== 'any' && args[2] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция getPrice() ожидает bool в третьем аргументе, получен ${args[2]}`
            })
          }

          return 'number'
        }
        
        case 'regexMatch':
          if (args.length !== 2) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция regexMatch() требует 2 аргумента, получено ${args.length}`
            })
            return 'bool'
          }
          
          if (args[0] !== 'string' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция regexMatch() ожидает string в первом аргументе, получен ${args[0]}`
            })
          }
          if (args[1] !== 'string' && args[1] !== 'any' && args[1] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция regexMatch() ожидает string во втором аргументе, получен ${args[1]}`
            })
          }
          
          return 'bool'
        
        case 'regexExtract':
          if (args.length !== 3) {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция regexExtract() требует 3 аргумента, получено ${args.length}`
            })
            return 'string'
          }
          
          if (args[0] !== 'string' && args[0] !== 'any' && args[0] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция regexExtract() ожидает string в первом аргументе, получен ${args[0]}`
            })
          }
          if (args[1] !== 'string' && args[1] !== 'any' && args[1] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция regexExtract() ожидает string во втором аргументе, получен ${args[1]}`
            })
          }
          if (args[2] !== 'number' && args[2] !== 'any' && args[2] !== 'unknown') {
            issues.push({
              severity: 'error',
              scope,
              refId,
              message: `Функция regexExtract() ожидает number в третьем аргументе, получен ${args[2]}`
            })
          }
          
          return 'string'
        
        default:
          return 'unknown'
      }
    }
    
    return { type: parseExpression(), issues }
  } catch (e) {
    return { type: 'unknown', issues }
  }
}
