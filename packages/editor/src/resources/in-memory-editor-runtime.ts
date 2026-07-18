import * as Y from 'yjs'
import { encodeWizardCanvasDocument } from '../canvas/native-document'
import { noteDocumentToMarkdown } from '../notes/document/markdown'
import {
  advanceFileContentVersion,
  initialFileContentVersion,
  initialNoteContentVersion,
} from './resource-content-version'
import { initialVersion, sha256Digest, versionStampEquals } from './component-version'
import type { VersionStamp } from './component-version'
import type { FileOwnedMetadata } from './file-content-contract'
import type {
  CanvasSessionSource,
  CanvasSessionState,
  CanvasSession,
  CanvasPreviewState,
  ContentExportResult,
  CreateCanvasResourceCommand,
  CreateFileResourceCommand,
  CreateMapResourceCommand,
  CreateNoteResourceCommand,
  FileContentSource,
  FileContentState,
  FileContentReplaceResult,
  FileResourceCreationSource,
  FileResourceSource,
  FileResourceContent,
  MapResourceContent,
  MapContentCommand,
  MapPreviewState,
  MapSession,
  MapSessionSource,
  MapSessionState,
  NoteSessionSource,
  NoteSessionState,
  NoteSession,
} from './content-session-contract'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceStructureCommandGateway,
  ResourceStructureCommandResult,
} from './resource-command-contract'
import type { ResourceNavigation, EditorRuntime } from './editor-runtime-contract'
import type { CampaignId, OperationId, ResourceId } from './domain-id'
import { createInMemoryResourceRuntime } from './in-memory-resource-runtime'
import { createResourceUndoHistory } from './resource-undo-history'
import type { InMemoryResourceRuntimeOptions } from './in-memory-resource-runtime'
import type { ResourceCatalogSnapshot, SourcePathAlias } from './resource-catalog-contract'
import type { ResourceProjectionScope } from './resource-index-contract'
import type { GrantedResourcePermission } from './resource-access-policy'
import { createInMemoryContentCopyPlanner } from './in-memory-content-copy'
import { classifyFileResourceSource } from './resource-source-classifier'
import { ResourceSessionStore } from './resource-session-store'
import {
  applyWorkspacePreferenceChange,
  DEFAULT_WORKSPACE_PREFERENCES,
  WorkspacePreferencesController,
} from './workspace-preferences'
import type { WorkspacePreferencesSnapshot } from './workspace-preferences'
import {
  createInMemoryBookmarks,
  createInMemoryWorkspaceSearch,
} from './in-memory-workspace-discovery'
import { createInMemoryNoteSession } from './in-memory-note-session'
import { createInMemoryCanvasSession } from './in-memory-canvas-session'
import { encodeWizardMapDocument } from './map-native-document'
import {
  advanceMapContentVersion,
  initialMapContentVersion,
  mapImageAttachment,
  replaceMapImageAttachment,
  transitionMapContent,
} from './map-session-policy'
import type { MapImageBytes } from './map-session-policy'
import { initialResourceMetadataVersion } from './resource-metadata-version'
import { assertSourcePathAlias } from './source-path-alias'

type ReadyContent<T> = Readonly<{
  content: T
  resourceId: ResourceId
  version: VersionStamp
}>

function createInMemoryYjsSessionRegistry<TSession extends { document: Y.Doc; dispose(): void }>(
  create: (
    document: Y.Doc,
    version: VersionStamp,
    changed: (session: TSession) => void,
  ) => TSession,
  publish: (resourceId: ResourceId, session: TSession) => void,
) {
  const sessions = new Map<ResourceId, TSession>()
  return {
    replace(resourceId: ResourceId, document: Y.Doc, version: VersionStamp): void {
      const previous = sessions.get(resourceId)
      if (previous && previous.document !== document) previous.dispose()
      const session = create(document, version, (next) => publish(resourceId, next))
      sessions.set(resourceId, session)
      publish(resourceId, session)
    },
    dispose(finish: () => void): void {
      for (const session of sessions.values()) session.dispose()
      sessions.clear()
      finish()
    },
  }
}

