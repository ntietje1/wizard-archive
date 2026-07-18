import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CollaborationUser } from '@wizard-archive/editor/resources/content-session-contract'
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
import { createLiveMapSessionSource } from './live-map-session-source'
import { createLiveCanvasSessionSource } from './live-canvas-session-source'
import type { LiveResourcePresenceBackend } from './live-resource-presence'
import { createLiveFileContentSource } from './live-file-content-source'
import { createLiveWorkspacePreferences } from './live-workspace-preferences'
import { createLiveResourceBookmarks, createLiveWorkspaceSearch } from './live-workspace-discovery'
import { useCommittedRuntime } from '../../committed-runtime'
import { createLiveResourceAccessGateway } from './live-resource-access-gateway'
import { createLiveNoteBlockAccessGateway } from './live-note-block-access-gateway'
import { executeResourceWrite, resourceQueryScope } from './resource-query-scope'
import type { LiveResourceContentAuthority } from './live-resource-content-authority'

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

const READONLY_PRESENCE_BACKEND: LiveResourcePresenceBackend = {
  heartbeatPresence: () => Promise.resolve({ status: 'unavailable' }),
  updatePresence: () => Promise.resolve({ status: 'unavailable' }),
  watchPresence: () => () => undefined,
  disconnectPresence: () => Promise.resolve({ status: 'unavailable' }),
}

export function useLiveResourceCore(
  scope: ResourceProjectionScope,
  navigation: ResourceNavigation,
  collaborationUser: CollaborationUser,
): Omit<EditorRuntime, 'viewAs'> | null {
  const convex = useConvex()
  return useCommittedRuntime(() =>
    createScopedLiveResourceRuntime(scope, navigation, collaborationUser, convex),
  )
}

