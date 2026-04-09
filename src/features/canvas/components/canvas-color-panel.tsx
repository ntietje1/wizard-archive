import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useOnSelectionChange } from '@xyflow/react'
import { CanvasContext } from '../utils/canvas-context'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { Node } from '@xyflow/react'
import { ColorPickerPopover } from '~/shared/components/color-picker-popover'
import { BASE_TEXT_COLORS } from '~/shared/utils/color'

interface CanvasColorPanelProps {
  canEdit: boolean
}

const COLOR_RELEVANT_TOOLS = new Set(['draw', 'rectangle'])

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

export function CanvasColorPanel({ canEdit }: CanvasColorPanelProps) {
  const { updateNodeData } = useContext(CanvasContext)
  const [selectedNodes, setSelectedNodes] = useState<Array<Node>>([])

  const activeTool = useCanvasToolStore((s) => s.activeTool)
  const strokeColor = useCanvasToolStore((s) => s.strokeColor)
  const strokeOpacity = useCanvasToolStore((s) => s.strokeOpacity)
  const setStrokeColor = useCanvasToolStore((s) => s.setStrokeColor)
  const setStrokeOpacity = useCanvasToolStore((s) => s.setStrokeOpacity)

  useOnSelectionChange({
    onChange: ({ nodes }) => setSelectedNodes(nodes),
  })

  const colorRelevantNodes = useMemo(
    () => selectedNodes.filter((n) => !!n.data?.color),
    [selectedNodes],
  )
  const isToolRelevant = COLOR_RELEVANT_TOOLS.has(activeTool)
  const hasColorSelection = colorRelevantNodes.length > 0

  const pendingUpdate = useRef<{
    data: Record<string, unknown>
    nodeIds: Array<string>
  } | null>(null)
  const rafId = useRef(0)

  const flushNodeUpdates = useCallback(() => {
    const pending = pendingUpdate.current
    if (!pending) return
    pendingUpdate.current = null
    for (const nodeId of pending.nodeIds) {
      updateNodeData(nodeId, pending.data)
    }
  }, [updateNodeData])

  const scheduleNodeUpdate = useCallback(
    (data: Record<string, unknown>) => {
      pendingUpdate.current = {
        data: { ...pendingUpdate.current?.data, ...data },
        nodeIds: colorRelevantNodes.map((n) => n.id),
      }
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = 0
          flushNodeUpdates()
        })
      }
    },
    [flushNodeUpdates, colorRelevantNodes],
  )

  const activeColor = hasColorSelection ? getSelectionColor(colorRelevantNodes) : strokeColor

  const activeOpacity = hasColorSelection
    ? (getSelectionOpacity(colorRelevantNodes) ?? strokeOpacity)
    : strokeOpacity

  const handleColorChange = useCallback(
    (color: string) => {
      setStrokeColor(color)
      if (hasColorSelection) scheduleNodeUpdate({ color })
    },
    [setStrokeColor, scheduleNodeUpdate, hasColorSelection],
  )

  const handleOpacityChange = useCallback(
    (opacity: number) => {
      setStrokeOpacity(opacity)
      if (hasColorSelection) scheduleNodeUpdate({ opacity })
    },
    [setStrokeOpacity, scheduleNodeUpdate, hasColorSelection],
  )

  useEffect(() => {
    if (!hasColorSelection) return
    const color = getSelectionColor(colorRelevantNodes)
    if (color) setStrokeColor(color)
    const opacity = getSelectionOpacity(colorRelevantNodes)
    if (opacity !== null) setStrokeOpacity(opacity)
  }, [hasColorSelection, colorRelevantNodes, setStrokeColor, setStrokeOpacity])

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  if (!canEdit || (!isToolRelevant && !hasColorSelection)) return null

  const displayColor = activeColor ?? strokeColor

  return (
    <div className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm border rounded-lg p-2 shadow-sm flex items-center gap-1">
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
  if (colors.size === 1) return colors.values().next().value!
  return null
}

function getSelectionOpacity(nodes: Array<Node>): number | null {
  const opacities = new Set<number>()
  for (const node of nodes) {
    opacities.add((node.data?.opacity as number) ?? 100)
  }
  if (opacities.size === 1) return opacities.values().next().value!
  return null
}
