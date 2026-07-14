import { useMemo } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import { createOptimisticResourceStructureRuntime } from '@wizard-archive/editor/resources/optimistic-runtime'
import { createLiveResourceIndexRuntime } from './live-resource-index'
import { createLiveResourceStructureGateway } from './live-resource-structure-gateway'

export function useLiveResourceCore(scope: ResourceProjectionScope) {
  const convex = useConvex()
  const { actorId, campaignId, projection, schema } = scope

  return useMemo(() => {
    const currentScope: ResourceProjectionScope = { actorId, campaignId, projection, schema }
    const base = createLiveResourceIndexRuntime(currentScope, {
      loadResource: (args) => convex.query(api.resources.queries.loadResource, args),
      loadCollection: (args) => convex.query(api.resources.queries.loadCollection, args),
    })
    const authoritativeStructure = createLiveResourceStructureGateway(campaignId, (args) =>
      convex.mutation(api.resources.mutations.executeStructureCommand, args),
    )
    const optimistic = createOptimisticResourceStructureRuntime(base.index, authoritativeStructure)

    return {
      index: optimistic.index,
      loader: base.loader,
      structure: optimistic.structure,
    }
  }, [actorId, campaignId, convex, projection, schema])
}
