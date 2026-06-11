import { createContext, createElement, use } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { ReactNode } from 'react'

type EmbedTargetOperations = {
  uploadFile: (file: File) => Promise<Id<'sidebarItems'> | null>
}

const DEFAULT_EMBED_TARGET_OPERATIONS: EmbedTargetOperations = {
  uploadFile: () => Promise.resolve(null),
}

const EmbedTargetOperationsContext = createContext<EmbedTargetOperations>(
  DEFAULT_EMBED_TARGET_OPERATIONS,
)

export function EmbedTargetOperationsProvider({
  children,
  operations,
}: {
  children: ReactNode
  operations?: EmbedTargetOperations
}) {
  return createElement(
    EmbedTargetOperationsContext.Provider,
    { value: operations ?? DEFAULT_EMBED_TARGET_OPERATIONS },
    children,
  )
}

export function useEmbedTargetOperations() {
  return use(EmbedTargetOperationsContext)
}
