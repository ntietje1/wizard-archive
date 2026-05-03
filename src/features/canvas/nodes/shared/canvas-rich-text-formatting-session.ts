import type { BlockNoteEditor } from '@blocknote/core'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { captureCanvasRichTextSelection } from './canvas-rich-text-blocknote-adapter'
import { resolveCanvasRichTextSelectionTextColor } from './canvas-rich-text-selection-colors'

export type CanvasRichTextFormattingEditor = Pick<
  BlockNoteEditor<any, any, any>,
  | 'document'
  | 'replaceBlocks'
  | 'addStyles'
  | 'focus'
  | 'getActiveStyles'
  | 'getSelection'
  | 'getSelectionCutBlocks'
  | 'getTextCursorPosition'
  | 'isEditable'
  | 'onChange'
  | 'onSelectionChange'
  | 'schema'
>

interface CanvasRichTextFormattingSession {
  defaultTextColor: string
  editor: CanvasRichTextFormattingEditor
  nodeId: string
  setDefaultTextColor: (color: string) => void
}

let activeSession: CanvasRichTextFormattingSession | null = null
const sessionListeners = new Set<() => void>()

export function registerCanvasRichTextFormattingSession(session: CanvasRichTextFormattingSession) {
  activeSession = session
  emitSessionChange()

  return () => {
    if (activeSession !== session) {
      return
    }

    activeSession = null
    emitSessionChange()
  }
}

export function useCanvasRichTextFormattingSnapshot() {
  const session = useSyncExternalStore(subscribeToSession, getActiveSession, getActiveSession)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    setRevision(0)
    if (!session) {
      return
    }

    const bumpRevision = () => setRevision((value) => value + 1)
    const unsubscribeSelection = session.editor.onSelectionChange(bumpRevision)
    const unsubscribeChange = session.editor.onChange(bumpRevision)

    return () => {
      unsubscribeSelection()
      unsubscribeChange()
    }
  }, [session])

  return session ? createFormattingSnapshot(session, revision) : null
}

function subscribeToSession(listener: () => void) {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

function getActiveSession() {
  return activeSession
}

function emitSessionChange() {
  sessionListeners.forEach((listener) => listener())
}

function createFormattingSnapshot(session: CanvasRichTextFormattingSession, revision: number) {
  const selection = session.editor.getSelection()
  const hasTextSelection = selection !== undefined
  const selectedTextBlocks = hasTextSelection
    ? session.editor.getSelectionCutBlocks().blocks
    : [session.editor.getTextCursorPosition().block]
  const activeTextColor = session.editor.getActiveStyles().textColor

  return {
    ...session,
    hasTextSelection,
    revision,
    selectionSnapshot: captureCanvasRichTextSelection(session.editor),
    textColorValue: resolveCanvasRichTextSelectionTextColor({
      activeTextColor: typeof activeTextColor === 'string' ? activeTextColor : null,
      defaultTextColor: session.defaultTextColor,
      hasTextSelection,
      selectedBlocks: selectedTextBlocks,
    }),
  }
}
