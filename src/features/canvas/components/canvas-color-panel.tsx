import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useOnSelectionChange } from '@xyflow/react'
import { CanvasContext } from '../utils/canvas-context'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { Node } from '@xyflow/react'
import { ColorPickerPopover } from '~/shared/components/color-picker-popover'
import { BASE_TEXT_COLORS } from '~/shared/utils/color'

interface CanvasColorPanelProps {
  canEdit: boolean
}

export function CanvasColorPanel({ canEdit }: CanvasColorPanelProps) {
  const { updateNodeData } = useContext(CanvasContext)
  const [selectedNodes, setSelectedNodes] = useState<Array<Node>>([])

  const strokeColor = useCanvasToolStore((s) => s.strokeColor)
  const strokeOpacity = useCanvasToolStore((s) => s.strokeOpacity)
  const setStrokeColor = useCanvasToolStore((s) => s.setStrokeColor)
  const setStrokeOpacity = useCanvasToolStore((s) => s.setStrokeOpacity)

  const pendingUpdate = useRef<Record<string, unknown> | null>(null)
  const rafId = useRef(0)
  const selectedNodesRef = useRef(selectedNodes)
  selectedNodesRef.current = selectedNodes

  const flushNodeUpdates = useCallback(() => {
    const data = pendingUpdate.current
    if (!data) return
    pendingUpdate.current = null
    for (const node of selectedNodesRef.current) {
      updateNodeData(node.id, data)
    }
  }, [updateNodeData])

  const scheduleNodeUpdate = useCallback(
    (data: Record<string, unknown>) => {
      pendingUpdate.current = { ...pendingUpdate.current, ...data }
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = 0
          flushNodeUpdates()
        })
      }
    },
    [flushNodeUpdates],
  )

  useOnSelectionChange({
    onChange: ({ nodes }) => setSelectedNodes(nodes),
  })

  const hasSelection = selectedNodes.length > 0

  const activeColor = hasSelection
    ? getSelectionColor(selectedNodes)
    : strokeColor

  const activeOpacity = hasSelection
    ? getSelectionOpacity(selectedNodes)
    : strokeOpacity

  const handleColorChange = useCallback(
    (color: string) => {
      setStrokeColor(color)
      scheduleNodeUpdate({ color })
    },
    [setStrokeColor, scheduleNodeUpdate],
  )

  const handleOpacityChange = useCallback(
    (opacity: number) => {
      setStrokeOpacity(opacity)
      scheduleNodeUpdate({ opacity })
    },
    [setStrokeOpacity, scheduleNodeUpdate],
  )

  useEffect(() => {
    if (!hasSelection) return
    const color = getSelectionColor(selectedNodes)
    if (color) setStrokeColor(color)
    const opacity = getSelectionOpacity(selectedNodes)
    setStrokeOpacity(opacity)
  }, [hasSelection, selectedNodes, setStrokeColor, setStrokeOpacity])

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  if (!canEdit) return null

  const displayColor = activeColor ?? strokeColor

  return (
    <div className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm border rounded-lg p-2 shadow-sm flex items-center gap-1">
      {BASE_TEXT_COLORS.map((color) => (
        <button
          key={color}
          className="h-6 w-6 rounded-sm border border-border transition-transform hover:scale-110"
          style={{
            backgroundColor: color,
            outline:
              activeColor === color ? '2px solid var(--primary)' : 'none',
            outlineOffset: '1px',
          }}
          onClick={() => handleColorChange(color)}
          aria-label={`Color ${color}`}
        />
      ))}
      <div className="w-px h-6 bg-border mx-1" />
      <ColorPickerPopover
        value={displayColor}
        onChange={handleColorChange}
        opacity={activeOpacity}
        onOpacityChange={handleOpacityChange}
      />
    </div>
  )
}

function getSelectionColor(nodes: Array<Node>): string | null {
  const colors = new Set<string>()
  for (const node of nodes) {
    const color = node.data?.color as string | undefined
    if (color) colors.add(color)
  }
  if (colors.size === 1) return [...colors][0]
  return null
}

function getSelectionOpacity(nodes: Array<Node>): number {
  const opacities = new Set<number>()
  for (const node of nodes) {
    opacities.add((node.data?.opacity as number) ?? 100)
  }
  if (opacities.size === 1) return [...opacities][0]
  return 100
}
