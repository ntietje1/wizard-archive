import * as Y from 'yjs'
import { initialFileContentVersion, initialNoteContentVersion } from './resource-content-version'
import { initialVersion, sha256Digest } from './component-version'
import type { VersionStamp } from './component-version'
import type {
  ContentSessionState,
  CreateNoteResourceCommand,
  NoteContentSource,
  ResourceContentSource,
} from './content-session-contract'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceStructureCommandGateway,
  ResourceStructureCommandResult,
} from './resource-command-contract'
import type {
  FileResourceContent,
  MapResourceContent,
  ResourceNavigation,
  WizardEditorRuntime,
} from './editor-runtime-contract'
import type { CampaignId, OperationId, ResourceId } from './domain-id'
import { createInMemoryResourceRuntime } from './in-memory-resource-runtime'
import type { InMemoryResourceRuntimeOptions } from './in-memory-resource-runtime'
import type { ResourceCatalogSnapshot } from './resource-catalog-contract'
import type { ResourceProjectionScope } from './resource-index-contract'
import { createInMemoryContentCopyPlanner } from './in-memory-content-copy'
import { FILE_CLASSIFICATION, FILE_VIEWER_UNAVAILABLE_REASON } from './file-content-contract'

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

type ResourceState<TLocal, TReady> = ContentSessionState<TLocal, TReady>

class InMemoryContentSource<TLocal, TReady> implements ResourceContentSource<TLocal, TReady> {
  readonly #listeners = new Map<ResourceId, Set<() => void>>()
  readonly #states = new Map<ResourceId, ResourceState<TLocal, TReady>>()

  constructor(ready: ReadonlyArray<ReadyContent<TReady>>) {
    for (const item of ready) {
      this.#states.set(item.resourceId, {
        status: 'ready',
        content: item.content,
        version: item.version,
      })
    }
  }

  get(resourceId: ResourceId): ResourceState<TLocal, TReady> {
    return this.#states.get(resourceId) ?? { status: 'loading' }
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    const listeners = this.#listeners.get(resourceId) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(resourceId, listeners)
    return () => listeners.delete(listener)
  }

  set(resourceId: ResourceId, state: ResourceState<TLocal, TReady>): void {
    this.#states.set(resourceId, state)
    for (const listener of this.#listeners.get(resourceId) ?? []) listener()
  }
}

class InMemoryNoteContentSource
  extends InMemoryContentSource<Y.Doc, Y.Doc>
  implements NoteContentSource<Y.Doc, Y.Doc>
{
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
    super(ready)
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
    this.set(resourceId, { status: 'ready', content: local, version })
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
}: InMemoryEditorRuntimeInput): Readonly<{ runtime: WizardEditorRuntime; dispose(): void }> {
  const canEdit = requestedCanEdit ?? scope.projection === 'dm'
  const kinds = new Map(snapshot.resources.map((resource) => [resource.id, resource.kind]))
  let executeStructure: ResourceStructureCommandGateway['execute'] = () =>
    Promise.resolve({
      status: 'not_committed',
      retryable: false,
      reason: 'transport_unavailable',
    })
  const notes = new InMemoryNoteContentSource(content.notes ?? [], scope.campaignId, (envelope) =>
    executeStructure(envelope),
  )
  const files = new InMemoryContentSource<null, FileResourceContent>(content.files ?? [])
  const maps = new InMemoryContentSource<null, MapResourceContent>(content.maps ?? [])
  const canvases = new InMemoryContentSource<null, Y.Doc>(content.canvases ?? [])
  const resources = createInMemoryResourceRuntime({
    scope,
    initialSnapshot: snapshot,
    authorize: authorize ?? (() => canEdit),
    contentCopy: createInMemoryContentCopyPlanner(kinds, { notes, files, maps, canvases }),
    ...(now ? { now } : {}),
  })
  const editorStructure: ResourceStructureCommandGateway = {
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
  executeStructure = (envelope) => editorStructure.execute(envelope)
  const unsupported = {
    status: 'unavailable',
    reason: 'capability_not_supported',
  } as const
  const structure = canEdit
    ? ({ status: 'available', value: editorStructure } as const)
    : ({ status: 'unavailable', reason: 'unauthorized' } as const)

  return {
    runtime: {
      scope,
      resources: {
        index: resources.index,
        loader: resources.loader,
        structure,
        access: unsupported,
        bookmarks: unsupported,
        previews: unsupported,
      },
      content: {
        notes,
        files,
        maps,
        canvases,
      },
      navigation,
      search: unsupported,
      history: unsupported,
    },
    dispose: resources.dispose,
  }
}

async function initializeCreatedContent(
  command: Extract<
    Parameters<ResourceStructureCommandGateway['execute']>[0]['command'],
    { type: 'create' }
  >,
  operationId: OperationId,
  stores: Readonly<{
    notes: InMemoryNoteContentSource
    files: InMemoryContentSource<null, FileResourceContent>
    maps: InMemoryContentSource<null, MapResourceContent>
    canvases: InMemoryContentSource<null, Y.Doc>
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
        content,
        version: initialVersion(
          await sha256Digest(new TextEncoder().encode(JSON.stringify(content))),
        ),
      })
      return
    }
    case 'canvas': {
      const content = new Y.Doc()
      stores.canvases.set(command.resourceId, {
        status: 'ready',
        content,
        version: initialVersion(await sha256Digest(Y.encodeStateAsUpdate(content))),
      })
    }
  }
}
