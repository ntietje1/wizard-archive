import { Pilcrow, Redo2, Undo2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import {
  applyFormattingToolbarBlockType,
  applyFormattingToolbarStyleColor,
  applyFormattingToolbarTextAlignment,
  toggleFormattingToolbarInlineStyle,
} from './formatting-toolbar-commands'
import { stringStyleExistsInSchema } from './formatting-toolbar-model'
import { Separator } from '@wizard-archive/ui/shadcn/components/separator'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { DEFAULT_RICH_TEXT_COLOR_VALUE } from '../blocknote/rich-text-selection-colors'
import { ColorControls } from './formatting-toolbar-color-controls'
import {
  BlockTypeControl,
  InlineStyleControls,
  TextAlignmentControls,
} from './formatting-toolbar-controls'
import { eventStartedOnToolbarTrigger, preventEditorBlur } from './formatting-toolbar-events'
import {
  useBlockTypeMenuState,
  usePendingFormattingState,
  useFormattingToolbarSelection,
  useFormattingToolbarSnapshot,
  usePendingTextColor,
} from './formatting-toolbar-hooks'
import type {
  FormattingToolbarSelectionController,
  PendingFormattingController,
} from './formatting-toolbar-hooks'
import type {
  RichTextFormattingEditor,
  FormattingToolbarMode,
  InlineStyle,
  TextAlignment,
  ToolbarSnapshot,
} from './formatting-toolbar-model'
import type { BlockNoteSelectionSnapshot } from '../blocknote/blocknote-selection-adapter'
import { Button } from '@wizard-archive/ui/shadcn/components/button'

interface RichTextFormattingToolbarProps {
  ariaLabel: string
  className?: string
  defaultTextColor?: string
  editor: RichTextFormattingEditor | null
  mode: FormattingToolbarMode
  onApplyCollapsedTextColor?: (
    editor: RichTextFormattingEditor,
    color: string,
    selectionSnapshot: BlockNoteSelectionSnapshot | null,
  ) => void
  onDefaultTextColorChange?: (color: string) => void
  visible: boolean
}

export function RichTextFormattingToolbar({
  ariaLabel,
  className,
  defaultTextColor = DEFAULT_RICH_TEXT_COLOR_VALUE.color,
  editor,
  mode,
  onApplyCollapsedTextColor,
  onDefaultTextColorChange,
  visible,
}: RichTextFormattingToolbarProps) {
  const selectionController = useFormattingToolbarSelection(editor)
  const pendingFormattingController = usePendingFormattingState(editor)
  const snapshot = useFormattingToolbarSnapshot({
    defaultTextColor,
    editor,
    mode,
    onSelectionChanged: pendingFormattingController.clearIfSelectionMoved,
    onSelectionSnapshot: selectionController.storeSelectionSnapshot,
    visible,
  })
  usePendingTextColor({
    editor,
    pendingTextColor: pendingFormattingController.pendingStyleColors.textColor,
    visible,
  })

  if (!editor || !visible || !editor.isEditable) {
    return null
  }

  return (
    <FormattingToolbarContent
      ariaLabel={ariaLabel}
      className={className}
      editor={editor}
      mode={mode}
      onApplyCollapsedTextColor={onApplyCollapsedTextColor}
      onDefaultTextColorChange={onDefaultTextColorChange}
      pendingFormattingController={pendingFormattingController}
      selectionController={selectionController}
      snapshot={snapshot}
    />
  )
}

function FormattingToolbarContent({
  ariaLabel,
  className,
  editor,
  mode,
  onApplyCollapsedTextColor,
  onDefaultTextColorChange,
  pendingFormattingController,
  selectionController,
  snapshot,
}: {
  ariaLabel: string
  className: string | undefined
  editor: RichTextFormattingEditor
  mode: FormattingToolbarMode
  onApplyCollapsedTextColor: RichTextFormattingToolbarProps['onApplyCollapsedTextColor']
  onDefaultTextColorChange: RichTextFormattingToolbarProps['onDefaultTextColorChange']
  pendingFormattingController: PendingFormattingController
  selectionController: FormattingToolbarSelectionController
  snapshot: ToolbarSnapshot
}) {
  const blockTypeMenu = useBlockTypeMenuState()
  const scheduleEditorFocus = useDeferredEditorFocus(editor)
  const activeBlockType =
    snapshot.supportedBlockTypes.find((option) => option.id === snapshot.activeBlockTypeId) ?? null
  const blockTypeLabel = activeBlockType?.label ?? 'Block type'
  const BlockTypeIcon = activeBlockType?.icon ?? Pilcrow
  const textColorSupported = stringStyleExistsInSchema(editor, 'textColor')
  const backgroundColorSupported = stringStyleExistsInSchema(editor, 'backgroundColor')
  const activeInlineStyles = {
    ...snapshot.activeStyles,
    ...pendingFormattingController.pendingInlineStyles,
  }
  const handleBlockTypeChange = (nextTypeId: string) => {
    const nextType = snapshot.supportedBlockTypes.find((option) => option.id === nextTypeId)
    if (!nextType) return

    applyFormattingToolbarBlockType({
      editor,
      nextType,
      selectionSnapshot: selectionController.getStoredSelectionSnapshot(),
    })
  }

  const toggleInlineStyle = (style: InlineStyle) => {
    const selectionSnapshot = selectionController.getCurrentSelectionSnapshot()
    const active = !!activeInlineStyles[style]
    toggleFormattingToolbarInlineStyle({
      active,
      editor,
      hasTextSelection: snapshot.hasTextSelection,
      selectionSnapshot,
      style,
    })
    if (!snapshot.hasTextSelection) {
      pendingFormattingController.markPendingInlineStyle(style, !active, selectionSnapshot)
    }
  }

  const setTextAlignment = (alignment: TextAlignment) => {
    applyFormattingToolbarTextAlignment({
      alignment,
      editor,
      selectionSnapshot: selectionController.getStoredSelectionSnapshot(),
    })
  }

  const setTextColor = (color: string) => {
    applyToolbarTextColor({
      color,
      editor,
      onApplyCollapsedTextColor,
      onDefaultTextColorChange,
      pendingFormattingController,
      scheduleEditorFocus,
      selectionController,
      snapshot,
      textColorSupported,
    })
  }

  const setBackgroundColor = (color: string) => {
    applyToolbarBackgroundColor({
      backgroundColorSupported,
      color,
      editor,
      pendingFormattingController,
      scheduleEditorFocus,
      selectionController,
    })
  }

  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-md backdrop-blur-sm',
        mode === 'full' &&
          'w-full overflow-x-auto rounded-none border-x-0 border-t-0 px-3 shadow-none',
        className,
      )}
      onPointerDown={(event) => {
        selectionController.captureSelection()
        if (eventStartedOnToolbarTrigger(event)) return
        preventEditorBlur(event)
      }}
    >
      {mode === 'full' && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Undo note edit"
            title="Undo note edit (Ctrl+Z)"
            disabled={!snapshot.canUndo}
            onClick={() => editor.undo()}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Redo note edit"
            title="Redo note edit (Ctrl+Shift+Z)"
            disabled={!snapshot.canRedo}
            onClick={() => editor.redo()}
          >
            <Redo2 className="size-4" />
          </Button>
          <Separator orientation="vertical" />
        </>
      )}
      <BlockTypeControl
        activeBlockTypeId={snapshot.activeBlockTypeId}
        blockTypeIcon={BlockTypeIcon}
        blockTypeLabel={blockTypeLabel}
        captureSelection={selectionController.captureSelection}
        onBlockTypeChange={handleBlockTypeChange}
        onOpenChange={blockTypeMenu.handleOpenChange}
        open={blockTypeMenu.open}
        supportedBlockTypes={snapshot.supportedBlockTypes}
      />

      <Separator orientation="vertical" />

      <ColorControls
        activeColor={
          pendingFormattingController.pendingStyleColors.textColor ?? snapshot.activeTextColor
        }
        disabled={!textColorSupported}
        kind="text"
        label="Text color"
        onColorChange={setTextColor}
      />

      <ColorControls
        activeColor={
          pendingFormattingController.pendingStyleColors.backgroundColor ??
          snapshot.activeBackgroundColor
        }
        disabled={!backgroundColorSupported}
        kind="background"
        label="Highlight color"
        onColorChange={setBackgroundColor}
      />

      <Separator orientation="vertical" />

      <InlineStyleControls
        editor={editor}
        onToggleInlineStyle={toggleInlineStyle}
        snapshot={{ ...snapshot, activeStyles: activeInlineStyles }}
      />

      <Separator orientation="vertical" />

      <TextAlignmentControls onTextAlignmentChange={setTextAlignment} snapshot={snapshot} />
    </div>
  )
}

