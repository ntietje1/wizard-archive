import { isUuidV7 } from '../../resources/domain-id'
import type { NoteValueProps } from './schema'

export type NoteValueDefinition = Readonly<
  NoteValueProps & {
    readonly blockId: string
  }
>

type NoteValueDocumentBlock = Readonly<{
  id: string
  content?: unknown
  children?: ReadonlyArray<NoteValueDocumentBlock>
}>

export type NoteValueState = Readonly<
  NoteValueProps & {
    readonly blockId: string
    readonly status: 'ok' | 'error'
    readonly value: number | null
    readonly formatted: string
    readonly error: string | null
  }
>

type Formula =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'reference'; readonly valueId: string }
  | { readonly kind: 'unary'; readonly operator: '+' | '-'; readonly value: Formula }
  | {
      readonly kind: 'binary'
      readonly operator: '+' | '-' | '*' | '/'
      readonly left: Formula
      readonly right: Formula
    }
  | { readonly kind: 'call'; readonly name: string; readonly arguments: ReadonlyArray<Formula> }

const functions = {
  abs: (values: ReadonlyArray<number>) => unaryFunction('abs', values, Math.abs),
  ceil: (values: ReadonlyArray<number>) => unaryFunction('ceil', values, Math.ceil),
  floor: (values: ReadonlyArray<number>) => unaryFunction('floor', values, Math.floor),
  max: (values: ReadonlyArray<number>) => aggregateFunction('max', values, Math.max),
  min: (values: ReadonlyArray<number>) => aggregateFunction('min', values, Math.min),
  round: (values: ReadonlyArray<number>) => unaryFunction('round', values, Math.round),
} satisfies Record<string, (values: ReadonlyArray<number>) => number>

export function evaluateNoteValues(
  definitions: ReadonlyArray<NoteValueDefinition>,
): ReadonlyMap<string, NoteValueState> {
  const definitionById = new Map<string, (typeof definitions)[number]>()
  const duplicateIds = new Set<string>()
  for (const definition of definitions) {
    if (definitionById.has(definition.valueId)) duplicateIds.add(definition.valueId)
    else definitionById.set(definition.valueId, definition)
  }

  const results = new Map<string, NoteValueState>()
  const evaluating = new Set<string>()
  const evaluate = (valueId: string): NoteValueState => {
    const existing = results.get(valueId)
    if (existing) return existing
    const definition = definitionById.get(valueId)
    if (!definition) return missingValue(valueId)
    if (!isUuidV7(valueId)) {
      const result = saveError(definition, 'Value identity must be a UUIDv7')
      results.set(valueId, result)
      return result
    }
    if (duplicateIds.has(valueId)) {
      const result = saveError(definition, 'Value identity is duplicated')
      results.set(valueId, result)
      return result
    }
    if (evaluating.has(valueId)) return saveError(definition, 'Formula has a cyclic dependency')

    evaluating.add(valueId)
    let result: NoteValueState
    try {
      const formula = new FormulaParser(definition.expressionSource).parse()
      const value = evaluateFormula(formula, (dependencyId) => {
        const dependency = evaluate(dependencyId)
        if (dependency.status === 'error') throw new Error(dependency.error ?? 'Dependency failed')
        return dependency.value!
      })
      if (!Number.isFinite(value)) throw new Error('Formula result must be finite')
      result = {
        ...definition,
        status: 'ok',
        value,
        formatted: formatNoteValue(value),
        error: null,
      }
    } catch (error) {
      result = saveError(definition, error instanceof Error ? error.message : 'Invalid formula')
    } finally {
      evaluating.delete(valueId)
    }
    results.set(valueId, result)
    return result
  }

  for (const definition of definitions) evaluate(definition.valueId)
  return results
}

export function extractNoteValues(blocks: ReadonlyArray<NoteValueDocumentBlock>) {
  const values: Array<NoteValueDefinition> = []
  const visit = (block: NoteValueDocumentBlock) => {
    collectInlineValues(block.content, block.id, values)
    for (const child of block.children ?? []) visit(child)
  }
  for (const block of blocks) visit(block)
  return values
}

