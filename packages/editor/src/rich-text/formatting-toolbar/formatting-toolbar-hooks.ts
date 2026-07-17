import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  EMPTY_TOOLBAR_SNAPSHOT,
  getVisibleToolbarSnapshot,
  toolbarSnapshotsEqual,
} from './formatting-toolbar-model'
import { getNextBlockTypeMenuState } from './formatting-toolbar-state'
import {
  blockNoteSelectionSnapshotCollapsedPosition,
  captureBlockNoteSelection,
  setBlockNotePendingTextColor,
} from '../blocknote/blocknote-selection-adapter'
import type { BlockTypeMenuChangeDetails } from './formatting-toolbar-state'
import type {
  FormattingToolbarMode,
  InlineStyle,
  RichTextFormattingEditor,
  ToolbarSnapshot,
} from './formatting-toolbar-model'
import type { BlockNoteSelectionSnapshot } from '../blocknote/blocknote-selection-adapter'

type PendingStyleColors = Partial<Record<'backgroundColor' | 'textColor', string>>
type PendingInlineStyles = Partial<Record<InlineStyle, boolean>>

export type FormattingToolbarSelectionController = {
  captureSelection: () => void
  getCurrentSelectionSnapshot: () => BlockNoteSelectionSnapshot | null
  getStoredSelectionSnapshot: () => BlockNoteSelectionSnapshot | null
  storeSelectionSnapshot: (selectionSnapshot: BlockNoteSelectionSnapshot | null) => void
}

export type PendingFormattingController = {
  clearIfSelectionMoved: (selectionSnapshot: BlockNoteSelectionSnapshot | null) => void
  markPendingInlineStyle: (
    style: InlineStyle,
    active: boolean,
    selectionSnapshot: BlockNoteSelectionSnapshot | null,
  ) => void
  markPendingStyleColor: (
    style: keyof PendingStyleColors,
    color: string,
    selectionSnapshot: BlockNoteSelectionSnapshot | null,
  ) => void
  pendingInlineStyles: PendingInlineStyles
  pendingStyleColors: PendingStyleColors
}

export function useFormattingToolbarSelection(
  editor: RichTextFormattingEditor | null,
): FormattingToolbarSelectionController {
  const selectionSnapshotRef = useRef<BlockNoteSelectionSnapshot | null>(null)

  useEffect(() => {
    selectionSnapshotRef.current = null
  }, [editor])

  return {
    captureSelection() {
      selectionSnapshotRef.current = captureBlockNoteSelection(editor)
    },
    getCurrentSelectionSnapshot() {
      const currentSelectionSnapshot = captureBlockNoteSelection(editor)
      if (currentSelectionSnapshot) {
        selectionSnapshotRef.current = currentSelectionSnapshot
        return currentSelectionSnapshot
      }

      return selectionSnapshotRef.current
    },
    getStoredSelectionSnapshot() {
      return selectionSnapshotRef.current
    },
    storeSelectionSnapshot(selectionSnapshot) {
      selectionSnapshotRef.current = selectionSnapshot
    },
  }
}

export function usePendingFormattingState(
  editor: RichTextFormattingEditor | null,
): PendingFormattingController {
  const pendingEditorRef = useRef(editor)
  const hasPendingStylesRef = useRef(false)
  const pendingSelectionPositionRef = useRef<number | null>(null)
  const [pendingFormatting, setPendingFormatting] = useState<{
    editor: RichTextFormattingEditor | null
    inlineStyles: PendingInlineStyles
    styleColors: PendingStyleColors
  }>({ editor, inlineStyles: {}, styleColors: {} })
  const pendingInlineStyles =
    pendingFormatting.editor === editor ? pendingFormatting.inlineStyles : {}
  const pendingStyleColors =
    pendingFormatting.editor === editor ? pendingFormatting.styleColors : {}
  const resetRefsForCurrentEditor = () => {
    if (pendingEditorRef.current === editor) return

    pendingEditorRef.current = editor
    hasPendingStylesRef.current = false
    pendingSelectionPositionRef.current = null
  }
  const clearPendingStyles = () => {
    resetRefsForCurrentEditor()
    hasPendingStylesRef.current = false
    pendingSelectionPositionRef.current = null
    setPendingFormatting({ editor, inlineStyles: {}, styleColors: {} })
    setBlockNotePendingTextColor(editor, null)
  }

  return {
    clearIfSelectionMoved(selectionSnapshot) {
      resetRefsForCurrentEditor()
      const collapsedPosition = blockNoteSelectionSnapshotCollapsedPosition(selectionSnapshot)
      const pendingSelectionPosition = pendingSelectionPositionRef.current
      if (
        hasPendingStylesRef.current &&
        (collapsedPosition === null ||
          pendingSelectionPosition === null ||
          collapsedPosition !== pendingSelectionPosition)
      ) {
        clearPendingStyles()
      }
    },
    markPendingInlineStyle(style, active, selectionSnapshot) {
      resetRefsForCurrentEditor()
      pendingSelectionPositionRef.current =
        blockNoteSelectionSnapshotCollapsedPosition(selectionSnapshot)
      hasPendingStylesRef.current = true
      setPendingFormatting((current) => ({
        editor,
        inlineStyles: {
          ...(current.editor === editor ? current.inlineStyles : {}),
          [style]: active,
        },
        styleColors: current.editor === editor ? current.styleColors : {},
      }))
    },
    markPendingStyleColor(style, color, selectionSnapshot) {
      resetRefsForCurrentEditor()
      pendingSelectionPositionRef.current =
        blockNoteSelectionSnapshotCollapsedPosition(selectionSnapshot)
      hasPendingStylesRef.current = true
      if (style === 'textColor') {
        setBlockNotePendingTextColor(editor, color)
      }
      setPendingFormatting((current) => ({
        editor,
        inlineStyles: current.editor === editor ? current.inlineStyles : {},
        styleColors: {
          ...(current.editor === editor ? current.styleColors : {}),
          [style]: color,
        },
      }))
    },
    pendingInlineStyles,
    pendingStyleColors,
  }
}

