import type { ResourceId } from '../resources/domain-id'
import { createContext, createElement, use } from 'react'
import type { ReactNode } from 'react'

import type { EmbeddedCanvasState } from './embedded-state-contract'

export type EmbeddedCanvasStateSource = {
  useEmbeddedCanvasState: (canvasId: ResourceId) => EmbeddedCanvasState
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

export function useEmbeddedCanvasState(canvasId: ResourceId) {
  const source = use(EmbeddedCanvasStateSourceContext)
  if (!source) {
    throw new Error('Embedded canvas state source is unavailable')
  }
  return source.useEmbeddedCanvasState(canvasId)
}
