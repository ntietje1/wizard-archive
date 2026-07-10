import type { ReactNode } from 'react'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { EmbedAncestryContext, useEmbedAncestry } from './render-ancestry-context'

export function EmbedAncestryProvider({
  itemId,
  children,
}: {
  itemId: SidebarItemId
  children: ReactNode
}) {
  const parent = useEmbedAncestry()
  const next = new Set(parent)
  next.add(itemId)

  return <EmbedAncestryContext.Provider value={next}>{children}</EmbedAncestryContext.Provider>
}
