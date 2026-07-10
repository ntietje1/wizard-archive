import type { NoteValueCompiledFormula, NoteValueErrorCode } from './model'

export interface NoteValueBinding<TNoteId = string> {
  key: string
  targetNoteId: TNoteId
  targetValueId: string
}

export type NoteValueCompileState<TNoteId = string> =
  | {
      status: 'ok'
      formula: NoteValueCompiledFormula
      bindings: Array<NoteValueBinding<TNoteId>>
    }
  | {
      status: 'error'
      errorCode: NoteValueErrorCode
      errorMessage: string
    }

type NoteValueRuntimeStateIdentity<TNoteId> = {
  noteId: TNoteId
  noteBlockId: string
  valueId: string
  slug: string
}

export type NoteValueRuntimeState<TNoteId = string> = NoteValueRuntimeStateIdentity<TNoteId> &
  (
    | {
        status: 'ok'
        rawValue: number
        formattedValue: string
      }
    | {
        status: 'error'
        errorCode: NoteValueErrorCode
        errorMessage: string
      }
  )
