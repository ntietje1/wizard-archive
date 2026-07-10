import { evaluateNoteValueDefinitions } from './dependency-evaluator'
import type { EvaluateDependency } from './dependency-evaluator'
import { compileNoteValueExpression, makeFormulaCompileError } from './formula-compiler'
import type { NoteValueCompiledFormula, NoteValueErrorCode } from './model'
import type { NoteValueProps } from './schema'
import type { NoteValueCompileState, NoteValueRuntimeState } from './state-contract'

export interface NoteValueAuthoringDefinition<TNoteId = string> extends NoteValueProps {
  noteId: TNoteId
  noteBlockId: string
}

export type NoteValueDefinition<TNoteId = string> = NoteValueAuthoringDefinition<TNoteId> & {
  compile: NoteValueCompileState<TNoteId>
}

export type NoteValueResolution<TNoteId = string> =
  | { ok: true; noteId: TNoteId; valueId: string }
  | { ok: false; errorCode: NoteValueErrorCode; errorMessage: string }

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

export function isNoteValueCompiledFormula(value: unknown): value is NoteValueCompiledFormula {
  if (!value || typeof value !== 'object') return false
  const node = value as { kind?: unknown }
  switch (node.kind) {
    case 'number':
      return typeof (value as { value?: unknown }).value === 'number'
    case 'binding':
      return typeof (value as { key?: unknown }).key === 'string'
    case 'unary': {
      const unary = value as { operator?: unknown; argument?: unknown }
      return (
        (unary.operator === '+' || unary.operator === '-') &&
        isNoteValueCompiledFormula(unary.argument)
      )
    }
    case 'binary': {
      const binary = value as { operator?: unknown; left?: unknown; right?: unknown }
      return (
        (binary.operator === '+' ||
          binary.operator === '-' ||
          binary.operator === '*' ||
          binary.operator === '/') &&
        isNoteValueCompiledFormula(binary.left) &&
        isNoteValueCompiledFormula(binary.right)
      )
    }
    case 'call': {
      const call = value as { callee?: unknown; args?: unknown }
      return (
        typeof call.callee === 'string' &&
        Array.isArray(call.args) &&
        call.args.every(isNoteValueCompiledFormula)
      )
    }
    default:
      return false
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
    let compile: NoteValueCompileState<TNoteId>
    if ((slugCounts.get(definition.slug) ?? 0) > 1) {
      compile = makeFormulaCompileError(
        'duplicate_slug',
        `Slug "${definition.slug}" is duplicated in this note`,
      )
    } else if ((valueIdCounts.get(definition.valueId) ?? 0) > 1) {
      compile = makeFormulaCompileError(
        'duplicate_value_id',
        `Value ID "${definition.valueId}" is duplicated in this note`,
      )
    } else {
      compile = compileNoteValueExpression(definition, {
        resolveSameNote,
        resolveExternal: (notePathRaw, slug) =>
          options.resolveExternal(notePathRaw, slug, definition),
      })
    }

    return {
      ...definition,
      compile,
    }
  })
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
