import type { FormulaReferenceToken } from './model'

type Operator = '+' | '-' | '*' | '/'
type SymbolTokenValue = '+' | '-' | '*' | '/' | '(' | ')' | ',' | '.'

export type FormulaNode =
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

export function parseFormula(input: string): FormulaNode {
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
