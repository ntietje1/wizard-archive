import type { Id } from 'convex/_generated/dataModel'
import type { ReactNode } from 'react'
import { EmbedAncestryContext, useEmbedAncestry } from './embed-render-ancestry-context'

export function EmbedAncestryProvider({
  itemId,
  children,
}: {
  itemId: Id<'sidebarItems'>
  children: ReactNode
}) {
  const parent = useEmbedAncestry()
  const next = new Set(parent)
  next.add(itemId)

  return <EmbedAncestryContext.Provider value={next}>{children}</EmbedAncestryContext.Provider>
}
