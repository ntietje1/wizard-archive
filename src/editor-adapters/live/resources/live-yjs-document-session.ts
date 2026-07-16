import * as Y from 'yjs'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type {
  ContentSessionSaveResult,
  ContentUnavailableState,
} from '@wizard-archive/editor/resources/content-session-contract'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { YjsUpdateOutbox } from './yjs-update-outbox'

export type RejectedYjsSave = Extract<ContentSessionSaveResult, { status: 'rejected' }>
type PersistedYjsUpdate =
  | Readonly<{ status: 'completed'; update: ArrayBuffer; version: VersionStamp }>
  | RejectedYjsSave
export type YjsVersionDecision = 'applied' | 'conflict' | 'duplicate' | 'stale'

type LiveYjsDocumentSessionOptions = Readonly<{
  document: Y.Doc
  version: VersionStamp
  outbox: YjsUpdateOutbox
  persist(update: Uint8Array): Promise<PersistedYjsUpdate>
  changed(): void
  failed(result: RejectedYjsSave): void
  canonicalize(document: Y.Doc, origin: unknown): 'changed' | 'invalid' | 'unchanged'
  flushCompanion?(): Promise<void>
  disposeCompanion?(): Promise<void>
}>

const REMOTE_YJS_UPDATE = Symbol('remote-yjs-update')
const YJS_SAVE_DELAY_MS = 250
const YJS_SAVE_RETRY_DELAYS_MS = [250, 500, 1000, 2000] as const

export class YjsUpdateOutboxUnavailableError extends Error {}

class LiveYjsDocumentSession {
  readonly document: Y.Doc
  readonly #outbox: YjsUpdateOutbox
  readonly #persistUpdate: LiveYjsDocumentSessionOptions['persist']
  readonly #changed: LiveYjsDocumentSessionOptions['changed']
  readonly #failed: LiveYjsDocumentSessionOptions['failed']
  readonly #canonicalize: LiveYjsDocumentSessionOptions['canonicalize']
  readonly #flushCompanion: NonNullable<LiveYjsDocumentSessionOptions['flushCompanion']>
  readonly #disposeCompanion: NonNullable<LiveYjsDocumentSessionOptions['disposeCompanion']>
  #version: VersionStamp
  #drainPromise: Promise<ContentSessionSaveResult> | null = null
  #lifecycle: 'closing' | 'destroyed' | 'open' = 'open'
  #pendingUpdate: Uint8Array | null = null
  #terminal: RejectedYjsSave | null = null
  #timer: ReturnType<typeof setTimeout> | null = null

