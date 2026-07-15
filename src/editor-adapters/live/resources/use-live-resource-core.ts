import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { NoteCollaborationUser } from '@wizard-archive/editor/resources/content-session-contract'
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
import {
  createLiveCanvasSessionSource,
  createLiveMapSessionSource,
} from './live-resource-content-source'
import type { LiveResourceContentBackend } from './live-resource-content-source'
import { createLiveFileContentSource } from './live-file-content-source'
import { createLiveWorkspacePreferences } from './live-workspace-preferences'
import { createLiveResourceBookmarks, createLiveWorkspaceSearch } from './live-workspace-discovery'
import { useCommittedRuntime } from '../../committed-runtime'

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
  collaborationUser: NoteCollaborationUser,
): EditorRuntime | null {
  const convex = useConvex()
  return useCommittedRuntime(() =>
    createScopedLiveResourceRuntime(scope, navigation, collaborationUser, convex),
  )
}

function createScopedLiveResourceRuntime(
  scope: ResourceProjectionScope,
  navigation: ResourceNavigation,
  collaborationUser: NoteCollaborationUser,
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
    convex.mutation(api.resources.mutations.compensateResourceOperation, args),
  )
  const optimistic = createOptimisticResourceStructureRuntime(base.index, authoritativeStructure)
  const undo = createResourceUndoHistory(
    currentScope.campaignId,
    optimistic.structure,
    compensation,
  )
  const refresh = async (resourceId: ResourceId, parentId: ResourceId | null) => {
    await Promise.all([
      base.loader.ensureResource(resourceId),
      base.loader.ensureCollection({ parentId, lifecycle: 'active' }),
    ])
  }
  const notes = createLiveNoteContentSource(
    currentScope.campaignId,
    currentScope.actorId,
    collaborationUser,
    {
      create: (args) => convex.mutation(api.resources.mutations.createNoteResource, args),
      refresh,
      save: (args) => convex.mutation(api.resources.mutations.saveNoteContent, args),
      load: (resourceId) =>
        convex.query(api.resources.queries.loadNoteContent, {
          campaignId: currentScope.campaignId,
          resourceId,
        }),
      publishAwareness: (args) =>
        convex.mutation(api.resources.mutations.publishNoteAwareness, {
          campaignId: currentScope.campaignId,
          ...args,
        }),
      releaseAwareness: (args) =>
        convex.mutation(api.resources.mutations.releaseNoteAwareness, {
          campaignId: currentScope.campaignId,
          ...args,
        }),
      watch: (resourceId, apply) => {
        const watch = convex.watchQuery(api.resources.queries.loadNoteContent, {
          campaignId: currentScope.campaignId,
          resourceId,
        })
        return subscribeToWatch(watch, apply)
      },
      watchAwareness: (resourceId, apply) => {
        const watch = convex.watchQuery(api.resources.queries.loadNoteAwareness, {
          campaignId: currentScope.campaignId,
          resourceId,
        })
        return subscribeToWatch(watch, apply)
      },
    },
    undo.begin,
  )
  const contentBackend = (kind: 'file' | 'map' | 'canvas'): LiveResourceContentBackend => ({
    load: (resourceId) =>
      convex.query(api.resources.queries.loadContent, {
        campaignId: currentScope.campaignId,
        resourceId,
        kind,
      }),
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
      create: (args) => convex.action(api.resources.actions.createFileResource, args),
      download: (resourceId) =>
        convex.query(api.resources.queries.loadFileDownload, {
          campaignId: currentScope.campaignId,
          resourceId,
        }),
      discard: async (sessionId) => {
        await convex.mutation(api.storage.mutations.discardUpload, { sessionId })
      },
      refresh,
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
  const maps = createLiveMapSessionSource(
    currentScope.campaignId,
    {
      ...contentBackend('map'),
      create: (args) => convex.mutation(api.resources.mutations.createMapResource, args),
      refresh,
    },
    undo.begin,
  )
  const canvases = createLiveCanvasSessionSource(
    currentScope.campaignId,
    {
      ...contentBackend('canvas'),
      create: (args) => convex.mutation(api.resources.mutations.createCanvasResource, args),
      refresh,
    },
    undo.begin,
  )
  const preferences = createLiveWorkspacePreferences(currentScope.campaignId, convex)
  const bookmarks = createLiveResourceBookmarks(currentScope.campaignId, base.applyProjection, {
    execute: (args) => convex.mutation(api.resources.mutations.executeBookmarkCommand, args),
    watch: (apply) => {
      const watch = convex.watchQuery(api.resources.queries.loadBookmarks, {
        campaignId: currentScope.campaignId,
      })
      return subscribeToWatch(watch, apply)
    },
  })
  const search = createLiveWorkspaceSearch(
    currentScope.campaignId,
    currentScope.actorId,
    base.applyProjection,
    (args) => convex.query(api.resources.queries.searchResources, args),
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
    start: () => {
      preferences.start()
      bookmarks.start()
    },
    dispose: () => {
      for (const source of Object.values(content)) source.dispose()
      preferences.dispose()
      bookmarks.dispose()
      optimistic.dispose()
    },
  }
}
