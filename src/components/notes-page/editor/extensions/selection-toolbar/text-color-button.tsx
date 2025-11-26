import {
  BlockNoteEditor,
  type BlockSchema,
  type InlineContentSchema,
  type StyleSchema,
} from '@blocknote/core'
import {
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useEditorContentOrSelectionChange,
  useSelectedBlocks,
} from '@blocknote/react'
import { useCallback, useMemo, useState } from 'react'
import { ColorIcon } from './color-picker/color-icon'
import { ColorPicker } from './color-picker/color-picker'

function checkTextColorInSchema(
  editor: BlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema>,
): editor is BlockNoteEditor<
  BlockSchema,
  InlineContentSchema,
  {
    textColor: {
      type: 'textColor'
      propSchema: 'string'
    }
  }
> {
  return (
    'textColor' in editor.schema.styleSchema &&
    editor.schema.styleSchema.textColor.type === 'textColor' &&
    editor.schema.styleSchema.textColor.propSchema === 'string'
  )
}

export const TextColorButton = () => {
  const Components = useComponentsContext()!
  const dict = useDictionary()
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >()

  const textColorInSchema = checkTextColorInSchema(editor)
  const selectedBlocks = useSelectedBlocks(editor)

  const [currentTextColor, setCurrentTextColor] = useState<string>(
    textColorInSchema
      ? editor.getActiveStyles().textColor || 'default'
      : 'default',
  )

  useEditorContentOrSelectionChange(() => {
    if (textColorInSchema) {
      setCurrentTextColor(editor.getActiveStyles().textColor || 'default')
    }
  }, editor)

  const setTextColor = useCallback(
    (color: string) => {
      if (!textColorInSchema) {
        throw Error(
          'Tried to set text color, but style does not exist in editor schema.',
        )
      }

      color === 'default'
        ? editor.removeStyles({ textColor: color })
        : editor.addStyles({ textColor: color })

      setTimeout(() => {
        // timeout needed to ensure compatibility with Mantine Toolbar useFocusTrap
        editor.focus()
      })
    },
    [editor, textColorInSchema],
  )

  const show = useMemo(() => {
    if (!textColorInSchema) {
      return false
    }

    for (const block of selectedBlocks) {
      if (block.content !== undefined) {
        return true
      }
    }

    return false
  }, [selectedBlocks, textColorInSchema])

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
