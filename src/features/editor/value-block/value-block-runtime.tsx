import { evaluateNoteValueAuthoringDefinitions } from '../../../../shared/note-values/formula'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'
import type {
  NoteValueAuthoringDefinition,
  NoteValueResolution,
  NoteValueRuntimeState,
} from '../../../../shared/note-values/types'
import { NoteValueRuntimeContext } from './value-block-runtime-context'
import { useValueTransferBehavior } from './value-transfer-plugin'
import type { NoteValueRuntimeSource } from './note-value-runtime-source'

function evaluateSameNoteAuthoringStates({
  noteId,
  definitions,
  externalStates,
  externalNoteIdByPath,
}: {
  noteId: Id<'sidebarItems'>
  definitions: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>>
  externalStates: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
  externalNoteIdByPath: Map<string, Id<'sidebarItems'>>
}) {
  const definitionsBySlug = new Map<
    string,
    Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>>
  >()
  for (const definition of definitions) {
    const matches = definitionsBySlug.get(definition.slug)
    if (matches) matches.push(definition)
    else definitionsBySlug.set(definition.slug, [definition])
  }
  const externalValuesByNoteAndSlug = new Map<
    string,
    Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
  >()
  for (const state of externalStates) {
    const key = `${state.noteId}:${state.slug}`
    const states = externalValuesByNoteAndSlug.get(key)
    if (states) states.push(state)
    else externalValuesByNoteAndSlug.set(key, [state])
  }
  const externalStateByTarget = new Map(
    externalStates.map((state) => [`${state.noteId}:${state.valueId}`, state]),
  )
  return evaluateNoteValueAuthoringDefinitions(definitions, {
    currentNoteId: noteId,
    resolveExternal: (notePathRaw, slug): NoteValueResolution<Id<'sidebarItems'>> => {
      const externalNoteId = externalNoteIdByPath.get(notePathRaw)
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
        errorMessage: `Unknown reference "${slug}"`,
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
  const {
    authoredDefinitions,
    externalNoteIdByPath,
    externalStates,
    itemsMap,
    noteId,
    persistedStates,
    sidebarItems,
  } = source
  const existingSlugs = authoredDefinitions.map((definition) => definition.slug)
  useValueTransferBehavior(editor, editable, () => existingSlugs)

  const stateByValueId = new Map(persistedStates.map((state) => [state.valueId, state]))
  if (noteId && evaluateValuesFromEditor) {
    const liveStates = evaluateSameNoteAuthoringStates({
      noteId,
      definitions: authoredDefinitions,
      externalStates,
      externalNoteIdByPath,
    })
    for (const state of liveStates) {
      stateByValueId.set(state.valueId, state)
    }
  }
  const authoredValueStates = authoredDefinitions.flatMap((definition) => {
    const state = stateByValueId.get(definition.valueId)
    return state ? [state] : []
  })

  return (
    <NoteValueRuntimeContext.Provider
      value={{
        noteId,
        editable,
        authoredDefinitions,
        authoredValueStates,
        stateByValueId,
        sidebarItems,
        itemsMap,
      }}
    >
      {children}
    </NoteValueRuntimeContext.Provider>
  )
}
