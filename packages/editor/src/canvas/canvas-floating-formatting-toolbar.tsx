import { RichTextFormattingToolbar } from '../rich-text/formatting-toolbar/formatting-toolbar'
import type { RichTextFormattingEditor } from '../rich-text/formatting-toolbar/formatting-toolbar-model'
import { applyCanvasTextDefaultTextColor } from './text/default-color'

const CANVAS_ZOOM = 'max(var(--canvas-zoom, 1), 0.0001)'
const TOOLBAR_OFFSET = '0.5rem'

export function CanvasFloatingFormattingToolbar({
  defaultTextColor,
  editor,
  onDefaultTextColorChange,
}: {
  defaultTextColor: string
  editor: RichTextFormattingEditor
  onDefaultTextColorChange: (color: string) => void
}) {
  return (
    <div
      className="absolute left-1/2 top-0 z-[31] nodrag nopan nowheel pointer-events-auto"
      style={{
        transform: `translate(-50%, calc((-100% - ${TOOLBAR_OFFSET}) / ${CANVAS_ZOOM}))`,
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div
        style={{
          transform: `scale(calc(1 / ${CANVAS_ZOOM}))`,
          transformOrigin: 'center top',
        }}
      >
        <RichTextFormattingToolbar
          ariaLabel="Canvas formatting toolbar"
          defaultTextColor={defaultTextColor}
          editor={editor}
          mode="compact"
          onApplyCollapsedTextColor={(currentEditor, color, selectionSnapshot) =>
            applyCanvasTextDefaultTextColor(
              currentEditor,
              defaultTextColor,
              color,
              selectionSnapshot,
            )
          }
          onDefaultTextColorChange={onDefaultTextColorChange}
          visible
        />
      </div>
    </div>
  )
}