function createScopedLiveResourceRuntime(
  scope: ResourceProjectionScope,
  navigation: ResourceNavigation,
  collaborationUser: CollaborationUser,
  convex: ReturnType<typeof useConvex>,
) {
  const currentScope: ResourceProjectionScope = { ...scope }
  const queryScope = resourceQueryScope(currentScope)
  const write = <T>(operation: () => Promise<T>) => executeResourceWrite(currentScope, operation)
  const base = createLiveResourceIndexRuntime(currentScope, {
    watchAvailability: (args, apply) => {
      const watch = convex.watchQuery(
        api.resources.queries.loadResourceProjectionAvailability,
        args,
      )
      return subscribeToWatch(watch, apply)
    },
    watchResource: (args, apply) => {
      const watch = convex.watchQuery(api.resources.queries.loadResource, args)
      return subscribeToWatch(watch, apply)
    },
    watchCollection: (args, apply) => {
      const watch = convex.watchQuery(api.resources.queries.loadCollection, args)
      return subscribeToWatch(watch, apply)
    },
  })
  const authoritativeStructure = createLiveResourceStructureGateway(
    currentScope.campaignId,
    (args) => write(() => convex.mutation(api.resources.mutations.executeStructureCommand, args)),
  )
  const compensation = createLiveResourceCompensationGateway(currentScope.campaignId, (args) =>
    write(() => convex.mutation(api.resources.mutations.compensateResourceOperation, args)),
  )
  const optimistic = createOptimisticResourceStructureRuntime(base.index, authoritativeStructure)
  const contentAuthority: LiveResourceContentAuthority = {
    canEdit: (resourceId) => {
      if (currentScope.projection === 'view_as_player') return false
      const resource = optimistic.index.getSnapshot().lookup(resourceId)
      return resource.state === 'known' && resource.value.permission === 'edit'
    },
    subscribe: (listener) => optimistic.index.subscribe(listener),
  }
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
  const livePresenceBackend: LiveResourcePresenceBackend = {
    heartbeatPresence: (args) =>
      write(() =>
        convex.mutation(api.resources.mutations.heartbeatResourcePresence, {
          campaignId: currentScope.campaignId,
          ...args,
        }),
      ),
    updatePresence: (args) =>
      write(() =>
        convex.mutation(api.resources.mutations.updateResourcePresence, {
          campaignId: currentScope.campaignId,
          ...args,
        }),
      ),
    disconnectPresence: (args) =>
      write(() =>
        convex.mutation(api.resources.mutations.disconnectResourcePresence, {
          campaignId: currentScope.campaignId,
          ...args,
        }),
      ),
    watchPresence: (resourceId, roomToken, apply) => {
      const watch = convex.watchQuery(api.resources.queries.loadResourcePresence, {
        ...queryScope,
        resourceId,
        roomToken,
      })
      return subscribeToWatch(watch, apply)
    },
  }
  const presenceBackend =
    currentScope.projection === 'view_as_player' ? READONLY_PRESENCE_BACKEND : livePresenceBackend
  const notes = createLiveNoteContentSource(
    currentScope.campaignId,
    currentScope.actorId,
    collaborationUser,
    {
      ...presenceBackend,
      create: (args) =>
        write(() => convex.mutation(api.resources.mutations.createNoteResource, args)),
      refresh,
      save: (args) => write(() => convex.mutation(api.resources.mutations.saveNoteContent, args)),
      load: (resourceId) =>
        convex.query(api.resources.queries.loadNoteContent, {
          ...queryScope,
          resourceId,
        }),
      watch: (resourceId, apply) => {
        const watch = convex.watchQuery(api.resources.queries.loadNoteContent, {
          ...queryScope,
          resourceId,
        })
        return subscribeToWatch(watch, apply)
      },
    },
    undo.beginRecording,
    contentAuthority,
  )
  const discardUpload = async (sessionId: Id<'fileStorage'>) => {
    await write(() => convex.mutation(api.storage.mutations.discardUpload, { sessionId }))
  }
  const uploadFile = async (source: { bytes: Uint8Array; fileName: string }) => {
    const { sessionId, uploadUrl } = await write(() =>
      convex.mutation(api.storage.mutations.createUploadSession, {}),
    )
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Blob([Uint8Array.from(source.bytes).buffer]),
    })
    if (!response.ok) throw new Error('File upload failed')
    const { storageId } = (await response.json()) as { storageId: Id<'_storage'> }
    await write(() =>
      convex.mutation(api.storage.mutations.bindUpload, {
        sessionId,
        storageId,
        originalFileName: source.fileName,
      }),
    )
    return sessionId
  }
  const files = createLiveFileContentSource(
    currentScope.campaignId,
    {
      load: (resourceId) =>
        convex.query(api.resources.queries.loadFileContent, {
          ...queryScope,
          resourceId,
        }),
      watch: (resourceId, apply) => {
        const watch = convex.watchQuery(api.resources.queries.loadFileContent, {
          ...queryScope,
          resourceId,
        })
        return subscribeToWatch(watch, apply)
      },
      cancel: (args) =>
        write(() => convex.mutation(api.resources.mutations.cancelPlainFileTransfer, args)).then(
          () => undefined,
        ),
      create: (args) =>
        write(() => convex.action(api.resources.actions.executePlainFileTransfer, args)),
      download: (resourceId) =>
        convex.query(api.resources.queries.loadFileDownload, {
          ...queryScope,
          resourceId,
        }),
      discard: discardUpload,
      refresh,
      replace: (args) => write(() => convex.action(api.resources.actions.replaceFileContent, args)),
      upload: uploadFile,
    },
    undo.beginRecording,
    contentAuthority,
  )
  const maps = createLiveMapSessionSource(
    currentScope.campaignId,
    {
      load: (resourceId) =>
        convex.query(api.resources.queries.loadMapContent, {
          ...queryScope,
          resourceId,
        }),
      watch: (resourceId, apply) => {
        const watch = convex.watchQuery(api.resources.queries.loadMapContent, {
          ...queryScope,
          resourceId,
        })
        return subscribeToWatch(watch, apply)
      },
      create: (args) =>
        write(() => convex.mutation(api.resources.mutations.createMapResource, args)),
      discard: discardUpload,
      download: (resourceId, layerId) =>
        convex.query(api.resources.queries.loadMapImage, {
          ...queryScope,
          resourceId,
          layerId,
        }),
      execute: (args) =>
        write(() => convex.mutation(api.resources.mutations.executeMapContentCommand, args)),
      refresh,
      replace: (args) => write(() => convex.action(api.resources.actions.replaceMapImage, args)),
      upload: uploadFile,
    },
    undo.beginRecording,
    contentAuthority,
  )
  const canvases = createLiveCanvasSessionSource(
    currentScope.campaignId,
    currentScope.actorId,
    collaborationUser,
    {
      ...presenceBackend,
      load: (resourceId) =>
        convex.query(api.resources.queries.loadCanvasContent, {
          ...queryScope,
          resourceId,
        }),
      watch: (resourceId, apply) => {
        const watch = convex.watchQuery(api.resources.queries.loadCanvasContent, {
          ...queryScope,
          resourceId,
        })
        return subscribeToWatch(watch, apply)
      },
      create: (args) =>
        write(() => convex.mutation(api.resources.mutations.createCanvasResource, args)),
      save: (args) => write(() => convex.mutation(api.resources.mutations.saveCanvasContent, args)),
      refresh,
    },
    undo.beginRecording,
    contentAuthority,
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
  const access = createLiveResourceAccessGateway(
    currentScope.campaignId,
    optimistic.index,
    currentScope.projection === 'dm'
      ? (args) =>
          write(() => convex.mutation(api.resources.mutations.executeResourceAccessCommand, args))
      : null,
    currentScope.projection === 'dm'
      ? (resourceId, cursor, apply) => {
          const watch = convex.watchQuery(api.resources.queries.loadResourceAccess, {
            campaignId: currentScope.campaignId,
            resourceId,
            cursor,
          })
          return subscribeToWatch(watch, apply)
        }
      : null,
  )
  const noteBlockAccess = createLiveNoteBlockAccessGateway(
    currentScope.campaignId,
    currentScope.projection === 'dm'
      ? (args) =>
          write(() => convex.mutation(api.resources.mutations.executeNoteBlockAccessCommand, args))
      : null,
    currentScope.projection === 'dm'
      ? (noteId, blockIds, cursor, apply) => {
          const watch = convex.watchQuery(api.resources.queries.loadNoteBlockAccess, {
            campaignId: currentScope.campaignId,
            noteId,
            blockIds: [...blockIds],
            cursor,
          })
          return subscribeToWatch(watch, apply)
        }
      : null,
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
  const accessCapability: EditorRuntime['resources']['access'] = {
    status: 'available',
    value: access,
  }
  const noteBlockAccessCapability: EditorRuntime['resources']['noteBlockAccess'] =
    currentScope.projection === 'dm'
      ? { status: 'available', value: noteBlockAccess }
      : { status: 'unavailable', reason: 'unauthorized' }
  const content = { notes, files, maps, canvases }
  return {
    runtime: {
      scope: currentScope,
      resources: {
        index: optimistic.index,
        loader: base.loader,
        structure,
        access: accessCapability,
        noteBlockAccess: noteBlockAccessCapability,
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
      base.start()
      preferences.start()
      if (currentScope.projection === 'dm') bookmarks.start()
    },
    dispose: () => {
      for (const source of Object.values(content)) source.dispose()
      preferences.dispose()
      bookmarks.dispose()
      access.dispose()
      noteBlockAccess.dispose()
      optimistic.dispose()
      base.dispose()
    },
  }
}
