import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import { useEffect, useRef } from 'react'
import { PreventExternalDrop } from '../rich-text/blocknote/prevent-external-drop'
import { SlashMenu } from './slash-menu/slash-menu'
import { NoteEmbedSurfaceProvider } from './embeds/surface-context'
import type { CustomBlockNoteEditor } from './editor-schema'
import type { LinkResolver } from './references/resolver'
import type { CSSProperties, DragEvent as ReactDragEvent, ReactNode, RefObject } from 'react'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { EmbedTargetOperations } from '../embeds/target-operations'
import type { EmbeddedNotePreviewRenderer } from './embeds/embedded-note-preview-renderer'
import { useNoteLinkDecorations } from './links/use-note-link-decorations'
import { useResolvedTheme } from '@wizard-archive/ui/theme/context'
import { useMergedRef } from '../drag-drop/ref-utils'
import { useNoteEditorDropTarget } from './use-note-editor-drop-target'
import {
  patchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy,
  runYjsHistoryCommand,
} from '../collaboration/yjs-history-patches'
import './links/md-link.css'
import {
  clearInternalNativeDrag,
  markInternalNativeDrag,
} from '@wizard-archive/ui/drag-drop/internal-native-drag'

export function NoteEditorCore({
  editor,
  editable,
  editableChrome = null,
  embedTargetOperations,
  enableYjsHistory = false,
  linkResolver,
  renderEmbeddedNotePreview,
  sourceNoteId = null,
  style,
  children,
}: {
  editor: CustomBlockNoteEditor
  editable: boolean
  editableChrome?: ReactNode
  embedTargetOperations?: EmbedTargetOperations
  enableYjsHistory?: boolean
  linkResolver: LinkResolver
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
  sourceNoteId?: SidebarItemId | null
  style?: CSSProperties
  children?: ReactNode
}) {
  const resolvedTheme = useResolvedTheme()
  const noteSurfaceRef = useRef<HTMLDivElement | null>(null)
  const isViewerMode = !editable || linkResolver.isViewerMode
  const canTargetNoteBodyExternalUrls = editable && !isViewerMode && sourceNoteId !== null
  const canTargetNoteBodyExternalFiles =
    canTargetNoteBodyExternalUrls && Boolean(embedTargetOperations?.uploadFile)
  const { dropTargetRef } = useNoteEditorDropTarget({
    editor,
    enabled: editable && !isViewerMode,
    sourceNoteId,
    uploadFile: embedTargetOperations?.uploadFile,
  })
  const noteSurfaceMergedRef = useMergedRef(noteSurfaceRef, dropTargetRef)

  useNoteLinkDecorations(editor, linkResolver, isViewerMode)
  useYjsUndoPatches(editor, enableYjsHistory)
  useNoteYjsUndoShortcutPatch(editor, noteSurfaceRef, enableYjsHistory && !isViewerMode)

  return (
    <NoteEmbedSurfaceProvider
      sourceNoteId={sourceNoteId}
      editable={editable}
      embedTargetOperations={embedTargetOperations}
      renderEmbeddedNotePreview={renderEmbeddedNotePreview}
    >
      <div
        ref={noteSurfaceMergedRef}
        data-blocknote-external-drop-target={canTargetNoteBodyExternalFiles ? 'true' : undefined}
        data-blocknote-external-url-drop-target={canTargetNoteBodyExternalUrls ? 'true' : undefined}
        className="note-editor-core-surface"
        onDragStart={markNoteEditorNativeDrag}
        onDragEnd={clearInternalNativeDrag}
      >
        <BlockNoteView
          editor={editor}
          style={style}
          theme={resolvedTheme}
          editable={editable}
          sideMenu={false}
          formattingToolbar={false}
          slashMenu={false}
          linkToolbar={false}
        >
          {editable ? (
            <>
              <PreventExternalDrop />
              {editableChrome}
              <SlashMenu editor={editor} />
            </>
          ) : null}
          {children}
        </BlockNoteView>
      </div>
    </NoteEmbedSurfaceProvider>
  )
}

function markNoteEditorNativeDrag(event: ReactDragEvent<HTMLElement>) {
  markInternalNativeDrag(event.dataTransfer)
}

function useYjsUndoPatches(editor: CustomBlockNoteEditor, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    // BlockNote does not expose public hooks for these y-prosemirror patches, so
    // keep the private TipTap view access isolated to this collaboration undo path.
    const view = editor._tiptapEditor.view
    patchYUndoPluginDestroy(view)
    patchYSyncAfterTypeChanged(view)
  }, [enabled, editor])
}

function useNoteYjsUndoShortcutPatch(
  editor: CustomBlockNoteEditor,
  noteSurfaceRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const surface = noteSurfaceRef.current
    if (!enabled || !surface) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        !isHistoryShortcut(event) ||
        !editor._tiptapEditor.view.hasFocus() ||
        !isEventInsideNoteSurface(event, surface)
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      runYjsHistoryCommand(editor._tiptapEditor.view, getHistoryDirection(event))
    }

    surface.addEventListener('keydown', handleKeyDown)
    return () => surface.removeEventListener('keydown', handleKeyDown)
  }, [enabled, editor, noteSurfaceRef])
}

function isHistoryShortcut(event: globalThis.KeyboardEvent) {
  if (event.altKey || (!event.ctrlKey && !event.metaKey)) return false

  const key = event.key.toLowerCase()
  return key === 'z' || (event.ctrlKey && !event.metaKey && key === 'y')
}

function getHistoryDirection(event: globalThis.KeyboardEvent): 'undo' | 'redo' {
  const key = event.key.toLowerCase()
  if (key === 'y' || (key === 'z' && event.shiftKey)) return 'redo'
  return 'undo'
}

function isEventInsideNoteSurface(event: globalThis.KeyboardEvent, surface: HTMLElement) {
  const target = event.target
  return target instanceof Node && surface.contains(target)
}
