import { applyCanvasRichTextDefaultTextColor } from '../nodes/shared/canvas-rich-text-default-color'
import { restoreCanvasRichTextSelection } from '../nodes/shared/canvas-rich-text-blocknote-adapter'
import { textColorCanvasProperty } from './canvas-property-definitions'
import { bindCanvasPaintProperty } from './canvas-property-types'
import { logger } from '~/shared/utils/logger'
import type { CanvasRichTextFormattingSnapshot } from '../nodes/shared/canvas-rich-text-formatting-session'
import type { CanvasInspectableProperties } from './canvas-property-types'

function createActiveRichTextColorBinding(
  activeFormattingSnapshot: CanvasRichTextFormattingSnapshot,
) {
  const applyTextColor = (color: string) => {
    if (activeFormattingSnapshot.hasTextSelection) {
      try {
        restoreCanvasRichTextSelection(
          activeFormattingSnapshot.editor,
          activeFormattingSnapshot.selectionSnapshot,
        )
        activeFormattingSnapshot.editor.addStyles({ textColor: color })
        activeFormattingSnapshot.editor.focus()
      } catch (error) {
        try {
          restoreCanvasRichTextSelection(
            activeFormattingSnapshot.editor,
            activeFormattingSnapshot.selectionSnapshot,
          )
        } catch (restoreError) {
          logger.warn(
            'Failed to restore canvas rich-text selection after color error',
            restoreError,
          )
        }
        logger.error('Failed to apply canvas rich-text color', error)
        throw error
      }
      return
    }

    try {
      applyCanvasRichTextDefaultTextColor(
        activeFormattingSnapshot.editor,
        activeFormattingSnapshot.defaultTextColor,
        color,
        activeFormattingSnapshot.selectionSnapshot,
      )
      activeFormattingSnapshot.setDefaultTextColor(color)
    } catch (error) {
      logger.error('Failed to apply default canvas rich-text color', error)
      throw error
    }
  }

  return bindCanvasPaintProperty(textColorCanvasProperty, {
    getPropertyValue: () => activeFormattingSnapshot.textColorValue,
    getColor: () =>
      activeFormattingSnapshot.textColorValue.kind === 'value'
        ? activeFormattingSnapshot.textColorValue.value.color
        : activeFormattingSnapshot.defaultTextColor,
    setValue: ({ color }) => applyTextColor(color),
    setColor: applyTextColor,
    getOpacity: () => 100,
    setOpacity: () => undefined,
  })
}

export function withActiveRichTextColorBinding(
  properties: CanvasInspectableProperties,
  activeFormattingSnapshot: CanvasRichTextFormattingSnapshot,
): CanvasInspectableProperties {
  return {
    bindings: [
      createActiveRichTextColorBinding(activeFormattingSnapshot),
      ...properties.bindings.filter(
        (binding) => binding.definition.id !== textColorCanvasProperty.id,
      ),
    ],
  }
}
