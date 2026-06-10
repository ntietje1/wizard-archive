import { createContext, createElement, use } from 'react'
import type { GameMapWithContent, MapPinWithItem } from 'shared/game-maps/types'
import type { ComponentType, ReactNode } from 'react'

type EmbeddedMapState = {
  pins: Array<MapPinWithItem>
  isPinGhost: (pin: MapPinWithItem) => boolean
}

type EmbeddedMapStateResolverProps = {
  map: GameMapWithContent
  children: (state: EmbeddedMapState) => ReactNode
}

export type EmbeddedMapStateResolver = ComponentType<EmbeddedMapStateResolverProps>

const DefaultEmbeddedMapStateResolver: EmbeddedMapStateResolver = ({ children, map }) =>
  children({
    pins: map.pins.filter((pin) => pin.visible === true),
    isPinGhost: () => false,
  })

const EmbeddedMapStateResolverContext = createContext<EmbeddedMapStateResolver>(
  DefaultEmbeddedMapStateResolver,
)

export function EmbeddedMapStateResolutionProvider({
  children,
  resolver,
}: {
  children: ReactNode
  resolver?: EmbeddedMapStateResolver
}) {
  const Resolver = resolver ?? DefaultEmbeddedMapStateResolver

  return createElement(EmbeddedMapStateResolverContext.Provider, { value: Resolver }, children)
}

export function useEmbeddedMapStateResolver() {
  return use(EmbeddedMapStateResolverContext)
}
