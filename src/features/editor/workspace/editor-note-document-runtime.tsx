import { api } from 'convex/_generated/api'
import { use, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLinkResolver } from '~/features/editor/hooks/useLinkResolver'
import { useNoteYjsCollaboration } from '~/features/editor/hooks/useNoteYjsCollaboration'
import { getCursorColor } from '~/features/editor/utils/cursor-colors'
import { useLiveNoteValueRuntimeSource } from '~/features/editor/value-block/use-live-note-value-runtime-source'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { updateConvexYjsProviderUser } from '~/shared/collaboration/convex-yjs-provider'
import {
  LinkClickHandler,
  LinkClickHandlerSurface,
} from '../components/extensions/link-click-handler'
import { LiveWikiLinkAutocomplete } from '../components/extensions/wiki-link/live-wiki-link-autocomplete'
import { WikiLinkAutocomplete } from '../components/extensions/wiki-link/wiki-link-autocomplete'
import {
  buildWikiLinkAutocompleteModel,
  getWikiLinkAutocompleteContext,
} from '../components/extensions/wiki-link/wiki-link-autocomplete-model'
import { NoteValueRuntimeContext } from '../value-block/value-block-runtime-context'
import type { Id } from 'convex/_generated/dataModel'
import type { ReactNode, RefObject } from 'react'
import type { NoteWithContent } from 'shared/notes/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { LinkResolver } from '~/features/editor/links/link-resolver'
import type { NoteValueRuntimeSource } from '~/features/editor/value-block/note-value-runtime-source'
import type { WikiLinkAutocompleteMenuState } from '../components/extensions/wiki-link/wiki-link-autocomplete-source'
import type {
  EditorWorkspaceNoteDocuments,
  EditorWorkspaceNoteEditableSession,
} from './editor-workspace-source'

const CLOSED_WIKI_LINK_AUTOCOMPLETE_MENU: WikiLinkAutocompleteMenuState = {
  show: false,
  query: '',
  pos: null,
}

export function EditorNoteEditableSession({
  children,
  documents,
  note,
}: {
  children: (session: EditorWorkspaceNoteEditableSession) => ReactNode
  documents: EditorWorkspaceNoteDocuments
  note: NoteWithContent
}) {
  if (documents.kind === 'client') {
    return (
      <ClientNoteEditableSession documents={documents} note={note}>
        {children}
      </ClientNoteEditableSession>
    )
  }

  return <LiveNoteEditableSession note={note}>{children}</LiveNoteEditableSession>
}

function LiveNoteEditableSession({
  children,
  note,
}: {
  children: (session: EditorWorkspaceNoteEditableSession) => ReactNode
  note: NoteWithContent
}) {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const user = {
    name: profile?.name ?? profile?.username ?? 'Anonymous',
    color: profile ? getCursorColor(profile._id) : '#61afef',
  }
  const session = useNoteYjsCollaboration(note._id, user, true)

  return children({
    destroy: () => {},
    doc: session.doc,
    error: session.error,
    instanceId: session.instanceId,
    isLoading: session.isLoading,
    provider: session.provider,
    updateUser: (nextUser) => {
      if (session.provider) {
        updateConvexYjsProviderUser(session.provider, nextUser)
      }
    },
    user,
  })
}

function ClientNoteEditableSession({
  children,
  documents,
  note,
}: {
  children: (session: EditorWorkspaceNoteEditableSession) => ReactNode
  documents: Extract<EditorWorkspaceNoteDocuments, { kind: 'client' }>
  note: NoteWithContent
}) {
  const [session] = useState(() => documents.createEditableSession(note))

  useEffect(() => () => session.destroy(), [session])

  return children(session)
}

export function EditorNoteRuntime({
  children,
  documents,
  editor,
  isViewerMode,
  noteId,
}: {
  children: (runtime: {
    linkResolver: LinkResolver
    valueRuntimeSource: NoteValueRuntimeSource
  }) => ReactNode
  documents: EditorWorkspaceNoteDocuments
  editor: CustomBlockNoteEditor | null
  isViewerMode: boolean
  noteId?: Id<'sidebarItems'>
}) {
  if (documents.kind === 'client') {
    return (
      <ClientNoteRuntime
        documents={documents}
        editor={editor}
        isViewerMode={isViewerMode}
        noteId={noteId}
      >
        {children}
      </ClientNoteRuntime>
    )
  }

  return (
    <LiveNoteRuntime editor={editor} isViewerMode={isViewerMode} noteId={noteId}>
      {children}
    </LiveNoteRuntime>
  )
}

function LiveNoteRuntime({
  children,
  editor,
  isViewerMode,
  noteId,
}: {
  children: (runtime: {
    linkResolver: LinkResolver
    valueRuntimeSource: NoteValueRuntimeSource
  }) => ReactNode
  editor: CustomBlockNoteEditor | null
  isViewerMode: boolean
  noteId?: Id<'sidebarItems'>
}) {
  const linkResolver = useLinkResolver(noteId, { isViewerMode })
  const valueRuntimeSource = useLiveNoteValueRuntimeSource({ editor, noteId })

  return children({ linkResolver, valueRuntimeSource })
}

