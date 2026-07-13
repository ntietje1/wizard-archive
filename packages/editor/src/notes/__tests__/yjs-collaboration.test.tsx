import * as Y from 'yjs'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { NOTE_YJS_PERSIST_DEBOUNCE_MS, NOTE_YJS_PERSIST_INTERVAL_MS } from '../session-timing'
import { useNoteYjsPersistenceLifecycle } from '../yjs-persistence'
import type { NoteProjectionResult } from '../../../../../shared/yjs-sync/note-projection'

const NOTE_ID = 'note-1' as SidebarItemId
const SOURCE_ID = 'workspace-1'

describe('useNoteYjsPersistenceLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes local note updates before persisting derived data', async () => {
    const doc = new Y.Doc()
    const provider = createProvider()
    const events: Array<string> = []
    const adapter = createAdapter({
      flushProvider: () => {
        events.push('flush')
        return true
      },
      persistNote: () => {
        events.push('persist')
        return { status: 'projected', throughSeq: 0 }
      },
    })

    renderHook(() =>
      useNoteYjsPersistenceLifecycle({
        noteId: NOTE_ID,
        sourceId: SOURCE_ID,
        canEdit: true,
        session: { doc, provider, isLoading: false },
        adapter,
      }),
    )

    doc.getMap('content').set('value', 'changed')

    await vi.advanceTimersByTimeAsync(NOTE_YJS_PERSIST_DEBOUNCE_MS)

    expect(events).toEqual(['flush', 'persist'])
    expect(adapter.persistNote).toHaveBeenCalledWith(NOTE_ID, SOURCE_ID)
  })

  it('persists provider-origin local updates when the provider is writable', async () => {
    const doc = new Y.Doc()
    const provider = createProvider({ isApplyingRemoteUpdate: false })
    const adapter = createAdapter()

    renderHook(() =>
      useNoteYjsPersistenceLifecycle({
        noteId: NOTE_ID,
        sourceId: SOURCE_ID,
        canEdit: true,
        session: { doc, provider, isLoading: false },
        adapter,
      }),
    )

    doc.transact(() => {
      doc.getMap('content').set('provider-local', 'changed')
    }, provider)

    await vi.advanceTimersByTimeAsync(NOTE_YJS_PERSIST_DEBOUNCE_MS)

    expect(adapter.persistNote).toHaveBeenCalledWith(NOTE_ID, SOURCE_ID)
  })

  it('drains pending work before cleanup persistence', async () => {
    const doc = new Y.Doc()
    const provider = createProvider()
    const events: Array<string> = []
    let resolveFlush!: () => void
    const adapter = createAdapter({
      flushProvider: () =>
        new Promise<boolean>((resolve) => {
          events.push('flush-start')
          resolveFlush = () => {
            events.push('flush-end')
            resolve(true)
          }
        }),
      persistNote: () => {
        events.push('persist')
        return { status: 'projected', throughSeq: 0 }
      },
    })

    const { result } = renderHook(() =>
      useNoteYjsPersistenceLifecycle({
        noteId: NOTE_ID,
        sourceId: SOURCE_ID,
        canEdit: true,
        session: { doc, provider, isLoading: false },
        adapter,
      }),
    )

    const cleanup = result.current.handleBeforeDestroy({
      noteId: NOTE_ID,
      sourceId: SOURCE_ID,
      provider,
    })

    await Promise.resolve()
    expect(events).toEqual(['flush-start'])

    resolveFlush()
    await cleanup

    expect(events).toEqual(['flush-start', 'flush-end', 'persist'])
  })

  it('waits for an in-flight projection before the final provider flush', async () => {
    const doc = new Y.Doc()
    const provider = createProvider()
    const events: Array<string> = []
    let resolveProjection!: (result: NoteProjectionResult) => void
    const projection = new Promise<NoteProjectionResult>((resolve) => {
      resolveProjection = resolve
    })
    const adapter = createAdapter({
      flushProvider: () => {
        events.push('flush')
        return true
      },
      persistNote: vi
        .fn()
        .mockImplementationOnce(() => {
          events.push('persist-start')
          return projection
        })
        .mockImplementation(() => {
          events.push('persist-cleanup')
          return { status: 'projected', throughSeq: 0 }
        }),
    })

    const { result } = renderHook(() =>
      useNoteYjsPersistenceLifecycle({
        noteId: NOTE_ID,
        sourceId: SOURCE_ID,
        canEdit: true,
        session: { doc, provider, isLoading: false },
        adapter,
      }),
    )

    doc.getMap('content').set('value', 'changed')
    await vi.advanceTimersByTimeAsync(NOTE_YJS_PERSIST_DEBOUNCE_MS)
    expect(events).toEqual(['flush', 'persist-start'])

    const cleanup = result.current.handleBeforeDestroy({
      noteId: NOTE_ID,
      sourceId: SOURCE_ID,
      provider,
    })
    await Promise.resolve()
    expect(events).toEqual(['flush', 'persist-start'])

    resolveProjection({ status: 'projected', throughSeq: 0 })
    await cleanup

    expect(events).toEqual(['flush', 'persist-start', 'flush', 'persist-cleanup'])
  })

  it('continues interval persistence after provider-backed persists complete', async () => {
    const doc = new Y.Doc()
    const provider = createProvider()
    const adapter = createAdapter()

    renderHook(() =>
      useNoteYjsPersistenceLifecycle({
        noteId: NOTE_ID,
        sourceId: SOURCE_ID,
        canEdit: true,
        session: { doc, provider, isLoading: false },
        adapter,
      }),
    )

    await vi.advanceTimersByTimeAsync(NOTE_YJS_PERSIST_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(NOTE_YJS_PERSIST_INTERVAL_MS)

    expect(adapter.persistNote).toHaveBeenCalledTimes(2)
  })

  it('projects a newer dirty watermark after an in-flight projection settles', async () => {
    const doc = new Y.Doc()
    const provider = createProvider()
    let resolveFirst!: (result: NoteProjectionResult) => void
    const firstProjection = new Promise<NoteProjectionResult>((resolve) => {
      resolveFirst = resolve
    })
    const adapter = createAdapter({
      persistNote: vi
        .fn()
        .mockReturnValueOnce(firstProjection)
        .mockReturnValue({ status: 'projected', throughSeq: 2 }),
    })

    renderHook(() =>
      useNoteYjsPersistenceLifecycle({
        noteId: NOTE_ID,
        sourceId: SOURCE_ID,
        canEdit: true,
        session: { doc, provider, isLoading: false },
        adapter,
      }),
    )

    doc.getMap('content').set('first', 'change')
    await vi.advanceTimersByTimeAsync(NOTE_YJS_PERSIST_DEBOUNCE_MS)
    expect(adapter.persistNote).toHaveBeenCalledTimes(1)

    doc.getMap('content').set('second', 'change')
    await vi.advanceTimersByTimeAsync(NOTE_YJS_PERSIST_DEBOUNCE_MS)
    expect(adapter.persistNote).toHaveBeenCalledTimes(1)

    resolveFirst({ status: 'projected', throughSeq: 1 })
    await vi.advanceTimersByTimeAsync(0)

    expect(adapter.persistNote).toHaveBeenCalledTimes(2)
  })

  it('does not persist debounced updates after cleanup stops the lifecycle', async () => {
    const doc = new Y.Doc()
    const provider = createProvider()
    const adapter = createAdapter()

    const { result } = renderHook(() =>
      useNoteYjsPersistenceLifecycle({
        noteId: NOTE_ID,
        sourceId: SOURCE_ID,
        canEdit: true,
        session: { doc, provider, isLoading: false },
        adapter,
      }),
    )

    doc.getMap('content').set('value', 'changed')
    await result.current.handleBeforeDestroy({
      noteId: NOTE_ID,
      sourceId: SOURCE_ID,
      provider,
    })
    doc.getMap('content').set('after-cleanup', 'changed')

    await vi.advanceTimersByTimeAsync(NOTE_YJS_PERSIST_DEBOUNCE_MS)

    expect(adapter.persistNote).toHaveBeenCalledOnce()
    expect(adapter.persistNote).toHaveBeenCalledWith(NOTE_ID, SOURCE_ID)
  })
})

type TestProvider = {
  isApplyingRemoteUpdate: boolean
}

function createProvider(overrides: Partial<TestProvider> = {}): TestProvider {
  return { isApplyingRemoteUpdate: false, ...overrides }
}

function createAdapter(
  overrides: Partial<{
    flushProvider: (provider: TestProvider, label: string) => Promise<boolean> | boolean
    persistNote: (
      noteId: SidebarItemId,
      sourceId: string,
    ) => Promise<NoteProjectionResult> | NoteProjectionResult
    reportError: (message: string, error?: unknown) => void
  }> = {},
) {
  const flushProvider = vi.fn(
    overrides.flushProvider ?? ((_provider: TestProvider, _label: string) => Promise.resolve(true)),
  )
  const persistNote = vi.fn(
    overrides.persistNote ??
      ((_noteId: SidebarItemId, _sourceId: string) =>
        Promise.resolve({ status: 'projected' as const, throughSeq: 0 })),
  )
  const reportError = vi.fn(overrides.reportError ?? ((_message: string, _error?: unknown) => {}))
  return {
    flushProvider,
    persistNote,
    reportError,
    isApplyingRemoteUpdate: (provider: TestProvider) => provider.isApplyingRemoteUpdate,
  }
}
