import { createContext, use } from 'react'
import type { SidebarItemId } from '../../../../../shared/common/ids'

type EmbedAncestry = ReadonlySet<SidebarItemId>

export const EmbedAncestryContext = createContext<EmbedAncestry>(new Set())

export function useEmbedAncestry(): EmbedAncestry {
  return use(EmbedAncestryContext)
}
