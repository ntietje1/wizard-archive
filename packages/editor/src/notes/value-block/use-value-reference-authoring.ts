import type { ResourceId } from '../../resources/domain-id'
import { buildExternalNoteValuePrefix, buildSameNoteValueReference } from '../values/authoring'
import type { NoteValueRuntimeState } from '../values/state-contract'

import { useNoteValueRuntime } from './value-block-runtime-context'

export interface ValueReferenceCandidate {
  key: string
  title: string
  aliases: Array<string>
  detail: string
  insertText: string
  slug?: string
  noteId?: ResourceId
  previewValues?: Array<NoteValueRuntimeState<ResourceId>>
}

type ValuesByNoteId = Map<ResourceId, Array<NoteValueRuntimeState<ResourceId>>>

export function useValueReferenceAuthoring({
  selectedExternalNoteId = null,
  externalNotePathRaw = null,
  includeNoteValuePreviews = false,
}: {
  selectedExternalNoteId?: ResourceId | null
  externalNotePathRaw?: string | null
  includeNoteValuePreviews?: boolean
}) {
  const {
    authoredDefinitions,
    authoredValueStates,
    noteId,
    referenceableStates,
    referenceableStatesStatus,
    references,
    stateByValueId,
  } = useNoteValueRuntime()

  const baseNoteCandidates: Array<ValueReferenceCandidate> = references
    .getNoteCandidates()
    .map(({ noteId: candidateNoteId, path, title }) => {
      const insertText = buildExternalNoteValuePrefix(path)
      return {
        key: candidateNoteId,
        noteId: candidateNoteId,
        title,
        aliases: [path],
        detail: path,
        insertText,
      }
    })
  const noteCandidateIds = baseNoteCandidates.flatMap((candidate) =>
    candidate.noteId ? [candidate.noteId] : [],
  )
  const persistedPreviewNoteIds = noteCandidateIds.filter(
    (candidateNoteId) => candidateNoteId !== noteId,
  )
  const previewValuesByNoteId = groupValuesByNoteId(
    includeNoteValuePreviews
      ? filterValuesByNoteIds(referenceableStates, persistedPreviewNoteIds)
      : [],
  )
  if (noteId) {
    previewValuesByNoteId.set(noteId, authoredValueStates)
  }
  const noteCandidates = baseNoteCandidates.map((candidate) => ({
    ...candidate,
    previewValues: candidate.noteId ? (previewValuesByNoteId.get(candidate.noteId) ?? []) : [],
  }))

  const resolvedExternalNoteId =
    selectedExternalNoteId ??
    references.resolveNoteIdByPath({
      notePathRaw: externalNotePathRaw,
      sourceNoteId: noteId,
    })

  const shouldUsePersistedExternalValues =
    resolvedExternalNoteId !== null && resolvedExternalNoteId !== noteId
  const selectedNoteValues =
    resolvedExternalNoteId === noteId
      ? authoredValueStates
      : shouldUsePersistedExternalValues && resolvedExternalNoteId
        ? filterValuesByNoteIds(referenceableStates, [resolvedExternalNoteId])
        : []

  const sameNoteCandidates = authoredDefinitions.map((definition) => {
    const state = stateByValueId.get(definition.valueId)
    return {
      key: definition.valueId,
      title: definition.slug,
      aliases: [definition.slug],
      detail: state?.status === 'ok' ? state.formattedValue : (state?.errorMessage ?? 'No value'),
      slug: definition.slug,
      insertText: buildSameNoteValueReference(definition.slug),
    }
  })

  const externalValueCandidates = selectedNoteValues.map((value) => {
    const insertText = `${value.slug}]]`
    return {
      key: value.valueId,
      title: value.slug,
      aliases: [value.slug],
      detail: value.status === 'ok' ? value.formattedValue : value.errorMessage,
      slug: value.slug,
      insertText,
    }
  })

  return {
    sameNoteCandidates,
    noteCandidates,
    externalValueCandidates,
    referenceableValuesStatus:
      resolvedExternalNoteId === noteId ? 'success' : referenceableStatesStatus,
  }
}

function filterValuesByNoteIds(
  values: Array<NoteValueRuntimeState<ResourceId>>,
  noteIds: ReadonlyArray<ResourceId>,
) {
  if (noteIds.length === 0) return []
  const noteIdSet = new Set(noteIds)
  return values.filter((value) => noteIdSet.has(value.noteId))
}

function groupValuesByNoteId(values: Array<NoteValueRuntimeState<ResourceId>>): ValuesByNoteId {
  const valuesByNoteId: ValuesByNoteId = new Map()
  for (const value of values) {
    const noteValues = valuesByNoteId.get(value.noteId)
    if (noteValues) {
      noteValues.push(value)
    } else {
      valuesByNoteId.set(value.noteId, [value])
    }
  }
  return valuesByNoteId
}
