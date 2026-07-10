import { formatNoteValue } from './constants'
import { evaluateCompiledFormula } from './formula-evaluator'
import { FormulaError, normalizeFormulaError } from './formula-errors'
import type { NoteValueErrorCode } from './model'
import type { NoteValueDefinition } from './runtime'
import type { NoteValueRuntimeState } from './state-contract'

export type EvaluateDependency<TNoteId> = (
  noteId: TNoteId,
  valueId: string,
) => NoteValueRuntimeState<TNoteId> | null

function makeRuntimeError<TNoteId>(
  definition: Pick<NoteValueDefinition<TNoteId>, 'noteId' | 'noteBlockId' | 'valueId' | 'slug'>,
  errorCode: NoteValueErrorCode,
  errorMessage: string,
): NoteValueRuntimeState<TNoteId> {
  return {
    noteId: definition.noteId,
    noteBlockId: definition.noteBlockId,
    valueId: definition.valueId,
    slug: definition.slug,
    status: 'error',
    errorCode,
    errorMessage,
  }
}

export function evaluateNoteValueDefinitions<TNoteId>(
  definitions: Array<NoteValueDefinition<TNoteId>>,
  getDependencyState: EvaluateDependency<TNoteId>,
): Array<NoteValueRuntimeState<TNoteId>> {
  const definitionsByNoteId = new Map<TNoteId, Map<string, Array<NoteValueDefinition<TNoteId>>>>()
  for (const definition of definitions) {
    let definitionsByValueId = definitionsByNoteId.get(definition.noteId)
    if (!definitionsByValueId) {
      definitionsByValueId = new Map()
      definitionsByNoteId.set(definition.noteId, definitionsByValueId)
    }
    const list = definitionsByValueId.get(definition.valueId)
    if (list) {
      list.push(definition)
    } else {
      definitionsByValueId.set(definition.valueId, [definition])
    }
  }

  const cache = new Map<NoteValueDefinition<TNoteId>, NoteValueRuntimeState<TNoteId>>()
  const visiting = new Set<NoteValueDefinition<TNoteId>>()

  const evaluateDefinition = (
    definition: NoteValueDefinition<TNoteId>,
  ): NoteValueRuntimeState<TNoteId> => {
    const definitionsByValueId = definitionsByNoteId.get(definition.noteId)
    if ((definitionsByValueId?.get(definition.valueId)?.length ?? 0) > 1) {
      return makeRuntimeError(
        definition,
        'duplicate_value_id',
        `Value ID "${definition.valueId}" is duplicated in this note`,
      )
    }

    const cached = cache.get(definition)
    if (cached) {
      return cached
    }

    if (visiting.has(definition)) {
      const cycleState = makeRuntimeError(
        definition,
        'cyclic_dependency',
        'Cyclic dependency detected',
      )
      cache.set(definition, cycleState)
      return cycleState
    }

    if (definition.compile.status === 'error') {
      const errorState = makeRuntimeError(
        definition,
        definition.compile.errorCode,
        definition.compile.errorMessage,
      )
      cache.set(definition, errorState)
      return errorState
    }

    visiting.add(definition)
    try {
      const rawValue = evaluateCompiledFormula(
        definition.compile.formula,
        definition.compile.bindings,
        (noteId, valueId) => {
          const dependency = definitionsByNoteId.get(noteId)?.get(valueId)?.[0]
          return dependency ? evaluateDefinition(dependency) : getDependencyState(noteId, valueId)
        },
      )
      if (!Number.isFinite(rawValue)) {
        throw new FormulaError('non_finite_result', 'Result is not a finite number')
      }

      const state: NoteValueRuntimeState<TNoteId> = {
        noteId: definition.noteId,
        noteBlockId: definition.noteBlockId,
        valueId: definition.valueId,
        slug: definition.slug,
        status: 'ok',
        rawValue,
        formattedValue: formatNoteValue(rawValue),
      }
      cache.set(definition, state)
      return state
    } catch (error) {
      const normalized = normalizeFormulaError(error)
      const errorState = makeRuntimeError(definition, normalized.errorCode, normalized.errorMessage)
      cache.set(definition, errorState)
      return errorState
    } finally {
      visiting.delete(definition)
    }
  }

  return definitions.map((definition) => evaluateDefinition(definition))
}