function ClientNoteRuntime({
  children,
  documents,
  editor,
  isViewerMode,
  noteId,
}: {
  children: (runtime: {
    linkResolver: LinkResolver
    valueRuntimeSource: NoteValueRuntimeSource
  }) => ReactNode
  documents: Extract<EditorWorkspaceNoteDocuments, { kind: 'client' }>
  editor: CustomBlockNoteEditor | null
  isViewerMode: boolean
  noteId?: Id<'sidebarItems'>
}) {
  return children({
    linkResolver: documents.createLinkResolver(noteId, { isViewerMode }),
    valueRuntimeSource: documents.createValueRuntimeSource({ editor, noteId }),
  })
}

export function EditorNoteLinkClickHandler({
  documents,
  editor,
  editorMode,
  sourceNoteId,
}: {
  documents: EditorWorkspaceNoteDocuments
  editor: CustomBlockNoteEditor | undefined
  editorMode: 'editor' | 'viewer'
  sourceNoteId?: Id<'sidebarItems'>
}) {
  if (documents.kind === 'live') {
    return <LinkClickHandler editor={editor} sourceNoteId={sourceNoteId} />
  }

  return (
    <ClientNoteLinkClickHandler
      documents={documents}
      editor={editor}
      editorMode={editorMode}
      sourceNoteId={sourceNoteId}
    />
  )
}

function ClientNoteLinkClickHandler({
  documents,
  editor,
  editorMode,
  sourceNoteId,
}: {
  documents: Extract<EditorWorkspaceNoteDocuments, { kind: 'client' }>
  editor: CustomBlockNoteEditor | undefined
  editorMode: 'editor' | 'viewer'
  sourceNoteId?: Id<'sidebarItems'>
}) {
  const navigate = useNavigate()
  const sidebarItems = documents.getSidebarItems()

  return (
    <LinkClickHandlerSurface
      campaignId={undefined}
      editor={editor}
      editorMode={editorMode}
      itemsMap={sidebarItems.itemsMap}
      navigate={navigate}
      parentItemsMap={sidebarItems.parentItemsMap}
      sourceNoteId={sourceNoteId}
    />
  )
}

export function EditorNoteWikiLinkAutocomplete({
  documents,
  editor,
  onForceOpenRef,
  sourceNoteId,
}: {
  documents: EditorWorkspaceNoteDocuments
  editor: CustomBlockNoteEditor | undefined
  onForceOpenRef?: RefObject<(() => void) | null>
  sourceNoteId?: Id<'sidebarItems'>
}) {
  if (documents.kind === 'live') {
    return (
      <LiveWikiLinkAutocomplete
        editor={editor}
        onForceOpenRef={onForceOpenRef}
        sourceNoteId={sourceNoteId}
      />
    )
  }

  return (
    <ClientNoteWikiLinkAutocomplete
      documents={documents}
      editor={editor}
      onForceOpenRef={onForceOpenRef}
      sourceNoteId={sourceNoteId}
    />
  )
}

function ClientNoteWikiLinkAutocomplete({
  documents,
  editor,
  onForceOpenRef,
  sourceNoteId,
}: {
  documents: Extract<EditorWorkspaceNoteDocuments, { kind: 'client' }>
  editor: CustomBlockNoteEditor | undefined
  onForceOpenRef?: RefObject<(() => void) | null>
  sourceNoteId?: Id<'sidebarItems'>
}) {
  const [menu, setMenu] = useState<WikiLinkAutocompleteMenuState>(
    CLOSED_WIKI_LINK_AUTOCOMPLETE_MENU,
  )
  const valueRuntime = use(NoteValueRuntimeContext)
  const sidebarItems = documents.getSidebarItems()
  const sourceParentId = sourceNoteId
    ? sidebarItems.itemsMap.get(sourceNoteId)?.parentId
    : undefined
  const context = menu.show
    ? getWikiLinkAutocompleteContext(
        menu.query,
        sidebarItems.items,
        sidebarItems.itemsMap,
        sourceParentId,
      )
    : null
  const values =
    context?.mode === 'value' && context.resolvedItem._id === valueRuntime?.noteId
      ? valueRuntime.authoredValueStates
      : []

  return (
    <WikiLinkAutocomplete
      editor={editor}
      menu={menu}
      modelData={{
        context,
        headingsPending: false,
        model: buildWikiLinkAutocompleteModel({
          context,
          sidebarItems: sidebarItems.items,
          itemsMap: sidebarItems.itemsMap,
          headings: [],
          values,
        }),
        valuesPending: false,
      }}
      onForceOpenRef={onForceOpenRef}
      setMenu={setMenu}
      sourceNoteId={sourceNoteId}
    />
  )
}
