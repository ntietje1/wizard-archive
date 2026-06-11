import * as Y from 'yjs'
import { EDITOR_MODE } from 'shared/editor/types'
import { blocksToYDoc } from 'shared/editor-blocks/blocknote-yjs'
import { validateSidebarItemNameWithSiblings } from 'shared/sidebar-items/name'
import { assertSidebarItemSlug } from 'shared/sidebar-items/slug'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { useCanvasToolStore } from '~/features/canvas/stores/canvas-tool-store'
import { CanvasViewerSession } from '~/features/canvas/components/canvas-viewer'
import { LocalCanvasViewerRuntime } from '~/features/canvas/components/local-canvas-viewer-runtime'
import type {
  CanvasViewerSource,
  CanvasViewerSourceComponentProps,
} from '~/features/canvas/components/canvas-viewer-source'
import type {
  EditorNoteCollaborationProvider,
  EditorWorkspaceNoteDocuments,
  EditorWorkspaceNoteEditableSession,
  EditorWorkspaceNoteSidebarItems,
  EditorWorkspaceSource,
} from '~/features/editor/workspace/editor-workspace-source'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'
import type { ReadyCanvasDocumentSource } from '~/features/canvas/runtime/session/canvas-document-source'
import type { FileViewerSource } from '~/features/editor/components/viewer/file/file-viewer-source'
import type { INITIAL_DEMO_WORKSPACE, DemoWorkspaceAction } from './demo-workspace-model'
import {
  createDemoWorkspaceProjection,
  demoCanvasForItem,
  selectedDemoItem,
} from './demo-workspace-model'
import {
  createDemoEmbeddedCanvasStateResolver,
  createDemoSidebarItemEmbedResolver,
} from './local-demo-embed-resolvers'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'
import { createLinkResolver } from '~/features/editor/links/link-resolver'
import { createEmptyNoteValueRuntimeSource } from '~/features/editor/value-block/note-value-runtime-source'
import { LocalYjsProvider } from './local-yjs-provider'
import type { Id } from 'convex/_generated/dataModel'
import { createElement, useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { NoteWithContent } from 'shared/notes/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'

type DemoWorkspaceState = typeof INITIAL_DEMO_WORKSPACE

const DEMO_CAMPAIGN_ID = 'demo-campaign' as Id<'campaigns'>

const noop = () => {}
const EmptyHistoryPreview = () => null
const EmptyRollbackDialog = () => null

function createParentItemsMap(
  items: Array<AnySidebarItem>,
): Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>> {
  const parentItemsMap = new Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>()
  items.forEach((item) => {
    const siblings = parentItemsMap.get(item.parentId) ?? []
    siblings.push(item)
    parentItemsMap.set(item.parentId, siblings)
  })
  return parentItemsMap
}

function createLocalDemoNoteSidebarItems(
  workspace: DemoWorkspaceState,
): EditorWorkspaceNoteSidebarItems {
  const projection = createDemoWorkspaceProjection(workspace)
  return {
    items: projection.items,
    itemsMap: projection.itemsById,
    parentItemsMap: createParentItemsMap(projection.items),
  }
}

export function createLocalDemoEditorWorkspaceSource({
  activeView,
  dispatch,
  canvasViewerSource,
  fileViewerSource,
  noteDocuments,
  selectedItemId,
  workspace,
}: {
  activeView?: DemoWorkspaceState['activeView']
  dispatch: Dispatch<DemoWorkspaceAction>
  canvasViewerSource: CanvasViewerSource
  fileViewerSource: FileViewerSource
  noteDocuments: EditorWorkspaceNoteDocuments
  selectedItemId?: string | null
  workspace: DemoWorkspaceState
}): EditorWorkspaceSource {
  const sourceWorkspace = {
    ...workspace,
    activeView: activeView ?? workspace.activeView,
    selectedItemId: selectedItemId === undefined ? workspace.selectedItemId : selectedItemId,
  }
  const selectedItem = selectedDemoItem(sourceWorkspace)
  const projection = createDemoWorkspaceProjection(sourceWorkspace)
  const contentItem = selectedItem
    ? (projection.itemsById.get(selectedItem.id as Id<'sidebarItems'>) ?? null)
    : null
  const unsupportedDemoItem = contentItem
    ? contentItem.type === SIDEBAR_ITEM_TYPES.gameMaps
      ? {
          status: 'error' as const,
          label: contentItem.name,
          message:
            'Map editing is not available in this demo yet. Use the canvas board for interactive planning.',
        }
      : null
    : null
  const canViewCurrentItem = Boolean(contentItem) && !unsupportedDemoItem

  return {
    content: {
      currentItem: {
        item: contentItem,
        contentItem,
        editorSearch: selectedItem ? { item: contentItem?.slug } : {},
        isLoading: false,
        itemError: null,
        hasRequestedItem: sourceWorkspace.activeView === 'item',
      },
      requestedSlug: contentItem?.slug ?? null,
      canViewCurrentItem,
      availabilityState: unsupportedDemoItem
        ? unsupportedDemoItem
        : contentItem
          ? { status: 'available', label: contentItem.name, item: contentItem }
          : {
              status: 'not_found',
              label: 'Demo item',
              message: 'Select an item from the sidebar.',
            },
    },
    permissions: {
      editorMode: EDITOR_MODE.EDITOR,
      campaignActor: { kind: 'dm', campaignId: DEMO_CAMPAIGN_ID },
      viewAsPlayerId: undefined,
      canEdit: true,
      setEditorMode: noop,
      setViewAsPlayerId: noop,
      viewAsPlayer: {
        isPending: false,
        playerMembers: [],
        selectedPlayerId: undefined,
        setSelectedPlayerId: noop,
        visible: false,
      },
    },
    index: {
      activeItemsById: projection.itemsById,
      trashItems: [],
    },
    workspace: {
      campaignId: DEMO_CAMPAIGN_ID,
      isCampaignLoaded: true,
      isDm: true,
    },
    items: {
      itemActions: {
        enabled: false,
        item: contentItem,
      },
      createItem: ({ name, type }) => {
        const command = SIDEBAR_ITEM_CREATION_COMMANDS.find((candidate) => candidate.type === type)
        if (!command) return null

        const id = `local-${command.key}-${workspace.nextLocalNoteIndex}`
        dispatch({ type: 'createItem', commandKey: command.key })
        if (name?.trim()) {
          dispatch({ type: 'renameItem', itemId: id, title: name })
        }
        return { id: id as Id<'sidebarItems'>, slug: assertSidebarItemSlug(id) }
      },
      createMissingRequestedNote: noop,
      emptyWorkspaceDrop: { status: 'disabled', reason: 'unsupported' },
      isCreatingMissingRequestedNote: false,
      renameItem: (item, name) =>
        dispatch({ type: 'renameItem', itemId: String(item._id), title: name }),
      validateItemName: (name, parentId, excludeId) =>
        validateSidebarItemNameWithSiblings(
          name,
          projection.items.filter((item) => item.parentId === parentId),
          excludeId,
        ),
    },
    navigation: {
      openItem: (item) => dispatch({ type: 'selectItem', itemId: String(item._id) }),
      openItemBySlug: (slug) => dispatch({ type: 'selectItem', itemId: String(slug) }),
      getItemLinkProps: () => null,
    },
    history: {
      preview: {
        previewingEntryId: null,
        clearItemSession: noop,
        PreviewComponent: EmptyHistoryPreview,
      },
      rollback: {
        DialogComponent: EmptyRollbackDialog,
      },
    },
    sharing: {
      visible: false,
    },
    files: {
      viewer: fileViewerSource,
    },
    documents: {
      canvases: {
        viewer: canvasViewerSource,
      },
      notes: noteDocuments,
    },
  }
}

function createLocalDemoCanvasSession({
  canvasId,
  edges,
  nodes,
}: {
  canvasId: Id<'sidebarItems'>
  edges: ReadonlyArray<CanvasDocumentEdge>
  nodes: ReadonlyArray<CanvasDocumentNode>
}): ReadyCanvasDocumentSource {
  const doc = new Y.Doc()
  const nodesMap = doc.getMap<CanvasDocumentNode>('nodes')
  const edgesMap = doc.getMap<CanvasDocumentEdge>('edges')
  doc.transact(() => {
    nodes.forEach((node) => nodesMap.set(node.id, node))
    edges.forEach((edge) => edgesMap.set(edge.id, edge))
  }, 'local-canvas-init')

  return {
    status: 'ready',
    canvasId,
    campaignId: DEMO_CAMPAIGN_ID,
    canEdit: true,
    colorMode: 'light',
    parentId: null,
    provider: null,
    user: { name: 'Demo', color: '#61afef' },
    doc,
    nodesMap,
    edgesMap,
  }
}

export function useLocalDemoCanvasViewerSource(workspace: DemoWorkspaceState): CanvasViewerSource {
  const workspaceRef = useRef(workspace)
  const sessionsRef = useRef(new Map<Id<'sidebarItems'>, ReadyCanvasDocumentSource>())
  const sourceRef = useRef<CanvasViewerSource | null>(null)
  workspaceRef.current = workspace

  useEffect(() => {
    const sessions = sessionsRef.current
    return () => {
      sessions.forEach((session) => session.doc.destroy())
      sessions.clear()
      useCanvasToolStore.getState().reset()
    }
  }, [])

  if (!sourceRef.current) {
    sourceRef.current = {
      SourceComponent: function LocalDemoCanvasViewerSourceComponent({
        canvas,
        source,
      }: CanvasViewerSourceComponentProps) {
        useEffect(() => {
          return () => {
            useCanvasToolStore.getState().reset()
          }
        }, [canvas._id])

        const sessions = sessionsRef.current
        const existingSession = sessions.get(canvas._id)
        const localCanvas = demoCanvasForItem(workspaceRef.current, String(canvas._id))
        const session =
          existingSession ??
          createLocalDemoCanvasSession({
            canvasId: canvas._id,
            nodes: localCanvas.nodes,
            edges: localCanvas.edges,
          })

        if (!existingSession) {
          sessions.set(canvas._id, session)
        }

        return createElement(CanvasViewerSession, {
          contextMenuSource: undefined,
          session,
          source,
        })
      },
      RuntimeComponent: LocalCanvasViewerRuntime,
      EmbeddedCanvasStateResolver: (props) => {
        const Resolver = createDemoEmbeddedCanvasStateResolver(workspaceRef.current)
        return createElement(Resolver, props)
      },
      SidebarItemEmbedResolver: (props) => {
        const Resolver = createDemoSidebarItemEmbedResolver(workspaceRef.current)
        return createElement(Resolver, props)
      },
    }
  }

  return sourceRef.current
}

function createLocalDemoNoteEditableSession(
  note: NoteWithContent,
): EditorWorkspaceNoteEditableSession {
  const doc = blocksToYDoc(note.content, 'document')
  const provider = new LocalYjsProvider(doc)
  const collaborationProvider: EditorNoteCollaborationProvider = {
    awareness: provider.awareness,
    destroy: () => provider.destroy(),
    doc,
    emit: provider.emit.bind(provider),
    flushUpdates: () => Promise.resolve(),
    off: provider.off.bind(provider),
    on: provider.on.bind(provider),
  }

  return {
    destroy: () => {
      provider.destroy()
      doc.destroy()
    },
    doc,
    error: null,
    instanceId: `local-demo-note:${note._id}`,
    isLoading: false,
    provider: collaborationProvider,
    updateUser: (user) => provider.awareness.setLocalStateField('user', user),
    user: { name: 'Demo', color: '#61afef' },
  }
}

export function useLocalDemoNoteDocuments(
  workspace: DemoWorkspaceState,
): EditorWorkspaceNoteDocuments {
  const projectionRef = useRef(createDemoWorkspaceProjection(workspace))
  const sidebarItemsRef = useRef(createLocalDemoNoteSidebarItems(workspace))
  const sessionsRef = useRef(new Map<Id<'sidebarItems'>, EditorWorkspaceNoteEditableSession>())
  const documentsRef = useRef<EditorWorkspaceNoteDocuments | null>(null)
  projectionRef.current = createDemoWorkspaceProjection(workspace)
  sidebarItemsRef.current = createLocalDemoNoteSidebarItems(workspace)

  useEffect(() => {
    const sessions = sessionsRef.current
    return () => {
      sessions.forEach((session) => session.destroy())
      sessions.clear()
    }
  }, [])

  if (!documentsRef.current) {
    documentsRef.current = {
      kind: 'client',
      getSidebarItems: () => sidebarItemsRef.current,
      createEditableSession: (note) => {
        let session = sessionsRef.current.get(note._id)
        if (!session) {
          session = createLocalDemoNoteEditableSession(note)
          sessionsRef.current.set(note._id, session)
        }

        return session
      },
      createLinkResolver: (noteId, { isViewerMode }) => {
        const projection = projectionRef.current
        return createLinkResolver({
          allItems: projection.items,
          isViewerMode,
          itemsMap: projection.itemsById,
          sourceNoteId: noteId,
        })
      },
      createValueRuntimeSource: ({ noteId }) => createEmptyNoteValueRuntimeSource(noteId),
    }
  }

  return documentsRef.current
}
