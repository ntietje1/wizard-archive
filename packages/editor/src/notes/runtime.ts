import type { CampaignMemberId, SidebarItemId } from '../../../../shared/common/ids'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import type { AnyItem, ValidationResult, CreateParentTarget } from '../workspace/items'
import type { ResourceKind } from '../workspace/resource-contract'
import type { MaybePromise } from '../../../../shared/common/async'
import type { NoteItemWithContent } from '../notes/item-contract'
import type { NoteBlock } from './document/model'
import type { BlocksShareSource } from '../sharing/contracts'
import type { EmbedTargetOperations } from '../embeds/target-operations'
import type { LinkPathKind } from '../../../../shared/links/types'
import type {
  WikiLinkAutocompleteModelData,
  WikiLinkAutocompleteModelDataArgs,
} from './wiki-link/autocomplete-source'
import type { NoteCollaborationPlayback } from './playback-contract'
import type { NoteEditorSession } from './session-contract'
import type { NoteCollaborationSessionRequest } from './workspace-session-source'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from './value-runtime-model'

export interface NoteLinkResolutionSource {
  revision: string
  resolveItemPath: (input: {
    pathKind: LinkPathKind
    pathSegments: Array<string>
    sourceNoteId: SidebarItemId | undefined
  }) => AnyItem | null
}

export type NoteScrollRequest = { status: 'none' } | { status: 'requested' }

export interface LinkClickCreateItemArgs {
  type: ResourceKind
  name: string
  parentTarget: CreateParentTarget
}

export interface OpenInternalLinkInput {
  heading?: string
  itemId: SidebarItemId
}

export interface RuntimeNoteContentSource {
  document: NoteDocumentContentSource
  embeddedNotes: EmbeddedNoteContentSource
  embedTargets: NoteEmbedTargetContentSource
  linkCreation: NoteLinkCreationSource | null
  linkNavigation: NoteLinkNavigationSource | null
  linkResolution: NoteLinkResolutionSource
  playback: NotePlaybackContentSource
  permissions: NotePermissionContentSource
  sharing: NoteSharingContentSource
  valueReferences: NoteValueReferences
  valueState: NoteValueRuntimeStateSource
  wikiLinks: NoteWikiLinkContentSource
}

export interface NotePermissionContentSource {
  canAccessItem: (note: NoteItemWithContent, requiredLevel: PermissionLevel) => boolean
  getMemberItemPermissionLevel: (
    note: NoteItemWithContent,
    memberId: CampaignMemberId,
  ) => PermissionLevel
  selectedViewAsPlayerId: CampaignMemberId | undefined
}

export interface NoteSharingContentSource {
  blocks: BlocksShareSource
}

export interface NotePlaybackContentSource {
  getNoteCollaborationPlayback?: (noteId: SidebarItemId) => NoteCollaborationPlayback | undefined
}

export interface NoteDocumentContentSource {
  useNoteCollaborationSession: (request: NoteCollaborationSessionRequest) => NoteEditorSession
}

export interface NoteWikiLinkContentSource {
  useWikiLinkAutocompleteModelData: (
    input: WikiLinkAutocompleteModelDataArgs,
  ) => WikiLinkAutocompleteModelData
}

export interface NoteEmbedTargetContentSource {
  embedTargetOperations: EmbedTargetOperations | undefined
}

export interface EmbeddedNoteContentSource {
  getEmbeddedNoteContent?: (note: NoteItemWithContent) => Array<NoteBlock>
}

export interface NoteLinkNavigationSource {
  getSourceParentId: (sourceNoteId: SidebarItemId) => SidebarItemId | null | undefined
  openExternalLink: (url: string) => unknown
  openInternalLink: (input: OpenInternalLinkInput) => unknown
  openInternalLinkSeparately: (input: OpenInternalLinkInput) => unknown
}

export interface NoteLinkCreationSource {
  createLinkedNote: (args: LinkClickCreateItemArgs) => MaybePromise<unknown>
  validateCreateItem: (args: LinkClickCreateItemArgs) => ValidationResult
}