type ReadyFileContent = ReadyContent<FileResourceContent> &
  Readonly<{
    bytes: Uint8Array
  }>

type ReadyMapContent = ReadyContent<MapResourceContent> &
  Readonly<{
    images: ReadonlyArray<MapImageBytes>
  }>

export type InMemoryEditorContent = Readonly<{
  notes?: ReadonlyArray<ReadyContent<Y.Doc>>
  files?: ReadonlyArray<ReadyFileContent>
  maps?: ReadonlyArray<ReadyMapContent>
  canvases?: ReadonlyArray<ReadyContent<Y.Doc>>
}>

export type InMemoryEditorRuntimeInput = Readonly<{
  authorize?: InMemoryResourceRuntimeOptions['authorize']
  canEdit?: boolean
  permission?: GrantedResourcePermission
  scope: ResourceProjectionScope
  snapshot: ResourceCatalogSnapshot
  content?: InMemoryEditorContent
  navigation: ResourceNavigation
  now?: () => number
}>

class InMemoryNoteSessionSource
  extends ResourceSessionStore<NoteSessionState>
  implements NoteSessionSource
{
  readonly #sessions = createInMemoryYjsSessionRegistry(
    createInMemoryNoteSession,
    (resourceId, session: NoteSession) => this.set(resourceId, { status: 'ready', session }),
  )
  readonly #creates = new Map<
    ResourceId,
    Readonly<{
      operationId: OperationId
      doc: Y.Doc
      delivery?: CommandDelivery<ResourceStructureCommandResult>
    }>
  >()

  constructor(
    ready: ReadonlyArray<ReadyContent<Y.Doc>>,
    private readonly campaignId: CampaignId,
    private readonly executeStructure: ResourceStructureCommandGateway['execute'],
  ) {
    super({ status: 'loading' })
    for (const entry of ready) {
      this.setReady(entry.resourceId, entry.content, entry.version)
    }
  }

  async create(
    envelope: CommandEnvelope<CreateNoteResourceCommand>,
    local: Y.Doc,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>> {
    const resourceId = envelope.command.resourceId
    const existing = this.#creates.get(resourceId)
    if (
      envelope.campaignId !== this.campaignId ||
      (existing && (existing.operationId !== envelope.operationId || existing.doc !== local))
    ) {
      return invalidCreateDelivery()
    }
    if (existing?.delivery) return existing.delivery

    this.#creates.set(resourceId, { operationId: envelope.operationId, doc: local })
    this.set(resourceId, {
      status: 'initializing',
      operationId: envelope.operationId,
      local,
    })
    const delivery = await this.executeStructure(envelope)
    if (delivery.status === 'indeterminate') return delivery
    if (delivery.status === 'not_committed' || delivery.result.status !== 'completed') {
      this.#creates.delete(resourceId)
      this.set(resourceId, { status: 'loading' })
      return delivery
    }
    if (
      delivery.result.receipt.operationId !== envelope.operationId ||
      delivery.result.receipt.result.type !== 'created' ||
      delivery.result.receipt.result.resourceId !== resourceId
    ) {
      this.#creates.delete(resourceId)
      this.set(resourceId, { status: 'integrity_error', issue: 'version_mismatch' })
      return { status: 'not_committed', retryable: false, reason: 'invalid_response' }
    }

    const version = await initialNoteContentVersion(Y.encodeStateAsUpdate(local))
    this.#creates.set(resourceId, { operationId: envelope.operationId, doc: local, delivery })
    this.setReady(resourceId, local, version)
    return delivery
  }

  export(resourceId: ResourceId): ContentExportResult {
    const state = this.get(resourceId)
    if (state.status !== 'ready') return exportPendingState(state)
    try {
      return {
        status: 'ready',
        bytes: new TextEncoder().encode(noteDocumentToMarkdown(state.session.document)),
        extension: 'md',
        mediaType: 'text/markdown',
      }
    } catch {
      return { status: 'integrity_error', issue: 'content_corrupt' }
    }
  }

  readonly setReady = (resourceId: ResourceId, document: Y.Doc, version: VersionStamp) =>
    this.#sessions.replace(resourceId, document, version)

  override readonly dispose = () => this.#sessions.dispose(() => super.dispose())
}

