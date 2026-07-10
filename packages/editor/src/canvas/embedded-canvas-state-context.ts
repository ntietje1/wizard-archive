import { createContext, createElement, use } from 'react'
import type { ReactNode } from 'react'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { EmbeddedCanvasState } from './embedded-state-contract'

export type EmbeddedCanvasStateSource = {
  useEmbeddedCanvasState: (canvasId: SidebarItemId) => EmbeddedCanvasState
}

const EmbeddedCanvasStateSourceContext = createContext<EmbeddedCanvasStateSource | null>(null)

export function EmbeddedCanvasStateProvider({
  children,
  source,
}: {
  children: ReactNode
  source: EmbeddedCanvasStateSource
}) {
  return createElement(EmbeddedCanvasStateSourceContext.Provider, { value: source }, children)
}

export function useEmbeddedCanvasState(canvasId: SidebarItemId) {
  const source = use(EmbeddedCanvasStateSourceContext)
  if (!source) {
    throw new Error('Embedded canvas state source is unavailable')
  }
  return source.useEmbeddedCanvasState(canvasId)
}
