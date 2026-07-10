import type { SidebarItemId } from '../../../../shared/common/ids'
import type {
  EmbeddedNoteContentSource,
  NoteEmbedTargetContentSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
} from './runtime'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from './value-runtime-model'
import type { NoteValueRuntimeState } from './values/state-contract'

const EMPTY_VALUE_STATES: Array<NoteValueRuntimeState<SidebarItemId>> = []

export const standaloneEmbeddedNoteContentSource: EmbeddedNoteContentSource = {}

export const standaloneNoteEmbedTargetSource: NoteEmbedTargetContentSource = {
  embedTargetOperations: undefined,
}

export const standaloneNoteLinkNavigationSource: NoteLinkNavigationSource | null = null

export const standaloneNoteLinkResolutionSource: NoteLinkResolutionSource = {
  revision: 'standalone',
  resolveItemPath: () => null,
}

export const standaloneNoteValueReferences: NoteValueReferences = {
  getNoteCandidates: () => [],
  resolveNoteIdByPath: () => null,
}

export const standaloneNoteValueStateSource: NoteValueRuntimeStateSource = {
  useNoteValueStates: () => ({
    states: EMPTY_VALUE_STATES,
    status: 'success',
  }),
}
