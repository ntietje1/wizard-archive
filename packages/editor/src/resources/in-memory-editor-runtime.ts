import * as Y from 'yjs'
import { encodeWizardCanvasDocument } from '../canvas/native-document'
import { noteDocumentToMarkdown } from '../notes/document/markdown'
import { initialFileContentVersion, initialNoteContentVersion } from './resource-content-version'
import { initialVersion, sha256Digest } from './component-version'
import type { VersionStamp } from './component-version'
import type {
  CanvasSessionSource,
  CanvasSessionState,
  ContentExportResult,
  CreateCanvasResourceCommand,
  CreateFileResourceCommand,
  CreateMapResourceCommand,
  CreateNoteResourceCommand,
  FileContentSource,
  FileContentState,
  FileResourceSource,
  FileResourceContent,
  MapResourceContent,
  MapSessionSource,
  MapSessionState,
  NoteSessionSource,
  NoteSessionState,
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
import { encodeWizardMapDocument } from './map-native-document'

type ReadyContent<T> = Readonly<{
  content: T
  resourceId: ResourceId
  version: VersionStamp
}>

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
  readonly #sessions = new Map<ResourceId, ReturnType<typeof createInMemoryNoteSession>>()
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
    private readonly readonly: boolean,
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

  setReady(resourceId: ResourceId, document: Y.Doc, version: VersionStamp): void {
    const previous = this.#sessions.get(resourceId)
    if (previous && previous.document !== document) previous.dispose()
    const session = createInMemoryNoteSession(document, version, this.readonly, (next) => {
      this.set(resourceId, { status: 'ready', session: next })
    })
    this.#sessions.set(resourceId, session)
    this.set(resourceId, { status: 'ready', session })
  }

  override dispose(): void {
    for (const session of this.#sessions.values()) session.dispose()
    this.#sessions.clear()
    super.dispose()
  }
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
      { ...metadata, assetId: null },
      await initialFileContentVersion(source.bytes, metadata),
      source.bytes,
    )
    return delivery
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
  async create(
    envelope: CommandEnvelope<CreateMapResourceCommand>,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>> {
    return await this.createContent(envelope, async () => {
      const content: MapResourceContent = { imageAssetId: null, layers: [], pins: [] }
      this.set(envelope.command.resourceId, {
        status: 'ready',
        session: localContentSession(
          { content },
          initialVersion(await sha256Digest(new TextEncoder().encode(JSON.stringify(content)))),
        ),
      })
    })
  }

  export(resourceId: ResourceId): ContentExportResult {
    return this.exportNative(
      resourceId,
      (state) => encodeWizardMapDocument(state.session.content),
      'wizardmap',
      'application/vnd.wizard-archive.map+json',
    )
  }
}

class InMemoryCanvasSessionSource
  extends InMemoryOwnedSessionSource<CanvasSessionState>
  implements CanvasSessionSource
{
  async create(
    envelope: CommandEnvelope<CreateCanvasResourceCommand>,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>> {
    return await this.createContent(envelope, async () => {
      const document = new Y.Doc()
      this.set(envelope.command.resourceId, {
        status: 'ready',
        session: localContentSession(
          { document },
          initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document))),
        ),
      })
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
}

function nativeContentExport(
  bytes: Uint8Array,
  extension: string,
  mediaType: string,
): ContentExportResult {
  return { status: 'ready', bytes, extension, mediaType }
}

function localContentSession<T extends object>(content: T, version: VersionStamp) {
  return { ...content, version, awareness: { status: 'unavailable' as const } }
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
  const notes = new InMemoryNoteSessionSource(
    content.notes ?? [],
    scope.campaignId,
    (envelope) => executeStructure(envelope),
    !canEdit,
  )
  const files = new InMemoryFileContentSource(content.files ?? [], scope.campaignId, (envelope) =>
    executeStructure(envelope),
  )
  const maps = new InMemoryMapSessionSource({ status: 'loading' }, scope.campaignId, (envelope) =>
    executeStructure(envelope),
  )
  for (const entry of content.maps ?? []) {
    maps.set(entry.resourceId, {
      status: 'ready',
      session: {
        content: entry.content,
        version: entry.version,
        awareness: { status: 'unavailable' },
      },
    })
  }
  const canvases = new InMemoryCanvasSessionSource(
    { status: 'loading' },
    scope.campaignId,
    (envelope) => executeStructure(envelope),
  )
  for (const entry of content.canvases ?? []) {
    canvases.set(entry.resourceId, {
      status: 'ready',
      session: {
        document: entry.content,
        version: entry.version,
        awareness: { status: 'unavailable' },
      },
    })
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
      search: { status: 'available', value: search },
      history: unsupported,
    },
    dispose: () => {
      for (const source of Object.values(contentSources)) source.dispose()
      resources.dispose()
    },
  }
}
