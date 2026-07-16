import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CreateCanvasResourceCommand,
  CreateMapResourceCommand,
  FileContentSource,
  FileContentState,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import { normalizeResourceStructureCommand } from '@wizard-archive/editor/resources/command-protocol'
import type { ResourceHistoryRecording } from '@wizard-archive/editor/resources/undo-history'
import { createResourceWatchStore } from './resource-watch-store'
import {
  deliverExpectedCreateResult,
  readLiveStructureResult,
  toLiveStructureMutationCommand,
} from './live-resource-structure-gateway'
import { liveContentPendingState } from './live-content-pending-state'

type ResourceContentSnapshot = FunctionReturnType<typeof api.resources.queries.loadContent>
type LiveFileContentStateSource = Pick<FileContentSource, 'dispose' | 'get' | 'subscribe'> & {
  load(resourceId: ResourceId): Promise<FileContentState>
}
type ResourceContentStore = ReturnType<
  typeof createResourceWatchStore<ResourceContentSnapshot, FileContentState>
>

export type LiveResourceContentBackend = Readonly<{
  load(resourceId: ResourceId): Promise<ResourceContentSnapshot>
  watch(resourceId: ResourceId, apply: (snapshot: ResourceContentSnapshot) => void): () => void
}>

class LiveResourceContentSource {
  readonly #store: ResourceContentStore

  constructor(private readonly backend: LiveResourceContentBackend) {
    this.#store = createResourceWatchStore<ResourceContentSnapshot, FileContentState>(
      backend.watch,
      (resourceId, snapshot) => this.#apply(resourceId, snapshot),
      { status: 'loading' },
    )
  }

  get(resourceId: ResourceId): FileContentState {
    return this.#store.get(resourceId)
  }

  async load(resourceId: ResourceId): Promise<FileContentState> {
    this.#apply(resourceId, await this.backend.load(resourceId))
    return this.get(resourceId)
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    return this.#store.subscribe(resourceId, listener)
  }

  dispose(): void {
    this.#store.dispose()
  }

  #apply(resourceId: ResourceId, snapshot: ResourceContentSnapshot): void {
    if (snapshot.status !== 'ready') {
      this.#setState(resourceId, liveContentPendingState(snapshot))
      return
    }
    this.#applyReady(resourceId, snapshot)
  }

  #applyReady(
    resourceId: ResourceId,
    snapshot: Extract<ResourceContentSnapshot, { status: 'ready' }>,
  ): void {
    if (snapshot.kind !== 'file') {
      this.#setState(resourceId, { status: 'integrity_error', issue: 'content_corrupt' })
      return
    }
    let version
    try {
      version = assertVersionStamp(snapshot.version)
    } catch {
      this.#setState(resourceId, { status: 'integrity_error', issue: 'version_mismatch' })
      return
    }
    this.#setState(resourceId, {
      status: 'ready',
      content: snapshot.content,
      version,
    })
  }

  #setState(resourceId: ResourceId, state: FileContentState): void {
    this.#store.set(resourceId, state)
  }
}

export function createLiveResourceContentSource(
  backend: LiveResourceContentBackend,
): LiveFileContentStateSource {
  const source = new LiveResourceContentSource(backend)
  return {
    dispose: () => source.dispose(),
    get: (resourceId: ResourceId) => source.get(resourceId),
    load: (resourceId: ResourceId) => source.load(resourceId),
    subscribe: (resourceId: ResourceId, listener: () => void) =>
      source.subscribe(resourceId, listener),
  }
}

type ContentCreateArgs = FunctionArgs<typeof api.resources.mutations.createMapResource>
type ContentCreateResult = FunctionReturnType<typeof api.resources.mutations.createMapResource>
export type LiveFixedContentBackend = LiveResourceContentBackend &
  Readonly<{
    create(args: ContentCreateArgs): Promise<ContentCreateResult>
    refresh(resourceId: ResourceId, parentId: ResourceId | null): Promise<void>
  }>

export async function finalizeLiveContentCreate(
  delivery: CommandDelivery<ResourceStructureCommandResult>,
  resourceId: ResourceId,
  parentId: ResourceId | null,
  backend: Pick<LiveFixedContentBackend, 'refresh'>,
  recording: ResourceHistoryRecording,
): Promise<CommandDelivery<ResourceStructureCommandResult>> {
  if (delivery.status !== 'received' || delivery.result.status !== 'completed') {
    recording.abandon()
    return delivery
  }
  await backend.refresh(resourceId, parentId)
  recording.completed(delivery.result.receipt)
  return delivery
}

export async function createLiveFixedContentResource(
  campaignId: CampaignId,
  envelope: CommandEnvelope<CreateMapResourceCommand | CreateCanvasResourceCommand>,
  backend: LiveFixedContentBackend,
  beginCreate: () => ResourceHistoryRecording,
): Promise<CommandDelivery<ResourceStructureCommandResult>> {
  if (envelope.campaignId !== campaignId) {
    return { status: 'received', result: { status: 'rejected', reason: 'invalid_command' } }
  }
  const recording = beginCreate()
  try {
    const delivery = deliverExpectedCreateResult(
      readLiveStructureResult(
        await backend.create({
          campaignId,
          operationId: envelope.operationId,
          command: toLiveStructureMutationCommand(
            normalizeResourceStructureCommand(envelope.command),
          ),
        }),
      ),
      campaignId,
      envelope.operationId,
      envelope.command.resourceId,
    )
    return await finalizeLiveContentCreate(
      delivery,
      envelope.command.resourceId,
      envelope.command.parentId,
      backend,
      recording,
    )
  } catch {
    recording.abandon()
    return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
  }
}
