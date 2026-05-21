import { validateSlug } from '../slugs'
import { NOTE_VALUE_FUNCTION_BY_NAME, NOTE_VALUE_SLUG_OPTIONS, formatNoteValue } from './constants'
import { NOTE_VALUE_ERROR_CODES } from './types'
import type {
  NoteValueAuthoringDefinition,
  NoteValueBinding,
  NoteValueCompileData,
  NoteValueCompiledFormula,
  NoteValueDefinition,
  NoteValueErrorCode,
  NoteValueResolution,
  NoteValueRuntimeState,
  FormulaReferenceToken,
} from './types'

type Operator = '+' | '-' | '*' | '/'
type SymbolTokenValue = '+' | '-' | '*' | '/' | '(' | ')' | ',' | '.'

type FormulaNode =
  | { kind: 'number'; value: number }
  | { kind: 'reference'; refKind: 'self' | 'external'; slug: string; notePathRaw?: string }
  | { kind: 'identifier'; name: string }
  | { kind: 'unary'; operator: '+' | '-'; argument: FormulaNode }
  | { kind: 'binary'; operator: Operator; left: FormulaNode; right: FormulaNode }
  | { kind: 'call'; callee: string; args: Array<FormulaNode> }

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'wiki'; value: string }
  | { type: 'symbol'; value: '+' | '-' | '*' | '/' | '(' | ')' | ',' | '.' }
  | { type: 'eof' }

interface TokenWithPosition {
  token: Token
  position: number
}

interface ReadTokenResult {
  token?: TokenWithPosition
  nextIndex: number
}

interface CompileExpressionOptions<TNoteId> {
  currentNoteId: TNoteId
  resolveSameNote: (slug: string) => NoteValueResolution<TNoteId>
  resolveExternal: (notePathRaw: string, slug: string) => NoteValueResolution<TNoteId>
}

interface CompileDefinitionsOptions<TNoteId> {
  currentNoteId: TNoteId
  resolveExternal: (
    notePathRaw: string,
    slug: string,
    definition: NoteValueAuthoringDefinition<TNoteId>,
  ) => NoteValueResolution<TNoteId>
}

interface EvaluateAuthoringOptions<TNoteId> extends CompileDefinitionsOptions<TNoteId> {
  getDependencyState: EvaluateDependency<TNoteId>
}

interface CompileState<TNoteId> {
  bindings: Array<NoteValueBinding<TNoteId>>
  bindingKeysByTarget: Map<string, string>
  resolveSameNote: (slug: string) => NoteValueResolution<TNoteId>
  resolveExternal: (notePathRaw: string, slug: string) => NoteValueResolution<TNoteId>
}

type EvaluateDependency<TNoteId> = (
  noteId: TNoteId,
  valueId: string,
) => NoteValueRuntimeState<TNoteId> | null

function makeCompileError<TNoteId>(
  errorCode: NoteValueErrorCode,
  errorMessage: string,
  unresolvedReference: FormulaReferenceToken | null = null,
): NoteValueCompileData<TNoteId> {
  return {
    compiledFormula: null,
    bindings: [],
    compileStatus: 'error',
    errorCode,
    errorMessage,
    unresolvedReference,
  }
}

class FormulaReferenceError extends Error {
  constructor(
    readonly errorCode: NoteValueErrorCode,
    readonly errorMessage: string,
    readonly reference: FormulaReferenceToken,
  ) {
    super(`${errorCode}:${errorMessage}`)
  }
}

function makeRuntimeError<TNoteId>(
  definition: Pick<NoteValueDefinition<TNoteId>, 'noteId' | 'blockNoteId' | 'valueId' | 'slug'>,
  errorCode: NoteValueErrorCode,
  errorMessage: string,
): NoteValueRuntimeState<TNoteId> {
  return {
    noteId: definition.noteId,
    blockNoteId: definition.blockNoteId,
    valueId: definition.valueId,
    slug: definition.slug,
    status: 'error',
    rawValue: null,
    formattedValue: errorMessage,
    errorCode,
    errorMessage,
  }
}

function tokenize(input: string): Array<TokenWithPosition> {
  const tokens: Array<TokenWithPosition> = []
  let index = 0

  while (index < input.length) {
    const result = readTokenAt(input, index)
    if (result.token) {
      tokens.push(result.token)
    }
    index = result.nextIndex
  }

  tokens.push({ token: { type: 'eof' }, position: input.length })
  return tokens
}

