import type { VersionStamp } from './component-version'
import type { OperationId, ResourceId } from './domain-id'
import type {
  CommandDelivery,
  CommandEnvelope,
  CreateResourceCommand,
  ResourceStructureCommandResult,
} from './resource-command-contract'

export type ContentUnavailableReason =
  | 'capability_not_supported'
  | 'scope_unavailable'
  | 'unauthorized'

export type ContentIntegrityIssue = 'content_missing' | 'content_corrupt' | 'version_mismatch'

export type ContentSessionState<TLocal, TReady> =
  | { readonly status: 'initializing'; readonly operationId: OperationId; readonly local: TLocal }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly content: TReady; readonly version: VersionStamp }
  | { readonly status: 'unavailable'; readonly reason: ContentUnavailableReason }
  | { readonly status: 'integrity_error'; readonly issue: ContentIntegrityIssue }

export interface ResourceContentSource<TLocal, TReady> {
  get(resourceId: ResourceId): ContentSessionState<TLocal, TReady>
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}

export type CreateNoteResourceCommand = Omit<CreateResourceCommand, 'kind'> & {
  readonly kind: 'note'
}

export interface NoteContentSource<TLocal, TReady> extends ResourceContentSource<TLocal, TReady> {
  create(
    envelope: CommandEnvelope<CreateNoteResourceCommand>,
    local: TLocal,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>>
}
