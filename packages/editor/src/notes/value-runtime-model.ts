import type { ResourceId } from '../resources/domain-id'
import { collectFormulaReferences } from './values/formula-parser'
import type { NoteValueAuthoringDefinition } from './values/runtime'
import type { NoteValueRuntimeState } from './values/state-contract'

export type NoteValueStatesForNotesStatus = 'pending' | 'success' | 'error'

interface NoteValueRuntimeStateLoad {
  states: Array<NoteValueRuntimeState<ResourceId>>
  status: NoteValueStatesForNotesStatus
}

export interface NoteValueRuntimeStateSource {
  useNoteValueStates: (noteIds: Array<ResourceId>) => NoteValueRuntimeStateLoad
}

export interface NoteValueRuntimeSource {
  noteId?: ResourceId
  authoredDefinitions: Array<NoteValueAuthoringDefinition<ResourceId>>
  externalDependencyStates: Array<NoteValueRuntimeState<ResourceId>>
  externalDependencyStatesStatus: NoteValueStatesForNotesStatus
  persistedStates: Array<NoteValueRuntimeState<ResourceId>>
  referenceableStates: Array<NoteValueRuntimeState<ResourceId>>
  referenceableStatesStatus: NoteValueStatesForNotesStatus
  references: NoteValueReferences
}

interface NoteValueReferenceNoteCandidate {
  noteId: ResourceId
  title: string
  path: string
}

export interface NoteValueReferences {
  getNoteCandidates: () => Array<NoteValueReferenceNoteCandidate>
  resolveNoteIdByPath: (input: {
    notePathRaw: string | null
    sourceNoteId?: ResourceId
  }) => ResourceId | null
}

interface NoteValueRuntimeStatePlan {
  noteIds: Array<ResourceId>
  externalDependencyNoteIds: Array<ResourceId>
  referenceableNoteIds: Array<ResourceId>
}

export function planNoteValueRuntimeStateLoad({
  authoredDefinitions,
  noteId,
  references,
}: {
  authoredDefinitions: Array<NoteValueAuthoringDefinition<ResourceId>>
  noteId?: ResourceId
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
  authoredDefinitions: Array<NoteValueAuthoringDefinition<ResourceId>>
  noteId?: ResourceId
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
  currentNoteId: ResourceId
  definitions: Array<NoteValueAuthoringDefinition<ResourceId>>
  resolveNoteIdByPath: NoteValueReferences['resolveNoteIdByPath']
  sourceNoteId?: ResourceId
}) {
  const noteIds = new Set<ResourceId>()
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

function uniqueSidebarItemIds(ids: Array<ResourceId>) {
  return [...new Set(ids)]
}