function applyToolbarTextColor({
  color,
  editor,
  onApplyCollapsedTextColor,
  onDefaultTextColorChange,
  pendingFormattingController,
  scheduleEditorFocus,
  selectionController,
  snapshot,
  textColorSupported,
}: {
  color: string
  editor: RichTextFormattingEditor
  onApplyCollapsedTextColor: RichTextFormattingToolbarProps['onApplyCollapsedTextColor']
  onDefaultTextColorChange: RichTextFormattingToolbarProps['onDefaultTextColorChange']
  pendingFormattingController: PendingFormattingController
  scheduleEditorFocus: () => void
  selectionController: FormattingToolbarSelectionController
  snapshot: ToolbarSnapshot
  textColorSupported: boolean
}) {
  if (!textColorSupported) return

  const selectionSnapshot = selectionController.getCurrentSelectionSnapshot()

  if (!snapshot.hasTextSelection && onApplyCollapsedTextColor) {
    onApplyCollapsedTextColor(editor, color, selectionSnapshot)
    onDefaultTextColorChange?.(color)
    pendingFormattingController.markPendingStyleColor('textColor', color, selectionSnapshot)
    scheduleEditorFocus()
    return
  }

  applyFormattingToolbarStyleColor({
    color,
    editor,
    scheduleFocus: scheduleEditorFocus,
    selectionSnapshot,
    style: 'textColor',
  })
  pendingFormattingController.markPendingStyleColor('textColor', color, selectionSnapshot)
}

