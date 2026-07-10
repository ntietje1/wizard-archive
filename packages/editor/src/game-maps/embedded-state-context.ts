import { createContext, createElement, use } from 'react'
import type { MapItemWithContent } from './item-contract'
import type { ReactNode } from 'react'
import type { EmbeddedMapState } from './embedded-state-contract'

export type EmbeddedMapStateSource = {
  resolveEmbeddedMapState: (map: MapItemWithContent) => EmbeddedMapState
}

const EmbeddedMapStateSourceContext = createContext<EmbeddedMapStateSource | null>(null)

export function EmbeddedMapStateSourceProvider({
  children,
  source,
}: {
  children: ReactNode
  source: EmbeddedMapStateSource
}) {
  return createElement(EmbeddedMapStateSourceContext.Provider, { value: source }, children)
}

export function useEmbeddedMapState(map: MapItemWithContent) {
  const source = use(EmbeddedMapStateSourceContext)
  if (!source) {
    throw new Error('Embedded map state source is unavailable')
  }
  return source.resolveEmbeddedMapState(map)
}
