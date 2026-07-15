import * as Y from 'yjs'
import { initialFileContentVersion, initialNoteContentVersion } from './resource-content-version'
import { initialVersion, sha256Digest } from './component-version'
import type { VersionStamp } from './component-version'
import type {
  CanvasSessionState,
  CreateFileResourceCommand,
  CreateNoteResourceCommand,
  FileContentSource,
  FileContentState,
  FileResourceSource,
  FileResourceContent,
  MapResourceContent,
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
import { FILE_CLASSIFICATION, FILE_VIEWER_UNAVAILABLE_REASON } from './file-content-contract'
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

type ReadyContent<T> = Readonly<{
  content: T
  resourceId: ResourceId
  version: VersionStamp
}>

export type InMemoryEditorContent = Readonly<{
  notes?: ReadonlyArray<ReadyContent<Y.Doc>>
  files?: ReadonlyArray<ReadyContent<FileResourceContent>>
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
  constructor(
    ready: ReadonlyArray<ReadyContent<FileResourceContent>>,
    private readonly campaignId: CampaignId,
    private readonly executeStructure: ResourceStructureCommandGateway['execute'],
  ) {
    super({ status: 'loading' })
    for (const entry of ready) {
      this.set(entry.resourceId, {
        status: 'ready',
        content: entry.content,
        version: entry.version,
      })
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
    this.set(envelope.command.resourceId, {
      status: 'ready',
      content: { ...metadata, assetId: null },
      version: await initialFileContentVersion(source.bytes, metadata),
    })
    return delivery
  }
}

function invalidCreateDelivery(): CommandDelivery<ResourceStructureCommandResult> {
  return {
    status: 'received',
    result: { status: 'rejected', reason: 'invalid_command' },
  }
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
  const maps = new ResourceSessionStore<MapSessionState>({ status: 'loading' })
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
  const canvases = new ResourceSessionStore<CanvasSessionState>({ status: 'loading' })
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
  const contentAwareStructure: ResourceStructureCommandGateway = {
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
        await initializeCreatedContent(envelope.command, envelope.operationId, {
          notes,
          files,
          maps,
          canvases,
        })
      }
      return delivery
    },
  }
  const undo = createResourceUndoHistory(
    scope.campaignId,
    contentAwareStructure,
    resources.compensation,
  )
  executeStructure = (envelope) => undo.structure.execute(envelope)
  const unsupported = {
    status: 'unavailable',
    reason: 'capability_not_supported',
  } as const
  const structure = canEdit
    ? ({ status: 'available', value: undo.structure } as const)
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

async function initializeCreatedContent(
  command: Extract<
    Parameters<ResourceStructureCommandGateway['execute']>[0]['command'],
    { type: 'create' }
  >,
  operationId: OperationId,
  stores: Readonly<{
    notes: InMemoryNoteSessionSource
    files: InMemoryFileContentSource
    maps: ResourceSessionStore<MapSessionState>
    canvases: ResourceSessionStore<CanvasSessionState>
  }>,
) {
  switch (command.kind) {
    case 'folder':
      return
    case 'note':
      stores.notes.set(command.resourceId, {
        status: 'initializing',
        operationId,
        local: new Y.Doc(),
      })
      return
    case 'file': {
      const content: FileResourceContent = {
        assetId: null,
        classification: FILE_CLASSIFICATION.inert,
        byteSize: 0,
        detectedFormat: null,
        extension: null,
        mediaType: 'application/octet-stream',
        viewerUnavailableReason: FILE_VIEWER_UNAVAILABLE_REASON.empty,
      }
      stores.files.set(command.resourceId, {
        status: 'ready',
        content,
        version: await initialFileContentVersion(new Uint8Array(), content),
      })
      return
    }
    case 'map': {
      const content: MapResourceContent = { imageAssetId: null, layers: [], pins: [] }
      stores.maps.set(command.resourceId, {
        status: 'ready',
        session: {
          content,
          version: initialVersion(
            await sha256Digest(new TextEncoder().encode(JSON.stringify(content))),
          ),
          awareness: { status: 'unavailable' },
        },
      })
      return
    }
    case 'canvas': {
      const content = new Y.Doc()
      stores.canvases.set(command.resourceId, {
        status: 'ready',
        session: {
          document: content,
          version: initialVersion(await sha256Digest(Y.encodeStateAsUpdate(content))),
          awareness: { status: 'unavailable' },
        },
      })
    }
  }
}
