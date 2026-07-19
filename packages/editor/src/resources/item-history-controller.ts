import { versionStampEquals } from './component-version'
import type {
  ItemHistoryController,
  ItemHistoryEntry,
  ItemHistoryPreview,
  ItemHistoryRestoreResult,
  ItemHistoryState,
} from './editor-runtime-contract'
import type { HistoryEntryId, ResourceId } from './domain-id'

export type ItemHistoryPageResult =
  | Readonly<{
      status: 'ready'
      entries: ReadonlyArray<ItemHistoryEntry>
      nextCursor: string | null
    }>
  | Readonly<{ status: 'error' }>

export type ItemHistoryPreviewResult =
  | Readonly<{ status: 'ready'; preview: ItemHistoryPreview }>
  | Readonly<{ status: 'unavailable' | 'failed' }>

export interface ItemHistoryBackend {
  watchPage(
    resourceId: ResourceId,
    cursor: string | null,
    publish: (result: ItemHistoryPageResult) => void,
  ): () => void
  loadCheckpoint(resourceId: ResourceId, entryId: HistoryEntryId): Promise<ItemHistoryPreviewResult>
  restore(resourceId: ResourceId, entryId: HistoryEntryId): Promise<ItemHistoryRestoreResult>
}

type HistoryPage = {
  readonly cursor: string | null
  entries: ReadonlyArray<ItemHistoryEntry>
  nextCursor: string | null
  dispose(): void
}

type HistorySession = {
  readonly resourceId: ResourceId
  readonly listeners: Set<() => void>
  readonly pages: Array<HistoryPage>
  previewRequest: number
  restorePromise: Promise<ItemHistoryRestoreResult> | null
  state: ItemHistoryState
}

const INITIAL_HISTORY_STATE: ItemHistoryState = {
  list: { status: 'loading' },
  preview: { status: 'closed' },
  restore: { status: 'closed' },
}

export function createItemHistoryController(backend: ItemHistoryBackend): Readonly<{
  controller: ItemHistoryController
  dispose(): void
}> {
  const controller = new ItemHistoryControllerStore(backend)
  return {
    controller,
    dispose: () => controller.dispose(),
  }
}

class ItemHistoryControllerStore implements ItemHistoryController {
  readonly #sessions = new Map<ResourceId, HistorySession>()

  constructor(private readonly backend: ItemHistoryBackend) {}

  get(resourceId: ResourceId): ItemHistoryState {
    return this.#sessions.get(resourceId)?.state ?? INITIAL_HISTORY_STATE
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    const session = this.#sessions.get(resourceId) ?? this.#createSession(resourceId)
    session.listeners.add(listener)
    if (session.pages.length === 0) this.#watchPage(session, null)
    let active = true
    return () => {
      if (!active) return
      active = false
      session.listeners.delete(listener)
      if (session.listeners.size === 0) this.#closeSession(session)
    }
  }

