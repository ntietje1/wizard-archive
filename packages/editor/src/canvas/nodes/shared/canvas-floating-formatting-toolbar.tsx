import { applyCanvasTextDefaultTextColor } from '../../text/default-color'
import { RichTextFormattingToolbar } from '../../../rich-text/formatting-toolbar/formatting-toolbar'
import { textColorCanvasProperty } from '../../properties/canvas-property-definitions'
import { CANVAS_SELECTION_OVERLAY_Z_INDEX } from '../../components/canvas-screen-space-overlay-utils'
import type { RichTextFormattingEditor } from '../../../rich-text/formatting-toolbar/formatting-toolbar-model'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

interface CanvasFloatingFormattingToolbarProps {
  defaultTextColor?: string
  editor: RichTextFormattingEditor | null
  onDefaultTextColorChange?: (color: string) => void
  visible: boolean
}

const FLOATING_FORMATTING_TOOLBAR_Z_INDEX = CANVAS_SELECTION_OVERLAY_Z_INDEX + 1
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
      className={cn(
        'absolute left-1/2 top-0 nodrag nopan nowheel',
        visible ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      style={{
        // Translate in zoomed canvas space, then inverse-scale the toolbar so it keeps screen size.
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
        <RichTextFormattingToolbar
          ariaLabel="Canvas formatting toolbar"
          defaultTextColor={defaultTextColor}
          editor={editor}
          mode="compact"
          onApplyCollapsedTextColor={(currentEditor, color, selectionSnapshot) => {
            applyCanvasTextDefaultTextColor(
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
