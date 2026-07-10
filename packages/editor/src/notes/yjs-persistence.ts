import { useEffect, useRef } from 'react'
import type { Doc } from 'yjs'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { NoteProjectionResult } from '../../../../shared/yjs-sync/note-projection'
import { NOTE_YJS_PERSIST_DEBOUNCE_MS, NOTE_YJS_PERSIST_INTERVAL_MS } from './session-timing'

type NoteYjsPersistenceSession<Provider> = {
  doc: Doc | null
  provider: Provider | null
  isLoading: boolean
}

type NoteYjsBeforeDestroyState<Provider> = {
  noteId: SidebarItemId
  sourceId: string
  provider: Provider
}

type NoteYjsPersistenceAdapter<Provider> = {
  flushProvider: (provider: Provider, label: string) => Promise<boolean> | boolean
  isApplyingRemoteUpdate: (provider: Provider) => boolean
  persistNote: (
    noteId: SidebarItemId,
    sourceId: string,
  ) => Promise<NoteProjectionResult> | NoteProjectionResult
  reportError: (message: string, error?: unknown) => void
}

type PersistFlushState =
  | { status: 'idle' }
  | { status: 'flushing'; targetWatermark: number; promise: Promise<void> }

type PersistLifecycle = {
  active: boolean
  timeoutId: ReturnType<typeof setTimeout> | null
  dirtyWatermark: number
  projectedWatermark: number
  flush: PersistFlushState
}

type UseNoteYjsPersistenceLifecycleOptions<Provider> = {
  noteId: SidebarItemId
  sourceId: string | null | undefined
  canEdit: boolean
  session: NoteYjsPersistenceSession<Provider>
  adapter: NoteYjsPersistenceAdapter<Provider>
}

export function useNoteYjsPersistenceLifecycle<Provider>({
  noteId,
  sourceId,
  canEdit,
  session,
  adapter,
}: UseNoteYjsPersistenceLifecycleOptions<Provider>) {
  const adapterRef = useRef(adapter)
  adapterRef.current = adapter

  const persistLifecyclesRef = useRef(new Map<string, PersistLifecycle>())
  const lifecycleKey = persistLifecycleKey(noteId, sourceId)
  let persistLifecycle = persistLifecyclesRef.current.get(lifecycleKey)
  if (!persistLifecycle) {
    persistLifecycle = createPersistLifecycle()
    persistLifecyclesRef.current.set(lifecycleKey, persistLifecycle)
  }

  const handleBeforeDestroy = async ({
    noteId: cleanupNoteId,
    sourceId: cleanupSourceId,
    provider,
  }: NoteYjsBeforeDestroyState<Provider>) => {
    const cleanupKey = persistLifecycleKey(cleanupNoteId, cleanupSourceId)
    const lifecycle = persistLifecyclesRef.current.get(cleanupKey)
    if (lifecycle) stopPersistLifecycle(lifecycle)

    try {
      if (!canEdit) {
        return
      }

      if (
        !(await adapterRef.current.flushProvider(provider, `cleanup persist for ${cleanupNoteId}`))
      ) {
        return
      }

      if (lifecycle?.flush.status === 'flushing') {
        try {
          await lifecycle.flush.promise
        } catch {
          // The active flush reports failures through the supplied adapter.
        }
      }

      try {
        const result = await adapterRef.current.persistNote(cleanupNoteId, cleanupSourceId)
        if (result.status === 'rejected') {
          adapterRef.current.reportError(
            `cleanup persist rejected for ${cleanupNoteId}: ${result.reason}`,
          )
        } else if (lifecycle) {
          lifecycle.projectedWatermark = lifecycle.dirtyWatermark
        }
      } catch (err: unknown) {
        adapterRef.current.reportError(`cleanup persist failed for ${cleanupNoteId}`, err)
      }
    } finally {
      persistLifecyclesRef.current.delete(cleanupKey)
    }
  }

  useEffect(() => {
    if (!canEdit || session.isLoading || !sourceId) return

    const activeSourceId = sourceId
    const lifecycle = persistLifecyclesRef.current.get(lifecycleKey)
    if (!lifecycle) return
    lifecycle.active = true

    const schedulePersist = (delay: number) => {
      lifecycle.timeoutId = setTimeout(persist, delay)
    }

    const persist = () => {
      lifecycle.timeoutId = null
      const started = runPersistCycle({
        lifecycle,
        adapter: adapterRef.current,
        provider: session.provider,
        noteId,
        sourceId: activeSourceId,
        label: `interval persist for ${noteId}`,
        errorMessage: `persist failed for ${noteId}`,
        onComplete: (hasNewerDirty) => {
          if (!lifecycle.active) return
          schedulePersist(hasNewerDirty ? 0 : NOTE_YJS_PERSIST_INTERVAL_MS)
        },
      })
      if (!started && lifecycle.active) {
        schedulePersist(NOTE_YJS_PERSIST_INTERVAL_MS)
      }
    }

    schedulePersist(NOTE_YJS_PERSIST_INTERVAL_MS)

    return () => {
      stopPersistLifecycle(lifecycle)
    }
  }, [noteId, canEdit, session.isLoading, sourceId, lifecycleKey, session.provider])

  useEffect(() => {
    if (!canEdit || session.isLoading || !sourceId || !session.doc || !session.provider) {
      return
    }

    const activeSourceId = sourceId
    const provider = session.provider
    const lifecycle = persistLifecyclesRef.current.get(lifecycleKey)
    if (!lifecycle) return
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let active = true

    const schedulePersist = (delay = NOTE_YJS_PERSIST_DEBOUNCE_MS) => {
      if (!active || !lifecycle.active) return
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        timeoutId = null
        if (!active || !lifecycle.active) return
        runPersist()
      }, delay)
    }

    const runPersist = () => {
      if (!active || !lifecycle.active) return
      runPersistCycle({
        lifecycle,
        adapter: adapterRef.current,
        provider,
        noteId,
        sourceId: activeSourceId,
        label: `persist note ${noteId}`,
        errorMessage: `Yjs note persist failed for ${noteId}`,
        onComplete: (hasNewerDirty) => {
          if (hasNewerDirty && active) schedulePersist(0)
        },
      })
    }

    const handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (!active || !lifecycle.active) return
      if (origin === provider && adapterRef.current.isApplyingRemoteUpdate(provider)) {
        return
      }
      lifecycle.dirtyWatermark += 1
      schedulePersist()
    }

    session.doc.on('update', handleDocUpdate)
    return () => {
      active = false
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      session.doc?.off('update', handleDocUpdate)
    }
  }, [sourceId, canEdit, lifecycleKey, noteId, session.doc, session.isLoading, session.provider])

  return { handleBeforeDestroy }
}

