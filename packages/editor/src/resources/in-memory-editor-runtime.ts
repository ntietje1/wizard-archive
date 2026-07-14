import * as Y from 'yjs'
import { initialNoteContentVersion } from './resource-content-version'
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
import type { ResourceCatalogSnapshot } from './resource-catalog-contract'
import type { ResourceProjectionScope } from './resource-index-contract'

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
    private readonly executeStructure: WizardEditorRuntime['resources']['structure']['execute'],
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
  content = {},
  navigation,
  now,
  scope,
  snapshot,
}: InMemoryEditorRuntimeInput): Readonly<{ runtime: WizardEditorRuntime; dispose(): void }> {
  const resources = createInMemoryResourceRuntime({
    scope,
    initialSnapshot: snapshot,
    authorize: () => true,
    ...(now ? { now } : {}),
  })
  const notes = new InMemoryNoteContentSource(content.notes ?? [], scope.campaignId, (envelope) =>
    resources.structure.execute(envelope),
  )
  const unsupported = {
    status: 'unavailable',
    reason: 'capability_not_supported',
  } as const

  return {
    runtime: {
      scope,
      resources: {
        index: resources.index,
        loader: resources.loader,
        structure: resources.structure,
        access: unsupported,
        bookmarks: unsupported,
        previews: unsupported,
      },
      content: {
        notes,
        files: new InMemoryContentSource(content.files ?? []),
        maps: new InMemoryContentSource(content.maps ?? []),
        canvases: new InMemoryContentSource(content.canvases ?? []),
      },
      navigation,
      search: unsupported,
      history: unsupported,
    },
    dispose: resources.dispose,
  }
}
