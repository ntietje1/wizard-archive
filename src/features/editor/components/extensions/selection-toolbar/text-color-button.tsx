import {
  useBlockNoteEditor,
  useComponentsContext,
  useEditorSelectionChange,
  useSelectedBlocks,
} from '@blocknote/react'
import { useState } from 'react'
import { ColorIcon } from './color-picker/color-icon'
import { ColorPicker } from './color-picker/color-picker'
import type {
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema,
} from 'convex/notes/editorSpecs'

export const TextColorButton = () => {
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor<
    CustomBlockSchema,
    CustomInlineContentSchema,
    CustomStyleSchema
  >()

  const selectedBlocks = useSelectedBlocks(editor)

  const [currentTextColor, setCurrentTextColor] = useState<string>(
    editor.getActiveStyles().textColor || 'default',
  )

  useEditorSelectionChange(() => {
    setCurrentTextColor(editor.getActiveStyles().textColor || 'default')
  }, editor)

  const setTextColor = (color: string) => {
    if (color === 'default') {
      editor.removeStyles({ textColor: undefined })
    } else {
      editor.addStyles({ textColor: color })
    }

    setTimeout(() => {
      // timeout needed to ensure compatibility with Mantine Toolbar useFocusTrap
      editor.focus()
    })
  }

  const show = selectedBlocks.length > 0

  if (!show || !editor.isEditable) {
    return null
  }

  return (
    <Components.Generic.Menu.Root>
      <Components.Generic.Menu.Trigger>
        <Components.FormattingToolbar.Button
          className={'bn-button'}
          data-test="text-colors"
          label={'Text color'}
          mainTooltip={'Text color'}
          icon={<ColorIcon textColor={currentTextColor} size={20} />}
        />
      </Components.Generic.Menu.Trigger>
      <Components.Generic.Menu.Dropdown
        className={'bn-menu-dropdown bn-color-picker-dropdown'}
      >
        <ColorPicker
          text={{
            color: currentTextColor,
            setColor: setTextColor,
          }}
        />
      </Components.Generic.Menu.Dropdown>
    </Components.Generic.Menu.Root>
  )
}
