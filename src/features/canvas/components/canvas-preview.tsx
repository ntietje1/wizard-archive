import { useEffect, useSyncExternalStore, useState, useRef } from 'react'
import { api } from 'convex/_generated/api'
import * as Y from 'yjs'
import { renderCanvasNodePreview } from './nodes/canvas-node-registry'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node } from '@xyflow/react'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { LoadingSpinner } from '~/shared/components/loading-spinner'

const DEFAULT_NODE_WIDTH = 150
const DEFAULT_NODE_HEIGHT = 40

function getNodeDimensions(node: Node): { w: number; h: number } {
  const bounds = (node.data as { bounds?: { width: number; height: number } }).bounds
  return {
    w: node.width ?? bounds?.width ?? DEFAULT_NODE_WIDTH,
    h: node.height ?? bounds?.height ?? DEFAULT_NODE_HEIGHT,
  }
}

export function CanvasPreview({ canvasId }: { canvasId: Id<'sidebarItems'> }) {
  const { nodes, edges, isLoading, isError } = useReadOnlyYjsCanvas(canvasId)

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <LoadingSpinner size="sm" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
        Failed to load canvas
      </div>
    )
  }

  return (
    <div className="h-full w-full pointer-events-none overflow-hidden bg-background">
      <StaticCanvasRenderer nodes={nodes} edges={edges} />
    </div>
  )
}

function StaticCanvasRenderer({ nodes, edges }: { nodes: Array<Node>; edges: Array<Edge> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      if (entry) {
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  if (nodes.length === 0) {
    return <div ref={containerRef} className="h-full w-full" />
  }

  const bounds = getNodesBounds(nodes)
  const padding = 20
  const ready = size && bounds

  let scale = 1
  let offsetX = 0
  let offsetY = 0

  if (ready) {
    const bw = bounds.maxX - bounds.minX + padding * 2
    const bh = bounds.maxY - bounds.minY + padding * 2
    scale = Math.min(size.w / bw, size.h / bh, 1)
    offsetX = (size.w - bw * scale) / 2 - (bounds.minX - padding) * scale
    offsetY = (size.h - bh * scale) / 2 - (bounds.minY - padding) * scale
  }

  const nodePositions = new Map<string, { cx: number; cy: number; w: number; h: number }>()
  for (const node of nodes) {
    const { w, h } = getNodeDimensions(node)
    nodePositions.set(node.id, {
      cx: node.position.x + w / 2,
      cy: node.position.y + h / 2,
      w,
      h,
    })
  }

  return (
    <div ref={containerRef} className="h-full w-full relative">
      {!ready ? null : (
        <>
          <svg
            className="absolute pointer-events-none"
            width="100%"
            height="100%"
            overflow="visible"
            style={{
              transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {edges.map((edge) => {
              const src = nodePositions.get(edge.source)
              const tgt = nodePositions.get(edge.target)
              if (!src || !tgt) return null
              return (
                <line
                  key={edge.id}
                  x1={src.cx}
                  y1={src.cy}
                  x2={tgt.cx}
                  y2={tgt.cy}
                  stroke="var(--border)"
                  strokeWidth={1.5}
                />
              )
            })}
          </svg>
          <div
            className="absolute origin-top-left"
            style={{
              transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
            }}
          >
            {nodes.map((node) => (
              <StaticNode key={node.id} node={node} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StaticNode({ node }: { node: Node }) {
  const { position, type, data } = node
  const { w, h } = getNodeDimensions(node)

  const content = renderNodePreview(type, data, w, h)
  if (!content) return null

  return (
    <div className="absolute" style={{ left: position.x, top: position.y, width: w, height: h }}>
      {content}
    </div>
  )
}

function renderNodePreview(
  type: string | undefined,
  data: Record<string, unknown>,
  w: number,
  h: number,
): React.ReactNode {
  return renderCanvasNodePreview(type, data, { width: w, height: h })
}

function getNodesBounds(nodes: Array<Node>) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const { w, h } = getNodeDimensions(node)
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + w)
    maxY = Math.max(maxY, node.position.y + h)
  }

  if (!isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

function yMapToArray<T>(map: Y.Map<T>): Array<T> {
  const items: Array<T> = []
  map.forEach((value) => items.push(value))
  return items
}

function useYMapAsArray<T>(doc: Y.Doc, mapName: string): Array<T> {
  const snapshotRef = useRef<Array<T>>(yMapToArray(doc.getMap<T>(mapName)))

  return useSyncExternalStore(
    (cb) => {
      const map = doc.getMap<T>(mapName)
      const onChange = () => {
        snapshotRef.current = yMapToArray(map)
        cb()
      }
      map.observe(onChange)
      return () => map.unobserve(onChange)
    },
    () => snapshotRef.current,
  )
}

function useReadOnlyYjsCanvas(canvasId: Id<'sidebarItems'>) {
  const [doc] = useState(() => new Y.Doc())
  const [afterSeq, setAfterSeq] = useState<number | undefined>(undefined)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const lastAppliedSeqRef = useRef(-1)

  useEffect(() => () => doc.destroy(), [doc])

  const updatesResult = useCampaignQuery(api.yjsSync.queries.getUpdates, {
    documentId: canvasId,
    afterSeq,
  })

  const isError = updatesResult.isError
  const isLoading = !initialLoadComplete && !isError

  useEffect(() => {
    if (!updatesResult.data) return

    for (const entry of updatesResult.data) {
      if (entry.seq > lastAppliedSeqRef.current) {
        Y.applyUpdate(doc, new Uint8Array(entry.update))
        lastAppliedSeqRef.current = entry.seq
      }
    }

    if (updatesResult.data.length > 0) {
      setAfterSeq(lastAppliedSeqRef.current)
    } else {
      setInitialLoadComplete(true)
    }
  }, [updatesResult.data, doc])

  const nodes = useYMapAsArray<Node>(doc, 'nodes')
  const edges = useYMapAsArray<Edge>(doc, 'edges')

  return { nodes, edges, isLoading, isError }
}
