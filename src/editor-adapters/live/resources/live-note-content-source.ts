import * as Y from 'yjs'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  CreateNoteResourceCommand,
  NoteSessionSource,
  NoteSessionState,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceStructureCommandResult,
  ResourceStructureCommandGateway,
} from '@wizard-archive/editor/resources/command-contract'
import { createResourceWatchStore } from './resource-watch-store'

type NoteSnapshot = FunctionReturnType<typeof api.resources.queries.loadNoteContent>
type BindNoteContentArgs = FunctionArgs<typeof api.resources.mutations.bindNoteContent>
type BindNoteContentResult = FunctionReturnType<typeof api.resources.mutations.bindNoteContent>

type LiveNoteContentBackend = Readonly<{
  watch(resourceId: ResourceId, apply: (snapshot: NoteSnapshot) => void): () => void
  bind(args: BindNoteContentArgs): Promise<BindNoteContentResult>
}>

type LocalCreate = Readonly<{ operationId: OperationId; doc: Y.Doc }>
type NoteStore = ReturnType<typeof createResourceWatchStore<NoteSnapshot, NoteSessionState>>

function toArrayBuffer(update: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(update.byteLength)
  copy.set(update)
  return copy.buffer
}

function invalidCreateDelivery(): CommandDelivery<ResourceStructureCommandResult> {
  return {
    status: 'received',
    result: { status: 'rejected', reason: 'invalid_command' },
  }
}

function bindingIssue(reason: Extract<BindNoteContentResult, { status: 'rejected' }>['reason']) {
  return reason === 'content_missing' || reason === 'resource_missing'
    ? ('content_missing' as const)
    : reason === 'already_initialized' || reason === 'operation_mismatch'
      ? ('version_mismatch' as const)
      : ('content_corrupt' as const)
}

class LiveNoteSessionSource implements NoteSessionSource {
  readonly #store: NoteStore
  readonly #localCreates = new Map<ResourceId, LocalCreate>()
  readonly #pendingCreates = new Map<ResourceId, LocalCreate>()
  readonly #boundDocuments = new Map<ResourceId, Readonly<{ digest: string; doc: Y.Doc }>>()
  readonly #loadedDocuments = new Map<ResourceId, Readonly<{ digest: string; doc: Y.Doc }>>()