class InMemoryFileContentSource
  extends ResourceSessionStore<FileContentState>
  implements FileContentSource
{
  readonly #bytes = new Map<ResourceId, Uint8Array>()

  constructor(
    ready: ReadonlyArray<ReadyFileContent>,
    private readonly campaignId: CampaignId,
    private readonly executeStructure: ResourceStructureCommandGateway['execute'],
    private readonly appendAlias: (alias: SourcePathAlias) => Promise<SourcePathAlias>,
  ) {
    super({ status: 'loading' })
    for (const entry of ready) {
      this.setReady(entry.resourceId, entry.content, entry.version, entry.bytes)
    }
  }

  export(resourceId: ResourceId): ContentExportResult {
    const state = this.get(resourceId)
    if (state.status !== 'ready') return exportPendingState(state)
    const bytes = this.#bytes.get(resourceId)
    if (!bytes || bytes.byteLength !== state.content.byteSize) {
      return { status: 'integrity_error', issue: 'content_corrupt' }
    }
    return {
      status: 'ready',
      bytes: Uint8Array.from(bytes),
      extension: state.content.extension ?? 'bin',
      mediaType: state.content.mediaType,
    }
  }

  async create(
    envelope: CommandEnvelope<CreateFileResourceCommand>,
    source: FileResourceCreationSource,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>> {
    try {
      assertSourcePathAlias(source.alias)
    } catch {
      return invalidCreateDelivery()
    }
    if (
      envelope.campaignId !== this.campaignId ||
      source.alias.campaignId !== envelope.campaignId ||
      source.alias.resourceId !== envelope.command.resourceId
    ) {
      return invalidCreateDelivery()
    }
    const metadataVersion = await initialResourceMetadataVersion({
      parentId: envelope.command.parentId,
      kind: envelope.command.kind,
      title: envelope.command.title,
      icon: envelope.command.icon,
      color: envelope.command.color,
      lifecycle: 'active',
    })
    if (!versionStampEquals(metadataVersion, source.metadataVersion)) {
      return invalidCreateDelivery()
    }
    const metadata = classifyFileResourceSource(source)
    if (metadata.classification === 'rejected') return invalidCreateDelivery()
    const delivery = await this.executeStructure(envelope)
    if (
      delivery.status !== 'received' ||
      delivery.result.status !== 'completed' ||
      delivery.result.receipt.result.type !== 'created' ||
      delivery.result.receipt.result.resourceId !== envelope.command.resourceId
    ) {
      return delivery
    }
    await this.appendAlias(source.alias)
    this.setReady(
      envelope.command.resourceId,
      { ...metadata, attachment: 'attached' },
      await initialFileContentVersion(source.bytes, metadata),
      source.bytes,
    )
    return delivery
  }

  async replace(
    resourceId: ResourceId,
    expectedVersion: VersionStamp,
    source: FileResourceSource,
  ): Promise<FileContentReplaceResult> {
    const current = this.get(resourceId)
    if (current.status !== 'ready') return unavailableInMemoryFileReplacement(current)
    if (!versionStampEquals(current.version, expectedVersion)) {
      return { status: 'rejected', reason: 'version_conflict' }
    }
    const metadata = classifyFileResourceSource(source)
    if (metadata.classification === 'rejected') {
      return { status: 'rejected', reason: 'invalid_file' }
    }
    const version = await nextInMemoryFileVersion(current.version, source.bytes, metadata)
    if ('status' in version) return version
    const content = { ...metadata, attachment: 'attached' as const }
    this.setReady(resourceId, content, version, source.bytes)
    return { status: 'completed', content, version }
  }

  readBytes(resourceId: ResourceId): Uint8Array {
    const bytes = this.#bytes.get(resourceId)
    if (!bytes) throw new TypeError('File bytes are unavailable')
    return Uint8Array.from(bytes)
  }

  setReady(
    resourceId: ResourceId,
    content: FileResourceContent,
    version: VersionStamp,
    bytes: Uint8Array,
  ): void {
    if (bytes.byteLength !== content.byteSize) throw new TypeError('File byte size does not match')
    this.#bytes.set(resourceId, Uint8Array.from(bytes))
    this.set(resourceId, { status: 'ready', content, version })
  }

  override dispose(): void {
    this.#bytes.clear()
    super.dispose()
  }
}

function unavailableInMemoryFileReplacement(
  state: Exclude<FileContentState, { status: 'ready' }>,
): FileContentReplaceResult {
  switch (state.status) {
    case 'loading':
    case 'initializing':
      return { status: 'retryable', reason: 'content_initializing' }
    case 'unavailable':
      return {
        status: 'rejected',
        reason: state.reason === 'unauthorized' ? 'unauthorized' : 'resource_missing',
      }
    case 'integrity_error':
      return {
        status: 'rejected',
        reason:
          state.issue === 'content_missing' || state.issue === 'version_exhausted'
            ? state.issue
            : 'content_corrupt',
      }
  }
}

async function nextInMemoryFileVersion(
  current: VersionStamp,
  bytes: Uint8Array,
  metadata: FileOwnedMetadata,
): Promise<VersionStamp | FileContentReplaceResult> {
  try {
    return await advanceFileContentVersion(current, bytes, metadata)
  } catch (error) {
    return error instanceof RangeError
      ? { status: 'rejected', reason: 'version_exhausted' }
      : { status: 'rejected', reason: 'content_corrupt' }
  }
}

type InMemoryNativeSessionState = CanvasSessionState | MapSessionState

abstract class InMemoryOwnedSessionSource<
  TState extends InMemoryNativeSessionState,
> extends ResourceSessionStore<TState> {
  constructor(
    initialState: TState,
    private readonly campaignId: CampaignId,
    private readonly executeStructure: ResourceStructureCommandGateway['execute'],
  ) {
    super(initialState)
  }

  protected async createContent(
    envelope: CommandEnvelope<CreateCanvasResourceCommand | CreateMapResourceCommand>,
    initialize: () => Promise<void>,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>> {
    return await createOwnedContentResource(
      envelope,
      this.campaignId,
      this.executeStructure,
      initialize,
    )
  }

  protected exportNative(
    resourceId: ResourceId,
    encode: (state: Extract<TState, { status: 'ready' }>) => Uint8Array,
    extension: string,
    mediaType: string,
  ): ContentExportResult {
    const state = this.get(resourceId)
    if (state.status !== 'ready') return exportPendingState(state)
    return nativeContentExport(
      encode(state as Extract<TState, { status: 'ready' }>),
      extension,
      mediaType,
    )
  }
}

class InMemoryMapSessionSource
  extends InMemoryOwnedSessionSource<MapSessionState>
  implements MapSessionSource
{
  readonly #sessions = new Map<ResourceId, InMemoryMapSession>()
  readonly #previewStates = new Map<
    ResourceId,
    Readonly<{ source: MapSessionState; state: MapPreviewState }>
  >()
  readonly previews = {
    get: (resourceId: ResourceId) => this.#previewState(resourceId),
    subscribe: (resourceId: ResourceId, listener: () => void) =>
      this.subscribe(resourceId, listener),
  }

  constructor(
    initialState: MapSessionState,
    campaignId: CampaignId,
    executeStructure: ResourceStructureCommandGateway['execute'],
    private readonly isActiveResource: (resourceId: ResourceId) => boolean,
  ) {
    super(initialState, campaignId, executeStructure)
  }

  async create(
    envelope: CommandEnvelope<CreateMapResourceCommand>,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>> {
    return await this.createContent(envelope, async () => {
      const content: MapResourceContent = {
        image: { status: 'unattached' },
        layers: [],
        pins: [],
      }
      this.setReady(
        envelope.command.resourceId,
        content,
        await initialMapContentVersion(content),
        [],
      )
    })
  }

  setReady(
    resourceId: ResourceId,
    content: MapResourceContent,
    version: VersionStamp,
    images: ReadonlyArray<MapImageBytes>,
  ): void {
    this.#sessions.get(resourceId)?.dispose()
    const session = new InMemoryMapSession(
      resourceId,
      content,
      version,
      images,
      this.isActiveResource,
      () => {
        this.set(resourceId, { status: 'ready', session })
      },
    )
    this.#sessions.set(resourceId, session)
    this.set(resourceId, { status: 'ready', session })
  }

  readImages(resourceId: ResourceId): ReadonlyArray<MapImageBytes> {
    const session = this.#sessions.get(resourceId)
    if (!session) throw new TypeError('Map image bytes are unavailable')
    return session.copyImages()
  }

  export(resourceId: ResourceId): ContentExportResult {
    return this.exportNative(
      resourceId,
      (state) => encodeWizardMapDocument(state.session.content),
      'wizardmap',
      'application/vnd.wizard-archive.map+json',
    )
  }

  override dispose(): void {
    for (const session of this.#sessions.values()) session.dispose()
    this.#sessions.clear()
    this.#previewStates.clear()
    super.dispose()
  }

  #previewState(resourceId: ResourceId): MapPreviewState {
    const source = this.get(resourceId)
    const cached = this.#previewStates.get(resourceId)
    if (cached?.source === source) return cached.state
    const state: MapPreviewState =
      source.status === 'ready'
        ? {
            status: 'ready',
            preview: {
              content: source.session.content,
              version: source.session.version,
              loadImage: (layerId) => source.session.loadImage(layerId),
            },
          }
        : source.status === 'initializing'
          ? { status: 'loading' }
          : source
    this.#previewStates.set(resourceId, { source, state })
    return state
  }
}

class InMemoryMapSession implements MapSession {
  readonly awareness = { status: 'unavailable' as const }
  readonly #images = new Map<string | null, Uint8Array>()
  #disposed = false

  constructor(
    private readonly resourceId: ResourceId,
    private currentContent: MapResourceContent,
    private currentVersion: VersionStamp,
    images: ReadonlyArray<MapImageBytes>,
    private readonly isActiveResource: (resourceId: ResourceId) => boolean,
    private readonly publish: () => void,
  ) {
    for (const image of images) this.#images.set(image.layerId, Uint8Array.from(image.bytes))
  }

  get content(): MapResourceContent {
    return this.currentContent
  }

  get version(): VersionStamp {
    return this.currentVersion
  }

  async execute(command: MapContentCommand) {
    if (this.#disposed) return { status: 'rejected' as const, reason: 'resource_missing' as const }
    if (
      command.type === 'createPins' &&
      command.pins.some(
        (pin) =>
          pin.destination.kind === 'internal' &&
          !this.isActiveResource(pin.destination.target.resourceId),
      )
    ) {
      return { status: 'rejected' as const, reason: 'target_missing' as const }
    }
    const transition = transitionMapContent(this.resourceId, this.currentContent, command)
    if (transition.status === 'rejected') return transition
    const version = await this.#nextVersion(transition.content)
    if (!version) {
      return { status: 'rejected' as const, reason: 'version_exhausted' as const }
    }
    this.currentContent = transition.content
    this.currentVersion = version
    this.publish()
    return { status: 'completed' as const, content: this.currentContent, version }
  }

  async loadImage(layerId: string | null): Promise<ContentExportResult> {
    const image = mapImageAttachment(this.currentContent, layerId)
    if (!image || image.status === 'unattached') {
      return { status: 'integrity_error', issue: 'content_missing' }
    }
    const bytes = this.#images.get(layerId)
    if (!bytes || bytes.byteLength !== image.byteSize) {
      return { status: 'integrity_error', issue: 'content_corrupt' }
    }
    if ((await sha256Digest(bytes)) !== image.digest) {
      return { status: 'integrity_error', issue: 'content_corrupt' }
    }
    return {
      status: 'ready',
      bytes: Uint8Array.from(bytes),
      extension: image.mediaType.split('/')[1] ?? 'bin',
      mediaType: image.mediaType,
    }
  }

  async replaceImage(
    layerId: string | null,
    expectedVersion: VersionStamp,
    source: FileResourceSource,
  ) {
    if (this.#disposed) return { status: 'rejected' as const, reason: 'resource_missing' as const }
    if (!versionStampEquals(expectedVersion, this.currentVersion)) {
      return { status: 'rejected' as const, reason: 'version_conflict' as const }
    }
    const metadata = classifyFileResourceSource(source)
    if (metadata.classification === 'rejected') {
      return { status: 'rejected' as const, reason: 'invalid_command' as const }
    }
    const attachment = {
      status: 'attached' as const,
      byteSize: source.bytes.byteLength,
      digest: await sha256Digest(source.bytes),
      mediaType: metadata.mediaType,
    }
    const transition = replaceMapImageAttachment(this.currentContent, layerId, attachment)
    if (transition.status === 'rejected') return transition
    const version = await this.#nextVersion(transition.content)
    if (!version) {
      return { status: 'rejected' as const, reason: 'version_exhausted' as const }
    }
    this.#images.set(layerId, Uint8Array.from(source.bytes))
    this.currentContent = transition.content
    this.currentVersion = version
    this.publish()
    return { status: 'completed' as const, content: this.currentContent, version }
  }

  async #nextVersion(content: MapResourceContent): Promise<VersionStamp | null> {
    try {
      return await advanceMapContentVersion(this.currentVersion, content)
    } catch {
      return null
    }
  }

  dispose(): void {
    this.#disposed = true
    this.#images.clear()
  }

  copyImages(): ReadonlyArray<MapImageBytes> {
    return [...this.#images].map(([layerId, bytes]) => ({
      layerId,
      bytes: Uint8Array.from(bytes),
    }))
  }
}

class InMemoryCanvasSessionSource
  extends InMemoryOwnedSessionSource<CanvasSessionState>
  implements CanvasSessionSource
{
  readonly #previews = new ResourceSessionStore<CanvasPreviewState>({ status: 'loading' })
  readonly #sessions = createInMemoryYjsSessionRegistry(
    createInMemoryCanvasSession,
    (resourceId, session: CanvasSession) => this.set(resourceId, { status: 'ready', session }),
  )
  readonly previews = {
    get: (resourceId: ResourceId) => this.#previews.get(resourceId),
    subscribe: (resourceId: ResourceId, listener: () => void) =>
      this.#previews.subscribe(resourceId, listener),
  }

  override set(resourceId: ResourceId, state: CanvasSessionState): void {
    super.set(resourceId, state)
    this.#previews.set(
      resourceId,
      state.status === 'ready'
        ? { status: 'ready', document: state.session.document, version: state.session.version }
        : state.status === 'initializing'
          ? { status: 'loading' }
          : state,
    )
  }

  async create(
    envelope: CommandEnvelope<CreateCanvasResourceCommand>,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>> {
    return await this.createContent(envelope, async () => {
      const document = new Y.Doc()
      this.setReady(
        envelope.command.resourceId,
        document,
        initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document))),
      )
    })
  }

  export(resourceId: ResourceId): ContentExportResult {
    return this.exportNative(
      resourceId,
      (state) => encodeWizardCanvasDocument(state.session.document),
      'wizardcanvas',
      'application/vnd.wizard-archive.canvas',
    )
  }

  readonly setReady = (resourceId: ResourceId, document: Y.Doc, version: VersionStamp) =>
    this.#sessions.replace(resourceId, document, version)

  override readonly dispose = () =>
    this.#sessions.dispose(() => {
      this.#previews.dispose()
      super.dispose()
    })
}

