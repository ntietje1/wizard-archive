import { applyCanvasRichTextDefaultTextColor } from './canvas-rich-text-default-color'
import { EditorFormattingToolbar } from '~/features/editor/components/formatting-toolbar/formatting-toolbar'
import { textColorCanvasProperty } from '../../properties/canvas-property-definitions'
import type { FormattingEditor } from '~/features/editor/components/formatting-toolbar/formatting-toolbar-model'

interface CanvasFloatingFormattingToolbarProps {
  defaultTextColor?: string
  editor: FormattingEditor | null
  onDefaultTextColorChange?: (color: string) => void
  visible: boolean
}

const FLOATING_FORMATTING_TOOLBAR_Z_INDEX = 60
const CANVAS_ZOOM_INVERSE_STYLE_FACTOR = 'max(var(--canvas-zoom, 1), 0.0001)'
const FLOATING_FORMATTING_TOOLBAR_TOP_OFFSET = '0.5rem'

export function CanvasFloatingFormattingToolbar({
  defaultTextColor = textColorCanvasProperty.defaultValue.color,
  editor,
  onDefaultTextColorChange,
  visible,
}: CanvasFloatingFormattingToolbarProps) {
  return (
    <div
      className="absolute left-1/2 top-0 pointer-events-auto nodrag nopan nowheel"
      style={{
        transform: `translate(-50%, calc((-100% - ${FLOATING_FORMATTING_TOOLBAR_TOP_OFFSET}) / ${CANVAS_ZOOM_INVERSE_STYLE_FACTOR}))`,
        zIndex: FLOATING_FORMATTING_TOOLBAR_Z_INDEX,
      }}
    >
      <div
        style={{
          transform: `scale(calc(1 / ${CANVAS_ZOOM_INVERSE_STYLE_FACTOR}))`,
          transformOrigin: 'center top',
        }}
      >
        <EditorFormattingToolbar
          defaultTextColor={defaultTextColor}
          editor={editor}
          mode="compact"
          onApplyCollapsedTextColor={(currentEditor, color, selectionSnapshot) => {
            applyCanvasRichTextDefaultTextColor(
              currentEditor,
              defaultTextColor,
              color,
              selectionSnapshot,
            )
          }}
          onDefaultTextColorChange={onDefaultTextColorChange}
          visible={visible}
        />
      </div>
    </div>
  )
}
