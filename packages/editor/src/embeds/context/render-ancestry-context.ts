import type { ResourceId } from '../../resources/domain-id'
import { createContext, use } from 'react'

type EmbedAncestry = ReadonlySet<ResourceId>

export const EmbedAncestryContext = createContext<EmbedAncestry>(new Set())

export function useEmbedAncestry(): EmbedAncestry {
  return use(EmbedAncestryContext)
}