export function useFormattingToolbarSnapshot({
  defaultTextColor,
  editor,
  mode,
  onSelectionChanged,
  onSelectionSnapshot,
  visible,
}: {
  defaultTextColor: string
  editor: RichTextFormattingEditor | null
  mode: FormattingToolbarMode
  onSelectionChanged: (selectionSnapshot: BlockNoteSelectionSnapshot | null) => void
  onSelectionSnapshot: (selectionSnapshot: BlockNoteSelectionSnapshot | null) => void
  visible: boolean
}) {
  const snapshotRef = useRef<ToolbarSnapshot>(EMPTY_TOOLBAR_SNAPSHOT)
  const onSelectionChangedRef = useRef(onSelectionChanged)
  const onSelectionSnapshotRef = useRef(onSelectionSnapshot)

  useEffect(() => {
    onSelectionChangedRef.current = onSelectionChanged
    onSelectionSnapshotRef.current = onSelectionSnapshot
  }, [onSelectionChanged, onSelectionSnapshot])

  const subscribe = (onStoreChange: () => void) => {
    if (!editor || !visible || !editor.isEditable) {
      return () => undefined
    }

    const unsubscribeSelection = editor.onSelectionChange(() => {
      const selectionSnapshot = captureBlockNoteSelection(editor)
      onSelectionSnapshotRef.current(selectionSnapshot)
      onSelectionChangedRef.current(selectionSnapshot)
      onStoreChange()
    })
    const unsubscribeChange = editor.onChange(onStoreChange)

    return () => {
      unsubscribeSelection()
      unsubscribeChange()
    }
  }

  return useSyncExternalStore(
    subscribe,
    () => {
      const nextSnapshot = getVisibleToolbarSnapshot({
        defaultTextColor,
        editor,
        mode,
        visible,
      })
      if (toolbarSnapshotsEqual(snapshotRef.current, nextSnapshot)) {
        return snapshotRef.current
      }

      snapshotRef.current = nextSnapshot
      return nextSnapshot
    },
    () => EMPTY_TOOLBAR_SNAPSHOT,
  )
}

export function usePendingTextColor({
  editor,
  pendingTextColor,
  visible,
}: {
  editor: RichTextFormattingEditor | null
  pendingTextColor: string | undefined
  visible: boolean
}) {
  const editorEditable = editor?.isEditable ?? false

  useEffect(() => {
    const visiblePendingTextColor =
      editor && visible && editorEditable ? (pendingTextColor ?? null) : null
    setBlockNotePendingTextColor(editor, visiblePendingTextColor)
    return () => setBlockNotePendingTextColor(editor, null)
  }, [editor, editorEditable, pendingTextColor, visible])
}

export function useBlockTypeMenuState() {
  const ignoreOpeningClickCloseRef = useRef(false)
  const [open, setOpen] = useState(false)
  const handleOpenChange = (nextOpen: boolean, details: BlockTypeMenuChangeDetails) => {
    const nextState = getNextBlockTypeMenuState({
      ignoreOpeningClickClose: ignoreOpeningClickCloseRef.current,
      nextOpen,
      details,
    })
    ignoreOpeningClickCloseRef.current = nextState.ignoreOpeningClickClose
    setOpen(nextState.open)
  }

  return {
    handleOpenChange,
    open,
  }
}
