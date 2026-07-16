import * as Y from 'yjs'
import { encodeWizardCanvasDocument } from '../canvas/native-document'
import { noteDocumentToMarkdown } from '../notes/document/markdown'
import {
  advanceFileContentVersion,
  initialFileContentVersion,
  initialNoteContentVersion,
} from './resource-content-version'
import {
  advanceVersion,
  initialVersion,
  sha256Digest,
  versionStampEquals,
} from './component-version'
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
  FileResourceSource,
  FileResourceContent,
  MapResourceContent,
  MapContentCommand,
  MapSession,
  MapSessionSource,
  MapSessionState,
  NoteSessionSource,
  NoteSessionState,
  NoteSession,
} from './content-session-contract'
import { isMapPosition } from './content-session-contract'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceStructureCommandGateway,
  ResourceStructureCommandResult,
} from './resource-command-contract'
import type { ResourceNavigation, EditorRuntime } from './editor-runtime-contract'
import type { CampaignId, MapPinId, OperationId, ResourceId } from './domain-id'
import { createInMemoryResourceRuntime } from './in-memory-resource-runtime'
import { createResourceUndoHistory } from './resource-undo-history'
import type { InMemoryResourceRuntimeOptions } from './in-memory-resource-runtime'
import type { ResourceCatalogSnapshot } from './resource-catalog-contract'
import type { ResourceProjectionScope } from './resource-index-contract'
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
import { serializeAuthoredDestination } from './authored-destination'

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

export type InMemoryEditorContent = Readonly<{
  notes?: ReadonlyArray<ReadyContent<Y.Doc>>
  files?: ReadonlyArray<ReadyFileContent>
  maps?: ReadonlyArray<ReadyContent<MapResourceContent>>
  canvases?: ReadonlyArray<ReadyContent<Y.Doc>>
}>

export type InMemoryEditorRuntimeInput = Readonly<{
  authorize?: InMemoryResourceRuntimeOptions['authorize']
  canEdit?: boolean
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
    source: FileResourceSource,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>> {
    if (envelope.campaignId !== this.campaignId) return invalidCreateDelivery()
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
        initialVersion(await sha256Digest(new TextEncoder().encode(JSON.stringify(content)))),
      )
    })
  }

  setReady(resourceId: ResourceId, content: MapResourceContent, version: VersionStamp): void {
    this.#sessions.get(resourceId)?.dispose()
    const session = new InMemoryMapSession(resourceId, content, version, () => {
      this.set(resourceId, { status: 'ready', session })
    })
    this.#sessions.set(resourceId, session)
    this.set(resourceId, { status: 'ready', session })
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
    super.dispose()
  }
}

class InMemoryMapSession implements MapSession {
  readonly awareness = { status: 'unavailable' as const }
  readonly #images = new Map<string, Uint8Array>()
  #disposed = false

  constructor(
    private readonly resourceId: ResourceId,
    private currentContent: MapResourceContent,
    private currentVersion: VersionStamp,
    private readonly publish: () => void,
  ) {}

  get content(): MapResourceContent {
    return this.currentContent
  }

  get version(): VersionStamp {
    return this.currentVersion
  }

