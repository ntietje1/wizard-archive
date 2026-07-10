import { evaluateNoteValueAuthoringDefinitions } from '../values/runtime'
import { useRef } from 'react'
import type { NoteValueAuthoringDefinition, NoteValueResolution } from '../values/runtime'
import type { NoteValueRuntimeState } from '../values/state-contract'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { CustomBlockNoteEditor } from '../editor-schema'
import { NoteValueRuntimeContext } from './value-block-runtime-context'
import type { NoteValueRuntimeContextValue } from './value-block-runtime-context'
import { useValueTransferBehavior } from './value-transfer-plugin'
import type { NoteValueReferences, NoteValueRuntimeSource } from '../value-runtime-model'

function evaluateSameNoteAuthoringStates({
  noteId,
  definitions,
  externalDependencyStates,
  externalDependencyStatesStatus,
  references,
}: {
  noteId: SidebarItemId
  definitions: Array<NoteValueAuthoringDefinition<SidebarItemId>>
  externalDependencyStates: Array<NoteValueRuntimeState<SidebarItemId>>
  externalDependencyStatesStatus: NoteValueRuntimeSource['externalDependencyStatesStatus']
  references: NoteValueReferences
}) {
  const definitionsBySlug = new Map<string, Array<NoteValueAuthoringDefinition<SidebarItemId>>>()
  for (const definition of definitions) {
    const matches = definitionsBySlug.get(definition.slug)
    if (matches) matches.push(definition)
    else definitionsBySlug.set(definition.slug, [definition])
  }
  const externalValuesByNoteAndSlug = new Map<string, Array<NoteValueRuntimeState<SidebarItemId>>>()
  for (const state of externalDependencyStates) {
    const key = `${state.noteId}:${state.slug}`
    const states = externalValuesByNoteAndSlug.get(key)
    if (states) states.push(state)
    else externalValuesByNoteAndSlug.set(key, [state])
  }
  const externalStateByTarget = new Map(
    externalDependencyStates.map((state) => [`${state.noteId}:${state.valueId}`, state]),
  )
  return evaluateNoteValueAuthoringDefinitions(definitions, {
    currentNoteId: noteId,
    resolveExternal: (notePathRaw, slug): NoteValueResolution<SidebarItemId> => {
      const externalNoteId = references.resolveNoteIdByPath({
        notePathRaw,
        sourceNoteId: noteId,
      })
      if (externalNoteId === noteId) {
        const matches = definitionsBySlug.get(slug) ?? []
        if (matches.length > 1) {
          return {
            ok: false,
            errorCode: 'duplicate_slug',
            errorMessage: `Slug "${slug}" is duplicated in this note`,
          }
        }
        const definition = matches[0]
        if (definition) {
          return {
            ok: true,
            noteId,
            valueId: definition.valueId,
          }
        }
        return {
          ok: false,
          errorCode: 'unknown_reference',
          errorMessage: `Unknown reference "[[${notePathRaw}.${slug}]]"`,
        }
      }

      if (externalNoteId && externalDependencyStatesStatus === 'error') {
        return {
          ok: false,
          errorCode: 'dependency_error',
          errorMessage: `Failed to load external reference "[[${notePathRaw}.${slug}]]"`,
        }
      }

      const states = externalNoteId
        ? externalValuesByNoteAndSlug.get(`${externalNoteId}:${slug}`)
        : undefined
      if (states && states.length > 1) {
        return {
          ok: false,
          errorCode: 'duplicate_slug',
          errorMessage: `Slug "${slug}" is duplicated in the target note`,
        }
      }
      const state = states?.[0]
      if (state) {
        return {
          ok: true,
          noteId: state.noteId,
          valueId: state.valueId,
        }
      }
      return {
        ok: false,
        errorCode: 'unknown_reference',
        errorMessage: `Unknown reference "[[${notePathRaw}.${slug}]]"`,
      }
    },
    getDependencyState: (dependencyNoteId, dependencyValueId) =>
      externalStateByTarget.get(`${dependencyNoteId}:${dependencyValueId}`) ?? null,
  })
}

export function NoteValueRuntimeProvider({
  editor,
  source,
  editable,
  evaluateValuesFromEditor,
  children,
}: {
  editor: CustomBlockNoteEditor
  source: NoteValueRuntimeSource
  editable: boolean
  evaluateValuesFromEditor: boolean
  children: React.ReactNode
}) {
  const { authoredDefinitions } = source
  const existingSlugs = authoredDefinitions.map((definition) => definition.slug)
  useValueTransferBehavior(editor, editable, () => existingSlugs)

  const contextValue = useStableNoteValueRuntimeContextValue({
    editable,
    evaluateValuesFromEditor,
    source,
  })

  return (
    <NoteValueRuntimeContext.Provider value={contextValue}>
      {children}
    </NoteValueRuntimeContext.Provider>
  )
}

function useStableNoteValueRuntimeContextValue(input: {
  editable: boolean
  evaluateValuesFromEditor: boolean
  source: NoteValueRuntimeSource
}) {
  const valueRef = useRef<{
    editable: boolean
    evaluateValuesFromEditor: boolean
    source: NoteValueRuntimeSource
    value: NoteValueRuntimeContextValue
  } | null>(null)
  if (
    !valueRef.current ||
    valueRef.current.editable !== input.editable ||
    valueRef.current.evaluateValuesFromEditor !== input.evaluateValuesFromEditor ||
    valueRef.current.source !== input.source
  ) {
    valueRef.current = {
      ...input,
      value: createNoteValueRuntimeContextValue(input),
    }
  }
  return valueRef.current.value
}

function createNoteValueRuntimeContextValue({
  editable,
  evaluateValuesFromEditor,
  source,
}: {
  editable: boolean
  evaluateValuesFromEditor: boolean
  source: NoteValueRuntimeSource
}): NoteValueRuntimeContextValue {
  const {
    authoredDefinitions,
    externalDependencyStates,
    externalDependencyStatesStatus,
    noteId,
    persistedStates,
    referenceableStates,
    referenceableStatesStatus,
    references,
  } = source
  const stateByValueId = new Map(persistedStates.map((state) => [state.valueId, state]))

  if (noteId && evaluateValuesFromEditor && externalDependencyStatesStatus !== 'pending') {
    for (const state of evaluateSameNoteAuthoringStates({
      noteId,
      definitions: authoredDefinitions,
      externalDependencyStates,
      externalDependencyStatesStatus,
      references,
    })) {
      stateByValueId.set(state.valueId, state)
    }
  }

  return {
    noteId,
    editable,
    authoredDefinitions,
    authoredValueStates: authoredDefinitions.flatMap((definition) => {
      const state = stateByValueId.get(definition.valueId)
      return state ? [state] : []
    }),
    externalDependencyStates,
    externalDependencyStatesStatus,
    referenceableStates,
    referenceableStatesStatus,
    stateByValueId,
    references,
  }
}
