import {
  compileNoteValueDefinitions as compileRuntimeNoteValueDefinitions,
  evaluateNoteValueAuthoringDefinitions as evaluateRuntimeNoteValueAuthoringDefinitions,
  isNoteValueCompiledFormula as isRuntimeNoteValueCompiledFormula,
} from './values/runtime'
import { evaluateNoteValueDefinitions as evaluateRuntimeNoteValueDefinitions } from './values/dependency-evaluator'
import { extractNoteValueDefinitions as extractRuntimeNoteValueDefinitions } from './values/definitions'
import { collectFormulaReferences as collectParserFormulaReferences } from './values/formula-parser'
import type {
  NoteValueAuthoringDefinition as RuntimeNoteValueAuthoringDefinition,
  NoteValueDefinition as RuntimeNoteValueDefinition,
  NoteValueResolution as RuntimeNoteValueResolution,
} from './values/runtime'
import { NOTE_VALUE_ERROR_CODES as NOTE_VALUE_MODEL_ERROR_CODES } from './values/model'
import type { NoteValueCompiledFormula as ModelNoteValueCompiledFormula } from './values/model'
import type {
  NoteValueBinding as RuntimeNoteValueBinding,
  NoteValueCompileState as RuntimeNoteValueCompileState,
  NoteValueRuntimeState as RuntimeNoteValueRuntimeState,
} from './values/state-contract'
import type { NoteBlock } from './document/model'

export const NOTE_VALUE_ERROR_CODES = [...NOTE_VALUE_MODEL_ERROR_CODES] as const

export type NoteValueErrorCode = (typeof NOTE_VALUE_ERROR_CODES)[number]

export type NoteValueCompiledFormula = ModelNoteValueCompiledFormula & {}
export type NoteValueBinding<TNoteId = string> = RuntimeNoteValueBinding<TNoteId>
export type NoteValueCompileState<TNoteId = string> = RuntimeNoteValueCompileState<TNoteId>
export type NoteValueAuthoringDefinition<TNoteId = string> =
  RuntimeNoteValueAuthoringDefinition<TNoteId>
export type NoteValueDefinition<TNoteId = string> = RuntimeNoteValueDefinition<TNoteId>
export type NoteValueRuntimeState<TNoteId = string> = RuntimeNoteValueRuntimeState<TNoteId>
export type NoteValueResolution<TNoteId = string> = RuntimeNoteValueResolution<TNoteId>
export type FormulaReferenceToken =
  | { kind: 'self'; slug: string }
  | { kind: 'external'; notePathRaw: string; slug: string }

export function isNoteValueCompiledFormula(value: unknown): value is NoteValueCompiledFormula {
  return isRuntimeNoteValueCompiledFormula(value)
}

export function extractNoteValueDefinitions<TNoteId>(
  blocks: Array<NoteBlock>,
  noteId: TNoteId,
): Array<NoteValueAuthoringDefinition<TNoteId>> {
  return extractRuntimeNoteValueDefinitions(blocks, noteId)
}

export function collectFormulaReferences(expressionSource: string): Array<FormulaReferenceToken> {
  return collectParserFormulaReferences(expressionSource)
}

export function compileNoteValueDefinitions<TNoteId>(
  definitions: Array<NoteValueAuthoringDefinition<TNoteId>>,
  options: {
    currentNoteId: TNoteId
    resolveExternal: (
      notePathRaw: string,
      slug: string,
      definition: NoteValueAuthoringDefinition<TNoteId>,
    ) => NoteValueResolution<TNoteId>
  },
): Array<NoteValueDefinition<TNoteId>> {
  return compileRuntimeNoteValueDefinitions(definitions, options)
}

export function evaluateNoteValueDefinitions<TNoteId>(
  definitions: Array<NoteValueDefinition<TNoteId>>,
  getDependencyState: (noteId: TNoteId, valueId: string) => NoteValueRuntimeState<TNoteId> | null,
): Array<NoteValueRuntimeState<TNoteId>> {
  return evaluateRuntimeNoteValueDefinitions(definitions, getDependencyState)
}

export function evaluateNoteValueAuthoringDefinitions<TNoteId>(
  definitions: Array<NoteValueAuthoringDefinition<TNoteId>>,
  options: {
    currentNoteId: TNoteId
    resolveExternal: (
      notePathRaw: string,
      slug: string,
      definition: NoteValueAuthoringDefinition<TNoteId>,
    ) => NoteValueResolution<TNoteId>
    getDependencyState: (noteId: TNoteId, valueId: string) => NoteValueRuntimeState<TNoteId> | null
  },
): Array<NoteValueRuntimeState<TNoteId>> {
  return evaluateRuntimeNoteValueAuthoringDefinitions(definitions, options)
}
