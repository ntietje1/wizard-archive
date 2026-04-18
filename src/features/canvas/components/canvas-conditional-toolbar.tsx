import { useState } from 'react'
import { useOnSelectionChange } from '@xyflow/react'
import { useCanvasNodeActions } from '../hooks/useCanvasContext'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { getCanvasConditionalToolbarState } from '../utils/canvas-toolbar-utils'
import type { Node } from '@xyflow/react'
import { Button } from '~/features/shadcn/components/button'
import { ColorPickerPopover } from '~/shared/components/color-picker-popover'
import { BASE_TEXT_COLORS } from '~/shared/utils/color'

interface CanvasConditionalToolbarProps {
  canEdit: boolean
}

const STROKE_SIZES = [2, 4, 8, 16]

const COLOR_NAMES: Record<string, string> = {
  'var(--foreground)': 'Default',
  'var(--t-red)': 'Red',
  'var(--t-orange)': 'Orange',
  'var(--t-yellow)': 'Yellow',
  'var(--t-green)': 'Green',
  'var(--t-blue)': 'Blue',
  'var(--t-purple)': 'Purple',
  'var(--t-pink)': 'Pink',
}

export function CanvasConditionalToolbar({ canEdit }: CanvasConditionalToolbarProps) {
  const { updateNodeData } = useCanvasNodeActions()
  const [selectedNodes, setSelectedNodes] = useState<Array<Node>>([])

  const activeTool = useCanvasToolStore((s) => s.activeTool)
  const strokeColor = useCanvasToolStore((s) => s.strokeColor)
  const strokeOpacity = useCanvasToolStore((s) => s.strokeOpacity)
  const strokeSize = useCanvasToolStore((s) => s.strokeSize)
  const setStrokeColor = useCanvasToolStore((s) => s.setStrokeColor)
  const setStrokeOpacity = useCanvasToolStore((s) => s.setStrokeOpacity)
  const setStrokeSize = useCanvasToolStore((s) => s.setStrokeSize)

  useOnSelectionChange({
    onChange: ({ nodes }) => setSelectedNodes(nodes),
  })

  const toolbarState = getCanvasConditionalToolbarState(activeTool, selectedNodes)

  if (!canEdit || toolbarState.kind === 'hidden') return null

  const selectedNode = toolbarState.kind === 'selection' ? toolbarState.node : null
  const activeColor = (selectedNode?.data?.color as string | undefined) ?? strokeColor
  const activeOpacity = (selectedNode?.data?.opacity as number | undefined) ?? strokeOpacity

  const handleColorChange = (color: string) => {
    setStrokeColor(color)
    if (selectedNode) {
      updateNodeData(selectedNode.id, { color })
    }
  }

  const handleOpacityChange = (opacity: number) => {
    setStrokeOpacity(opacity)
    if (selectedNode) {
      updateNodeData(selectedNode.id, { opacity })
    }
  }
  
  return (
    <div
      className="absolute top-4 left-4 z-10 flex items-center gap-1 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-sm"
      role="toolbar"
      aria-label="Canvas conditional toolbar"
    >
      {BASE_TEXT_COLORS.map((color) => (
        <button
          type="button"
          key={color}
          className="h-6 w-6 rounded-sm border border-border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          style={{
            backgroundColor: color,
            outline: activeColor === color ? '2px solid var(--primary)' : 'none',
            outlineOffset: '1px',
          }}
          onClick={() => handleColorChange(color)}
          aria-label={`Select ${COLOR_NAMES[color] ?? 'custom'} color`}
          aria-pressed={activeColor === color}
        />
      ))}
      <div className="mx-1 h-6 w-px bg-border" />
      <ColorPickerPopover
        value={activeColor}
        onChange={handleColorChange}
        opacity={activeOpacity}
        onOpacityChange={handleOpacityChange}
      />
      {toolbarState.kind === 'tool' && toolbarState.tool === 'draw' && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          <div className="flex items-center gap-0.5">
            {STROKE_SIZES.map((size) => (
              <Button
                key={size}
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${strokeSize === size ? 'bg-accent' : ''}`}
                onClick={() => setStrokeSize(size)}
                aria-label={`Stroke size ${size}`}
                title={`Size ${size}`}
              >
                <div className="rounded-full bg-foreground" style={{ width: size, height: size }} />
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
