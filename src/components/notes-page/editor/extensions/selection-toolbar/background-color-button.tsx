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
import { BackgroundColorIcon } from './color-picker/background-color-icon'
import { ColorPicker } from './color-picker/color-picker'

function checkBackgroundColorInSchema(
  editor: BlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema>,
): editor is BlockNoteEditor<
  BlockSchema,
  InlineContentSchema,
  {
    backgroundColor: {
      type: 'backgroundColor'
      propSchema: 'string'
    }
  }
> {
  return (
    'backgroundColor' in editor.schema.styleSchema &&
    editor.schema.styleSchema.backgroundColor.type === 'backgroundColor' &&
    editor.schema.styleSchema.backgroundColor.propSchema === 'string'
  )
}

export const BackgroundColorButton = () => {
  const Components = useComponentsContext()!
  const dict = useDictionary()
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >()

  const backgroundColorInSchema = checkBackgroundColorInSchema(editor)
  const selectedBlocks = useSelectedBlocks(editor)

  const [currentBackgroundColor, setCurrentBackgroundColor] = useState<string>(
    backgroundColorInSchema
      ? editor.getActiveStyles().backgroundColor || 'default'
      : 'default',
  )

  useEditorContentOrSelectionChange(() => {
    if (backgroundColorInSchema) {
      setCurrentBackgroundColor(
        editor.getActiveStyles().backgroundColor || 'default',
      )
    }
  }, editor)

  const setBackgroundColor = useCallback(
    (color: string) => {
      if (!backgroundColorInSchema) {
        throw Error(
          'Tried to set background color, but style does not exist in editor schema.',
        )
      }

      color === 'default'
        ? editor.removeStyles({ backgroundColor: color })
        : editor.addStyles({ backgroundColor: color })

      setTimeout(() => {
        // timeout needed to ensure compatibility with Mantine Toolbar useFocusTrap
        editor.focus()
      })
    },
    [backgroundColorInSchema, editor],
  )

  const show = useMemo(() => {
    if (!backgroundColorInSchema) {
      return false
    }

    for (const block of selectedBlocks) {
      if (block.content !== undefined) {
        return true
      }
    }

    return false
  }, [backgroundColorInSchema, selectedBlocks])

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