  async execute(command: MapContentCommand) {
    if (this.#disposed) return { status: 'rejected' as const, reason: 'resource_missing' as const }
    let content: MapResourceContent
    switch (command.type) {
      case 'createPins': {
        if (!validLocalPinCreations(this.resourceId, this.currentContent, command)) {
          return { status: 'rejected' as const, reason: 'invalid_command' as const }
        }
        content = {
          ...this.currentContent,
          pins: [
            ...this.currentContent.pins,
            ...command.pins.map((pin) => ({ ...pin, visible: false })),
          ],
        }
        break
      }
      case 'movePin': {
        if (!isMapPosition(command) || !mapPin(this.currentContent, command.pinId)) {
          return {
            status: 'rejected' as const,
            reason: isMapPosition(command)
              ? ('pin_missing' as const)
              : ('invalid_command' as const),
          }
        }
        content = {
          ...this.currentContent,
          pins: this.currentContent.pins.map((pin) =>
            pin.id === command.pinId ? { ...pin, x: command.x, y: command.y } : pin,
          ),
        }
        break
      }
      case 'setPinVisibility': {
        if (!mapPin(this.currentContent, command.pinId)) {
          return { status: 'rejected' as const, reason: 'pin_missing' as const }
        }
        content = {
          ...this.currentContent,
          pins: this.currentContent.pins.map((pin) =>
            pin.id === command.pinId ? { ...pin, visible: command.visible } : pin,
          ),
        }
        break
      }
      case 'removePin': {
        if (!mapPin(this.currentContent, command.pinId)) {
          return { status: 'rejected' as const, reason: 'pin_missing' as const }
        }
        content = {
          ...this.currentContent,
          pins: this.currentContent.pins.filter((pin) => pin.id !== command.pinId),
        }
      }
    }
    const version = await this.#nextVersion(content)
    if (!version) {
      return { status: 'rejected' as const, reason: 'version_exhausted' as const }
    }
    this.currentContent = content
    this.currentVersion = version
    this.publish()
    return { status: 'completed' as const, content, version }
  }

  async loadImage(layerId: string | null): Promise<ContentExportResult> {
    const image = mapImageAttachment(this.currentContent, layerId)
    if (!image || image.status === 'unattached') {
      return { status: 'integrity_error', issue: 'content_missing' }
    }
    const bytes = this.#images.get(mapImageKey(layerId))
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
    if (layerId !== null && !this.currentContent.layers.some((layer) => layer.id === layerId)) {
      return { status: 'rejected' as const, reason: 'layer_missing' as const }
    }
    const metadata = classifyFileResourceSource(source)
    if (metadata.classification !== 'viewable_image') {
      return { status: 'rejected' as const, reason: 'invalid_image' as const }
    }
    const attachment = {
      status: 'attached' as const,
      byteSize: source.bytes.byteLength,
      digest: await sha256Digest(source.bytes),
      mediaType: metadata.mediaType,
    }
    const content = replaceMapImageAttachment(this.currentContent, layerId, attachment)
    const version = await this.#nextVersion(content)
    if (!version) {
      return { status: 'rejected' as const, reason: 'version_exhausted' as const }
    }
    this.#images.set(mapImageKey(layerId), Uint8Array.from(source.bytes))
    this.currentContent = content
    this.currentVersion = version
    this.publish()
    return { status: 'completed' as const, content, version }
  }

  async #nextVersion(content: MapResourceContent): Promise<VersionStamp | null> {
    try {
      return advanceVersion(
        this.currentVersion,
        await sha256Digest(new TextEncoder().encode(JSON.stringify(content))),
      )
    } catch {
      return null
    }
  }

  dispose(): void {
    this.#disposed = true
    this.#images.clear()
  }
}

function validLocalPinCreations(
  resourceId: ResourceId,
  content: MapResourceContent,
  command: Extract<MapContentCommand, { type: 'createPins' }>,
): boolean {
  if (command.pins.length === 0 || command.pins.length > 100) return false
  const layerIds = new Set(content.layers.map((layer) => layer.id))
  const pinIds = new Set(content.pins.map((pin) => pin.id))
  const destinations = new Set(
    content.pins.map((pin) => serializeAuthoredDestination(pin.destination)),
  )
  for (const pin of command.pins) {
    const destination = serializeAuthoredDestination(pin.destination)
    if (
      pinIds.has(pin.id) ||
      destinations.has(destination) ||
      !isMapPosition(pin) ||
      (pin.layerId !== null && !layerIds.has(pin.layerId)) ||
      (pin.destination.kind === 'internal' && pin.destination.target.resourceId === resourceId)
    ) {
      return false
    }
    pinIds.add(pin.id)
    destinations.add(destination)
  }
  return true
}

function mapPin(content: MapResourceContent, pinId: MapPinId) {
  return content.pins.find((pin) => pin.id === pinId)
}

function mapImageKey(layerId: string | null): string {
  return layerId ?? ''
}

function mapImageAttachment(content: MapResourceContent, layerId: string | null) {
  return layerId === null
    ? content.image
    : content.layers.find((layer) => layer.id === layerId)?.image
}

function replaceMapImageAttachment(
  content: MapResourceContent,
  layerId: string | null,
  image: MapResourceContent['image'],
): MapResourceContent {
  return layerId === null
    ? { ...content, image }
    : {
        ...content,
        layers: content.layers.map((layer) => (layer.id === layerId ? { ...layer, image } : layer)),
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
): Exclude<ContentExportResult, { status: 'ready' }> {
  return state.status === 'initializing' ? { status: 'loading' } : state
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
  const notes = new InMemoryNoteSessionSource(content.notes ?? [], scope.campaignId, (envelope) =>
    executeStructure(envelope),
  )
  const files = new InMemoryFileContentSource(content.files ?? [], scope.campaignId, (envelope) =>
    executeStructure(envelope),
  )
  const maps = new InMemoryMapSessionSource({ status: 'loading' }, scope.campaignId, (envelope) =>
    executeStructure(envelope),
  )
  for (const entry of content.maps ?? []) {
    maps.setReady(entry.resourceId, entry.content, entry.version)
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
    contentCopy: createInMemoryContentCopyPlanner(kinds, { notes, files, maps, canvases }),
    ...(now ? { now } : {}),
  })
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
    },
    dispose: () => {
      search.dispose()
      for (const source of Object.values(contentSources)) source.dispose()
      resources.dispose()
    },
  }
}
