import { createContext, createElement, use } from 'react'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'
import type { Id } from 'convex/_generated/dataModel'
import type { ComponentType, ReactNode } from 'react'

export type EmbeddedCanvasState = {
  nodes: ReadonlyArray<CanvasDocumentNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
  isLoading: boolean
  isError: boolean
}

export type EmbeddedCanvasStateResolverProps = {
  canvasId: Id<'sidebarItems'>
  children: (state: EmbeddedCanvasState) => ReactNode
}

export type EmbeddedCanvasStateResolver = ComponentType<EmbeddedCanvasStateResolverProps>

const UNAVAILABLE_EMBEDDED_CANVAS_STATE: EmbeddedCanvasState = {
  nodes: [],
  edges: [],
  isLoading: false,
  isError: true,
}

const DefaultEmbeddedCanvasStateResolver: EmbeddedCanvasStateResolver = ({ children }) =>
  children(UNAVAILABLE_EMBEDDED_CANVAS_STATE)

const EmbeddedCanvasStateResolverContext = createContext<EmbeddedCanvasStateResolver>(
  DefaultEmbeddedCanvasStateResolver,
)

export function EmbeddedCanvasStateResolutionProvider({
  children,
  resolver,
}: {
  children: ReactNode
  resolver?: EmbeddedCanvasStateResolver
}) {
  const Resolver = resolver ?? DefaultEmbeddedCanvasStateResolver

  return createElement(EmbeddedCanvasStateResolverContext.Provider, { value: Resolver }, children)
}

export function useEmbeddedCanvasStateResolver() {
  return use(EmbeddedCanvasStateResolverContext)
}
