import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as Y from 'yjs'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { EmbeddedCanvasState } from './embedded-state-contract'
import { yMapToArray } from './utils/canvas-yjs-utils'
import type { CanvasDocumentEdge, CanvasDocumentNode } from './document-contract'

interface EmbeddedCanvasUpdate {
  revision: number
  seq: number
  update: ArrayBuffer | Uint8Array
}

interface EmbeddedCanvasUpdateState {
  data: ReadonlyArray<EmbeddedCanvasUpdate> | undefined
  isError: boolean
}

type EmbeddedCanvasUpdateSource = (input: {
  afterSeq: number | undefined
  canvasId: SidebarItemId
}) => EmbeddedCanvasUpdateState

interface EmbeddedCanvasCursor {
  afterSeq: number | undefined
  canvasId: SidebarItemId
  initialLoadComplete: boolean
  revision: number
}

export function useEmbeddedCanvasStateFromUpdates({
  canvasId,
  useUpdates,
}: {
  canvasId: SidebarItemId
  useUpdates: EmbeddedCanvasUpdateSource
}): EmbeddedCanvasState {
  const [cursor, setCursor] = useState<EmbeddedCanvasCursor>(() => createInitialCursor(canvasId))
  const activeCursor = cursor.canvasId === canvasId ? cursor : createInitialCursor(canvasId)
  const doc = useMemo(createEmbeddedCanvasDoc, [canvasId, activeCursor.revision])
  const lastAppliedSeqRef = useRef({ canvasId, revision: activeCursor.revision, seq: -1 })
  if (
    lastAppliedSeqRef.current.canvasId !== canvasId ||
    lastAppliedSeqRef.current.revision !== activeCursor.revision
  ) {
    lastAppliedSeqRef.current = { canvasId, revision: activeCursor.revision, seq: -1 }
  }

  useEffect(() => {
    setCursorIfChanged(setCursor, createInitialCursor(canvasId))
  }, [canvasId])

  useEffect(() => {
    return () => doc.destroy()
  }, [doc])

  const updatesResult = useUpdates({ canvasId, afterSeq: activeCursor.afterSeq })

  useEffect(() => {
    if (!updatesResult.data) {
      return
    }

    const revision = updatesResult.data[0]?.revision
    if (revision !== undefined && revision !== activeCursor.revision) {
      setCursorIfChanged(setCursor, {
        afterSeq: undefined,
        canvasId,
        initialLoadComplete: false,
        revision,
      })
      return
    }

    for (const entry of updatesResult.data) {
      if (entry.seq > lastAppliedSeqRef.current.seq) {
        Y.applyUpdate(doc, toUint8Array(entry.update))
        lastAppliedSeqRef.current = { canvasId, revision: activeCursor.revision, seq: entry.seq }
      }
    }

    if (updatesResult.data.length > 0) {
      setCursorIfChanged(setCursor, {
        canvasId,
        afterSeq: lastAppliedSeqRef.current.seq,
        initialLoadComplete: false,
        revision: activeCursor.revision,
      })
      return
    }

    setCursorIfChanged(setCursor, {
      ...activeCursor,
      canvasId,
      initialLoadComplete: true,
    })
  }, [activeCursor, canvasId, doc, updatesResult.data])

  const nodes = useYMapAsArray<CanvasDocumentNode>(doc, 'nodes')
  const edges = useYMapAsArray<CanvasDocumentEdge>(doc, 'edges')

  const status = resolveEmbeddedCanvasStatus(activeCursor, updatesResult)
  if (status !== 'available') return { status }
  return { status, nodes, edges }
}

function resolveEmbeddedCanvasStatus(
  activeCursor: EmbeddedCanvasCursor,
  updatesResult: EmbeddedCanvasUpdateState,
): EmbeddedCanvasState['status'] {
  if (updatesResult.isError) return 'unavailable'
  return activeCursor.initialLoadComplete ? 'available' : 'loading'
}

function createInitialCursor(canvasId: SidebarItemId): EmbeddedCanvasCursor {
  return {
    afterSeq: undefined,
    canvasId,
    initialLoadComplete: false,
    revision: 0,
  }
}

function setCursorIfChanged(
  setCursor: (update: (previous: EmbeddedCanvasCursor) => EmbeddedCanvasCursor) => void,
  next: EmbeddedCanvasCursor,
) {
  setCursor((previous) => (cursorsEqual(previous, next) ? previous : next))
}

function cursorsEqual(left: EmbeddedCanvasCursor, right: EmbeddedCanvasCursor) {
  return (
    left.canvasId === right.canvasId &&
    left.afterSeq === right.afterSeq &&
    left.initialLoadComplete === right.initialLoadComplete &&
    left.revision === right.revision
  )
}

function useYMapAsArray<T>(doc: Y.Doc, mapName: string): Array<T> {
  const map = useMemo(() => doc.getMap<T>(mapName), [doc, mapName])
  const snapshotRef = useRef<{ map: Y.Map<T> | null; value: Array<T> }>({
    map: null,
    value: [],
  })

  if (snapshotRef.current.map !== map) {
    snapshotRef.current = { map, value: yMapToArray(map) }
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const syncSnapshot = () => {
        const nextSnapshot = yMapToArray(map)
        if (arraysEqual(snapshotRef.current.value, nextSnapshot)) {
          return
        }

        snapshotRef.current = { map, value: nextSnapshot }
        onStoreChange()
      }

      syncSnapshot()
      map.observe(syncSnapshot)
      return () => map.unobserve(syncSnapshot)
    },
    [map],
  )
  const getSnapshot = useCallback(() => snapshotRef.current.value, [])

  return useSyncExternalStore(subscribe, getSnapshot)
}

function arraysEqual<T>(left: Array<T>, right: Array<T>) {
  return (
    left.length === right.length && left.every((value, index) => valuesEqual(value, right[index]))
  )
}

function valuesEqual(left: unknown, right: unknown) {
  return left === right
}

function toUint8Array(update: EmbeddedCanvasUpdate['update']): Uint8Array {
  return update instanceof Uint8Array ? update : new Uint8Array(update)
}

function createEmbeddedCanvasDoc() {
  return new Y.Doc()
}
