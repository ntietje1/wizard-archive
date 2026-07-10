import { applyCanvasTextDefaultTextColor } from '../text/default-color'
import { restoreCanvasTextSelection } from '../text/blocknote-adapter'
import { textColorCanvasProperty } from './canvas-property-definitions'
import { bindCanvasPaintProperty } from './canvas-property-types'
import type { CanvasTextFormattingSnapshot } from '../text/formatting-session'
import type { CanvasInspectableProperties } from './canvas-property-types'

function createActiveCanvasTextColorBinding(
  activeFormattingSnapshot: CanvasTextFormattingSnapshot,
) {
  const applyTextColor = (color: string) => {
    if (activeFormattingSnapshot.hasTextSelection) {
      try {
        restoreCanvasTextSelection(
          activeFormattingSnapshot.editor,
          activeFormattingSnapshot.selectionSnapshot,
        )
        activeFormattingSnapshot.editor.addStyles({ textColor: color })
        activeFormattingSnapshot.editor.focus()
      } catch (error) {
        try {
          restoreCanvasTextSelection(
            activeFormattingSnapshot.editor,
            activeFormattingSnapshot.selectionSnapshot,
          )
        } catch (restoreError) {
          console.warn('Failed to restore canvas text selection after color error', restoreError)
        }
        console.error('Failed to apply canvas text color', error)
        throw error
      }
      return
    }

    try {
      applyCanvasTextDefaultTextColor(
        activeFormattingSnapshot.editor,
        activeFormattingSnapshot.defaultTextColor,
        color,
        activeFormattingSnapshot.selectionSnapshot,
      )
      activeFormattingSnapshot.setDefaultTextColor(color)
    } catch (error) {
      console.error('Failed to apply default canvas text color', error)
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
  })
}

export function withActiveCanvasTextColorBinding(
  properties: CanvasInspectableProperties,
  activeFormattingSnapshot: CanvasTextFormattingSnapshot,
): CanvasInspectableProperties {
  return {
    bindings: [
      createActiveCanvasTextColorBinding(activeFormattingSnapshot),
      ...properties.bindings.filter(
        (binding) => binding.definition.id !== textColorCanvasProperty.id,
      ),
    ],
  }
}
