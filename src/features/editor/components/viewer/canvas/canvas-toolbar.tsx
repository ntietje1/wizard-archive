import { useReactFlow } from '@xyflow/react'
import { Maximize2, Minus, Plus, StickyNote, Type } from 'lucide-react'
import { STICKY_COLOR_COUNT } from './nodes/stick-node-colors'
import type { Node } from '@xyflow/react'
import type * as Y from 'yjs'
import { Button } from '~/features/shadcn/components/button'

interface CanvasToolbarProps {
  nodesMap: Y.Map<Node>
  canEdit: boolean
}

export function CanvasToolbar({ nodesMap, canEdit }: CanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  const addNode = (type: 'text' | 'sticky') => {
    const id = crypto.randomUUID()
    const position = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 400 + 100,
    }

    const node: Node = {
      id,
      type,
      position,
      data: {
        label: type === 'text' ? 'New text' : '',
        ...(type === 'sticky'
          ? { colorIndex: Math.floor(Math.random() * STICKY_COLOR_COUNT) }
          : {}),
      },
    }

    nodesMap.set(id, node)
  }

  return (
    <div className="absolute top-4 left-4 z-10 flex gap-1 bg-background/80 backdrop-blur-sm border rounded-lg p-1 shadow-sm">
      {canEdit && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => addNode('text')}
            aria-label="Add text node"
            title="Add text node"
          >
            <Type className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => addNode('sticky')}
            aria-label="Add sticky note"
            title="Add sticky note"
          >
            <StickyNote className="h-4 w-4" />
          </Button>
          <div className="w-px bg-border mx-1" />
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => zoomIn()}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => zoomOut()}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => fitView()}
        aria-label="Fit view"
        title="Fit view"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
