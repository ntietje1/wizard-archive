export type CanvasConnectionDraft = {
  source: string
  sourceHandle: string | null
  start: { x: number; y: number }
  current: { x: number; y: number }
}

export function CanvasConnectionLayer({ draft }: { draft: CanvasConnectionDraft | null }) {
  if (!draft) {
    return null
  }

  return (
    <path
      d={`M ${draft.start.x},${draft.start.y} L ${draft.current.x},${draft.current.y}`}
      fill="none"
      stroke="var(--primary)"
      strokeDasharray="6 6"
      strokeWidth={2}
      pointerEvents="none"
      data-testid="canvas-connection-preview"
    />
  )
}
