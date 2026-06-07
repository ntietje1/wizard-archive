import { BlockNoteView } from '@blocknote/shadcn'
import { useEffect, useRef } from 'react'
import { PreventExternalDrop } from './extensions/prevent-external-drop/prevent-external-drop'
import { SlashMenu } from './extensions/slash-menu/slash-menu'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { LinkResolver } from '~/features/editor/hooks/useLinkResolver'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useDisableAutolink } from '~/features/editor/hooks/useDisableAutolink'
import { useLinkDecorations } from '~/features/editor/hooks/useLinkDecorations'
import { useResolvedTheme } from '~/shared/theme/context'
import {
  patchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy,
  runYjsHistoryCommand,
} from '~/features/editor/utils/patch-yundo-destroy'
import './extensions/wiki-link/wiki-link.css'
import './extensions/md-link/md-link.css'

export function NoteEditorCore({
  editor,
  editable,
  editableChrome = null,
  enableYjsHistory = false,
  linkResolver,
  style,
  children,
}: {
  editor: CustomBlockNoteEditor
  editable: boolean
  editableChrome?: ReactNode
  enableYjsHistory?: boolean
  linkResolver: LinkResolver
  style?: CSSProperties
  children?: ReactNode
}) {
  const resolvedTheme = useResolvedTheme()
  const noteSurfaceRef = useRef<HTMLDivElement | null>(null)
  const isViewerMode = !editable || linkResolver.isViewerMode

  useLinkDecorations(editor, linkResolver, isViewerMode)
  useDisableAutolink(editor)
  useYjsUndoPatches(editor, enableYjsHistory)
  useNoteYjsUndoShortcutPatch(editor, noteSurfaceRef, enableYjsHistory && !isViewerMode)

  return (
    <div ref={noteSurfaceRef} className="contents">
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
  )
}

function useYjsUndoPatches(editor: CustomBlockNoteEditor, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    // BlockNote does not expose public hooks for these y-prosemirror patches, so
    // keep the private TipTap view access isolated to this live-collaboration path.
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