  constructor(
    private readonly campaignId: CampaignId,
    private readonly structure: ResourceStructureCommandGateway,
    private readonly backend: LiveNoteContentBackend,
  ) {
    this.#store = createResourceWatchStore<NoteSnapshot, NoteSessionState>(
      backend.watch,
      (resourceId, snapshot) => this.#apply(resourceId, snapshot),
      { status: 'loading' },
    )
  }

  get(resourceId: ResourceId): NoteSessionState {
    return this.#store.get(resourceId)
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    return this.#store.subscribe(resourceId, listener)
  }

  async create(
    envelope: CommandEnvelope<CreateNoteResourceCommand>,
    local: Y.Doc,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>> {
    if (envelope.campaignId !== this.campaignId) return invalidCreateDelivery()
    const existing =
      this.#localCreates.get(envelope.command.resourceId) ??
      this.#pendingCreates.get(envelope.command.resourceId)
    if (existing && (existing.operationId !== envelope.operationId || existing.doc !== local)) {
      return invalidCreateDelivery()
    }

    this.#pendingCreates.set(envelope.command.resourceId, {
      operationId: envelope.operationId,
      doc: local,
    })

    const delivery = await this.structure.execute(envelope)
    if (delivery.status === 'indeterminate') return delivery
    if (delivery.status === 'not_committed' || delivery.result.status !== 'completed') {
      this.#removeLocal(envelope.command.resourceId)
      return delivery
    }
    if (
      delivery.result.receipt.operationId !== envelope.operationId ||
      delivery.result.receipt.result.type !== 'created' ||
      delivery.result.receipt.result.resourceId !== envelope.command.resourceId
    ) {
      this.#removeLocal(envelope.command.resourceId)
      return { status: 'not_committed', retryable: false, reason: 'invalid_response' }
    }

    let binding: BindNoteContentResult
    try {
      binding = await this.backend.bind({
        campaignId: this.campaignId,
        operationId: envelope.operationId,
        resourceId: envelope.command.resourceId,
        update: toArrayBuffer(Y.encodeStateAsUpdate(local)),
      })
    } catch {
      return delivery
    }
    if (binding.status === 'rejected') {
      this.#localCreates.delete(envelope.command.resourceId)
      this.#boundDocuments.delete(envelope.command.resourceId)
      this.#setState(envelope.command.resourceId, {
        status: 'integrity_error',
        issue: bindingIssue(binding.reason),
      })
      return delivery
    }

    const version = assertVersionStamp(binding.version)
    this.#localCreates.delete(envelope.command.resourceId)
    this.#boundDocuments.set(envelope.command.resourceId, {
      digest: version.digest,
      doc: local,
    })
    this.#setState(envelope.command.resourceId, {
      status: 'ready',
      session: { document: local, version, awareness: { status: 'unavailable' } },
    })
    return delivery
  }

  optimisticApplied(envelope: CommandEnvelope<CreateNoteResourceCommand>): void {
    const pending = this.#pendingCreates.get(envelope.command.resourceId)
    if (!pending || pending.operationId !== envelope.operationId) return
    this.#pendingCreates.delete(envelope.command.resourceId)
    this.#localCreates.set(envelope.command.resourceId, pending)
    this.#setState(envelope.command.resourceId, {
      status: 'initializing',
      operationId: envelope.operationId,
      local: pending.doc,
    })
  }

  dispose(): void {
    this.#store.dispose()
    for (const loaded of this.#loadedDocuments.values()) loaded.doc.destroy()
    this.#loadedDocuments.clear()
  }

  #apply(resourceId: ResourceId, snapshot: NoteSnapshot): void {
    switch (snapshot.status) {
      case 'initializing': {
        const operationId = assertDomainId(DOMAIN_ID_KIND.operation, snapshot.operationId)
        const local = this.#localCreates.get(resourceId)
        this.#setState(
          resourceId,
          local?.operationId === operationId
            ? { status: 'initializing', operationId, local: local.doc }
            : { status: 'loading' },
        )
        return
      }
      case 'unavailable':
      case 'integrity_error':
        this.#boundDocuments.delete(resourceId)
        this.#clearLoadedDocument(resourceId)
        this.#setState(resourceId, snapshot)
        return
      case 'ready': {
        const version = assertVersionStamp(snapshot.version)
        const bound = this.#boundDocuments.get(resourceId)
        if (bound?.digest === version.digest) {
          this.#clearLoadedDocument(resourceId)
          this.#setState(resourceId, {
            status: 'ready',
            session: {
              document: bound.doc,
              version,
              awareness: { status: 'unavailable' },
            },
          })
          return
        }
        this.#boundDocuments.delete(resourceId)
        const loaded = this.#loadedDocuments.get(resourceId)
        if (loaded?.digest === version.digest) {
          this.#setState(resourceId, {
            status: 'ready',
            session: {
              document: loaded.doc,
              version,
              awareness: { status: 'unavailable' },
            },
          })
          return
        }
        const doc = new Y.Doc()
        try {
          Y.applyUpdate(doc, new Uint8Array(snapshot.update))
          this.#clearLoadedDocument(resourceId)
          this.#loadedDocuments.set(resourceId, { digest: version.digest, doc })
          this.#setState(resourceId, {
            status: 'ready',
            session: { document: doc, version, awareness: { status: 'unavailable' } },
          })
        } catch {
          doc.destroy()
          this.#clearLoadedDocument(resourceId)
          this.#setState(resourceId, {
            status: 'integrity_error',
            issue: 'content_corrupt',
          })
        }
      }
    }
  }

  #removeLocal(resourceId: ResourceId): void {
    this.#pendingCreates.delete(resourceId)
    this.#localCreates.delete(resourceId)
    this.#boundDocuments.delete(resourceId)
    this.#setState(resourceId, { status: 'loading' })
  }

  #clearLoadedDocument(resourceId: ResourceId): void {
    this.#loadedDocuments.get(resourceId)?.doc.destroy()
    this.#loadedDocuments.delete(resourceId)
  }

  #setState(resourceId: ResourceId, state: NoteSessionState): void {
    this.#store.set(resourceId, state)
  }
}

export function createLiveNoteContentSource(
  campaignId: CampaignId,
  structure: ResourceStructureCommandGateway,
  backend: LiveNoteContentBackend,
) {
  const source = new LiveNoteSessionSource(campaignId, structure, backend)
  return {
    create: (envelope: CommandEnvelope<CreateNoteResourceCommand>, local: Y.Doc) =>
      source.create(envelope, local),
    dispose: () => source.dispose(),
    get: (resourceId: ResourceId) => source.get(resourceId),
    optimisticApplied: (envelope: CommandEnvelope<CreateNoteResourceCommand>) =>
      source.optimisticApplied(envelope),
    subscribe: (resourceId: ResourceId, listener: () => void) =>
      source.subscribe(resourceId, listener),
  }
}
