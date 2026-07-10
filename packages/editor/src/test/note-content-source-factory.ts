import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import { buildWikiLinkAutocompleteModelFromSource } from '../notes/wiki-link/autocomplete-model'
import type {
  NoteDocumentContentSource,
  EmbeddedNoteContentSource,
  NoteEmbedTargetContentSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
  NotePermissionContentSource,
  NotePlaybackContentSource,
  NoteSharingContentSource,
  NoteWikiLinkContentSource,
  RuntimeNoteContentSource,
} from '../notes/runtime'
import type { WikiLinkAutocompleteItemSource } from '../notes/wiki-link/autocomplete-model'
import type { WikiLinkAutocompleteModelData } from '../notes/wiki-link/autocomplete-source'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from '../notes/value-runtime-model'

const EMPTY_WIKI_LINK_AUTOCOMPLETE_ITEM_SOURCE: WikiLinkAutocompleteItemSource = {
  getItemBreadcrumbs: () => '',
  getItemLinkPath: () => [],
  queryItems: () => [],
  resolveFolderPath: () => null,
  resolveItemPath: () => null,
  resolveNotePath: () => null,
}

const EMPTY_WIKI_LINK_AUTOCOMPLETE_MODEL_DATA: WikiLinkAutocompleteModelData = {
  context: null,
  headingsPending: false,
  model: buildWikiLinkAutocompleteModelFromSource({
    context: null,
    headings: [],
    itemSource: EMPTY_WIKI_LINK_AUTOCOMPLETE_ITEM_SOURCE,
    values: [],
  }),
  valuesPending: false,
}

export function createTestNoteContentSource(
  overrides: Partial<RuntimeNoteContentSource> = {},
): RuntimeNoteContentSource {
  return {
    document: createTestNoteDocumentContentSource(overrides.document),
    embeddedNotes: createTestEmbeddedNoteContentSource(overrides.embeddedNotes),
    embedTargets: createTestNoteEmbedTargetContentSource(overrides.embedTargets),
    linkCreation: overrides.linkCreation ?? null,
    linkNavigation:
      overrides.linkNavigation === undefined
        ? createTestNoteLinkNavigationSource()
        : overrides.linkNavigation,
    linkResolution: createTestNoteLinkResolutionSource(overrides.linkResolution),
    playback: createTestNotePlaybackContentSource(overrides.playback),
    permissions: createTestNotePermissionContentSource(overrides.permissions),
    sharing: createTestNoteSharingContentSource(overrides.sharing),
    valueReferences: createTestNoteValueReferences(overrides.valueReferences),
    valueState: createTestNoteValueStateSource(overrides.valueState),
    wikiLinks: createTestNoteWikiLinkContentSource(overrides.wikiLinks),
  }
}

function createTestEmbeddedNoteContentSource(
  overrides: Partial<EmbeddedNoteContentSource> = {},
): EmbeddedNoteContentSource {
  return {
    ...overrides,
  }
}

function createTestNoteEmbedTargetContentSource(
  overrides: Partial<NoteEmbedTargetContentSource> = {},
): NoteEmbedTargetContentSource {
  return {
    embedTargetOperations: undefined,
    ...overrides,
  }
}

function createTestNoteLinkNavigationSource(): NoteLinkNavigationSource | null {
  return null
}

function createTestNoteLinkResolutionSource(
  overrides: Partial<NoteLinkResolutionSource> = {},
): NoteLinkResolutionSource {
  return {
    revision: 'test',
    resolveItemPath: () => null,
    ...overrides,
  }
}

function createTestNoteValueReferences(
  overrides: Partial<NoteValueReferences> = {},
): NoteValueReferences {
  return {
    getNoteCandidates: () => [],
    resolveNoteIdByPath: () => null,
    ...overrides,
  }
}

function createTestNoteValueStateSource(
  overrides: Partial<NoteValueRuntimeStateSource> = {},
): NoteValueRuntimeStateSource {
  return {
    useNoteValueStates: () => ({
      states: [],
      status: 'success',
    }),
    ...overrides,
  }
}

function createTestNotePlaybackContentSource(
  overrides: Partial<NotePlaybackContentSource> = {},
): NotePlaybackContentSource {
  return {
    ...overrides,
  }
}

function createTestNoteSharingContentSource(
  overrides: Partial<NoteSharingContentSource> = {},
): NoteSharingContentSource {
  return {
    blocks: { status: 'unsupported', reason: 'not_available' },
    ...overrides,
  }
}

function createTestNoteWikiLinkContentSource(
  overrides: Partial<NoteWikiLinkContentSource> = {},
): NoteWikiLinkContentSource {
  return {
    useWikiLinkAutocompleteModelData: () => EMPTY_WIKI_LINK_AUTOCOMPLETE_MODEL_DATA,
    ...overrides,
  }
}

function createTestNoteDocumentContentSource(
  overrides: Partial<NoteDocumentContentSource> = {},
): NoteDocumentContentSource {
  return {
    useNoteCollaborationSession: () => {
      throw new Error('Collaboration sessions are not used in this test fixture')
    },
    ...overrides,
  }
}

export function createTestNotePermissionContentSource(
  overrides: Partial<NotePermissionContentSource> = {},
): NotePermissionContentSource {
  return {
    canAccessItem: () => true,
    getMemberItemPermissionLevel: () => PERMISSION_LEVEL.FULL_ACCESS,
    selectedViewAsPlayerId: undefined,
    ...overrides,
  }
}
