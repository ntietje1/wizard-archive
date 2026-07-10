import { useState } from 'react'
import { LinkClickHandlerSurface } from './link-click-handler'
import { WikiLinkAutocomplete } from './wiki-link/autocomplete'
import { createLinkResolver } from './references/resolver'
import { useNoteValueRuntimeSource } from './value-runtime'
import type { ReactNode, RefObject } from 'react'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { NoteItemWithContent } from '../notes/item-contract'
import type { CustomBlockNoteEditor } from './editor-schema'
import type { LinkResolver } from './references/resolver'
import type {
  NoteValueReferences,
  NoteValueRuntimeSource,
  NoteValueRuntimeStateSource,
} from './value-runtime-model'
import type {
  WikiLinkAutocompleteMenuState,
  WikiLinkAutocompleteModelDataArgs,
} from './wiki-link/autocomplete-source'
import type {
  NoteDocumentContentSource,
  NoteLinkCreationSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
  NoteWikiLinkContentSource,
} from './runtime'
import type { NoteEditorSession } from './session-contract'

interface NoteRuntime {
  linkResolver: LinkResolver
  valueRuntimeSource: NoteValueRuntimeSource
}

const CLOSED_WIKI_LINK_AUTOCOMPLETE_MENU: WikiLinkAutocompleteMenuState = {
  show: false,
  query: '',
  pos: null,
}

export function NoteEditableSession({
  children,
  note,
  source,
}: {
  children: (session: NoteEditorSession) => ReactNode
  note: NoteItemWithContent
  source: NoteDocumentContentSource
}) {
  const session = source.useNoteCollaborationSession({ mode: 'editable', note })

  return children(session)
}

export function NoteDocumentRuntime({
  children,
  editor,
  isViewerMode,
  linkResolutionSource,
  noteId,
  noteValueReferences,
  noteValueStateSource,
}: {
  children: (runtime: NoteRuntime) => ReactNode
  editor: CustomBlockNoteEditor | null
  isViewerMode: boolean
  linkResolutionSource: NoteLinkResolutionSource
  noteId?: SidebarItemId
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
}) {
  const runtime = useNoteDocumentRuntime({
    editor,
    isViewerMode,
    linkResolutionSource,
    noteId,
    noteValueReferences,
    noteValueStateSource,
  })

  return children(runtime)
}

function useNoteDocumentRuntime({
  editor,
  isViewerMode,
  linkResolutionSource,
  noteId,
  noteValueReferences,
  noteValueStateSource,
}: {
  editor: CustomBlockNoteEditor | null
  isViewerMode: boolean
  linkResolutionSource: NoteLinkResolutionSource
  noteId?: SidebarItemId
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
}): NoteRuntime {
  const valueRuntimeSource = useNoteValueRuntimeSource({
    editor,
    noteId,
    references: noteValueReferences,
    stateSource: noteValueStateSource,
  })

  return {
    linkResolver: createLinkResolver({
      isViewerMode,
      revision: linkResolutionSource.revision,
      resolveItemPath: (parsed) =>
        linkResolutionSource.resolveItemPath({
          pathKind: parsed.pathKind,
          pathSegments: parsed.itemPath,
          sourceNoteId: noteId,
        }),
    }),
    valueRuntimeSource,
  }
}

export function NoteLinkClickHandler({
  editor,
  editorMode,
  forceOpenLinkPopover,
  linkCreation,
  linkNavigationSource,
  sourceNoteId,
}: {
  editor: CustomBlockNoteEditor | undefined
  editorMode: 'editor' | 'viewer'
  forceOpenLinkPopover?: () => void
  linkCreation: NoteLinkCreationSource | null
  linkNavigationSource: NoteLinkNavigationSource | null
  sourceNoteId?: SidebarItemId
}) {
  const linkNavigation = linkNavigationSource
  if (!linkNavigation && !linkCreation) return null

  return (
    <LinkClickHandlerSurface
      editor={editor}
      editorMode={editorMode}
      forceOpenLinkPopover={forceOpenLinkPopover}
      linkCreation={linkCreation}
      linkNavigation={linkNavigation}
      sourceParentId={
        linkNavigation && sourceNoteId ? linkNavigation.getSourceParentId(sourceNoteId) : undefined
      }
    />
  )
}

export function NoteWikiLinkAutocomplete({
  editor,
  onForceOpenRef,
  source,
  sourceNoteId,
}: {
  editor: CustomBlockNoteEditor | undefined
  onForceOpenRef?: RefObject<(() => void) | null>
  source: NoteWikiLinkContentSource
  sourceNoteId?: SidebarItemId
}) {
  const [menu, setMenu] = useState<WikiLinkAutocompleteMenuState>(
    CLOSED_WIKI_LINK_AUTOCOMPLETE_MENU,
  )
  const modelData = useNoteWikiLinkAutocompleteModelData(source, { menu, sourceNoteId })

  return (
    <WikiLinkAutocomplete
      editor={editor}
      menu={menu}
      modelData={modelData}
      onForceOpenRef={onForceOpenRef}
      setMenu={setMenu}
      sourceNoteId={sourceNoteId}
    />
  )
}

function useNoteWikiLinkAutocompleteModelData(
  source: NoteWikiLinkContentSource,
  input: WikiLinkAutocompleteModelDataArgs,
) {
  return source.useWikiLinkAutocompleteModelData(input)
}