function createPersistLifecycle(): PersistLifecycle {
  return {
    active: false,
    timeoutId: null,
    dirtyWatermark: 0,
    projectedWatermark: 0,
    flush: { status: 'idle' },
  }
}

function stopPersistLifecycle(lifecycle: PersistLifecycle) {
  lifecycle.active = false
  if (lifecycle.timeoutId !== null) {
    clearTimeout(lifecycle.timeoutId)
    lifecycle.timeoutId = null
  }
}

function runPersistCycle<Provider>({
  lifecycle,
  adapter,
  provider,
  noteId,
  sourceId,
  label,
  errorMessage,
  onComplete,
}: {
  lifecycle: PersistLifecycle
  adapter: NoteYjsPersistenceAdapter<Provider>
  provider: Provider | null
  noteId: SidebarItemId
  sourceId: string
  label: string
  errorMessage: string
  onComplete: (hasNewerDirty: boolean) => void
}) {
  if (!lifecycle.active) return false

  if (lifecycle.flush.status === 'flushing') return false

  const targetWatermark = lifecycle.dirtyWatermark
  const promise = Promise.resolve().then(async () => {
    try {
      if (provider) {
        const flushed = await adapter.flushProvider(provider, label)
        if (!flushed) return
      }
      const result = await adapter.persistNote(noteId, sourceId)
      if (result.status === 'rejected') {
        adapter.reportError(`${errorMessage}: ${result.reason}`)
        return
      }
      lifecycle.projectedWatermark =
        lifecycle.flush.status === 'flushing' ? lifecycle.flush.targetWatermark : targetWatermark
    } catch (err: unknown) {
      adapter.reportError(errorMessage, err)
    } finally {
      lifecycle.flush = { status: 'idle' }
      onComplete(lifecycle.dirtyWatermark > Math.max(targetWatermark, lifecycle.projectedWatermark))
    }
  })
  lifecycle.flush = { status: 'flushing', targetWatermark, promise }
  return true
}

function persistLifecycleKey(noteId: SidebarItemId, sourceId: string | null | undefined) {
  return `${noteId}:${sourceId ?? ''}`
}
