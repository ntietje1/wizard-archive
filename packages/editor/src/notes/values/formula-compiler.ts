import { validateSlug } from '../../../../../shared/slugs'
import { NOTE_VALUE_SLUG_OPTIONS } from './constants'
import { validateFormulaFunctionCall } from './formula-evaluator'
import { FormulaError, FormulaReferenceError, normalizeFormulaError } from './formula-errors'
import { parseFormula } from './formula-parser'
import type { FormulaNode } from './formula-parser'
import type { NoteValueCompiledFormula, NoteValueErrorCode } from './model'
import type { NoteValueBinding, NoteValueCompileState } from './state-contract'

type FormulaResolution<TNoteId = string> =
  | { ok: true; noteId: TNoteId; valueId: string }
  | { ok: false; errorCode: NoteValueErrorCode; errorMessage: string }

interface CompileState<TNoteId> {
  bindings: Array<NoteValueBinding<TNoteId>>
  bindingKeysByTarget: Map<string, string>
  resolveSameNote: (slug: string) => FormulaResolution<TNoteId>
  resolveExternal: (notePathRaw: string, slug: string) => FormulaResolution<TNoteId>
}

interface CompileExpressionOptions<TNoteId> {
  resolveSameNote: (slug: string) => FormulaResolution<TNoteId>
  resolveExternal: (notePathRaw: string, slug: string) => FormulaResolution<TNoteId>
}

export function makeFormulaCompileError<TNoteId>(
  errorCode: NoteValueErrorCode,
  errorMessage: string,
): NoteValueCompileState<TNoteId> {
  return {
    status: 'error',
    errorCode,
    errorMessage,
  }
}

export function compileNoteValueExpression<TNoteId>(
  definition: { slug: string; expressionSource: string },
  options: CompileExpressionOptions<TNoteId>,
): NoteValueCompileState<TNoteId> {
  if (validateSlug(definition.slug, NOTE_VALUE_SLUG_OPTIONS) !== null) {
    return makeFormulaCompileError('invalid_slug', `Slug "${definition.slug}" is invalid`)
  }

  const expressionSource = definition.expressionSource.trim()
  if (!expressionSource) {
    return makeFormulaCompileError('empty_expression', 'Enter a literal value or formula')
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
      status: 'ok',
      formula: compiled,
      bindings: compileState.bindings,
    }
  } catch (error) {
    const normalized = normalizeFormulaError(error)
    return makeFormulaCompileError(normalized.errorCode, normalized.errorMessage)
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
      throw new FormulaError('unknown_reference', `Unknown reference "${node.name}"`)
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
      validateFormulaFunctionCall(node.callee, node.args.length)
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
