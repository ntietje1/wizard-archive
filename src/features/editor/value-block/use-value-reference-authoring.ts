import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { parseWikiLinkText } from 'shared/links/parsing'
import { getMinDisambiguationPath, resolveParsedItemPath } from 'shared/links/resolution'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import {
  buildExternalNoteValuePrefix,
  buildSameNoteValueReference,
} from '../../../../shared/note-values/authoring'
import type { NoteValueRuntimeState } from '../../../../shared/note-values/types'
import { useNoteValueRuntime } from './value-block-runtime-context'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'

export interface ValueReferenceCandidate {
  key: string
  title: string
  aliases: Array<string>
  detail: string
  insertText: string
  slug?: string
  noteId?: Id<'sidebarItems'>
  previewValues?: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
}

type ValuesByNoteId = Map<Id<'sidebarItems'>, Array<NoteValueRuntimeState<Id<'sidebarItems'>>>>

export function useValueReferenceAuthoring({
  selectedExternalNoteId = null,
  externalNotePathRaw = null,
  includeNoteValuePreviews = false,
}: {
  selectedExternalNoteId?: Id<'sidebarItems'> | null
  externalNotePathRaw?: string | null
  includeNoteValuePreviews?: boolean
}) {
  const {
    authoredDefinitions,
    authoredValueStates,
    noteId,
    sidebarItems,
    itemsMap,
    stateByValueId,
  } = useNoteValueRuntime()
  const sourceParentId = noteId ? itemsMap.get(noteId)?.parentId : undefined

  const baseNoteCandidates: Array<ValueReferenceCandidate> = sidebarItems
    .filter((item) => item.type === SIDEBAR_ITEM_TYPES.notes)
    .map((item) => {
      const path = getMinDisambiguationPath(item, sidebarItems, itemsMap).join('/')
      const insertText = buildExternalNoteValuePrefix(path)
      return {
        key: item._id,
        noteId: item._id,
        title: item.name,
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
  const notePreviewValuesQuery = useCampaignQuery(
    api.noteValues.queries.getNoteValueStatesByNotes,
    includeNoteValuePreviews && persistedPreviewNoteIds.length > 0
      ? { noteIds: persistedPreviewNoteIds }
      : 'skip',
  )
  const previewValuesByNoteId = groupValuesByNoteId(notePreviewValuesQuery.data ?? [])
  if (noteId) {
    previewValuesByNoteId.set(noteId, authoredValueStates)
  }
  const noteCandidates = baseNoteCandidates.map((candidate) => ({
    ...candidate,
    previewValues: candidate.noteId ? (previewValuesByNoteId.get(candidate.noteId) ?? []) : [],
  }))

  const resolvedExternalNoteId =
    selectedExternalNoteId ??
    resolveExternalNoteId(externalNotePathRaw, sidebarItems, itemsMap, sourceParentId)
  const selectedExternalNote = resolvedExternalNoteId
    ? itemsMap.get(resolvedExternalNoteId)
    : undefined

  const shouldLoadPersistedExternalValues =
    resolvedExternalNoteId !== null && resolvedExternalNoteId !== noteId
  const selectedNoteValuesQuery = useCampaignQuery(
    api.noteValues.queries.getNoteValueStates,
    shouldLoadPersistedExternalValues ? { noteId: resolvedExternalNoteId } : 'skip',
  )
  const selectedNoteValues =
    resolvedExternalNoteId === noteId ? authoredValueStates : (selectedNoteValuesQuery.data ?? [])

  const sameNoteCandidates = authoredDefinitions.map((definition) => {
    const state = stateByValueId.get(definition.valueId)
    return {
      key: definition.valueId,
      title: definition.slug,
      aliases: [definition.slug],
      detail: state?.formattedValue ?? 'No value',
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
      detail: value.formattedValue,
      slug: value.slug,
      insertText,
    }
  })

  return {
    sameNoteCandidates,
    noteCandidates,
    externalValueCandidates,
    selectedExternalNote,
    externalValuesStatus:
      resolvedExternalNoteId === noteId ? 'success' : selectedNoteValuesQuery.status,
  }
}

function groupValuesByNoteId(
  values: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>,
): ValuesByNoteId {
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

export function resolveExternalNoteId(
  notePathRaw: string | null,
  sidebarItems: ReturnType<typeof useNoteValueRuntime>['sidebarItems'],
  itemsMap: ReturnType<typeof useNoteValueRuntime>['itemsMap'],
  sourceParentId: Id<'sidebarItems'> | null | undefined,
): Id<'sidebarItems'> | null {
  if (!notePathRaw) {
    return null
  }

  const parsed = parseWikiLinkText(notePathRaw)
  if (
    parsed.displayName !== null ||
    parsed.headingPath.length > 0 ||
    parsed.itemPath.length === 0
  ) {
    return null
  }

  const resolvedItem = resolveParsedItemPath(
    parsed.pathKind,
    parsed.itemPath,
    sidebarItems,
    itemsMap,
    sourceParentId,
  )
  return resolvedItem?.type === SIDEBAR_ITEM_TYPES.notes ? resolvedItem._id : null
}