  constructor(options: LiveYjsDocumentSessionOptions) {
    this.document = options.document
    this.#version = options.version
    this.#outbox = options.outbox
    this.#persistUpdate = options.persist
    this.#changed = options.changed
    this.#failed = options.failed
    this.#canonicalize = options.canonicalize
    this.#flushCompanion = options.flushCompanion ?? (() => Promise.resolve())
    this.#disposeCompanion = options.disposeCompanion ?? (() => Promise.resolve())

    const recovered = this.#outbox.load()
    if (recovered.status === 'unavailable') throw new YjsUpdateOutboxUnavailableError()
    if (recovered.update) Y.applyUpdate(this.document, recovered.update, REMOTE_YJS_UPDATE)
    this.#pendingUpdate = recovered.update
    const canonicalization = this.#canonicalizeDocument()
    if (canonicalization === 'unavailable') throw new YjsUpdateOutboxUnavailableError()
    if (canonicalization === 'invalid') {
      throw new TypeError('Recovered Yjs update produced invalid content')
    }
    this.document.on('update', this.#onUpdate)
    if (this.#pendingUpdate) this.#scheduleSave()
  }

  get version(): VersionStamp {
    return this.#version
  }

  apply(update: ArrayBuffer, version: VersionStamp): YjsVersionDecision {
    if (version.revision < this.#version.revision) return 'stale'
    if (version.revision === this.#version.revision) {
      if (version.digest === this.#version.digest) return 'duplicate'
      this.#fail({ status: 'rejected', reason: 'content_corrupt' })
      return 'conflict'
    }
    const canonicalization = this.document.transact(() => {
      Y.applyUpdate(this.document, new Uint8Array(update), REMOTE_YJS_UPDATE)
      return this.#canonicalizeDocument()
    }, REMOTE_YJS_UPDATE)
    if (canonicalization === 'invalid' || canonicalization === 'unavailable') {
      this.#fail({
        status: 'rejected',
        reason: canonicalization === 'invalid' ? 'content_corrupt' : 'scope_unavailable',
      })
      return 'conflict'
    }
    this.#version = version
    if (canonicalization === 'changed') this.#scheduleSave()
    this.#changed()
    return 'applied'
  }

  readonly flush = (): Promise<ContentSessionSaveResult> => {
    const companion = this.#flushCompanion()
    const document = this.#flushDocument()
    return Promise.all([companion, document]).then(([, result]) => result)
  }

  dispose(): void {
    if (this.#lifecycle !== 'open') return
    this.#close()
    void this.flush().finally(() => this.#destroy())
  }

  readonly #onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_YJS_UPDATE || this.#lifecycle !== 'open') return
    const accepted = this.#outbox.merge(update)
    if (accepted.status === 'unavailable') {
      this.#fail({ status: 'rejected', reason: 'scope_unavailable' })
      return
    }
    this.#pendingUpdate = mergeOptionalYjsUpdates(this.#pendingUpdate, update)
    this.#scheduleSave()
  }

  #canonicalizeDocument(): 'changed' | 'invalid' | 'unavailable' | 'unchanged' {
    const vector = Y.encodeStateVector(this.document)
    const result = this.#canonicalize(this.document, REMOTE_YJS_UPDATE)
    if (result !== 'changed') return result

    const update = Y.encodeStateAsUpdate(this.document, vector)
    const accepted = this.#outbox.merge(update)
    if (accepted.status === 'unavailable') return 'unavailable'
    this.#pendingUpdate = mergeOptionalYjsUpdates(this.#pendingUpdate, update)
    return 'changed'
  }

  #flushDocument(): Promise<ContentSessionSaveResult> {
    if (this.#lifecycle === 'destroyed') {
      return Promise.resolve(this.#terminal ?? { status: 'rejected', reason: 'scope_unavailable' })
    }
    if (this.#terminal) return Promise.resolve(this.#terminal)
    if (this.#drainPromise) return this.#drainPromise
    if (this.#pendingUpdate === null) {
      return Promise.resolve({ status: 'completed', version: this.#version })
    }
    this.#drainPromise = this.#runDrain()
    return this.#drainPromise
  }

  #scheduleSave(): void {
    if (this.#drainPromise) return
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = setTimeout(() => {
      this.#timer = null
      void this.flush()
    }, YJS_SAVE_DELAY_MS)
  }

  async #runDrain(): Promise<ContentSessionSaveResult> {
    try {
      while (this.#pendingUpdate !== null) {
        const update = this.#pendingUpdate
        this.#pendingUpdate = null
        const result = await this.#persist(update)
        if (result.status === 'rejected') {
          this.#pendingUpdate = mergeOptionalYjsUpdates(update, this.#pendingUpdate)
          this.#fail(result)
          return result
        }
        if (this.apply(result.update, assertVersionStamp(result.version)) === 'conflict') {
          return this.#terminal!
        }
        const remaining = this.#pendingUpdate
        const stored = remaining === null ? this.#outbox.clear() : this.#outbox.replace(remaining)
        if (stored.status === 'unavailable') {
          const unavailable = { status: 'rejected', reason: 'scope_unavailable' } as const
          this.#fail(unavailable)
          return unavailable
        }
        await Promise.resolve()
      }
      return { status: 'completed', version: this.#version }
    } finally {
      this.#drainPromise = null
      if (this.#lifecycle === 'closing') this.#destroy()
      else if (this.#pendingUpdate !== null && !this.#terminal) this.#scheduleSave()
    }
  }

  async #persist(update: Uint8Array): Promise<PersistedYjsUpdate> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.#persistUpdate(update)
      } catch {
        const delay = YJS_SAVE_RETRY_DELAYS_MS[attempt]
        if (delay === undefined) return { status: 'rejected', reason: 'scope_unavailable' }
        await new Promise<void>((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  #fail(result: RejectedYjsSave): void {
    if (this.#terminal) return
    this.#terminal = result
    this.#close()
    this.#failed(result)
    if (!this.#drainPromise) this.#destroy()
  }

  #close(): void {
    if (this.#lifecycle !== 'open') return
    this.#lifecycle = 'closing'
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = null
    this.document.off('update', this.#onUpdate)
  }

  #destroy(): void {
    if (this.#lifecycle === 'destroyed') return
    this.#lifecycle = 'destroyed'
    void this.#disposeCompanion().finally(() => this.document.destroy())
  }
}

export function createLiveYjsDocumentSession(options: LiveYjsDocumentSessionOptions) {
  return new LiveYjsDocumentSession(options)
}

type BackendContentSaveRejection =
  | 'content_corrupt'
  | 'content_limit_exceeded'
  | 'content_missing'
  | 'unauthorized'
  | 'version_exhausted'

export function failedYjsSessionState(result: RejectedYjsSave): ContentUnavailableState {
  switch (result.reason) {
    case 'scope_unavailable':
    case 'unauthorized':
      return { status: 'unavailable', reason: result.reason }
    case 'content_corrupt':
    case 'content_limit_exceeded':
    case 'version_exhausted':
      return { status: 'integrity_error', issue: result.reason }
    case 'content_missing':
    case 'resource_missing':
      return { status: 'integrity_error', issue: 'content_missing' }
  }
}

function mergeOptionalYjsUpdates(
  first: Uint8Array | null,
  second: Uint8Array | null,
): Uint8Array | null {
  if (!first) return second ? Uint8Array.from(second) : null
  if (!second) return Uint8Array.from(first)
  return Y.mergeUpdates([first, second])
}

export function yjsUpdateArrayBuffer(update: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(update.byteLength)
  copy.set(update)
  return copy.buffer
}

type BackendYjsSaveResult =
  | Readonly<{
      status: 'completed'
      resourceId: ResourceId
      update: ArrayBuffer
      version: VersionStamp
    }>
  | Readonly<{ status: 'rejected'; reason: BackendContentSaveRejection }>

export function createBackendYjsPersistence(
  campaignId: CampaignId,
  resourceId: ResourceId,
  save: (args: {
    campaignId: CampaignId
    resourceId: ResourceId
    update: ArrayBuffer
  }) => Promise<BackendYjsSaveResult>,
) {
  return async (update: Uint8Array): Promise<PersistedYjsUpdate> => {
    const result = await save({
      campaignId,
      resourceId,
      update: yjsUpdateArrayBuffer(update),
    })
    return result
  }
}
