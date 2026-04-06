import { useEffect, useRef, useState } from 'react'
import { api } from 'convex/_generated/api'
import * as Y from 'yjs'
import { StrokePreview } from '../stroke-node'
import { TextPreview } from '../text-node'
import { StickyPreview } from '../sticky-node'
import { RectanglePreview } from '../rectangle-node'
import type { Id } from 'convex/_generated/dataModel'
import type { Node } from '@xyflow/react'
import type { StrokeNodeData } from '../stroke-node'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { LoadingSpinner } from '~/shared/components/loading-spinner'

export function EmbedCanvasContent({ canvasId }: { canvasId: Id<'canvases'> }) {
  const { nodes, isLoading } = useReadOnlyYjsCanvas(canvasId)

  if (isLoading) {
    return (
      <div className="nodrag nopan nowheel h-full w-full flex items-center justify-center">
        <LoadingSpinner size="sm" />
      </div>
    )
  }

  return (
    <div className="nodrag nopan nowheel h-full w-full pointer-events-none overflow-hidden bg-background">
      <StaticCanvasRenderer nodes={nodes} />
    </div>
  )
}

function StaticCanvasRenderer({ nodes }: { nodes: Array<Node> }) {
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

  let scale = 1
  let offsetX = 0
  let offsetY = 0

  if (size && bounds) {
    const bw = bounds.maxX - bounds.minX + padding * 2
    const bh = bounds.maxY - bounds.minY + padding * 2
    scale = Math.min(size.w / bw, size.h / bh, 1)
    offsetX = (size.w - bw * scale) / 2 - (bounds.minX - padding) * scale
    offsetY = (size.h - bh * scale) / 2 - (bounds.minY - padding) * scale
  }

  return (
    <div ref={containerRef} className="h-full w-full relative">
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
    </div>
  )
}

function StaticNode({ node }: { node: Node }) {
  const { position, width, height, type, data } = node
  const bounds = (data as { bounds?: { width: number; height: number } }).bounds
  const w = width ?? bounds?.width ?? 150
  const h = height ?? bounds?.height ?? 40

  const content = renderNodePreview(type, data, w, h)
  if (!content) return null

  return (
    <div
      className="absolute"
      style={{ left: position.x, top: position.y, width: w, height: h }}
    >
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
  switch (type) {
    case 'stroke': {
      const d = data as unknown as StrokeNodeData
      return <StrokePreview data={d} width={w} height={h} />
    }
    case 'text':
      return <TextPreview label={(data.label as string) ?? ''} />
    case 'sticky':
      return (
        <StickyPreview
          label={(data.label as string) ?? ''}
          color={(data.color as string) ?? ''}
          opacity={data.opacity as number | undefined}
        />
      )
    case 'rectangle':
      return (
        <RectanglePreview
          color={(data.color as string) ?? 'transparent'}
          opacity={data.opacity as number | undefined}
        />
      )
    case 'embed':
      return (
        <div className="h-full w-full rounded-lg border bg-card shadow-sm px-3 py-2 text-sm text-muted-foreground">
          Embedded item
        </div>
      )
    default:
      return null
  }
}

function getNodesBounds(nodes: Array<Node>) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const bounds = (node.data as { bounds?: { width: number; height: number } })
      .bounds
    const w = node.width ?? bounds?.width ?? 150
    const h = node.height ?? bounds?.height ?? 40
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

function useReadOnlyYjsCanvas(canvasId: Id<'canvases'>) {
  const [doc, setDoc] = useState<Y.Doc | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [nodes, setNodes] = useState<Array<Node>>([])
  const [afterSeq, setAfterSeq] = useState<number | undefined>(undefined)
  const lastAppliedSeqRef = useRef(-1)

  useEffect(() => {
    setIsLoading(true)
    setAfterSeq(undefined)
    lastAppliedSeqRef.current = -1

    const d = new Y.Doc()
    setDoc(d)

    return () => {
      d.destroy()
      setDoc(null)
    }
  }, [canvasId])

  const updatesResult = useAuthQuery(api.yjsSync.queries.getUpdates, {
    documentId: canvasId,
    afterSeq,
  })

  useEffect(() => {
    if (!updatesResult.data || !doc) return

    for (const entry of updatesResult.data) {
      if (entry.seq > lastAppliedSeqRef.current) {
        Y.applyUpdate(doc, new Uint8Array(entry.update))
        lastAppliedSeqRef.current = entry.seq
      }
    }

    if (updatesResult.data.length > 0) {
      setAfterSeq(lastAppliedSeqRef.current)
    }

    const nodesMap = doc.getMap<Node>('nodes')
    setNodes(yMapToArray(nodesMap))

    if (isLoading) setIsLoading(false)
  }, [updatesResult.data, doc])

  useEffect(() => {
    if (!doc) return

    const nodesMap = doc.getMap<Node>('nodes')
    const onChange = () => setNodes(yMapToArray(nodesMap))
    nodesMap.observe(onChange)
    return () => nodesMap.unobserve(onChange)
  }, [doc])

  return { nodes, isLoading }
}