  loadMore(resourceId: ResourceId): void {
    const session = this.#sessions.get(resourceId)
    if (!session || session.state.list.status !== 'ready') return
    const lastPage = session.pages.at(-1)
    if (!lastPage?.nextCursor || session.state.list.pagination !== 'more_available') return
    this.#publishState(session, {
      ...session.state,
      list: { ...session.state.list, pagination: 'loading_more' },
    })
    this.#watchPage(session, lastPage.nextCursor)
  }

  selectPreview(resourceId: ResourceId, entryId: HistoryEntryId | null): void {
    const session = this.#sessions.get(resourceId)
    if (!session) return
    const request = ++session.previewRequest
    if (entryId === null) {
      this.#publishState(session, { ...session.state, preview: { status: 'closed' } })
      return
    }
    void this.#loadPreview(session, entryId, request)
  }

  requestRestore(resourceId: ResourceId, entryId: HistoryEntryId): void {
    const session = this.#sessions.get(resourceId)
    if (!session || session.state.restore.status === 'restoring') return
    const entry = this.#checkpointEntry(session, entryId)
    if (!entry) return
    this.#publishState(session, {
      ...session.state,
      restore: { status: 'ready', entryId, entryTime: entry.createdAt },
    })
  }

  cancelRestore(resourceId: ResourceId): void {
    const session = this.#sessions.get(resourceId)
    if (!session || session.state.restore.status === 'restoring') return
    this.#publishState(session, { ...session.state, restore: { status: 'closed' } })
  }

  confirmRestore(resourceId: ResourceId): Promise<ItemHistoryRestoreResult> {
    const session = this.#sessions.get(resourceId)
    return session ? this.#restore(session) : Promise.resolve({ status: 'unavailable' })
  }

  dispose(): void {
    for (const session of this.#sessions.values()) this.#closeSession(session)
  }

  #createSession(resourceId: ResourceId): HistorySession {
    const session: HistorySession = {
      resourceId,
      listeners: new Set(),
      pages: [],
      previewRequest: 0,
      restorePromise: null,
      state: INITIAL_HISTORY_STATE,
    }
    this.#sessions.set(resourceId, session)
    return session
  }

  #current(session: HistorySession): boolean {
    return this.#sessions.get(session.resourceId) === session
  }

  #publishState(session: HistorySession, state: ItemHistoryState): void {
    if (!this.#current(session)) return
    session.state = state
    for (const listener of session.listeners) listener()
  }

  #closeSession(session: HistorySession): void {
    if (!this.#current(session)) return
    this.#sessions.delete(session.resourceId)
    session.previewRequest += 1
    for (const page of session.pages) page.dispose()
    session.pages.length = 0
    session.listeners.clear()
  }

  #watchPage(session: HistorySession, cursor: string | null): void {
    let unsubscribe = () => {}
    const page: HistoryPage = {
      cursor,
      entries: [],
      nextCursor: cursor,
      dispose: () => unsubscribe(),
    }
    session.pages.push(page)
    try {
      unsubscribe = this.backend.watchPage(session.resourceId, cursor, (result) =>
        this.#applyPage(session, page, result),
      )
      if (!this.#current(session) || !session.pages.includes(page)) unsubscribe()
    } catch {
      this.#failPage(session, page)
    }
  }

  #applyPage(session: HistorySession, page: HistoryPage, result: ItemHistoryPageResult): void {
    if (!this.#current(session) || !session.pages.includes(page)) return
    if (
      result.status === 'error' ||
      !validHistoryPage(session, page, result.entries, result.nextCursor)
    ) {
      this.#failPage(session, page)
      return
    }
    const index = session.pages.indexOf(page)
    for (const laterPage of session.pages.splice(index + 1)) laterPage.dispose()
    page.entries = result.entries
    page.nextCursor = result.nextCursor
    this.#publishPages(session)
  }

  #failPage(session: HistorySession, page: HistoryPage): void {
    const index = session.pages.indexOf(page)
    if (index < 0) return
    session.pages.splice(index, 1)
    page.dispose()
    if (index === 0) {
      this.#publishState(session, { ...session.state, list: { status: 'error' } })
      return
    }
    this.#publishPages(session)
  }

  #publishPages(session: HistorySession): void {
    const entries = session.pages.flatMap((page) => page.entries)
    const lastPage = session.pages.at(-1)
    this.#publishState(session, {
      ...session.state,
      list: {
        status: 'ready',
        entries,
        pagination: lastPage?.nextCursor === null ? 'complete' : 'more_available',
      },
    })
  }

  #checkpointEntry(session: HistorySession, entryId: HistoryEntryId) {
    if (session.state.list.status !== 'ready') return null
    const entry = session.state.list.entries.find((candidate) => candidate.id === entryId)
    return entry && 'checkpoint' in entry ? entry : null
  }

  async #loadPreview(
    session: HistorySession,
    entryId: HistoryEntryId,
    request: number,
  ): Promise<void> {
    const entry = this.#checkpointEntry(session, entryId)
    if (!entry) return
    this.#publishState(session, {
      ...session.state,
      preview: { status: 'loading', entryId, entryTime: entry.createdAt },
    })
    let result: ItemHistoryPreviewResult
    try {
      result = await this.backend.loadCheckpoint(session.resourceId, entryId)
    } catch {
      result = { status: 'failed' }
    }
    if (!this.#current(session) || request !== session.previewRequest) return
    if (result.status === 'ready' && checkpointMatchesPreview(entry, result.preview)) {
      this.#publishState(session, {
        ...session.state,
        preview: {
          status: 'ready',
          entryId,
          entryTime: entry.createdAt,
          preview: result.preview,
        },
      })
      return
    }
    this.#publishState(session, {
      ...session.state,
      preview: {
        status: result.status === 'unavailable' ? 'unavailable' : 'error',
        entryId,
        entryTime: entry.createdAt,
      },
    })
  }

  #restore(session: HistorySession): Promise<ItemHistoryRestoreResult> {
    if (session.restorePromise) return session.restorePromise
    const restore = session.state.restore
    if (restore.status !== 'ready' && restore.status !== 'error') {
      return Promise.resolve({ status: 'unavailable' })
    }
    const entry = this.#checkpointEntry(session, restore.entryId)
    if (!entry) return Promise.resolve({ status: 'unavailable' })
    this.#publishState(session, {
      ...session.state,
      restore: {
        status: 'restoring',
        entryId: entry.id,
        entryTime: entry.createdAt,
      },
    })
    const promise = this.backend
      .restore(session.resourceId, entry.id)
      .catch(() => ({ status: 'failed' }) as const)
      .then((result) => this.#completeRestore(session, entry, result))
    session.restorePromise = promise
    return promise
  }

  #completeRestore(
    session: HistorySession,
    entry: Extract<ItemHistoryEntry, { checkpoint: unknown }>,
    result: ItemHistoryRestoreResult,
  ): ItemHistoryRestoreResult {
    if (!this.#current(session)) return result
    session.restorePromise = null
    if (result.status === 'restored') {
      session.previewRequest += 1
      this.#publishState(session, {
        ...session.state,
        preview: { status: 'closed' },
        restore: { status: 'closed' },
      })
    } else {
      this.#publishState(session, {
        ...session.state,
        restore: {
          status: 'error',
          entryId: entry.id,
          entryTime: entry.createdAt,
          result,
        },
      })
    }
    return result
  }
}

function validHistoryPage(
  session: HistorySession,
  page: HistoryPage,
  entries: ReadonlyArray<ItemHistoryEntry>,
  nextCursor: string | null,
): boolean {
  if (page.cursor !== null && page.cursor === nextCursor) return false
  const seen = new Set(
    session.pages
      .filter((candidate) => candidate !== page)
      .flatMap((candidate) => candidate.entries.map((entry) => entry.id)),
  )
  for (const entry of entries) {
    if (entry.resourceId !== session.resourceId || seen.has(entry.id)) return false
    seen.add(entry.id)
  }
  return true
}

function checkpointMatchesPreview(
  entry: Extract<ItemHistoryEntry, { checkpoint: unknown }>,
  preview: ItemHistoryPreview,
): boolean {
  return (
    entry.checkpoint.kind === preview.kind &&
    entry.checkpoint.snapshotId === preview.snapshotId &&
    versionStampEquals(entry.checkpoint.version, preview.version)
  )
}