function collectInlineValues(
  content: unknown,
  blockId: string,
  values: Array<NoteValueDefinition>,
) {
  for (const inlineContent of inlineContentGroups(content)) {
    for (const inline of inlineContent) {
      if (!isRecord(inline) || inline.type !== 'value' || !isNoteValueProps(inline.props)) continue
      values.push({ ...inline.props, blockId })
    }
  }
}

function inlineContentGroups(content: unknown): ReadonlyArray<ReadonlyArray<unknown>> {
  if (Array.isArray(content)) return [content]
  if (!isTableContent(content)) return []
  return content.rows.flatMap((row) => tableCells(row).flatMap((cell) => cellContent(cell)))
}

function isTableContent(
  value: unknown,
): value is Record<string, unknown> & { rows: Array<unknown> } {
  return isRecord(value) && value.type === 'tableContent' && Array.isArray(value.rows)
}

function tableCells(row: unknown): ReadonlyArray<unknown> {
  return isRecord(row) && Array.isArray(row.cells) ? row.cells : []
}

function cellContent(cell: unknown): ReadonlyArray<ReadonlyArray<unknown>> {
  return isRecord(cell) && Array.isArray(cell.content) ? [cell.content] : []
}

function isNoteValueProps(value: unknown): value is NoteValueProps {
  return (
    isRecord(value) &&
    typeof value.valueId === 'string' &&
    typeof value.label === 'string' &&
    typeof value.expressionSource === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function noteValueReference(valueId: string) {
  return `{{${valueId}}}`
}

function saveError(
  definition: NoteValueProps & { readonly blockId: string },
  error: string,
): NoteValueState {
  const state: NoteValueState = {
    ...definition,
    status: 'error',
    value: null,
    formatted: error,
    error,
  }
  return state
}

function missingValue(valueId: string): NoteValueState {
  return saveError(
    { valueId, label: 'Missing value', expressionSource: '', blockId: '' },
    'Formula references an unknown value',
  )
}

function formatNoteValue(value: number) {
  const rounded = Math.round(value * 100) / 100
  if (Object.is(rounded, -0)) return '0'
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

function unaryFunction(
  name: string,
  values: ReadonlyArray<number>,
  run: (value: number) => number,
) {
  if (values.length !== 1) throw new Error(`${name} expects one argument`)
  return run(values[0]!)
}

function aggregateFunction(
  name: string,
  values: ReadonlyArray<number>,
  run: (...values: Array<number>) => number,
) {
  if (values.length === 0) throw new Error(`${name} expects at least one argument`)
  return run(...values)
}

function evaluateFormula(formula: Formula, resolve: (valueId: string) => number): number {
  switch (formula.kind) {
    case 'number':
      return formula.value
    case 'reference':
      return resolve(formula.valueId)
    case 'unary': {
      const value = evaluateFormula(formula.value, resolve)
      return formula.operator === '-' ? -value : value
    }
    case 'binary': {
      const left = evaluateFormula(formula.left, resolve)
      const right = evaluateFormula(formula.right, resolve)
      if (formula.operator === '/' && right === 0) throw new Error('Division by zero')
      if (formula.operator === '+') return left + right
      if (formula.operator === '-') return left - right
      if (formula.operator === '*') return left * right
      return left / right
    }
    case 'call': {
      const run = functions[formula.name as keyof typeof functions]
      if (!run) throw new Error(`Unknown function "${formula.name}"`)
      return run(formula.arguments.map((argument) => evaluateFormula(argument, resolve)))
    }
  }
}

type Token =
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'reference'; readonly value: string }
  | { readonly type: 'identifier'; readonly value: string }
  | { readonly type: 'symbol'; readonly value: '+' | '-' | '*' | '/' | '(' | ')' | ',' }
  | { readonly type: 'end' }

class FormulaParser {
  readonly #tokens: ReadonlyArray<Token>
  #index = 0

  constructor(source: string) {
    this.#tokens = tokenize(source)
  }

  parse(): Formula {
    if (this.#tokens[0]?.type === 'end') throw new Error('Formula is empty')
    const formula = this.#expression()
    if (this.#peek().type !== 'end') throw new Error('Formula has unexpected input')
    return formula
  }

  #expression(): Formula {
    let left = this.#term()
    while (this.#symbol('+') || this.#symbol('-')) {
      const operator = (this.#previous() as Extract<Token, { type: 'symbol' }>).value as '+' | '-'
      left = { kind: 'binary', operator, left, right: this.#term() }
    }
    return left
  }

  #term(): Formula {
    let left = this.#unary()
    while (this.#symbol('*') || this.#symbol('/')) {
      const operator = (this.#previous() as Extract<Token, { type: 'symbol' }>).value as '*' | '/'
      left = { kind: 'binary', operator, left, right: this.#unary() }
    }
    return left
  }

  #unary(): Formula {
    if (this.#symbol('+') || this.#symbol('-')) {
      const operator = (this.#previous() as Extract<Token, { type: 'symbol' }>).value as '+' | '-'
      return { kind: 'unary', operator, value: this.#unary() }
    }
    return this.#primary()
  }

  #primary(): Formula {
    const token = this.#peek()
    if (token.type === 'number') {
      this.#index += 1
      return { kind: 'number', value: token.value }
    }
    if (token.type === 'reference') {
      this.#index += 1
      return { kind: 'reference', valueId: token.value }
    }
    if (token.type === 'identifier') {
      this.#index += 1
      if (!this.#symbol('(')) throw new Error(`Unknown identifier "${token.value}"`)
      const args: Array<Formula> = []
      if (!this.#checkSymbol(')')) {
        do args.push(this.#expression())
        while (this.#symbol(','))
      }
      this.#expectSymbol(')')
      return { kind: 'call', name: token.value.toLowerCase(), arguments: args }
    }
    if (this.#symbol('(')) {
      const expression = this.#expression()
      this.#expectSymbol(')')
      return expression
    }
    throw new Error('Expected a number, value reference, function, or parenthesis')
  }

  #symbol(value: Extract<Token, { type: 'symbol' }>['value']) {
    if (!this.#checkSymbol(value)) return false
    this.#index += 1
    return true
  }

  #checkSymbol(value: Extract<Token, { type: 'symbol' }>['value']) {
    const token = this.#peek()
    return token.type === 'symbol' && token.value === value
  }

  #expectSymbol(value: Extract<Token, { type: 'symbol' }>['value']) {
    if (!this.#symbol(value)) throw new Error(`Expected "${value}"`)
  }

  #peek() {
    return this.#tokens[this.#index]!
  }

  #previous() {
    return this.#tokens[this.#index - 1]!
  }
}

function tokenize(source: string): ReadonlyArray<Token> {
  const tokens: Array<Token> = []
  let index = 0
  while (index < source.length) {
    const rest = source.slice(index)
    const whitespace = rest.match(/^\s+/)
    if (whitespace) {
      index += whitespace[0].length
      continue
    }
    const reference = rest.match(/^\{\{([^}]+)}}/)
    if (reference) {
      tokens.push({ type: 'reference', value: reference[1]!.trim() })
      index += reference[0].length
      continue
    }
    const number = rest.match(/^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i)
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) })
      index += number[0].length
      continue
    }
    const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0] })
      index += identifier[0].length
      continue
    }
    const symbol = rest[0]
    if (symbol && '+-*/(),'.includes(symbol)) {
      tokens.push({ type: 'symbol', value: symbol as Extract<Token, { type: 'symbol' }>['value'] })
      index += 1
      continue
    }
    throw new Error(`Unexpected formula character "${symbol ?? ''}"`)
  }
  tokens.push({ type: 'end' })
  return tokens
}
