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
import { createLiveResourceReferenceSource } from './live-resource-references'
import { createLiveResourcePreviewSource } from './live-resource-preview-source'
import {
  createLiveItemHistory,
  readLiveItemHistoryEntry,
  readLiveItemHistoryPreview,
} from './live-item-history'
import { createLivePlainTransferGateway } from './live-plain-transfer-gateway'
import { ERROR_CODE, isClientError } from 'shared/errors/client'

function subscribeToWatch<T>(
  watch: Readonly<{
    localQueryResult(): T | undefined
    onUpdate(listener: () => void): () => void
  }>,
  apply: (value: T) => void,
) {
  const update = () => {
    try {
      const value = watch.localQueryResult()
      if (value !== undefined) apply(value)
    } catch (error) {
      if (!isClientError(error, ERROR_CODE.NOT_AUTHENTICATED)) throw error
    }
  }
  const unsubscribe = watch.onUpdate(update)
  update()
  return unsubscribe
}

async function uploadBytes(
  uploadUrl: string,
  bytes: Uint8Array,
  mediaType: string,
): Promise<Id<'_storage'>> {
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': mediaType },
    body: new Blob([Uint8Array.from(bytes).buffer]),
  })
  if (!response.ok) throw new Error('File upload failed')
  const { storageId } = (await response.json()) as { storageId: Id<'_storage'> }
  return storageId
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
      reapply: (args) =>
        write(() => convex.mutation(api.resources.mutations.reapplyYjsRecovery, args)),
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
  const uploadFile = async (source: {
    bytes: Uint8Array
    fileName: string
    mediaType?: string
  }) => {
    const { sessionId, uploadUrl } = await write(() =>
      convex.mutation(api.storage.mutations.createUploadSession, {}),
    )
    try {
      const storageId = await uploadBytes(
        uploadUrl,
        source.bytes,
        source.mediaType ?? 'application/octet-stream',
      )
      await write(() =>
        convex.mutation(api.storage.mutations.bindUpload, {
          sessionId,
          storageId,
          originalFileName: source.fileName,
        }),
      )
      return sessionId
    } catch (error) {
      await discardUpload(sessionId).catch(() => undefined)
      throw error
    }
  }
  const bindReservedUpload = async (
    target: Readonly<{
      sessionId: Id<'fileStorage'>
      uploadUrl: string
    }>,
    source: Readonly<{ bytes: Uint8Array; path: string }>,
  ) => {
    const storageId = await uploadBytes(target.uploadUrl, source.bytes, 'application/octet-stream')
    await write(() =>
      convex.mutation(api.storage.mutations.bindUpload, {
        sessionId: target.sessionId,
        storageId,
        originalFileName: source.path.slice(source.path.lastIndexOf('/') + 1),
      }),
    )
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
      download: (resourceId) =>
        convex.query(api.resources.queries.loadFileDownload, {
          ...queryScope,
          resourceId,
        }),
      discard: discardUpload,
      createAsset: (args) =>
        write(() => convex.action(api.resources.actions.createAssetFile, args)),
      replace: (args) => write(() => convex.action(api.resources.actions.replaceFileContent, args)),
      upload: uploadFile,
    },
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
      reapply: (args) =>
        write(() => convex.mutation(api.resources.mutations.reapplyYjsRecovery, args)),
      save: (args) => write(() => convex.mutation(api.resources.mutations.saveCanvasContent, args)),
      refresh,
    },
    undo.beginRecording,
    contentAuthority,
  )
  const preferences = createLiveWorkspacePreferences(currentScope.campaignId, convex)
  const bookmarks = createLiveResourceBookmarks(currentScope.campaignId, base.applyProjection, {
    setBookmarkState: (args) => convex.mutation(api.resources.mutations.setBookmarkState, args),
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
  const references = createLiveResourceReferenceSource(
    base.applyProjection,
    (resourceId, apply) => {
      const watch = convex.watchQuery(api.resources.queries.loadResourceReferences, {
        ...queryScope,
        resourceId,
      })
      return subscribeToWatch(watch, apply)
    },
  )
  const referencesCapability: EditorRuntime['resources']['references'] = {
    status: 'available',
    value: references.source,
  }
  const previews = createLiveResourcePreviewSource((resourceId, apply) => {
    const watch = convex.watchQuery(api.resources.queries.loadResourcePreview, {
      ...queryScope,
      resourceId,
    })
    return subscribeToWatch(watch, apply)
  })
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
  const transfers =
    currentScope.projection === 'dm'
      ? createLivePlainTransferGateway(currentScope.campaignId, {
          bind: bindReservedUpload,
          cancel: (args) =>
            write(() => convex.mutation(api.resources.mutations.cancelPlainTransfer, args)),
          commit: (args) =>
            write(() => convex.action(api.resources.actions.commitPlainTransfer, args)),
          load: (args) => convex.query(api.resources.queries.loadPlainTransfer, args),
          refresh,
          reserve: (args) =>
            write(() => convex.mutation(api.resources.mutations.reservePlainTransfer, args)),
        })
      : null
  const history =
    currentScope.projection === 'view_as_player'
      ? null
      : createLiveItemHistory(currentScope.campaignId, optimistic.index, content, {
          watchPage: (resourceId, cursor, apply) => {
            const watch = convex.watchQuery(api.resources.queries.loadItemHistoryPage, {
              ...queryScope,
              resourceId,
              cursor,
            })
            return subscribeToWatch(watch, (result) =>
              apply(
                result.status === 'ready'
                  ? {
                      status: 'ready',
                      entries: result.entries.map(readLiveItemHistoryEntry),
                      nextCursor: result.nextCursor,
                    }
                  : { status: 'error' },
              ),
            )
          },
          loadCheckpoint: async (resourceId, entryId) => {
            const result = await convex.query(api.resources.queries.loadItemHistoryCheckpoint, {
              ...queryScope,
              resourceId,
              entryId,
            })
            return result.status === 'ready'
              ? {
                  status: 'ready',
                  preview: readLiveItemHistoryPreview(result.preview),
                }
              : result
          },
          restore: (args) =>
            write(() =>
              convex.mutation(api.resources.mutations.restoreItemHistoryCheckpoint, args),
            ),
          loadNote: (resourceId) =>
            convex.query(api.resources.queries.loadNoteContent, {
              ...queryScope,
              resourceId,
            }),
          loadCanvas: (resourceId) =>
            convex.query(api.resources.queries.loadCanvasContent, {
              ...queryScope,
              resourceId,
            }),
          loadMap: (resourceId) =>
            convex.query(api.resources.queries.loadMapContent, {
              ...queryScope,
              resourceId,
            }),
        })
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
        previews: { status: 'available', value: previews.source },
        references: referencesCapability,
        undo: undoCapability,
      },
      content,
      navigation,
      preferences: preferences.source,
      search:
        currentScope.projection === 'dm'
          ? ({ status: 'available', value: search } as const)
          : unsupported,
      history:
        history === null
          ? { status: 'unavailable', reason: 'unauthorized' }
          : { status: 'available', value: history.controller },
      transfers:
        transfers === null
          ? { status: 'unavailable', reason: 'unauthorized' }
          : { status: 'available', value: transfers },
    } satisfies Omit<EditorRuntime, 'viewAs'>,
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
      references.dispose()
      previews.dispose()
      history?.dispose()
      optimistic.dispose()
      base.dispose()
    },
  }
}
