import type { ResourceId } from '../../resources/domain-id'
import type { ReactNode } from 'react'

import { EmbedAncestryContext, useEmbedAncestry } from './render-ancestry-context'

export function EmbedAncestryProvider({
  itemId,
  children,
}: {
  itemId: ResourceId
  children: ReactNode
}) {
  const parent = useEmbedAncestry()
  const next = new Set(parent)
  next.add(itemId)

  return <EmbedAncestryContext.Provider value={next}>{children}</EmbedAncestryContext.Provider>
}
