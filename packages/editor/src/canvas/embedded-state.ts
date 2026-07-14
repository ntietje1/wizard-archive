import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as Y from 'yjs'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { EmbeddedCanvasState } from './embedded-state-contract'
import { yMapToArray } from './utils/canvas-yjs-utils'
import { parseCanvasDocumentEdge, parseCanvasDocumentNode } from './document-contract'

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

  const nodes = useYMapAsArray(doc, 'nodes', parseCanvasDocumentNode)
  const edges = useYMapAsArray(doc, 'edges', parseCanvasDocumentEdge)

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

function useYMapAsArray<T>(
  doc: Y.Doc,
  mapName: string,
  parseValue: (value: unknown) => T | null,
): Array<T> {
  const map = doc.getMap<unknown>(mapName)
  const getSnapshot = () => getYMapArraySnapshot(map, parseValue)
  const subscribe = (onStoreChange: () => void) => {
    map.observe(onStoreChange)
    return () => map.unobserve(onStoreChange)
  }

  return useSyncExternalStore(subscribe, getSnapshot)
}

const yMapArraySnapshots = new WeakMap<
  Y.Map<unknown>,
  { source: Array<unknown>; value: Array<unknown> }
>()

function getYMapArraySnapshot<T>(map: Y.Map<unknown>, parseValue: (value: unknown) => T | null) {
  const source = yMapToArray(map)
  const cached = yMapArraySnapshots.get(map) as
    | { source: Array<unknown>; value: Array<T> }
    | undefined
  if (cached && arraysEqual(cached.source, source)) return cached.value
  const snapshot = parseYMapValues(source, parseValue)
  yMapArraySnapshots.set(map, { source, value: snapshot })
  return snapshot
}

function parseYMapValues<T>(values: Array<unknown>, parseValue: (value: unknown) => T | null) {
  return values.flatMap((value) => {
    const parsed = parseValue(value)
    return parsed ? [parsed] : []
  })
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
