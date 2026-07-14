import { useMemo } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import { createOptimisticResourceStructureRuntime } from '@wizard-archive/editor/resources/optimistic-runtime'
import { createLiveResourceIndexRuntime } from './live-resource-index'
import { createLiveResourceStructureGateway } from './live-resource-structure-gateway'
import { createLiveNoteContentSource } from './live-note-content-source'

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
    let notes: ReturnType<typeof createLiveNoteContentSource> | null = null
    const optimistic = createOptimisticResourceStructureRuntime(
      base.index,
      authoritativeStructure,
      Date.now,
      {
        applied: (envelope) => {
          if (envelope.command.type === 'create' && envelope.command.kind === 'note') {
            notes?.optimisticApplied({
              ...envelope,
              command: { ...envelope.command, kind: 'note' },
            })
          }
        },
      },
    )
    notes = createLiveNoteContentSource(currentScope.campaignId, optimistic.structure, {
      bind: (args) => convex.mutation(api.resources.mutations.bindNoteContent, args),
      watch: (resourceId, apply) => {
        const watch = convex.watchQuery(api.resources.queries.loadNoteContent, {
          campaignId: currentScope.campaignId,
          resourceId,
        })
        const update = () => {
          const snapshot = watch.localQueryResult()
          if (snapshot) apply(snapshot)
        }
        const unsubscribe = watch.onUpdate(update)
        update()
        return unsubscribe
      },
    })

    return {
      content: { notes },
      dispose: () => {
        notes.dispose()
        optimistic.dispose()
      },
      index: optimistic.index,
      loader: base.loader,
      structure: optimistic.structure,
    }
  }, [actorId, campaignId, convex, projection, schema])
}
