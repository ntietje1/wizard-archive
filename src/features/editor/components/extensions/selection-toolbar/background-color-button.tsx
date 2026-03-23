import {
  useBlockNoteEditor,
  useComponentsContext,
  useEditorSelectionChange,
  useSelectedBlocks,
} from '@blocknote/react'
import { useCallback, useMemo, useState } from 'react'
import { BackgroundColorIcon } from './color-picker/background-color-icon'
import { ColorPicker } from './color-picker/color-picker'
import type {
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema,
} from 'convex/notes/editorSpecs'

export const BackgroundColorButton = () => {
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor<
    CustomBlockSchema,
    CustomInlineContentSchema,
    CustomStyleSchema
  >()

  const selectedBlocks = useSelectedBlocks(editor)

  const [currentBackgroundColor, setCurrentBackgroundColor] = useState<string>(
    editor.getActiveStyles().backgroundColor || 'default',
  )

  useEditorSelectionChange(() => {
    setCurrentBackgroundColor(
      editor.getActiveStyles().backgroundColor || 'default',
    )
  }, editor)

  const setBackgroundColor = useCallback(
    (color: string) => {
      if (color === 'default') {
        editor.removeStyles({ backgroundColor: 'default' })
      } else {
        editor.addStyles({ backgroundColor: color })
      }

      setTimeout(() => {
        // timeout needed to ensure compatibility with Mantine Toolbar useFocusTrap
        editor.focus()
      })
    },
    [editor],
  )

  const show = useMemo(() => {
    return selectedBlocks.length > 0
  }, [selectedBlocks])

  if (!show || !editor.isEditable) {
    return null
  }

  return (
    <Components.Generic.Menu.Root>
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          className={'bn-button'}
          data-test="background-colors"
          label={'Highlight Color'}
          mainTooltip={'Highlight Color'}
          icon={
            <BackgroundColorIcon
              backgroundColor={currentBackgroundColor}
              size={20}
            />
          }
        />
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown
        className={'bn-menu-dropdown bn-color-picker-dropdown'}
      >
        <ColorPicker
          background={{
            color: currentBackgroundColor,
            setColor: setBackgroundColor,
          }}
        />
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  )
}
