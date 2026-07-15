import { useEffect, useState } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import type {
  ResourceNavigation,
  EditorRuntime,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import { createOptimisticResourceStructureRuntime } from '@wizard-archive/editor/resources/optimistic-runtime'
import { createLiveResourceIndexRuntime } from './live-resource-index'
import {
  createLiveResourceCompensationGateway,
  createLiveResourceStructureGateway,
} from './live-resource-structure-gateway'
import { createResourceUndoHistory } from '@wizard-archive/editor/resources/undo-history'
import { createLiveNoteContentSource } from './live-note-content-source'
import { createLiveResourceContentSource } from './live-resource-content-source'
import type { LiveResourceContentBackend } from './live-resource-content-source'
import { createLiveFileContentSource } from './live-file-content-source'
import { createLiveWorkspacePreferences } from './live-workspace-preferences'
import { createLiveResourceBookmarks, createLiveWorkspaceSearch } from './live-workspace-discovery'

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
  const compensation = createLiveResourceCompensationGateway(currentScope.campaignId, (args) =>
    convex.mutation(api.resources.mutations.executeStructureCompensation, args),
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
  const undo = createResourceUndoHistory(optimistic.index, optimistic.structure, compensation)
  notes = createLiveNoteContentSource(currentScope.campaignId, undo.structure, {
    bind: (args) => convex.mutation(api.resources.mutations.bindNoteContent, args),
    save: (args) => convex.mutation(api.resources.mutations.saveNoteContent, args),
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
  const files = createLiveFileContentSource(
    currentScope.campaignId,
    {
      ...contentBackend('file'),
      create: (args) => convex.mutation(api.resources.mutations.createFileResource, args),
      discard: async (sessionId) => {
        await convex.mutation(api.storage.mutations.discardUpload, { sessionId })
      },
      refresh: async (resourceId, parentId) => {
        await Promise.all([
          base.loader.ensureResource(resourceId),
          base.loader.ensureCollection({ parentId, lifecycle: 'active' }),
        ])
      },
      upload: async (source) => {
        const { sessionId, uploadUrl } = await convex.mutation(
          api.storage.mutations.createUploadSession,
          {},
        )
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: new Blob([Uint8Array.from(source.bytes).buffer]),
        })
        if (!response.ok) throw new Error('File upload failed')
        const { storageId } = (await response.json()) as { storageId: Id<'_storage'> }
        await convex.mutation(api.storage.mutations.bindUpload, {
          sessionId,
          storageId,
          originalFileName: source.fileName,
        })
        return sessionId
      },
    },
    undo.begin,
  )
  const maps = createLiveResourceContentSource('map', contentBackend('map'))
  const canvases = createLiveResourceContentSource('canvas', contentBackend('canvas'))
  const preferences = createLiveWorkspacePreferences(currentScope.campaignId, convex)
  const bookmarks = createLiveResourceBookmarks(currentScope.campaignId, {
    execute: (args) => convex.mutation(api.resources.mutations.executeBookmarkCommand, args),
    watch: (apply) => {
      const watch = convex.watchQuery(api.resources.queries.loadBookmarks, {
        campaignId: currentScope.campaignId,
      })
      return subscribeToWatch(watch, apply)
    },
  })
  const search = createLiveWorkspaceSearch(currentScope.campaignId, (args) =>
    convex.query(api.resources.queries.searchResources, args),
  )

  const unsupported = {
    status: 'unavailable',
    reason: 'capability_not_supported',
  } as const
  const structure: EditorRuntime['resources']['structure'] =
    currentScope.projection === 'dm'
      ? { status: 'available', value: undo.structure }
      : { status: 'unavailable', reason: 'unauthorized' }
  const undoCapability: EditorRuntime['resources']['undo'] =
    currentScope.projection === 'dm'
      ? { status: 'available', value: undo.history }
      : { status: 'unavailable', reason: 'unauthorized' }
  const content = { notes, files, maps, canvases }
  return {
    runtime: {
      scope: currentScope,
      resources: {
        index: optimistic.index,
        loader: base.loader,
        structure,
        access: unsupported,
        bookmarks:
          currentScope.projection === 'dm'
            ? ({ status: 'available', value: bookmarks.gateway } as const)
            : unsupported,
        previews: unsupported,
        undo: undoCapability,
      },
      content,
      navigation,
      preferences: preferences.source,
      search:
        currentScope.projection === 'dm'
          ? ({ status: 'available', value: search } as const)
          : unsupported,
      history: unsupported,
    },
    dispose: () => {
      for (const source of Object.values(content)) source.dispose()
      preferences.dispose()
      bookmarks.dispose()
      optimistic.dispose()
    },
  }
}