function nativeContentExport(
  bytes: Uint8Array,
  extension: string,
  mediaType: string,
): ContentExportResult {
  return { status: 'ready', bytes, extension, mediaType }
}

function exportPendingState(
  state: Exclude<
    NoteSessionState | FileContentState | MapSessionState | CanvasSessionState,
    { status: 'ready' }
  >,
): ContentExportResult {
  if (state.status === 'initializing') return { status: 'loading' }
  if (state.status === 'empty') {
    return {
      status: 'ready',
      bytes: new Uint8Array(),
      extension: 'md',
      mediaType: 'text/markdown',
    }
  }
  return state
}

function invalidCreateDelivery(): CommandDelivery<ResourceStructureCommandResult> {
  return {
    status: 'received',
    result: { status: 'rejected', reason: 'invalid_command' },
  }
}

function isCompletedCreate(
  delivery: CommandDelivery<ResourceStructureCommandResult>,
  resourceId: ResourceId,
): boolean {
  return (
    delivery.status === 'received' &&
    delivery.result.status === 'completed' &&
    delivery.result.receipt.result.type === 'created' &&
    delivery.result.receipt.result.resourceId === resourceId
  )
}

async function createOwnedContentResource(
  envelope: CommandEnvelope<CreateCanvasResourceCommand | CreateMapResourceCommand>,
  campaignId: CampaignId,
  executeStructure: ResourceStructureCommandGateway['execute'],
  initialize: () => Promise<void>,
): Promise<CommandDelivery<ResourceStructureCommandResult>> {
  if (envelope.campaignId !== campaignId) return invalidCreateDelivery()
  const delivery = await executeStructure(envelope)
  if (!isCompletedCreate(delivery, envelope.command.resourceId)) return delivery
  await initialize()
  return delivery
}

