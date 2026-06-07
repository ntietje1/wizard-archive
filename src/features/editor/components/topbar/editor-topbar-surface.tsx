import type { ReactNode } from 'react'

interface EditorTopbarSurfaceProps {
  middleContent?: ReactNode
  timestampControl?: ReactNode
  title: ReactNode
}

export function EditorTopbarSurface({
  middleContent = null,
  timestampControl = null,
  title,
}: EditorTopbarSurfaceProps) {
  return (
    <div className="flex items-center py-0.5 pl-3 pr-1 shrink-0 w-full min-w-0 overflow-hidden gap-4 border-b">
      <div className="flex-1 min-w-0">{title}</div>
      {timestampControl}
      {middleContent}
    </div>
  )
}
