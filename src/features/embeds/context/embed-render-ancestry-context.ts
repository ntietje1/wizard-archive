import { createContext, useContext } from 'react'
import type { Id } from 'convex/_generated/dataModel'

export type EmbedAncestry = ReadonlySet<Id<'sidebarItems'>>

export const EmbedAncestryContext = createContext<EmbedAncestry>(new Set())

export function useEmbedAncestry(): EmbedAncestry {
  return useContext(EmbedAncestryContext)
}
