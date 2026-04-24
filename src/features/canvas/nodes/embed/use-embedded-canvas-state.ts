import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { api } from 'convex/_generated/api'
import { parseEmbeddedCanvasStableId } from 'convex/canvases/validation'
import * as Y from 'yjs'
import { yMapToArray } from '../../utils/canvas-yjs-utils'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node } from '@xyflow/react'

export { parseEmbeddedCanvasStableId } from 'convex/canvases/validation'

function useYMapAsArray<T>(doc: Y.Doc, mapName: string): Array<T> {
  const snapshotRef = useRef<Array<T>>([])

  return useSyncExternalStore(
    (onStoreChange) => {
      const map = doc.getMap<T>(mapName)
      const syncSnapshot = () => {
        const nextSnapshot = yMapToArray(map)
        if (arraysEqual(snapshotRef.current, nextSnapshot)) {
          return
        }

        snapshotRef.current = nextSnapshot
        onStoreChange()
      }

      syncSnapshot()
      map.observe(syncSnapshot)
      return () => map.unobserve(syncSnapshot)
    },
    () => snapshotRef.current,
  )
}

export function useEmbeddedCanvasState(canvasId: Id<'sidebarItems'>) {
  const doc = useMemo(() => createEmbeddedCanvasDoc(canvasId), [canvasId])
  const [afterSeq, setAfterSeq] = useState<number | undefined>(undefined)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const lastAppliedSeqRef = useRef(-1)

  useEffect(() => {
    lastAppliedSeqRef.current = -1
    setAfterSeq(undefined)
    setInitialLoadComplete(false)
  }, [canvasId])

  useEffect(() => {
    return () => doc.destroy()
  }, [doc])

  const updatesResult = useCampaignQuery(api.yjsSync.queries.getUpdates, {
    documentId: canvasId,
    afterSeq,
  })

  useEffect(() => {
    if (!updatesResult.data) {
      return
    }

    for (const entry of updatesResult.data) {
      if (entry.seq > lastAppliedSeqRef.current) {
        Y.applyUpdate(doc, new Uint8Array(entry.update))
        lastAppliedSeqRef.current = entry.seq
      }
    }

    if (updatesResult.data.length > 0) {
      setAfterSeq(lastAppliedSeqRef.current)
      return
    }

    setInitialLoadComplete(true)
  }, [doc, updatesResult.data])

  const nodes = useYMapAsArray<Node>(doc, 'nodes')
  const edges = useYMapAsArray<Edge>(doc, 'edges')

  return {
    nodes,
    edges,
    isLoading: !initialLoadComplete && !updatesResult.isError,
    isError: updatesResult.isError,
  }
}

function arraysEqual<T>(left: Array<T>, right: Array<T>) {
  return (
    left.length === right.length && left.every((value, index) => valuesEqual(value, right[index]))
  )
}

function valuesEqual(left: unknown, right: unknown) {
  if (left === right) {
    return true
  }

  const leftId = parseEmbeddedCanvasStableId(left)
  return leftId !== undefined && leftId === parseEmbeddedCanvasStableId(right)
}
function createEmbeddedCanvasDoc(_canvasId: Id<'sidebarItems'>) {
  return new Y.Doc()
}
