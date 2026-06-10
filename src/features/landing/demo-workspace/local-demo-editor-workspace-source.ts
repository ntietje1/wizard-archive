import { EDITOR_MODE } from 'shared/editor/types'
import { blocksToYDoc } from 'shared/editor-blocks/blocknote-yjs'
import { validateSidebarItemNameWithSiblings } from 'shared/sidebar-items/name'
import { assertSidebarItemSlug } from 'shared/sidebar-items/slug'
import type {
  EditorNoteCollaborationProvider,
  EditorWorkspaceNoteDocuments,
  EditorWorkspaceNoteEditableSession,
  EditorWorkspaceNoteEditableSessionProviderProps,
  EditorWorkspaceNoteRuntimeProviderProps,
  EditorWorkspaceSource,
} from '~/features/editor/workspace/editor-workspace-source'
import type { FileViewerSource } from '~/features/editor/components/viewer/file/file-viewer-source'
import type { INITIAL_DEMO_WORKSPACE, DemoWorkspaceAction } from './demo-workspace-model'
import { createDemoWorkspaceProjection, selectedDemoItem } from './demo-workspace-model'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'
import { createLinkResolver } from '~/features/editor/links/link-resolver'
import { createEmptyNoteValueRuntimeSource } from '~/features/editor/value-block/note-value-runtime-source'
import { LocalYjsProvider } from './local-yjs-provider'
import type { Id } from 'convex/_generated/dataModel'
import { useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { NoteWithContent } from 'shared/notes/types'

type DemoWorkspaceState = typeof INITIAL_DEMO_WORKSPACE

const DEMO_CAMPAIGN_ID = 'demo-campaign' as Id<'campaigns'>

const noop = () => {}
const EmptyHistoryPreview = () => null
const EmptyRollbackDialog = () => null

export function createLocalDemoEditorWorkspaceSource({
  activeView,
  dispatch,
  fileViewerSource,
  noteDocuments,
  selectedItemId,
  workspace,
}: {
  activeView?: DemoWorkspaceState['activeView']
  dispatch: Dispatch<DemoWorkspaceAction>
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
      canViewCurrentItem: Boolean(contentItem),
      availabilityState: contentItem
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
      creationDraft: {
        pendingName: selectedItem?.title ?? '',
        setPendingName: (title) => dispatch({ type: 'renameSelectedItem', title }),
      },
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
      notes: noteDocuments,
    },
  }
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
  const sessionsRef = useRef(new Map<Id<'sidebarItems'>, EditorWorkspaceNoteEditableSession>())
  const documentsRef = useRef<EditorWorkspaceNoteDocuments | null>(null)
  projectionRef.current = createDemoWorkspaceProjection(workspace)

  useEffect(() => {
    const sessions = sessionsRef.current
    return () => {
      sessions.forEach((session) => session.destroy())
      sessions.clear()
    }
  }, [])

  if (!documentsRef.current) {
    documentsRef.current = {
      EditableSessionProvider: function LocalDemoEditableNoteSessionProvider({
        children,
        note,
      }: EditorWorkspaceNoteEditableSessionProviderProps) {
        let session = sessionsRef.current.get(note._id)
        if (!session) {
          session = createLocalDemoNoteEditableSession(note)
          sessionsRef.current.set(note._id, session)
        }

        return children(session)
      },
      RuntimeProvider: function LocalDemoNoteRuntimeProvider({
        children,
        editor: _editor,
        isViewerMode,
        noteId,
      }: EditorWorkspaceNoteRuntimeProviderProps) {
        const projection = projectionRef.current
        return children({
          linkResolver: createLinkResolver({
            allItems: projection.items,
            isViewerMode,
            itemsMap: projection.itemsById,
            sourceNoteId: noteId,
          }),
          valueRuntimeSource: createEmptyNoteValueRuntimeSource(noteId),
        })
      },
    }
  }

  return documentsRef.current
}