function readTokenAt(input: string, index: number): ReadTokenResult {
  const char = input[index]

  if (/\s/.test(char)) {
    return { nextIndex: index + 1 }
  }

  if (char === '[' && input.slice(index, index + 2) === '[[') {
    return readWikiToken(input, index)
  }

  if (/[0-9]/.test(char)) {
    return readNumberToken(input, index)
  }

  if (/[A-Za-z_]/.test(char)) {
    return readIdentifierToken(input, index)
  }

  if ('+-*/(),.'.includes(char)) {
    return {
      token: { token: { type: 'symbol', value: char as SymbolTokenValue }, position: index },
      nextIndex: index + 1,
    }
  }

  throw new Error(`Unexpected character "${char}"`)
}

function readWikiToken(input: string, index: number): ReadTokenResult {
  const closeIndex = input.indexOf(']]', index + 2)
  if (closeIndex === -1) {
    throw new Error('Unterminated note reference')
  }
  return {
    token: { token: { type: 'wiki', value: input.slice(index + 2, closeIndex) }, position: index },
    nextIndex: closeIndex + 2,
  }
}

function readNumberToken(input: string, index: number): ReadTokenResult {
  const numberMatch = input.slice(index).match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)
  if (!numberMatch) {
    throw new Error(`Invalid number at position ${index}`)
  }
  const raw = numberMatch[0]
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number "${raw}"`)
  }
  return {
    token: { token: { type: 'number', value }, position: index },
    nextIndex: index + raw.length,
  }
}

function readIdentifierToken(input: string, index: number): ReadTokenResult {
  let end = index + 1
  while (end < input.length && /[A-Za-z0-9_]/.test(input[end])) {
    end += 1
  }
  return {
    token: { token: { type: 'identifier', value: input.slice(index, end) }, position: index },
    nextIndex: end,
  }
}

class FormulaParser {
  private readonly tokens: Array<TokenWithPosition>
  private index = 0

  constructor(input: string) {
    this.tokens = tokenize(input)
  }

  parse(): FormulaNode {
    const expression = this.parseExpression()
    this.expect('eof')
    return expression
  }

  private parseExpression(): FormulaNode {
    let node = this.parseTerm()
    while (this.matchSymbol('+') || this.matchSymbol('-')) {
      const operator = (this.previous().token as Extract<Token, { type: 'symbol' }>)
        .value as Operator
      const right = this.parseTerm()
      node = { kind: 'binary', operator, left: node, right }
    }
    return node
  }

  private parseTerm(): FormulaNode {
    let node = this.parseUnary()
    while (this.matchSymbol('*') || this.matchSymbol('/')) {
      const operator = (this.previous().token as Extract<Token, { type: 'symbol' }>)
        .value as Operator
      const right = this.parseUnary()
      node = { kind: 'binary', operator, left: node, right }
    }
    return node
  }

  private parseUnary(): FormulaNode {
    if (this.matchSymbol('+') || this.matchSymbol('-')) {
      const operator = (this.previous().token as Extract<Token, { type: 'symbol' }>).value as
        | '+'
        | '-'
      return { kind: 'unary', operator, argument: this.parseUnary() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): FormulaNode {
    if (this.match('number')) {
      return this.parsePreviousNumber()
    }

    if (this.match('wiki')) {
      return this.parsePreviousExternalReference()
    }

    if (this.match('identifier')) {
      const identifier = (this.previous().token as Extract<Token, { type: 'identifier' }>).value
      return this.parseIdentifierPrimary(identifier)
    }

    if (this.matchSymbol('(')) {
      return this.parseParenthesizedExpression()
    }

    throw this.error('Expected a number, reference, function call, or "("')
  }

  private parsePreviousNumber(): FormulaNode {
    return {
      kind: 'number',
      value: (this.previous().token as Extract<Token, { type: 'number' }>).value,
    }
  }

  private parsePreviousExternalReference(): FormulaNode {
    const referenceText = (this.previous().token as Extract<Token, { type: 'wiki' }>).value.trim()
    const dotIndex = referenceText.lastIndexOf('.')
    if (dotIndex === -1) {
      return { kind: 'reference', refKind: 'self', slug: referenceText }
    }
    const notePathRaw = referenceText.slice(0, dotIndex).trim()
    const slug = referenceText.slice(dotIndex + 1).trim()
    if (!notePathRaw) {
      throw new Error(`Expected a note path before "." in "[[${referenceText}]]"`)
    }
    if (!slug) {
      throw new Error(`Expected a value slug after "." in "[[${referenceText}]]"`)
    }
    return { kind: 'reference', refKind: 'external', notePathRaw, slug }
  }

  private parseIdentifierPrimary(identifier: string): FormulaNode {
    if (this.matchSymbol('(')) {
      return { kind: 'call', callee: identifier, args: this.parseCallArguments() }
    }

    return { kind: 'identifier', name: identifier }
  }

  private parseCallArguments(): Array<FormulaNode> {
    const args: Array<FormulaNode> = []
    if (!this.checkSymbol(')')) {
      do {
        args.push(this.parseExpression())
      } while (this.matchSymbol(','))
    }
    this.expectSymbol(')')
    return args
  }

  private parseParenthesizedExpression(): FormulaNode {
    const expression = this.parseExpression()
    this.expectSymbol(')')
    return expression
  }

  private match(type: Token['type']): boolean {
    if (this.peek().token.type !== type) return false
    this.index += 1
    return true
  }

  private matchSymbol(symbol: SymbolTokenValue): boolean {
    const token = this.peek().token
    if (token.type !== 'symbol' || token.value !== symbol) {
      return false
    }
    this.index += 1
    return true
  }

  private checkSymbol(symbol: SymbolTokenValue): boolean {
    const token = this.peek().token
    return token.type === 'symbol' && token.value === symbol
  }

  private expect(type: Token['type']): TokenWithPosition {
    const current = this.peek()
    if (current.token.type !== type) {
      throw this.error(`Expected ${type}`)
    }
    this.index += 1
    return current
  }

  private expectSymbol(symbol: SymbolTokenValue): void {
    if (!this.matchSymbol(symbol)) {
      throw this.error(`Expected "${symbol}"`)
    }
  }

  private error(message: string): Error {
    const current = this.peek()
    return new Error(`${message} at position ${current.position}`)
  }

  private peek(): TokenWithPosition {
    return this.tokens[this.index]
  }

  private previous(): TokenWithPosition {
    return this.tokens[this.index - 1]
  }
}

function parseFormula(input: string): FormulaNode {
  const parser = new FormulaParser(input)
  return parser.parse()
}

function collectReferencesFromNode(
  node: FormulaNode,
  references: Array<FormulaReferenceToken>,
): void {
  switch (node.kind) {
    case 'number':
      return
    case 'identifier':
      return
    case 'reference':
      references.push(
        node.refKind === 'external'
          ? { kind: 'external', notePathRaw: node.notePathRaw ?? '', slug: node.slug }
          : { kind: 'self', slug: node.slug },
      )
      return
    case 'unary':
      collectReferencesFromNode(node.argument, references)
      return
    case 'binary':
      collectReferencesFromNode(node.left, references)
      collectReferencesFromNode(node.right, references)
      return
    case 'call':
      for (const arg of node.args) {
        collectReferencesFromNode(arg, references)
      }
      return
  }
}

export function collectFormulaReferences(expressionSource: string): Array<FormulaReferenceToken> {
  try {
    const references: Array<FormulaReferenceToken> = []
    collectReferencesFromNode(parseFormula(expressionSource.trim()), references)
    return references
  } catch {
    return []
  }
}

function compileNode<TNoteId>(
  node: FormulaNode,
  state: CompileState<TNoteId>,
): NoteValueCompiledFormula {
  switch (node.kind) {
    case 'number':
      return node
    case 'identifier': {
      throw new Error(`unknown_reference:Unknown reference "${node.name}"`)
    }
    case 'reference': {
      const resolution =
        node.refKind === 'self'
          ? state.resolveSameNote(node.slug)
          : state.resolveExternal(node.notePathRaw ?? '', node.slug)
      if (!resolution.ok) {
        throw new FormulaReferenceError(
          resolution.errorCode,
          resolution.errorMessage,
          node.refKind === 'external'
            ? { kind: 'external', notePathRaw: node.notePathRaw ?? '', slug: node.slug }
            : { kind: 'self', slug: node.slug },
        )
      }
      return {
        kind: 'binding',
        key: getOrCreateBindingKey(state, resolution.noteId, resolution.valueId),
      }
    }
    case 'unary':
      return { kind: 'unary', operator: node.operator, argument: compileNode(node.argument, state) }
    case 'binary':
      return {
        kind: 'binary',
        operator: node.operator,
        left: compileNode(node.left, state),
        right: compileNode(node.right, state),
      }
    case 'call':
      validateFunctionCall(node.callee, node.args.length)
      return {
        kind: 'call',
        callee: node.callee,
        args: node.args.map((arg) => compileNode(arg, state)),
      }
  }
}

function getOrCreateBindingKey<TNoteId>(
  state: CompileState<TNoteId>,
  targetNoteId: TNoteId,
  targetValueId: string,
): string {
  const targetKey = `${String(targetNoteId)}:${targetValueId}`
  const existing = state.bindingKeysByTarget.get(targetKey)
  if (existing) {
    return existing
  }
  const key = `ref_${state.bindings.length}`
  state.bindingKeysByTarget.set(targetKey, key)
  state.bindings.push({
    key,
    targetNoteId,
    targetValueId,
  })
  return key
}

function validateFunctionCall(name: string, argCount: number): void {
  const metadata = NOTE_VALUE_FUNCTION_BY_NAME.get(name)
  if (!metadata) {
    throw new Error(`invalid_function_usage:Unknown function "${name}"`)
  }
  if (argCount < metadata.minArgs) {
    throw new Error(
      `invalid_function_usage:${name} expects ${metadata.minArgs === 1 ? 'at least 1 argument' : `at least ${metadata.minArgs} arguments`}`,
    )
  }
  if (metadata.maxArgs !== undefined && argCount > metadata.maxArgs) {
    throw new Error(
      `invalid_function_usage:${name} expects exactly ${metadata.maxArgs} argument${metadata.maxArgs === 1 ? '' : 's'}`,
    )
  }
}

const NOTE_VALUE_ERROR_CODE_SET = new Set<string>(NOTE_VALUE_ERROR_CODES)

function normalizeFormulaError(error: unknown): {
  errorCode: NoteValueErrorCode
  errorMessage: string
} {
  if (!(error instanceof Error)) {
    return { errorCode: 'parse_error', errorMessage: 'Invalid expression' }
  }

  const [rawCode, ...rest] = error.message.split(':')
  const errorMessage = rest.join(':').trim()
  if (NOTE_VALUE_ERROR_CODE_SET.has(rawCode)) {
    return {
      errorCode: rawCode as NoteValueErrorCode,
      errorMessage: errorMessage || 'Invalid expression',
    }
  }

  return {
    errorCode: 'parse_error',
    errorMessage: error.message,
  }
}

function compileNoteValueExpression<TNoteId>(
  definition: NoteValueAuthoringDefinition<TNoteId>,
  options: CompileExpressionOptions<TNoteId>,
): NoteValueCompileData<TNoteId> {
  if (validateSlug(definition.slug, NOTE_VALUE_SLUG_OPTIONS) !== null) {
    return makeCompileError('invalid_slug', `Slug "${definition.slug}" is invalid`)
  }

  const expressionSource = definition.expressionSource.trim()
  if (!expressionSource) {
    return makeCompileError('empty_expression', 'Enter a literal value or formula')
  }

  try {
    const parsed = parseFormula(expressionSource)
    const compileState: CompileState<TNoteId> = {
      bindings: [],
      bindingKeysByTarget: new Map(),
      resolveSameNote: options.resolveSameNote,
      resolveExternal: options.resolveExternal,
    }
    const compiled = compileNode(parsed, compileState)
    return {
      compiledFormula: compiled,
      bindings: compileState.bindings,
      compileStatus: 'ok',
      errorCode: null,
      errorMessage: null,
    }
  } catch (error) {
    const normalized = normalizeFormulaError(error)
    return makeCompileError(
      normalized.errorCode,
      normalized.errorMessage,
      error instanceof FormulaReferenceError ? error.reference : null,
    )
  }
}

export function compileNoteValueDefinitions<TNoteId>(
  definitions: Array<NoteValueAuthoringDefinition<TNoteId>>,
  options: CompileDefinitionsOptions<TNoteId>,
): Array<NoteValueDefinition<TNoteId>> {
  const slugCounts = new Map<string, number>()
  const valueIdCounts = new Map<string, number>()

  for (const definition of definitions) {
    slugCounts.set(definition.slug, (slugCounts.get(definition.slug) ?? 0) + 1)
    valueIdCounts.set(definition.valueId, (valueIdCounts.get(definition.valueId) ?? 0) + 1)
  }

  const resolveSameNote = (slug: string): NoteValueResolution<TNoteId> => {
    if (slugCounts.get(slug) && slugCounts.get(slug)! > 1) {
      return {
        ok: false,
        errorCode: 'duplicate_slug',
        errorMessage: `Slug "${slug}" is duplicated in this note`,
      }
    }
    const match = definitions.find((definition) => definition.slug === slug)
    if (!match) {
      return {
        ok: false,
        errorCode: 'unknown_reference',
        errorMessage: `Unknown reference "[[${slug}]]"`,
      }
    }
    return {
      ok: true,
      noteId: options.currentNoteId,
      valueId: match.valueId,
    }
  }

  return definitions.map((definition) => {
    let compileData: NoteValueCompileData<TNoteId>
    if ((slugCounts.get(definition.slug) ?? 0) > 1) {
      compileData = makeCompileError(
        'duplicate_slug',
        `Slug "${definition.slug}" is duplicated in this note`,
      )
    } else if ((valueIdCounts.get(definition.valueId) ?? 0) > 1) {
      compileData = makeCompileError(
        'duplicate_value_id',
        `Value ID "${definition.valueId}" is duplicated in this note`,
      )
    } else {
      compileData = compileNoteValueExpression(definition, {
        currentNoteId: options.currentNoteId,
        resolveSameNote,
        resolveExternal: (notePathRaw, slug) =>
          options.resolveExternal(notePathRaw, slug, definition),
      })
    }

    return {
      ...definition,
      ...compileData,
    }
  })
}

function evaluateFunction(name: string, args: Array<number>): number {
  validateFunctionCall(name, args.length)

  switch (name) {
    case 'min':
      return Math.min(...args)
    case 'max':
      return Math.max(...args)
    case 'round':
      return Math.round(args[0])
    case 'floor':
      return Math.floor(args[0])
    case 'ceil':
      return Math.ceil(args[0])
    case 'abs':
      return Math.abs(args[0])
    default:
      throw new Error(`invalid_function_usage:Unknown function "${name}"`)
  }
}

function evaluateCompiledNode<TNoteId>(
  node: NoteValueCompiledFormula,
  bindingMap: Map<string, NoteValueBinding<TNoteId>>,
  getDependencyState: EvaluateDependency<TNoteId>,
): number {
  switch (node.kind) {
    case 'number':
      return node.value
    case 'binding':
      return evaluateCompiledBinding(node.key, bindingMap, getDependencyState)
    case 'unary': {
      const value = evaluateCompiledNode(node.argument, bindingMap, getDependencyState)
      return node.operator === '-' ? -value : value
    }
    case 'binary':
      return evaluateCompiledBinary(node, bindingMap, getDependencyState)
    case 'call':
      return evaluateFunction(
        node.callee,
        node.args.map((arg) => evaluateCompiledNode(arg, bindingMap, getDependencyState)),
      )
  }
}

function evaluateCompiledBinding<TNoteId>(
  key: string,
  bindingMap: Map<string, NoteValueBinding<TNoteId>>,
  getDependencyState: EvaluateDependency<TNoteId>,
): number {
  const binding = bindingMap.get(key)
  if (!binding) {
    throw new Error(`missing_target:Missing binding "${key}"`)
  }
  return evaluateBindingDependency(binding, getDependencyState)
}

function evaluateBindingDependency<TNoteId>(
  binding: NoteValueBinding<TNoteId>,
  getDependencyState: EvaluateDependency<TNoteId>,
): number {
  const dependencyState = getDependencyState(binding.targetNoteId, binding.targetValueId)
  if (!dependencyState) {
    throw new Error('missing_target:Referenced value could not be found')
  }
  if (dependencyState.status === 'ok' && dependencyState.rawValue !== null) {
    return dependencyState.rawValue
  }
  if (dependencyState.errorCode === 'cyclic_dependency') {
    throw new Error(
      `cyclic_dependency:${dependencyState.errorMessage ?? 'Cyclic dependency detected'}`,
    )
  }
  throw new Error(
    `dependency_error:${dependencyState.errorMessage ?? `Dependency "${binding.targetValueId}" is invalid`}`,
  )
}

function evaluateCompiledBinary<TNoteId>(
  node: Extract<NoteValueCompiledFormula, { kind: 'binary' }>,
  bindingMap: Map<string, NoteValueBinding<TNoteId>>,
  getDependencyState: EvaluateDependency<TNoteId>,
): number {
  const left = evaluateCompiledNode(node.left, bindingMap, getDependencyState)
  const right = evaluateCompiledNode(node.right, bindingMap, getDependencyState)
  switch (node.operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      if (right === 0) {
        throw new Error('division_by_zero:Division by zero')
      }
      return left / right
  }
}

export function evaluateNoteValueDefinitions<TNoteId>(
  definitions: Array<NoteValueDefinition<TNoteId>>,
  getDependencyState: EvaluateDependency<TNoteId>,
): Array<NoteValueRuntimeState<TNoteId>> {
  const definitionsByValueId = new Map<string, Array<NoteValueDefinition<TNoteId>>>()
  for (const definition of definitions) {
    const list = definitionsByValueId.get(definition.valueId)
    if (list) {
      list.push(definition)
    } else {
      definitionsByValueId.set(definition.valueId, [definition])
    }
  }

  const cache = new Map<string, NoteValueRuntimeState<TNoteId>>()
  const visiting = new Set<string>()

  const evaluateDefinition = (
    definition: NoteValueDefinition<TNoteId>,
  ): NoteValueRuntimeState<TNoteId> => {
    const cacheKey = `${definition.blockNoteId}:${definition.valueId}`
    if ((definitionsByValueId.get(definition.valueId)?.length ?? 0) > 1) {
      return makeRuntimeError(
        definition,
        'duplicate_value_id',
        `Value ID "${definition.valueId}" is duplicated in this note`,
      )
    }

    const cached = cache.get(cacheKey)
    if (cached) {
      return cached
    }

    if (visiting.has(cacheKey)) {
      const cycleState = makeRuntimeError(
        definition,
        'cyclic_dependency',
        'Cyclic dependency detected',
      )
      cache.set(cacheKey, cycleState)
      return cycleState
    }

    if (definition.compileStatus === 'error' || !definition.compiledFormula) {
      const errorState = makeRuntimeError(
        definition,
        definition.errorCode ?? 'parse_error',
        definition.errorMessage ?? 'Invalid expression',
      )
      cache.set(cacheKey, errorState)
      return errorState
    }

    visiting.add(cacheKey)
    try {
      const bindingMap = new Map(definition.bindings.map((binding) => [binding.key, binding]))
      const rawValue = evaluateCompiledNode(
        definition.compiledFormula,
        bindingMap,
        (noteId, valueId) => {
          if (noteId === definition.noteId) {
            const dependency = definitionsByValueId.get(valueId)?.[0]
            if (!dependency) return null
            return evaluateDefinition(dependency)
          }
          return getDependencyState(noteId, valueId)
        },
      )
      if (!Number.isFinite(rawValue)) {
        throw new Error('non_finite_result:Result is not a finite number')
      }

      const state: NoteValueRuntimeState<TNoteId> = {
        noteId: definition.noteId,
        blockNoteId: definition.blockNoteId,
        valueId: definition.valueId,
        slug: definition.slug,
        status: 'ok',
        rawValue,
        formattedValue: formatNoteValue(rawValue),
        errorCode: null,
        errorMessage: null,
      }
      cache.set(cacheKey, state)
      return state
    } catch (error) {
      const normalized = normalizeFormulaError(error)
      const errorState = makeRuntimeError(definition, normalized.errorCode, normalized.errorMessage)
      cache.set(cacheKey, errorState)
      return errorState
    } finally {
      visiting.delete(cacheKey)
    }
  }

  return definitions.map((definition) => evaluateDefinition(definition))
}

export function evaluateNoteValueAuthoringDefinitions<TNoteId>(
  definitions: Array<NoteValueAuthoringDefinition<TNoteId>>,
  options: EvaluateAuthoringOptions<TNoteId>,
): Array<NoteValueRuntimeState<TNoteId>> {
  return evaluateNoteValueDefinitions(
    compileNoteValueDefinitions(definitions, {
      currentNoteId: options.currentNoteId,
      resolveExternal: options.resolveExternal,
    }),
    options.getDependencyState,
  )
}
