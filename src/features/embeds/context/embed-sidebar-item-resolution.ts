import { createContext, createElement, use } from 'react'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { SidebarItemAvailabilityState } from 'shared/sidebar-items/availability'
import type { ComponentType, ReactNode } from 'react'

export type EmbedSidebarItemState = SidebarItemAvailabilityState

export type EmbedSidebarItemResolverProps = {
  target: EmbedTarget
  children: (itemState: EmbedSidebarItemState | undefined) => ReactNode
}

export type EmbedSidebarItemResolver = ComponentType<EmbedSidebarItemResolverProps>

const DefaultEmbedSidebarItemResolver: EmbedSidebarItemResolver = ({ children }) =>
  children(undefined)

const EmbedSidebarItemResolverContext = createContext<EmbedSidebarItemResolver>(
  DefaultEmbedSidebarItemResolver,
)

export function EmbedSidebarItemResolutionProvider({
  children,
  resolver,
}: {
  children: ReactNode
  resolver?: EmbedSidebarItemResolver
}) {
  const Resolver = resolver ?? DefaultEmbedSidebarItemResolver

  return createElement(EmbedSidebarItemResolverContext.Provider, { value: Resolver }, children)
}

export function useEmbedSidebarItemResolver() {
  return use(EmbedSidebarItemResolverContext)
}