export function createInMemoryEditorRuntime({
  authorize,
  canEdit: requestedCanEdit,
  content = {},
  navigation,
  now,
  permission,
  scope,
  snapshot,
}: InMemoryEditorRuntimeInput): Readonly<{ runtime: EditorRuntime; dispose(): void }> {
  const canEdit = requestedCanEdit ?? scope.projection === 'dm'
  const kinds = new Map(snapshot.resources.map((resource) => [resource.id, resource.kind]))
  let executeStructure: ResourceStructureCommandGateway['execute'] = () =>
    Promise.resolve({
      status: 'not_committed',
      retryable: false,
      reason: 'transport_unavailable',
    })
  let appendAlias: (alias: SourcePathAlias) => Promise<SourcePathAlias> = (_alias) =>
    Promise.reject(new TypeError('Resource aliases are unavailable'))
  const notes = new InMemoryNoteSessionSource(content.notes ?? [], scope.campaignId, (envelope) =>
    executeStructure(envelope),
  )
  const files = new InMemoryFileContentSource(
    content.files ?? [],
    scope.campaignId,
    (envelope) => executeStructure(envelope),
    (alias) => appendAlias(alias),
  )
  let currentCatalogSnapshot = () => snapshot
  const maps = new InMemoryMapSessionSource(
    { status: 'loading' },
    scope.campaignId,
    (envelope) => executeStructure(envelope),
    (resourceId) =>
      currentCatalogSnapshot().resources.some(
        (resource) => resource.id === resourceId && resource.lifecycle.state === 'active',
      ),
  )
  for (const entry of content.maps ?? []) {
    maps.setReady(entry.resourceId, entry.content, entry.version, entry.images)
  }
  const canvases = new InMemoryCanvasSessionSource(
    { status: 'loading' },
    scope.campaignId,
    (envelope) => executeStructure(envelope),
  )
  for (const entry of content.canvases ?? []) {
    canvases.setReady(entry.resourceId, entry.content, entry.version)
  }
  const resources = createInMemoryResourceRuntime({
    scope,
    initialSnapshot: snapshot,
    authorize: authorize ?? (() => canEdit),
    ...(permission ? { permission } : {}),
    contentCopy: createInMemoryContentCopyPlanner(kinds, { notes, files, maps, canvases }),
    ...(now ? { now } : {}),
  })
  currentCatalogSnapshot = resources.catalogSnapshot
  appendAlias = resources.appendAlias
  const structureWithKindIndex: ResourceStructureCommandGateway = {
    execute: async (envelope) => {
      const createWasKnown =
        envelope.command.type === 'create' && kinds.has(envelope.command.resourceId)
      const delivery = await resources.structure.execute(envelope)
      if (
        delivery.status === 'received' &&
        delivery.result.status === 'completed' &&
        envelope.command.type === 'create' &&
        !createWasKnown
      ) {
        kinds.set(envelope.command.resourceId, envelope.command.kind)
      }
      return delivery
    },
  }
  const undo = createResourceUndoHistory(
    scope.campaignId,
    structureWithKindIndex,
    resources.compensation,
  )
  executeStructure = (envelope) => undo.structure.execute(envelope)
  const unsupported = {
    status: 'unavailable',
    reason: 'capability_not_supported',
  } as const
  const workspaceStructure: ResourceStructureCommandGateway = {
    execute: (envelope) =>
      envelope.command.type === 'create' && envelope.command.kind !== 'folder'
        ? Promise.resolve(invalidCreateDelivery())
        : undo.structure.execute(envelope),
  }
  const structure = canEdit
    ? ({ status: 'available', value: workspaceStructure } as const)
    : ({ status: 'unavailable', reason: 'unauthorized' } as const)
  const contentSources = { notes, files, maps, canvases }
  let preferencesSnapshot: WorkspacePreferencesSnapshot = {
    revision: 0,
    value: DEFAULT_WORKSPACE_PREFERENCES,
  }
  const preferences = new WorkspacePreferencesController({
    save: (change) => {
      preferencesSnapshot = {
        revision: preferencesSnapshot.revision + 1,
        value: applyWorkspacePreferenceChange(preferencesSnapshot.value, change),
      }
      return Promise.resolve(preferencesSnapshot)
    },
  })
  preferences.hydrate(preferencesSnapshot)
  const catalogResources = () => resources.catalogSnapshot().resources
  const bookmarks = createInMemoryBookmarks(scope.campaignId, (resourceId) =>
    catalogResources().some((resource) => resource.id === resourceId),
  )
  const search = createInMemoryWorkspaceSearch(catalogResources, notes)

  return {
    runtime: {
      scope,
      resources: {
        index: resources.index,
        loader: resources.loader,
        structure,
        access: unsupported,
        noteBlockAccess: unsupported,
        bookmarks: { status: 'available', value: bookmarks },
        previews: unsupported,
        undo: canEdit
          ? { status: 'available', value: undo.history }
          : { status: 'unavailable', reason: 'unauthorized' },
      },
      content: contentSources,
      navigation,
      preferences,
      search: { status: 'available', value: search.gateway },
      history: unsupported,
      viewAs: unsupported,
    },
    dispose: () => {
      search.dispose()
      for (const source of Object.values(contentSources)) source.dispose()
      resources.dispose()
    },
  }
}
