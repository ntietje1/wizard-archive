import type { SidebarItemId } from '../../../../shared/common/ids'
import { collectFormulaReferences } from './values/formula-parser'
import type { NoteValueAuthoringDefinition } from './values/runtime'
import type { NoteValueRuntimeState } from './values/state-contract'

export type NoteValueStatesForNotesStatus = 'pending' | 'success' | 'error'

interface NoteValueRuntimeStateLoad {
  states: Array<NoteValueRuntimeState<SidebarItemId>>
  status: NoteValueStatesForNotesStatus
}

export interface NoteValueRuntimeStateSource {
  useNoteValueStates: (noteIds: Array<SidebarItemId>) => NoteValueRuntimeStateLoad
}

export interface NoteValueRuntimeSource {
  noteId?: SidebarItemId
  authoredDefinitions: Array<NoteValueAuthoringDefinition<SidebarItemId>>
  externalDependencyStates: Array<NoteValueRuntimeState<SidebarItemId>>
  externalDependencyStatesStatus: NoteValueStatesForNotesStatus
  persistedStates: Array<NoteValueRuntimeState<SidebarItemId>>
  referenceableStates: Array<NoteValueRuntimeState<SidebarItemId>>
  referenceableStatesStatus: NoteValueStatesForNotesStatus
  references: NoteValueReferences
}

interface NoteValueReferenceNoteCandidate {
  noteId: SidebarItemId
  title: string
  path: string
}

export interface NoteValueReferences {
  getNoteCandidates: () => Array<NoteValueReferenceNoteCandidate>
  resolveNoteIdByPath: (input: {
    notePathRaw: string | null
    sourceNoteId?: SidebarItemId
  }) => SidebarItemId | null
}

interface NoteValueRuntimeStatePlan {
  noteIds: Array<SidebarItemId>
  externalDependencyNoteIds: Array<SidebarItemId>
  referenceableNoteIds: Array<SidebarItemId>
}

export function planNoteValueRuntimeStateLoad({
  authoredDefinitions,
  noteId,
  references,
}: {
  authoredDefinitions: Array<NoteValueAuthoringDefinition<SidebarItemId>>
  noteId?: SidebarItemId
  references: NoteValueReferences
}): NoteValueRuntimeStatePlan {
  const externalDependencyNoteIds = noteId
    ? getReferencedExternalNoteIds({
        definitions: authoredDefinitions,
        currentNoteId: noteId,
        sourceNoteId: noteId,
        resolveNoteIdByPath: references.resolveNoteIdByPath,
      })
    : []
  const candidateNoteIds = references
    .getNoteCandidates()
    .flatMap((candidate) => (candidate.noteId === noteId ? [] : [candidate.noteId]))
  const referenceableNoteIds = uniqueSidebarItemIds([
    ...externalDependencyNoteIds,
    ...candidateNoteIds,
  ])

  return {
    noteIds: uniqueSidebarItemIds([...(noteId ? [noteId] : []), ...referenceableNoteIds]),
    externalDependencyNoteIds,
    referenceableNoteIds,
  }
}

export function hydrateNoteValueRuntimeSource({
  authoredDefinitions,
  noteId,
  references,
  stateLoad,
  statePlan,
}: {
  authoredDefinitions: Array<NoteValueAuthoringDefinition<SidebarItemId>>
  noteId?: SidebarItemId
  references: NoteValueReferences
  stateLoad: NoteValueRuntimeStateLoad
  statePlan: NoteValueRuntimeStatePlan
}): NoteValueRuntimeSource {
  return {
    noteId,
    authoredDefinitions,
    externalDependencyStates: stateLoad.states.filter((state) =>
      statePlan.externalDependencyNoteIds.includes(state.noteId),
    ),
    externalDependencyStatesStatus: stateLoad.status,
    persistedStates: noteId ? stateLoad.states.filter((state) => state.noteId === noteId) : [],
    referenceableStates: stateLoad.states.filter((state) =>
      statePlan.referenceableNoteIds.includes(state.noteId),
    ),
    referenceableStatesStatus: stateLoad.status,
    references,
  }
}

function getReferencedExternalNoteIds({
  currentNoteId,
  definitions,
  resolveNoteIdByPath,
  sourceNoteId,
}: {
  currentNoteId: SidebarItemId
  definitions: Array<NoteValueAuthoringDefinition<SidebarItemId>>
  resolveNoteIdByPath: NoteValueReferences['resolveNoteIdByPath']
  sourceNoteId?: SidebarItemId
}) {
  const noteIds = new Set<SidebarItemId>()
  for (const definition of definitions) {
    for (const reference of collectFormulaReferences(definition.expressionSource)) {
      if (reference.kind !== 'external') continue
      const externalNoteId = resolveNoteIdByPath({
        notePathRaw: reference.notePathRaw,
        sourceNoteId,
      })
      if (externalNoteId && externalNoteId !== currentNoteId) {
        noteIds.add(externalNoteId)
      }
    }
  }
  return [...noteIds]
}

function uniqueSidebarItemIds(ids: Array<SidebarItemId>) {
  return [...new Set(ids)]
}
