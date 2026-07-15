import { useEffect, useState } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import type {
  ResourceNavigation,
  EditorRuntime,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import { createOptimisticResourceStructureRuntime } from '@wizard-archive/editor/resources/optimistic-runtime'
import { createLiveResourceIndexRuntime } from './live-resource-index'
import { createLiveResourceStructureGateway } from './live-resource-structure-gateway'
import { createLiveNoteContentSource } from './live-note-content-source'
import { createLiveResourceContentSource } from './live-resource-content-source'
import type { LiveResourceContentBackend } from './live-resource-content-source'

function subscribeToWatch<T>(
  watch: Readonly<{
    localQueryResult(): T | undefined
    onUpdate(listener: () => void): () => void
  }>,
  apply: (value: T) => void,
) {
  const update = () => {
    const value = watch.localQueryResult()
    if (value !== undefined) apply(value)
  }
  const unsubscribe = watch.onUpdate(update)
  update()
  return unsubscribe
}

export function useLiveResourceCore(
  scope: ResourceProjectionScope,
  navigation: ResourceNavigation,
): EditorRuntime {
  const convex = useConvex()
  const [scoped] = useState(() => createScopedLiveResourceRuntime(scope, navigation, convex))

  useEffect(() => scoped.dispose, [scoped])
  return scoped.runtime
}

function createScopedLiveResourceRuntime(
  scope: ResourceProjectionScope,
  navigation: ResourceNavigation,
  convex: ReturnType<typeof useConvex>,
) {
  const currentScope: ResourceProjectionScope = { ...scope }
  const base = createLiveResourceIndexRuntime(currentScope, {
    loadResource: (args) => convex.query(api.resources.queries.loadResource, args),
    loadCollection: (args) => convex.query(api.resources.queries.loadCollection, args),
  })
  const authoritativeStructure = createLiveResourceStructureGateway(
    currentScope.campaignId,
    (args) => convex.mutation(api.resources.mutations.executeStructureCommand, args),
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
      return subscribeToWatch(watch, apply)
    },
  })
  const contentBackend = (kind: 'file' | 'map' | 'canvas'): LiveResourceContentBackend => ({
    watch: (resourceId, apply) => {
      const watch = convex.watchQuery(api.resources.queries.loadContent, {
        campaignId: currentScope.campaignId,
        resourceId,
        kind,
      })
      return subscribeToWatch(watch, apply)
    },
  })
  const files = createLiveResourceContentSource('file', contentBackend('file'))
  const maps = createLiveResourceContentSource('map', contentBackend('map'))
  const canvases = createLiveResourceContentSource('canvas', contentBackend('canvas'))

  const unsupported = {
    status: 'unavailable',
    reason: 'capability_not_supported',
  } as const
  const structure =
    currentScope.projection === 'dm'
      ? ({ status: 'available', value: optimistic.structure } as const)
      : ({ status: 'unavailable', reason: 'unauthorized' } as const)
  const content = { notes, files, maps, canvases }
  return {
    runtime: {
      scope: currentScope,
      resources: {
        index: optimistic.index,
        loader: base.loader,
        structure,
        access: unsupported,
        bookmarks: unsupported,
        previews: unsupported,
      },
      content,
      navigation,
      search: unsupported,
      history: unsupported,
    },
    dispose: () => {
      for (const source of Object.values(content)) source.dispose()
      optimistic.dispose()
    },
  }
}