function useDeferredEditorFocus(editor: RichTextFormattingEditor) {
  const focusFrameRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (focusFrameRef.current !== null) {
        cancelAnimationFrame(focusFrameRef.current)
        focusFrameRef.current = null
      }
    },
    [editor],
  )

  return () => {
    if (focusFrameRef.current !== null) {
      cancelAnimationFrame(focusFrameRef.current)
    }

    const focusFrame = requestAnimationFrame(() => {
      if (focusFrameRef.current !== focusFrame) {
        return
      }
      focusFrameRef.current = null
      editor.focus()
    })
    focusFrameRef.current = focusFrame
  }
}

function applyToolbarBackgroundColor({
  backgroundColorSupported,
  color,
  editor,
  pendingFormattingController,
  scheduleEditorFocus,
  selectionController,
}: {
  backgroundColorSupported: boolean
  color: string
  editor: RichTextFormattingEditor
  pendingFormattingController: PendingFormattingController
  scheduleEditorFocus: () => void
  selectionController: FormattingToolbarSelectionController
}) {
  if (!backgroundColorSupported) return

  const selectionSnapshot = selectionController.getCurrentSelectionSnapshot()
  applyFormattingToolbarStyleColor({
    color,
    editor,
    scheduleFocus: scheduleEditorFocus,
    selectionSnapshot,
    style: 'backgroundColor',
  })
  pendingFormattingController.markPendingStyleColor('backgroundColor', color, selectionSnapshot)
}
